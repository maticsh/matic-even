/**
 * The relay's HTTP server: GET /health, GET /v1/fetch?url=..., and CORS preflight. It answers every
 * route with open CORS, because the Even app's WebView has no fixed origin to name.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import { createCache, type Entry } from './cache.ts'
import type { Config } from './config.ts'
import { createFetcher } from './fetch.ts'
import { allowList, checkUrl, guardedLookup, isBlocked, PORTS, Refused, type Policy, type Resolve } from './guard.ts'
import { createLimiter } from './limit.ts'

/** What tests swap out. A deployed relay uses every default. */
export type Seams = {
  /** DNS. Defaults to the system resolver. */
  resolve?: Resolve
  /** The address check. Tests let their own fake upstream on 127.0.0.1 through. */
  isBlocked?: (ip: string) => boolean
  /** Upstream ports. Tests add their fake upstream's port. */
  ports?: readonly number[]
  now?: () => number
}

export const systemResolve: Resolve = host => lookup(host, { all: true, verbatim: true })

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-relay-cache' }
const PREFLIGHT = {
  ...CORS,
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'x-relay-key, if-none-match, if-modified-since',
  'access-control-max-age': '86400',
}

const sha = (s: string) => createHash('sha256').update(s).digest()

function json(res: ServerResponse, status: number, body: object, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body)
  res.writeHead(status, { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
  res.end(text)
}

export function createRelay(config: Config, seams: Seams = {}): http.Server {
  const now = seams.now ?? Date.now
  const blocked = seams.isBlocked ?? isBlocked
  const policy: Policy = { allowed: allowList(config.allow), isBlocked: blocked, ports: seams.ports ?? PORTS }
  const fetcher = createFetcher({
    ...policy,
    lookup: guardedLookup(seams.resolve ?? systemResolve, blocked),
    maxBytes: config.maxBytes,
    timeoutMs: config.timeoutMs,
    maxRedirects: config.maxRedirects,
  })
  const cache = createCache({ ttlMs: config.cacheTtlMs, maxBytes: config.cacheBytes, now })
  const limiter = createLimiter({ perMinute: config.ratePerMinute, now })
  const key = config.key ? sha(config.key) : null

  /** Behind a proxy every request comes from the proxy, so the client is the last X-Forwarded-For entry. */
  function clientOf(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for']
    if (config.trustProxy && typeof forwarded === 'string') return forwarded.split(',').at(-1)!.trim()
    return req.socket.remoteAddress ?? 'unknown'
  }

  function keyOk(req: IncomingMessage): boolean {
    const sent = req.headers['x-relay-key']
    return !key || (typeof sent === 'string' && timingSafeEqual(sha(sent), key))
  }

  function send(req: IncomingMessage, res: ServerResponse, e: Omit<Entry, 'at' | 'status'>, cacheState: string) {
    const headers: Record<string, string> = {
      ...CORS,
      'content-type': e.contentType,
      'cache-control': `max-age=${Math.floor(config.cacheTtlMs / 1000)}`,
      'x-relay-cache': cacheState,
      // The body is someone else's page, served from this origin. Never run it here.
      'x-content-type-options': 'nosniff',
      'content-security-policy': 'sandbox',
    }
    if (e.contentEncoding) headers['content-encoding'] = e.contentEncoding
    if (e.etag) headers.etag = e.etag
    if (e.lastModified) headers['last-modified'] = e.lastModified
    if (e.etag && req.headers['if-none-match'] === e.etag) {
      res.writeHead(304, headers)
      return res.end()
    }
    res.writeHead(200, { ...headers, 'content-length': String(e.body.length) })
    res.end(e.body)
  }

  async function relay(req: IncomingMessage, res: ServerResponse, target: string | null) {
    const wait = limiter.take(clientOf(req))
    if (wait) return json(res, 429, { error: 'too many requests' }, { 'retry-after': String(wait) })
    if (!keyOk(req)) return json(res, 401, { error: 'x-relay-key is missing or wrong' })
    if (!target) return json(res, 400, { error: 'url is required' })
    try {
      const url = checkUrl(target, policy).href
      const cached = cache.get(url)
      if (cached && cache.isFresh(cached)) return send(req, res, cached, 'hit')
      const up = await fetcher.fetch(url, cached ?? {})
      if (up.status === 304 && cached) {
        cache.touch(url)
        return send(req, res, cached, 'revalidated')
      }
      cache.set(url, up)
      send(req, res, up, 'miss')
    } catch (e) {
      if (!(e instanceof Refused)) throw e
      json(res, e.status, { error: e.message })
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://relay.invalid')
    const route = url.pathname === '/health' || url.pathname === '/v1/fetch' ? url.pathname : null
    if (req.method === 'OPTIONS') {
      res.writeHead(204, PREFLIGHT)
      return res.end()
    }
    if (!route) return json(res, 404, { error: 'not found' })
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' }, { allow: 'GET, OPTIONS' })
    if (route === '/health') return json(res, 200, { ok: true })
    await relay(req, res, url.searchParams.get('url'))
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(e => {
      console.error('[relay]', e)
      if (res.headersSent) res.destroy()
      else json(res, 500, { error: 'internal error' })
    })
  })
  server.on('close', () => fetcher.close())
  return server
}
