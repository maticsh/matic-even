/**
 * A small in-memory cache of upstream answers, by URL. An entry is fresh for `ttlMs`. After that the relay
 * keeps it, and asks upstream with its ETag and Last-Modified, so an unchanged page costs a 304.
 * The oldest entries go first once the cache holds more than `maxBytes` of bodies.
 */
export type Entry = {
  status: number
  contentType: string
  contentEncoding: string | null
  etag: string | null
  lastModified: string | null
  body: Buffer
  /** When the entry was stored or last confirmed by upstream. */
  at: number
}

export type Cache = ReturnType<typeof createCache>

export function createCache({ ttlMs, maxBytes, now = Date.now }: { ttlMs: number; maxBytes: number; now?: () => number }) {
  const entries = new Map<string, Entry>()
  let bytes = 0

  function drop(key: string) {
    const e = entries.get(key)
    if (!e) return
    bytes -= e.body.length
    entries.delete(key)
  }

  return {
    /** The entry for a URL, fresh or stale, or undefined. */
    get(key: string): Entry | undefined {
      return entries.get(key)
    },
    isFresh: (e: Entry): boolean => now() - e.at < ttlMs,
    set(key: string, entry: Omit<Entry, 'at'>) {
      if (ttlMs <= 0 || entry.body.length > maxBytes) return
      drop(key)
      entries.set(key, { ...entry, at: now() })
      bytes += entry.body.length
      // A Map keeps insertion order, so the first key is the oldest.
      for (const oldest of entries.keys()) {
        if (bytes <= maxBytes) break
        drop(oldest)
      }
    },
    /** Upstream answered 304: the entry is fresh again. */
    touch(key: string) {
      const e = entries.get(key)
      if (!e) return
      entries.delete(key)
      entries.set(key, { ...e, at: now() })
    },
    get size() { return entries.size },
    get bytes() { return bytes },
  }
}
