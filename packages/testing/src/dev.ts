/**
 * The dev server's address, for an app's `vite.config.ts` and for the `maticsh-qr` bin. Node only.
 *
 * After a QR sideload the phone loads the app from this machine, so the QR code and the hot-reload
 * socket need an address the phone can reach. No address is hard-coded: set DEV_HOST, or this
 * machine's LAN address is used.
 */
import { networkInterfaces } from 'node:os'

/** The dev server's port: DEV_PORT when it is set, else the app's own default. */
export function devPort(fallback: number): number {
  const n = Number(process.env.DEV_PORT)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/**
 * The address the phone uses to reach this machine. DEV_HOST wins when it is set. Else this
 * machine's LAN address (a private IPv4 address first), else localhost.
 */
export function devHost(): string {
  const set = process.env.DEV_HOST?.trim()
  if (set) return set
  const v4 = Object.values(networkInterfaces()).flat()
    .filter(a => a !== undefined && a.family === 'IPv4' && !a.internal)
    .map(a => a!.address)
  return v4.find(isLanAddress) ?? v4[0] ?? 'localhost'
}

/** RFC 1918 home and office networks. */
function isLanAddress(addr: string): boolean {
  return /^10\./.test(addr) || /^192\.168\./.test(addr) || /^172\.(1[6-9]|2\d|3[01])\./.test(addr)
}

/**
 * True for loopback, LAN, carrier-grade NAT (100.64.0.0/10, which VPN overlays use), link-local and
 * IPv6 unique-local addresses. Dev-only endpoints (the probe's log) accept requests only from these.
 */
export function isPrivateAddress(raw: string): boolean {
  const addr = raw.replace(/^::ffff:/, '')
  if (addr === '::1' || /^127\./.test(addr) || /^169\.254\./.test(addr)) return true
  if (isLanAddress(addr)) return true
  const cgnat = /^100\.(\d+)\./.exec(addr)
  if (cgnat && Number(cgnat[1]) >= 64 && Number(cgnat[1]) <= 127) return true
  return /^f[cd][0-9a-f]{2}:/i.test(addr) || /^fe80:/i.test(addr)
}
