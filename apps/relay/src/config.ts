/**
 * The relay's settings, read from environment variables. A bad value stops the relay at boot, so a typo
 * never runs as a silent default.
 */
export type Config = {
  port: number
  /** Undefined listens on every interface. */
  host: string | undefined
  /** RELAY_ALLOW entries. Empty refuses every upstream. */
  allow: string[]
  key: string | null
  maxBytes: number
  timeoutMs: number
  maxRedirects: number
  ratePerMinute: number
  cacheTtlMs: number
  cacheBytes: number
  trustProxy: boolean
}

export const DEFAULTS: Config = {
  port: 8787,
  host: undefined,
  allow: [],
  key: null,
  maxBytes: 2 * 1024 * 1024,
  timeoutMs: 8000,
  maxRedirects: 3,
  ratePerMinute: 60,
  cacheTtlMs: 60_000,
  cacheBytes: 32 * 1024 * 1024,
  trustProxy: false,
}

type Env = Record<string, string | undefined>

function int(env: Env, name: string, fallback: number): number {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a whole number of 0 or more, not "${raw}"`)
  return n
}

export function readConfig(env: Env): Config {
  const set = (name: string) => env[name]?.trim() || null
  return {
    port: int(env, 'PORT', DEFAULTS.port),
    host: set('HOST') ?? undefined,
    allow: (env.RELAY_ALLOW ?? '').split(',').map(s => s.trim()).filter(Boolean),
    key: set('RELAY_KEY'),
    maxBytes: int(env, 'RELAY_MAX_BYTES', DEFAULTS.maxBytes),
    timeoutMs: int(env, 'RELAY_TIMEOUT_MS', DEFAULTS.timeoutMs),
    maxRedirects: int(env, 'RELAY_MAX_REDIRECTS', DEFAULTS.maxRedirects),
    ratePerMinute: int(env, 'RELAY_RATE', DEFAULTS.ratePerMinute),
    cacheTtlMs: int(env, 'RELAY_CACHE_TTL', DEFAULTS.cacheTtlMs / 1000) * 1000,
    cacheBytes: int(env, 'RELAY_CACHE_MB', DEFAULTS.cacheBytes / 1024 / 1024) * 1024 * 1024,
    trustProxy: set('RELAY_TRUST_PROXY') === '1',
  }
}
