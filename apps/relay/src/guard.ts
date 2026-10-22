/**
 * What the relay may fetch: the URL's scheme, port and host, and the address the host resolves to.
 * The address check runs inside the socket's DNS lookup, so the address that is checked is the address
 * that is dialled. A name that resolves to a public address for the check and a private one for the
 * connect (DNS rebinding) cannot get past.
 */
import { BlockList, isIP, type LookupFunction } from 'node:net'

/** One resolved address, as `dns.lookup` with `all: true` returns it. */
export type Address = { address: string; family: number }
/** Name to addresses. The relay uses the system resolver; tests pass their own. */
export type Resolve = (host: string) => Promise<Address[]>

/** A refusal, with the HTTP status the relay answers with. */
export class Refused extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const PORTS: readonly number[] = [80, 443]

// Addresses

const v4 = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC 1918
  ['100.64.0.0', 10], // carrier-grade NAT, and many VPNs
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata at 169.254.169.254
  ['172.16.0.0', 12], // RFC 1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // RFC 1918
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and broadcast
] as const) v4.addSubnet(net, bits, 'ipv4')

const v6 = new BlockList()
for (const [net, bits] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local (ULA)
  ['fe80::', 10], // link-local
  ['fec0::', 10], // old site-local
  ['ff00::', 8], // multicast
] as const) v6.addSubnet(net, bits, 'ipv6')

/** An IPv6 address as eight 16-bit groups. Call it only on an address `isIP` has passed as IPv6. */
function groups(ip: string): number[] {
  let s = ip
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s)
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number) as [number, number, number, number]
    s = `${s.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, rest] = s.split('::').map(h => (h ? h.split(':').map(g => parseInt(g, 16)) : []))
  if (!rest) return head!
  return [...head!, ...new Array<number>(8 - head!.length - rest.length).fill(0), ...rest]
}

const dotted = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`

/**
 * The IPv4 address inside an IPv6 one, for the forms that reach an IPv4 host: mapped (::ffff:a.b.c.d),
 * NAT64 (64:ff9b::a.b.c.d) and 6to4 (2002:aabb:ccdd::).
 */
function embeddedV4(g: number[]): string | null {
  if (g.slice(0, 5).every(x => x === 0) && g[5] === 0xffff) return dotted(g[6]!, g[7]!)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) return dotted(g[6]!, g[7]!)
  if (g[0] === 0x2002) return dotted(g[1]!, g[2]!)
  return null
}

/** True for an address the relay must never connect to. Anything that is not an IP address counts too. */
export function isBlocked(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  const kind = isIP(bare)
  if (kind === 4) return v4.check(bare, 'ipv4')
  if (kind !== 6) return true
  const inner = embeddedV4(groups(bare.toLowerCase()))
  if (inner) return v4.check(inner, 'ipv4')
  return v6.check(bare, 'ipv6')
}

// Hosts

/** A host as the relay compares it: lower case, no trailing dot, no IPv6 brackets. */
export const normalHost = (host: string): string => host.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '')

/**
 * The upstream allowlist from RELAY_ALLOW: `example.com`, `*.example.com` (any name under it, not the name
 * itself) or `*` (any public host). An empty list allows nothing.
 */
export function allowList(entries: readonly string[]): (host: string) => boolean {
  const list = entries.map(e => normalHost(e.trim())).filter(Boolean)
  for (const e of list) {
    if (e !== '*' && !/^(\*\.)?[a-z0-9.:-]+$/.test(e)) throw new Error(`RELAY_ALLOW takes host names, not "${e}"`)
  }
  if (list.includes('*')) return () => true
  return host => {
    const h = normalHost(host)
    return list.some(e => (e.startsWith('*.') ? h.endsWith(e.slice(1)) && h.length > e.length - 1 : h === e))
  }
}

// URLs

export type Policy = {
  allowed: (host: string) => boolean
  isBlocked?: (ip: string) => boolean
  ports?: readonly number[]
}

/**
 * Parse and check one URL, the first one or a redirect target. It refuses other schemes, other ports,
 * user names in the URL, hosts off the allowlist, and IP literals in a refused range. A host name is
 * checked again when the socket resolves it.
 */
export function checkUrl(raw: string, policy: Policy, base?: URL): URL {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    throw new Refused(400, 'url must be an absolute http or https URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Refused(400, `scheme ${url.protocol} is not allowed`)
  if (url.username || url.password) throw new Refused(400, 'url must not carry a user name or password')
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  if (!(policy.ports ?? PORTS).includes(port)) throw new Refused(400, `port ${port} is not allowed`)
  const host = normalHost(url.hostname)
  if (!policy.allowed(host)) throw new Refused(403, `host ${host} is not on the allowlist`)
  if (isIP(host) && (policy.isBlocked ?? isBlocked)(host)) throw new Refused(403, 'address is private or reserved')
  return url
}

// The lookup

type Callback = Parameters<LookupFunction>[2]

/**
 * A `lookup` for an http.Agent: resolve the name, refuse it when any of its addresses is in a refused
 * range, else hand the addresses to the socket. Refusing on any bad address, not only the first, means
 * a name cannot mix a public address with a private one.
 */
export function guardedLookup(resolve: Resolve, blocked: (ip: string) => boolean = isBlocked): LookupFunction {
  return (host, options, callback: Callback) => {
    resolve(host).then(
      all => {
        const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : options.family
        const addresses = family ? all.filter(a => a.family === family) : all
        if (!addresses.length) return callback(Object.assign(new Error(`no address for ${host}`), { code: 'ENOTFOUND' }), '', 0)
        if (addresses.some(a => blocked(a.address))) {
          return callback(Object.assign(new Refused(403, 'address is private or reserved'), { code: 'EREFUSED_PRIVATE' }), '', 0)
        }
        if (options.all) return callback(null, addresses)
        callback(null, addresses[0]!.address, addresses[0]!.family)
      },
      (error: NodeJS.ErrnoException) => callback(error, '', 0),
    )
  }
}
