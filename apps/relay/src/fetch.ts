/**
 * One upstream fetch: check the URL, follow redirects (each hop checked again), and read a text body
 * under a size cap. One deadline covers every hop and the body. The agents carry the guarded lookup,
 * so every socket they open is checked at connect time.
 */
import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'
import type { LookupFunction } from 'node:net'
import { checkUrl, Refused, type Policy } from './guard.ts'

export type FetchOptions = Policy & {
  lookup: LookupFunction
  maxBytes: number
  timeoutMs: number
  maxRedirects: number
}

/** Validators from a cached copy. With either one, upstream may answer 304. */
export type Conditional = { etag?: string | null; lastModified?: string | null }

export type Upstream = {
  /** 200, or 304 when the cached copy is still current. */
  status: 200 | 304
  contentType: string
  contentEncoding: string | null
  etag: string | null
  lastModified: string | null
  body: Buffer
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])
const ACCEPT = 'application/json, application/feed+json, application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, text/plain;q=0.9'
/** Change it to name your app, so upstream owners can tell who is calling. */
const USER_AGENT = 'relay/0.1'

/** JSON, XML (RSS and Atom too, and any +json or +xml type), HTML and plain text. */
const TEXT_TYPE = /^(application\/(json|xml|[\w.-]+\+(json|xml))|text\/(xml|html|plain))$/
export const isTextType = (contentType: string): boolean => TEXT_TYPE.test(contentType.split(';')[0]!.trim().toLowerCase())

const header = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v) ?? null

export type Fetcher = ReturnType<typeof createFetcher>

export function createFetcher(opts: FetchOptions) {
  const agents = {
    'http:': new http.Agent({ keepAlive: true, lookup: opts.lookup }),
    'https:': new https.Agent({ keepAlive: true, lookup: opts.lookup }),
  }

  function request(url: URL, cond: Conditional, signal: AbortSignal): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = { accept: ACCEPT, 'accept-encoding': 'identity', 'user-agent': USER_AGENT }
      if (cond.etag) headers['if-none-match'] = cond.etag
      if (cond.lastModified) headers['if-modified-since'] = cond.lastModified
      const lib = url.protocol === 'https:' ? https : http
      const req = lib.request(url, { agent: agents[url.protocol as 'http:' | 'https:'], headers, signal }, resolve)
      req.on('error', reject)
      req.end()
    })
  }

  function read(res: IncomingMessage, cond: Conditional): Promise<Upstream> {
    const status = res.statusCode ?? 0
    const meta = {
      contentType: header(res.headers['content-type']) ?? '',
      contentEncoding: header(res.headers['content-encoding']),
      etag: header(res.headers.etag),
      lastModified: header(res.headers['last-modified']),
    }
    if (status === 304 && (cond.etag || cond.lastModified)) {
      res.resume()
      return Promise.resolve({ status: 304, ...meta, body: Buffer.alloc(0) })
    }
    if (status < 200 || status > 299) {
      res.resume()
      return Promise.reject(new Refused(502, `upstream answered ${status}`))
    }
    if (!isTextType(meta.contentType)) {
      res.destroy()
      return Promise.reject(new Refused(415, `content type "${meta.contentType || 'none'}" is not allowed`))
    }
    const tooBig = () => new Refused(502, `upstream body is over ${opts.maxBytes} bytes`)
    if (Number(res.headers['content-length']) > opts.maxBytes) {
      res.destroy()
      return Promise.reject(tooBig())
    }
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > opts.maxBytes) {
          reject(tooBig())
          res.destroy()
        } else chunks.push(chunk)
      })
      res.on('end', () => resolve({ status: 200, ...meta, body: Buffer.concat(chunks) }))
      res.on('error', reject)
      res.on('close', () => { if (!res.complete) reject(new Error('upstream closed early')) })
    })
  }

  /** Fetch a URL. Throws `Refused` with the status the relay should answer with. */
  async function fetch(raw: string, cond: Conditional = {}): Promise<Upstream> {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), opts.timeoutMs)
    try {
      let url = checkUrl(raw, opts)
      const seen = new Set([url.href])
      for (let hop = 0; ; hop++) {
        const res = await request(url, cond, abort.signal)
        const location = header(res.headers.location)
        if (!REDIRECTS.has(res.statusCode ?? 0) || !location) return await read(res, cond)
        res.resume()
        if (hop >= opts.maxRedirects) throw new Refused(502, `more than ${opts.maxRedirects} redirects`)
        try {
          url = checkUrl(location, opts, url)
        } catch (e) {
          throw e instanceof Refused ? new Refused(e.status, `redirect refused: ${e.message}`) : e
        }
        if (seen.has(url.href)) throw new Refused(502, 'redirect loop')
        seen.add(url.href)
      }
    } catch (e) {
      if (abort.signal.aborted) throw new Refused(504, `upstream took longer than ${opts.timeoutMs} ms`)
      if (e instanceof Refused) throw e
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') throw new Refused(502, 'could not resolve the host')
      throw new Refused(502, 'upstream connection failed')
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    fetch,
    /** Close the agents' idle sockets. */
    close() {
      agents['http:'].destroy()
      agents['https:'].destroy()
    },
  }
}
