import { describe, expect, it } from 'vitest'
import type { LookupAddress } from 'node:dns'
import { allowList, checkUrl, guardedLookup, isBlocked, Refused, type Policy } from '../src/guard.ts'
import { fakeDns } from './harness.ts'

describe('isBlocked', () => {
  it.each([
    ['0.0.0.0', 'this network'],
    ['0.255.255.255', 'this network'],
    ['10.0.0.1', 'RFC 1918 10/8'],
    ['10.255.255.255', 'RFC 1918 10/8'],
    ['100.64.0.1', 'CGNAT 100.64/10'],
    ['100.127.255.254', 'CGNAT 100.64/10'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['169.254.169.254', 'cloud metadata'],
    ['169.254.0.1', 'link-local'],
    ['172.16.0.1', 'RFC 1918 172.16/12'],
    ['172.31.255.255', 'RFC 1918 172.16/12'],
    ['192.0.0.8', 'IETF assignments'],
    ['192.0.2.1', 'documentation'],
    ['192.168.0.1', 'RFC 1918 192.168/16'],
    ['198.18.0.1', 'benchmarking'],
    ['198.51.100.7', 'documentation'],
    ['203.0.113.9', 'documentation'],
    ['224.0.0.251', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'broadcast'],
    ['::', 'unspecified'],
    ['::1', 'IPv6 loopback'],
    ['[::1]', 'IPv6 loopback in brackets'],
    ['0:0:0:0:0:0:0:1', 'IPv6 loopback, long form'],
    ['fc00::1', 'ULA'],
    ['fd12:3456:789a::1', 'ULA'],
    ['fe80::1', 'IPv6 link-local'],
    ['fe80::1%eth0', 'IPv6 link-local with a zone'],
    ['febf::1', 'IPv6 link-local, top of range'],
    ['fec0::1', 'old site-local'],
    ['ff02::1', 'IPv6 multicast'],
    ['2001:db8::1', 'IPv6 documentation'],
    ['100::1', 'discard'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback, hex'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
    ['::ffff:10.0.0.1', 'IPv4-mapped RFC 1918'],
    ['64:ff9b::10.0.0.1', 'NAT64 of RFC 1918'],
    ['64:ff9b::7f00:1', 'NAT64 of loopback'],
    ['2002:c0a8:0101::1', '6to4 of 192.168.1.1'],
    ['2002:7f00:0001::', '6to4 of loopback'],
  ])('refuses %s (%s)', ip => {
    expect(isBlocked(ip)).toBe(true)
  })

  it.each([
    '93.184.215.14', '1.1.1.1', '8.8.8.8', '100.63.255.255', '100.128.0.1', '172.15.255.255', '172.32.0.1',
    '169.253.255.255', '192.169.0.1', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e', '::ffff:8.8.8.8',
    '64:ff9b::808:808', '2002:0808:0808::1',
  ])('lets public %s through', ip => {
    expect(isBlocked(ip)).toBe(false)
  })

  it.each(['', 'example.com', '1.2.3', '1.2.3.4.5', '256.1.1.1', ':::1', '1::2::3', 'g::1'])('refuses %j, which is no IP address', s => {
    expect(isBlocked(s)).toBe(true)
  })
})

describe('allowList', () => {
  it('allows nothing when empty', () => {
    const allowed = allowList([])
    expect(allowed('example.com')).toBe(false)
    expect(allowed('localhost')).toBe(false)
  })

  it('matches exact hosts, ignoring case and a trailing dot', () => {
    const allowed = allowList(['example.com', 'API.Feeds.org'])
    expect(allowed('example.com')).toBe(true)
    expect(allowed('EXAMPLE.com.')).toBe(true)
    expect(allowed('api.feeds.org')).toBe(true)
    expect(allowed('www.example.com')).toBe(false)
    expect(allowed('example.com.evil.net')).toBe(false)
    expect(allowed('notexample.com')).toBe(false)
  })

  it('matches names under a wildcard, at any depth, but not the name itself', () => {
    const allowed = allowList(['*.example.com'])
    expect(allowed('a.example.com')).toBe(true)
    expect(allowed('a.b.example.com')).toBe(true)
    expect(allowed('example.com')).toBe(false)
    expect(allowed('badexample.com')).toBe(false)
    expect(allowed('a.example.com.evil.net')).toBe(false)
  })

  it('allows any host with *', () => {
    const allowed = allowList(['example.com', '*'])
    expect(allowed('anything.net')).toBe(true)
  })

  it.each(['https://example.com', 'example.com/feed', '*example.com', 'a.*.com', 'example.com:8080/x'])('refuses the entry %j at boot', e => {
    expect(() => allowList([e])).toThrow(/RELAY_ALLOW/)
  })
})

describe('checkUrl', () => {
  const open: Policy = { allowed: () => true }
  const refused = (raw: string, policy = open) => {
    try {
      checkUrl(raw, policy)
    } catch (e) {
      if (e instanceof Refused) return { status: e.status, message: e.message }
      throw e
    }
    return null
  }

  it('accepts http and https on ports 80 and 443', () => {
    expect(checkUrl('https://example.com/feed.xml', open).href).toBe('https://example.com/feed.xml')
    expect(checkUrl('http://example.com:80/', open).port).toBe('')
    expect(checkUrl('http://example.com:443/', open).port).toBe('443')
    expect(checkUrl('https://example.com:80/', open).port).toBe('80')
  })

  it.each(['ftp://example.com/', 'file:///etc/passwd', 'data:text/plain,hi', 'javascript:alert(1)', 'gopher://example.com/', 'ws://example.com/'])(
    'refuses the scheme of %s', raw => {
      expect(refused(raw)).toMatchObject({ status: 400, message: expect.stringMatching(/scheme/) })
    },
  )

  it.each(['http://example.com:8080/', 'https://example.com:8443/', 'http://example.com:22/', 'http://example.com:6379/'])(
    'refuses the port of %s', raw => {
      expect(refused(raw)).toMatchObject({ status: 400, message: expect.stringMatching(/port/) })
    },
  )

  it('refuses relative URLs, junk and user names', () => {
    expect(refused('/feed.xml')?.status).toBe(400)
    expect(refused('example.com/feed.xml')?.status).toBe(400)
    expect(refused('not a url')?.status).toBe(400)
    expect(refused('https://user:pass@example.com/')?.message).toMatch(/user name/)
  })

  it.each([
    'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/',
    'http://0.0.0.0/', 'http://10.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/',
    'http://[::ffff:127.0.0.1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://100.100.100.100/',
  ])('refuses the IP literal in %s', raw => {
    expect(refused(raw)).toEqual({ status: 403, message: 'address is private or reserved' })
  })

  it('refuses hosts off the allowlist before anything else about the host', () => {
    const policy: Policy = { allowed: allowList(['example.com']) }
    expect(refused('https://example.com/', policy)).toBeNull()
    expect(refused('https://other.com/', policy)).toEqual({ status: 403, message: 'host other.com is not on the allowlist' })
    expect(refused('http://127.0.0.1/', policy)?.message).toMatch(/allowlist/)
  })

  it('resolves a redirect against the URL it came from', () => {
    expect(checkUrl('/next', open, new URL('https://example.com/a/b')).href).toBe('https://example.com/next')
  })
})

describe('guardedLookup', () => {
  type Result = { error: NodeJS.ErrnoException | null; address: string | LookupAddress[]; family?: number }
  const look = (host: string, options: { all?: boolean; family?: number | 'IPv4' | 'IPv6' } = {}) =>
    new Promise<Result>(r => guardedLookup(fakeDns().resolve)(host, options, (error, address, family) => r({ error, address, family })))

  it('answers in both shapes the socket asks for', async () => {
    // The real check refuses feeds.test (127.0.0.1), so this lookup lets everything through.
    const open = guardedLookup(fakeDns().resolve, () => false)
    const ask = (options: { all?: boolean }) =>
      new Promise<Result>(r => open('feeds.test', options, (error, address, family) => r({ error, address, family })))
    expect((await ask({ all: true })).address).toEqual([{ address: '127.0.0.1', family: 4 }])
    expect(await ask({})).toEqual({ error: null, address: '127.0.0.1', family: 4 })
  })

  it.each(['metadata.test', 'lan.test', 'ula.test', 'loop6.test', 'mapped6.test', 'nat64.test', 'mixed.test'])(
    'refuses %s at connect time', async host => {
      const { error } = await look(host, { all: true })
      expect(error).toBeInstanceOf(Refused)
      expect((error as Refused).status).toBe(403)
    },
  )

  it('filters by the family the socket asks for, and fails a name with no address in it', async () => {
    expect((await look('ten.test', { family: 6 })).error?.code).toBe('ENOTFOUND')
    expect((await look('ten.test', { family: 'IPv6' })).error?.code).toBe('ENOTFOUND')
    expect((await look('ula.test', { family: 'IPv4' })).error?.code).toBe('ENOTFOUND')
    expect((await look('ula.test', { family: 'IPv6' })).error).toBeInstanceOf(Refused)
  })

  it('passes resolver errors on', async () => {
    expect((await look('nowhere.test')).error?.code).toBe('ENOTFOUND')
  })
})
