/**
 * A fake upstream on 127.0.0.1, a fake DNS, and a relay pointed at both. Nothing here reaches the real
 * network: the fake DNS knows only `.test` names, and the relay lets only the fake upstream's address
 * through its address check.
 */
import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { DEFAULTS, type Config } from '../src/config.ts'
import { isBlocked, type Address, type Resolve } from '../src/guard.ts'
import { createRelay, type Seams } from '../src/server.ts'

const v4 = (address: string): Address[] => [{ address, family: 4 }]
const v6 = (address: string): Address[] => [{ address, family: 6 }]

/** Names to addresses. The `.feeds.test` names point at the fake upstream; the rest at refused ranges. */
export const DNS: Record<string, Address[]> = {
  'feeds.test': v4('127.0.0.1'),
  'a.feeds.test': v4('127.0.0.1'),
  'deep.a.feeds.test': v4('127.0.0.1'),
  'other.test': v4('127.0.0.1'),
  'zero.test': v4('0.0.0.1'),
  'loopback.test': v4('127.0.0.2'),
  'ten.test': v4('10.20.30.40'),
  'lan172.test': v4('172.20.0.5'),
  'lan.test': v4('192.168.1.20'),
  'linklocal.test': v4('169.254.10.10'),
  'metadata.test': v4('169.254.169.254'),
  'cgnat.test': v4('100.64.0.1'),
  'vpn.test': v4('100.100.100.100'),
  'multicast.test': v4('224.0.0.251'),
  'broadcast.test': v4('255.255.255.255'),
  'loop6.test': v6('::1'),
  'unspecified6.test': v6('::'),
  'ula.test': v6('fd12:3456:789a::1'),
  'linklocal6.test': v6('fe80::1'),
  'mapped6.test': v6('::ffff:127.0.0.1'),
  'mapped-meta6.test': v6('::ffff:169.254.169.254'),
  'nat64.test': v6('64:ff9b::10.0.0.1'),
  'sixtofour.test': v6('2002:c0a8:0101::1'),
  /** One public address and one private one: refused, so a name cannot mix them. */
  'mixed.test': [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.1', family: 4 }],
}

export const PRIVATE_NAMES = Object.keys(DNS).filter(n => !n.endsWith('feeds.test') && n !== 'other.test')

/** A fake DNS that counts its lookups. Unknown names fail as they would for real. */
export function fakeDns(): { resolve: Resolve; lookups: string[] } {
  const lookups: string[] = []
  const resolve: Resolve = async host => {
    lookups.push(host)
    const found = DNS[host]
    if (!found) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: 'ENOTFOUND' })
    return found
  }
  return { resolve, lookups }
}

export type Hit = { path: string; headers: IncomingHttpHeaders }
type Handler = (req: IncomingMessage, res: ServerResponse) => void

async function listen(server: http.Server): Promise<number> {
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  return (server.address() as AddressInfo).port
}

/** The fake upstream. `routes` maps a path to a handler; every request is logged in `hits`. */
export async function upstream(routes: Record<string, Handler>) {
  const hits: Hit[] = []
  const server = http.createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x.invalid').pathname
    hits.push({ path, headers: req.headers })
    const route = routes[path]
    if (route) return route(req, res)
    res.writeHead(404, { 'content-type': 'text/plain' }).end('no such path')
  })
  const port = await listen(server)
  return {
    port,
    hits,
    /** A URL on the fake upstream, by one of its `.test` names. */
    at: (path: string, host = 'feeds.test') => `http://${host}:${port}${path}`,
    close: () => { server.closeAllConnections(); return new Promise(r => server.close(r)) },
  }
}

/**
 * A relay on a random port. By default it allows the `.feeds.test` names, reaches the fake upstream's
 * port, and treats 127.0.0.1 (the fake upstream) as public. Every other address check is the real one.
 */
export async function relay(config: Partial<Config> = {}, seams: Seams & { upstreamPort?: number } = {}) {
  const dns = fakeDns()
  const { upstreamPort, ...rest } = seams
  const server = createRelay(
    { ...DEFAULTS, allow: ['feeds.test', '*.feeds.test'], ...config },
    {
      resolve: dns.resolve,
      isBlocked: ip => ip !== '127.0.0.1' && isBlocked(ip),
      ports: upstreamPort ? [80, 443, upstreamPort] : undefined,
      ...rest,
    },
  )
  const port = await listen(server)
  const base = `http://127.0.0.1:${port}`
  return {
    base,
    lookups: dns.lookups,
    /** GET /v1/fetch for a target URL. */
    get: (target: string, headers: Record<string, string> = {}) =>
      fetch(`${base}/v1/fetch?url=${encodeURIComponent(target)}`, { headers }),
    close: () => { server.closeAllConnections(); return new Promise(r => server.close(r)) },
  }
}

/** A JSON error body's message. */
export const errorOf = async (res: Response): Promise<string> => ((await res.json()) as { error: string }).error
