/**
 * Requests per client per minute, as a token bucket: each client holds up to `perMinute` tokens, a
 * request spends one, and tokens come back evenly over the minute, so a client can burst up to the limit.
 */
export type Limiter = ReturnType<typeof createLimiter>

export function createLimiter({ perMinute, now = Date.now }: { perMinute: number; now?: () => number }) {
  const buckets = new Map<string, { tokens: number; at: number }>()
  /** Tokens earned since `at`. Multiply first, so whole steps come out whole. */
  const earned = (ms: number) => (ms * perMinute) / 60_000

  /** Forget clients whose bucket has filled up again. Runs when the map grows, so it stays small. */
  function prune(t: number) {
    for (const [k, b] of buckets) if (b.tokens + earned(t - b.at) >= perMinute) buckets.delete(k)
  }

  return {
    /** Spend one token for this client. Returns 0 when allowed, else the seconds to wait. */
    take(client: string): number {
      if (perMinute <= 0) return 0
      const t = now()
      if (buckets.size > 10_000) prune(t)
      const b = buckets.get(client) ?? { tokens: perMinute, at: t }
      b.tokens = Math.min(perMinute, b.tokens + earned(t - b.at))
      b.at = t
      buckets.set(client, b)
      if (b.tokens >= 1) {
        b.tokens -= 1
        return 0
      }
      return Math.max(1, Math.ceil(((1 - b.tokens) * 60) / perMinute))
    },
    get clients() { return buckets.size },
  }
}
