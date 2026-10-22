import { describe, expect, it } from 'vitest'
import { createCache } from '../src/cache.ts'
import { DEFAULTS, readConfig } from '../src/config.ts'
import { isTextType } from '../src/fetch.ts'
import { createLimiter } from '../src/limit.ts'

describe('the rate limit', () => {
  it('allows a burst up to the limit, then asks the client to wait', () => {
    let t = 0
    const limit = createLimiter({ perMinute: 3, now: () => t })
    expect([limit.take('a'), limit.take('a'), limit.take('a')]).toEqual([0, 0, 0])
    expect(limit.take('a')).toBe(20)
    expect(limit.take('b')).toBe(0)
    t += 20_000
    expect(limit.take('a')).toBe(0)
    expect(limit.take('a')).toBe(20)
  })

  it('forgets clients whose bucket has filled again, once it tracks over 10,000', () => {
    let t = 0
    const limit = createLimiter({ perMinute: 60, now: () => t })
    for (let i = 0; i <= 10_000; i++) limit.take(`c${i}`)
    expect(limit.clients).toBe(10_001)
    t = 60_000
    limit.take('late')
    expect(limit.clients).toBe(1)
  })

  it('is off at 0', () => {
    const limit = createLimiter({ perMinute: 0 })
    for (let i = 0; i < 100; i++) expect(limit.take('a')).toBe(0)
  })
})

describe('the cache', () => {
  const entry = (text: string) => ({
    status: 200, contentType: 'text/plain', contentEncoding: null, etag: null, lastModified: null, body: Buffer.from(text),
  })

  it('is fresh for the TTL, then stale but kept', () => {
    let t = 0
    const cache = createCache({ ttlMs: 1000, maxBytes: 100, now: () => t })
    cache.set('u', entry('hi'))
    expect(cache.isFresh(cache.get('u')!)).toBe(true)
    t = 1000
    expect(cache.isFresh(cache.get('u')!)).toBe(false)
    cache.touch('u')
    expect(cache.isFresh(cache.get('u')!)).toBe(true)
    cache.touch('gone')
    expect(cache.get('gone')).toBeUndefined()
  })

  it('drops the oldest entries over its byte cap, and never stores a body bigger than the cap', () => {
    const cache = createCache({ ttlMs: 1000, maxBytes: 10 })
    cache.set('a', entry('aaaa'))
    cache.set('b', entry('bbbb'))
    cache.set('c', entry('cccc'))
    expect([cache.get('a'), !!cache.get('b'), !!cache.get('c')]).toEqual([undefined, true, true])
    expect(cache.bytes).toBe(8)
    cache.set('huge', entry('x'.repeat(11)))
    expect(cache.get('huge')).toBeUndefined()
  })

  it('stores nothing with a TTL of 0', () => {
    const cache = createCache({ ttlMs: 0, maxBytes: 100 })
    cache.set('u', entry('hi'))
    expect(cache.size).toBe(0)
  })
})

describe('content types', () => {
  it.each([
    'application/json', 'application/json; charset=utf-8', 'application/feed+json', 'application/ld+json', 'application/xml',
    'text/xml', 'application/rss+xml', 'application/atom+xml', 'text/html; charset=UTF-8', 'text/plain', 'TEXT/PLAIN',
  ])('allows %s', t => expect(isTextType(t)).toBe(true))

  it.each(['', 'image/png', 'application/octet-stream', 'application/pdf', 'text/javascript', 'application/javascript', 'video/mp4', 'text/css', 'image/svg+xml'])(
    'refuses %j', t => expect(isTextType(t)).toBe(false),
  )
})

describe('settings', () => {
  it('defaults to a closed relay with the documented caps', () => {
    expect(readConfig({})).toEqual(DEFAULTS)
    expect(DEFAULTS).toMatchObject({ port: 8787, allow: [], key: null, maxBytes: 2_097_152, timeoutMs: 8000, maxRedirects: 3, ratePerMinute: 60, cacheTtlMs: 60_000 })
  })

  it('reads every variable', () => {
    expect(readConfig({
      PORT: '5760', HOST: '127.0.0.1', RELAY_ALLOW: ' example.com, *.feeds.org ,', RELAY_KEY: 'k', RELAY_MAX_BYTES: '1000',
      RELAY_TIMEOUT_MS: '500', RELAY_MAX_REDIRECTS: '1', RELAY_RATE: '10', RELAY_CACHE_TTL: '0', RELAY_CACHE_MB: '4', RELAY_TRUST_PROXY: '1',
    })).toEqual({
      port: 5760, host: '127.0.0.1', allow: ['example.com', '*.feeds.org'], key: 'k', maxBytes: 1000, timeoutMs: 500,
      maxRedirects: 1, ratePerMinute: 10, cacheTtlMs: 0, cacheBytes: 4 * 1024 * 1024, trustProxy: true,
    })
  })

  it.each([['PORT', 'eighty'], ['RELAY_MAX_BYTES', '2MB'], ['RELAY_RATE', '-1'], ['RELAY_TIMEOUT_MS', '1.5']])('stops at boot on %s=%s', (name, value) => {
    expect(() => readConfig({ [name]: value })).toThrow(name)
  })
})
