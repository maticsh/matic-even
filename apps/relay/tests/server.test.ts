import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { errorOf, PRIVATE_NAMES, relay, upstream } from './harness.ts'

/** The upstream's /cond page: change `version` to change its body and ETag. */
let version = 1
const opened: { close: () => Promise<unknown> }[] = []
afterEach(async () => { await Promise.all(opened.splice(0).map(r => r.close())) })

const send = (type: string | null, body: string) => (_: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, type ? { 'content-type': type } : {}).end(body)
}

const up = await upstream({
  '/feed.xml': send('application/rss+xml; charset=utf-8', '<rss version="2.0"><channel><title>t</title></channel></rss>'),
  '/atom': send('application/atom+xml', '<feed xmlns="http://www.w3.org/2005/Atom"/>'),
  '/data.json': send('application/json', '{"ok":true}'),
  '/page': send('text/html; charset=utf-8', '<p>hi</p><script>alert(1)</script>'),
  '/text': send('text/plain', 'plain'),
  '/xml': send('text/xml', '<a/>'),
  '/image.png': send('image/png', 'PNG'),
  '/script.js': send('text/javascript', 'alert(1)'),
  '/untyped': send(null, 'what am I'),
  '/broken': (_, res) => void res.writeHead(500, { 'content-type': 'text/plain' }).end('down'),
  '/big': (_, res) => void res.writeHead(200, { 'content-type': 'text/plain', 'content-length': '2000' }).end('x'.repeat(2000)),
  '/exact': (_, res) => void res.writeHead(200, { 'content-type': 'text/plain' }).end('x'.repeat(1000)),
  '/streamed-big': (_, res) => {
    // No content-length: the cap has to count the bytes as they come.
    res.writeHead(200, { 'content-type': 'text/plain' })
    for (let i = 0; i < 10; i++) res.write('y'.repeat(300))
    res.end()
  },
  '/hang': () => {},
  '/trickle': (_, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.write('a') },
  '/r1': (_, res) => void res.writeHead(302, { location: '/r2' }).end(),
  '/r2': (_, res) => void res.writeHead(301, { location: '/r3' }).end(),
  '/r3': (_, res) => void res.writeHead(307, { location: '/text' }).end(),
  '/r0': (_, res) => void res.writeHead(308, { location: '/r1' }).end(),
  '/loop-a': (_, res) => void res.writeHead(302, { location: '/loop-b' }).end(),
  '/loop-b': (_, res) => void res.writeHead(302, { location: '/loop-a' }).end(),
  '/to': (req, res) => {
    const to = new URL(req.url!, 'http://x.invalid').searchParams.get('l')!
    res.writeHead(302, { location: to }).end()
  },
  '/cond': (req, res) => {
    const etag = `"v${version}"`
    const lastModified = new Date(Date.UTC(2026, 9, version)).toUTCString()
    if (req.headers['if-none-match'] === etag) return void res.writeHead(304, { etag }).end()
    res.writeHead(200, { 'content-type': 'text/plain', etag, 'last-modified': lastModified }).end(`body ${version}`)
  },
  '/dated': (req, res) => {
    const lastModified = new Date(Date.UTC(2026, 9, 1)).toUTCString()
    if (req.headers['if-modified-since'] === lastModified) return void res.writeHead(304).end()
    res.writeHead(200, { 'content-type': 'text/plain', 'last-modified': lastModified }).end('dated')
  },
})
afterAll(() => up.close())

/** A relay that reaches the fake upstream, closed after each test. */
async function open(...args: Parameters<typeof relay>) {
  const [config, seams = {}] = args
  const r = await relay(config, { upstreamPort: up.port, ...seams })
  opened.push(r)
  return r
}
const hitsOn = (path: string) => up.hits.filter(h => h.path === path).length

describe('routes', () => {
  it('answers /health with open CORS', async () => {
    const r = await open()
    const res = await fetch(`${r.base}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('answers a preflight on any path, with the key header allowed', async () => {
    const r = await open({ key: 'secret' })
    const res = await fetch(`${r.base}/v1/fetch?url=x`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS')
    expect(res.headers.get('access-control-allow-headers')).toContain('x-relay-key')
  })

  it('answers 404 off the routes, 405 for other methods and 400 without a url', async () => {
    const r = await open()
    expect((await fetch(`${r.base}/nope`)).status).toBe(404)
    const post = await fetch(`${r.base}/v1/fetch`, { method: 'POST', body: 'x' })
    expect(post.status).toBe(405)
    expect(post.headers.get('access-control-allow-origin')).toBe('*')
    const none = await fetch(`${r.base}/v1/fetch`)
    expect([none.status, await errorOf(none)]).toEqual([400, 'url is required'])
  })
})

describe('/v1/fetch', () => {
  it.each([
    ['/feed.xml', 'application/rss+xml; charset=utf-8'],
    ['/atom', 'application/atom+xml'],
    ['/data.json', 'application/json'],
    ['/page', 'text/html; charset=utf-8'],
    ['/text', 'text/plain'],
    ['/xml', 'text/xml'],
  ])('relays %s with its content type and open CORS', async (path, type) => {
    const r = await open()
    const res = await r.get(up.at(path))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(type)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-expose-headers')).toContain('x-relay-cache')
    expect((await res.text()).length).toBeGreaterThan(0)
  })

  it('sends someone else\'s HTML so it can never run on the relay\'s origin', async () => {
    const res = await (await open()).get(up.at('/page'))
    expect(res.headers.get('content-security-policy')).toBe('sandbox')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it.each(['/image.png', '/script.js', '/untyped'])('refuses %s with 415', async path => {
    const res = await (await open()).get(up.at(path))
    expect(res.status).toBe(415)
    expect(await errorOf(res)).toMatch(/content type/)
  })

  it('passes no upstream error page through', async () => {
    const res = await (await open()).get(up.at('/broken'))
    expect([res.status, await errorOf(res)]).toEqual([502, 'upstream answered 500'])
  })

  it('sends no client headers upstream', async () => {
    const r = await open()
    await r.get(up.at('/text?who'), { cookie: 'session=1', authorization: 'Bearer t' })
    const hit = up.hits.at(-1)!
    expect(hit.headers.cookie).toBeUndefined()
    expect(hit.headers.authorization).toBeUndefined()
    expect(hit.headers['user-agent']).toBe('relay/0.1')
  })
})

describe('refused addresses', () => {
  // These relays run the real address check, with nothing let through, and allow every host.
  const strict = () => open({ allow: ['*'] }, { isBlocked: undefined })

  it.each(PRIVATE_NAMES)('refuses %s, which resolves to a refused range', async name => {
    const r = await strict()
    const before = up.hits.length
    const res = await r.get(`http://${name}/`)
    expect([res.status, await errorOf(res)]).toEqual([403, 'address is private or reserved'])
    expect(up.hits.length).toBe(before)
  })

  it.each([
    'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'http://172.16.0.1/', 'http://192.168.1.1/',
    'http://100.64.0.1/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[::ffff:169.254.169.254]/', 'http://0x7f.1/',
  ])('refuses the literal %s before it connects', async target => {
    const r = await strict()
    const res = await r.get(target)
    expect(res.status).toBe(403)
    expect(r.lookups).toEqual([])
  })

  it('refuses the relay itself', async () => {
    const r = await strict()
    const res = await r.get(`${r.base}/health`)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toMatch(/port/)
  })

  it('checks the address at connect time, with the one lookup the socket makes', async () => {
    const r = await strict()
    expect((await r.get('http://metadata.test/')).status).toBe(403)
    expect(r.lookups).toEqual(['metadata.test'])
  })

  it('answers 502 when nothing listens upstream', async () => {
    const gone = await upstream({})
    await gone.close()
    const r = await open({}, { ports: [gone.port] })
    const res = await r.get(gone.at('/'))
    expect([res.status, await errorOf(res)]).toEqual([502, 'upstream connection failed'])
  })

  it('answers 502 for a name that does not resolve', async () => {
    const res = await (await strict()).get('http://nowhere.test/')
    expect([res.status, await errorOf(res)]).toEqual([502, 'could not resolve the host'])
  })
})

describe('redirects', () => {
  it('follows up to three hops', async () => {
    const res = await (await open()).get(up.at('/r1'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('plain')
  })

  it('refuses a fourth hop', async () => {
    const res = await (await open()).get(up.at('/r0'))
    expect([res.status, await errorOf(res)]).toEqual([502, 'more than 3 redirects'])
  })

  it('refuses a redirect loop', async () => {
    const res = await (await open()).get(up.at('/loop-a'))
    expect([res.status, await errorOf(res)]).toEqual([502, 'redirect loop'])
  })

  it.each([
    ['a private literal', 'http://10.0.0.5/', 403],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/', 403],
    ['loopback on another port', 'http://127.0.0.1:6379/', 400],
    ['a name that resolves to the LAN', 'http://lan.test/', 403],
    ['a name that resolves to IPv6 link-local', 'http://linklocal6.test/', 403],
    ['a host off the allowlist', 'http://other.test/', 403],
    ['another scheme', 'file:///etc/passwd', 400],
  ])('re-checks every hop: refuses a redirect to %s', async (_, location, status) => {
    const r = await open({ allow: ['feeds.test', 'lan.test', 'linklocal6.test', '10.0.0.5', '169.254.169.254', '127.0.0.1'] })
    const res = await r.get(up.at(`/to?l=${encodeURIComponent(location)}`))
    expect(res.status).toBe(status)
    // A literal or a URL fails its check at once. A name fails in the socket's lookup.
    expect(await errorOf(res)).toMatch(/^redirect refused: |^address is private or reserved$/)
  })

  it('follows a redirect to an allowed name', async () => {
    const r = await open()
    const res = await r.get(up.at(`/to?l=${encodeURIComponent(up.at('/data.json', 'a.feeds.test'))}`))
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('caps', () => {
  it('refuses a body over the cap, by its content-length', async () => {
    const res = await (await open({ maxBytes: 1000 })).get(up.at('/big'))
    expect([res.status, await errorOf(res)]).toEqual([502, 'upstream body is over 1000 bytes'])
  })

  it('refuses a body over the cap as it streams', async () => {
    const res = await (await open({ maxBytes: 1000 })).get(up.at('/streamed-big'))
    expect(res.status).toBe(502)
  })

  it('takes a body exactly at the cap', async () => {
    const res = await (await open({ maxBytes: 1000 })).get(up.at('/exact'))
    expect((await res.text()).length).toBe(1000)
  })

  it('answers 504 when upstream never answers', async () => {
    const started = Date.now()
    const res = await (await open({ timeoutMs: 200 })).get(up.at('/hang'))
    expect([res.status, await errorOf(res)]).toEqual([504, 'upstream took longer than 200 ms'])
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('answers 504 when the body never ends', async () => {
    const res = await (await open({ timeoutMs: 200 })).get(up.at('/trickle'))
    expect(res.status).toBe(504)
  })
})

describe('the allowlist', () => {
  it('refuses everything when it is empty', async () => {
    const r = await open({ allow: [] })
    const res = await r.get(up.at('/text'))
    expect([res.status, await errorOf(res)]).toEqual([403, 'host feeds.test is not on the allowlist'])
    expect(r.lookups).toEqual([])
  })

  it('allows a listed host and refuses the rest', async () => {
    const r = await open({ allow: ['feeds.test'] })
    expect((await r.get(up.at('/text'))).status).toBe(200)
    expect((await r.get(up.at('/text', 'other.test'))).status).toBe(403)
    expect((await r.get(up.at('/text', 'a.feeds.test'))).status).toBe(403)
  })

  it('allows names under a wildcard, but not the name itself', async () => {
    const r = await open({ allow: ['*.feeds.test'] })
    expect((await r.get(up.at('/text', 'a.feeds.test'))).status).toBe(200)
    expect((await r.get(up.at('/text', 'deep.a.feeds.test'))).status).toBe(200)
    expect((await r.get(up.at('/text', 'feeds.test'))).status).toBe(403)
  })

  it('allows any public host with *, and still refuses private ones', async () => {
    const r = await open({ allow: ['*'] })
    expect((await r.get(up.at('/text', 'other.test'))).status).toBe(200)
    expect((await r.get('http://metadata.test/')).status).toBe(403)
  })
})

describe('the key', () => {
  it('is off by default', async () => {
    expect((await (await open()).get(up.at('/text'))).status).toBe(200)
  })

  it('refuses a request with no key or the wrong key', async () => {
    const r = await open({ key: 'k3y' })
    const none = await r.get(up.at('/text'))
    expect([none.status, await errorOf(none)]).toEqual([401, 'x-relay-key is missing or wrong'])
    expect(none.headers.get('access-control-allow-origin')).toBe('*')
    expect((await r.get(up.at('/text'), { 'x-relay-key': 'k3' })).status).toBe(401)
    expect((await r.get(up.at('/text'), { 'x-relay-key': 'k3y' })).status).toBe(200)
  })

  it('leaves /health open', async () => {
    const r = await open({ key: 'k3y' })
    expect((await fetch(`${r.base}/health`)).status).toBe(200)
  })
})

describe('the rate limit', () => {
  it('answers 429 with Retry-After once a client is over it', async () => {
    const r = await open({ ratePerMinute: 2 })
    expect((await r.get(up.at('/text'))).status).toBe(200)
    expect((await r.get(up.at('/text'))).status).toBe(200)
    const third = await r.get(up.at('/text'))
    expect(third.status).toBe(429)
    expect(third.headers.get('retry-after')).toBe('30')
    expect(third.headers.get('access-control-allow-origin')).toBe('*')
    expect((await fetch(`${r.base}/health`)).status).toBe(200)
  })

  it('counts each client on its own behind a trusted proxy', async () => {
    const r = await open({ ratePerMinute: 1, trustProxy: true })
    const from = (ip: string) => r.get(up.at('/text'), { 'x-forwarded-for': `203.0.113.50, ${ip}` })
    expect((await from('198.51.100.1')).status).toBe(200)
    expect((await from('198.51.100.1')).status).toBe(429)
    expect((await from('198.51.100.2')).status).toBe(200)
  })

  it('ignores X-Forwarded-For unless told to trust it', async () => {
    const r = await open({ ratePerMinute: 1 })
    expect((await r.get(up.at('/text'), { 'x-forwarded-for': '198.51.100.1' })).status).toBe(200)
    expect((await r.get(up.at('/text'), { 'x-forwarded-for': '198.51.100.2' })).status).toBe(429)
  })
})

describe('the cache', () => {
  beforeAll(() => { version = 1 })

  it('serves a second request from memory within the TTL', async () => {
    const r = await open()
    const before = hitsOn('/data.json')
    const first = await r.get(up.at('/data.json'))
    const second = await r.get(up.at('/data.json'))
    expect([first.headers.get('x-relay-cache'), second.headers.get('x-relay-cache')]).toEqual(['miss', 'hit'])
    expect(await second.json()).toEqual({ ok: true })
    expect(hitsOn('/data.json') - before).toBe(1)
  })

  it('asks upstream with the ETag once stale, and serves the copy on a 304', async () => {
    let t = 0
    const r = await open({ cacheTtlMs: 1000 }, { now: () => t })
    expect((await r.get(up.at('/cond'))).headers.get('x-relay-cache')).toBe('miss')
    t = 1500
    const again = await r.get(up.at('/cond'))
    expect(again.headers.get('x-relay-cache')).toBe('revalidated')
    expect(await again.text()).toBe('body 1')
    expect(up.hits.at(-1)!.headers['if-none-match']).toBe('"v1"')
    // Fresh again after the 304.
    expect((await r.get(up.at('/cond'))).headers.get('x-relay-cache')).toBe('hit')
  })

  it('takes the new body when upstream changed', async () => {
    let t = 0
    const r = await open({ cacheTtlMs: 1000 }, { now: () => t })
    await r.get(up.at('/cond'))
    version = 2
    t = 1500
    const changed = await r.get(up.at('/cond'))
    expect([changed.headers.get('x-relay-cache'), await changed.text()]).toEqual(['miss', 'body 2'])
  })

  it('asks with If-Modified-Since when there is no ETag', async () => {
    let t = 0
    const r = await open({ cacheTtlMs: 1000 }, { now: () => t })
    await r.get(up.at('/dated'))
    t = 1500
    const again = await r.get(up.at('/dated'))
    expect([again.headers.get('x-relay-cache'), await again.text()]).toEqual(['revalidated', 'dated'])
    expect(up.hits.at(-1)!.headers['if-modified-since']).toBe(new Date(Date.UTC(2026, 9, 1)).toUTCString())
  })

  it('answers the client 304 when its ETag matches', async () => {
    const r = await open()
    const first = await r.get(up.at('/cond'))
    const etag = first.headers.get('etag')!
    const second = await r.get(up.at('/cond'), { 'if-none-match': etag })
    expect(second.status).toBe(304)
  })

  it('keeps nothing with a TTL of 0', async () => {
    const r = await open({ cacheTtlMs: 0 })
    const before = hitsOn('/xml')
    await r.get(up.at('/xml'))
    expect((await r.get(up.at('/xml'))).headers.get('x-relay-cache')).toBe('miss')
    expect(hitsOn('/xml') - before).toBe(2)
  })

  it('caches no refusal', async () => {
    const r = await open()
    await r.get(up.at('/broken'))
    const before = hitsOn('/broken')
    expect((await r.get(up.at('/broken'))).status).toBe(502)
    expect(hitsOn('/broken') - before).toBe(1)
  })
})
