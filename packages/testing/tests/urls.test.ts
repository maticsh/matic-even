import { describe, expect, it } from 'vitest'
import { scanUrls, type UrlFinding } from '../src/index.ts'

const net = (whitelist?: unknown) => ({
  permissions: [{ name: 'network', desc: 'Talks to its server.', ...(whitelist === undefined ? {} : { whitelist }) }],
})
const rules = (fs: UrlFinding[]) => fs.map(f => f.rule)

// The relay shape: one origin on the whitelist, written once, used by the bundle. Other URLs live on the server.
const relay = {
  manifest: net(['https://api.example.com']),
  files: [
    { path: 'index.html', text: '<svg xmlns="http://www.w3.org/2000/svg"></svg><script src="./assets/index.js"></script>' },
    { path: 'assets/index.js', text: 'const A="https://api.example.com";fetch(`https://api.example.com${p}`);fetch(A+"/v1/items?x=1")' },
  ],
  source: [
    { path: 'src/infra/api.ts', text: "export const API_BASE = 'https://api.example.com'\nconst r = await fetch(`${API_BASE}${path}`, init)\n" },
    { path: 'src/main.ts', text: "fetch('/relative/ok')\nnew WebSocket(url)\n" },
  ],
}

describe('scanUrls', () => {
  it('passes the relay shape: one origin, used, everything else on the server', () => {
    expect(scanUrls(relay)).toEqual([])
  })

  it('passes an app with no network permission and no URLs', () => {
    expect(scanUrls({ manifest: { permissions: [] }, files: [{ path: 'a.js', text: 'console.log(1)' }] })).toEqual([])
  })

  it('url-not-whitelisted: flags literals the app never calls, with file and line', () => {
    const fs = scanUrls({
      manifest: net(['https://api.example.com']),
      files: [{ path: 'assets/index.js', text: 'x\nconst starter=["https://feeds.example.com/rss","https://api.example.com/v1"]' }],
    })
    expect(fs).toEqual([{ rule: 'url-not-whitelisted', severity: 'error', detail: 'https://feeds.example.com/rss', path: 'assets/index.js', line: 2 }])
  })

  it('url-not-whitelisted: catches template starts, ws:// and wss://, and reports each URL once per file', () => {
    const fs = scanUrls({
      manifest: net(['https://api.example.com']),
      files: [{ path: 'a.js', text: 'fetch(`https://${host}/x`);new WebSocket("wss://live.example.com/s");new WebSocket("ws://10.0.0.2:81");"https://${host}/x"' }],
    })
    expect(fs.filter(f => f.rule === 'url-not-whitelisted').map(f => f.detail)).toEqual([
      'https://${host}/x',
      'wss://live.example.com/s',
      'ws://10.0.0.2:81',
    ])
  })

  it('url-not-whitelisted: keeps the w3.org namespace exception and ignores look-alike schemes', () => {
    const fs = scanUrls({
      manifest: net(['https://api.example.com']),
      files: [{ path: 'a.js', text: 'api.example.com;"https://api.example.com/";"http://www.w3.org/1999/xhtml";"news://group"' }],
    })
    expect(fs).toEqual([])
  })

  it('url-not-whitelisted: a look-alike host is not under the origin', () => {
    const fs = scanUrls({ manifest: net(['https://api.example.com']), files: [{ path: 'a.js', text: '"https://api.example.com.evil.net/x"' }] })
    expect(rules(fs)).toEqual(['url-not-whitelisted', 'whitelist-unused'])
    expect(fs[0]!.detail).toBe('https://api.example.com.evil.net/x')
  })

  it('whitelist-shape: only bare https:// or wss:// origins', () => {
    const bad = ['http://a.example.com', 'https://a.example.com/', 'https://a.example.com/v1', 'https://*.example.com', 'https://a.example.com?k=1', 'a.example.com']
    const fs = scanUrls({ manifest: net([...bad, 'wss://live.example.com']), files: [{ path: 'a.js', text: bad.join(' ') + ' wss://live.example.com' }] })
    const shape = fs.filter(f => f.rule === 'whitelist-shape')
    expect(shape).toHaveLength(bad.length)
    expect(shape.every(f => f.severity === 'error')).toBe(true)
    expect(shape.map(f => f.detail).join('\n')).toMatch(/trailing slash[\s\S]*has a path[\s\S]*wildcard[\s\S]*query[\s\S]*not a URL/)
  })

  it('whitelist-unused: warns on an origin the bundle never names', () => {
    const fs = scanUrls({ manifest: net(['https://api.example.com', 'https://old.example.com']), files: relay.files })
    expect(fs).toEqual([{ rule: 'whitelist-unused', severity: 'warn', detail: expect.stringContaining('https://old.example.com') }])
  })

  it('network-permission-empty: a network permission with no whitelist', () => {
    expect(rules(scanUrls({ manifest: net(), files: [] }))).toEqual(['network-permission-empty'])
    expect(rules(scanUrls({ manifest: net([]), files: [] }))).toEqual(['network-permission-empty'])
  })

  it('fetch-origin: absolute URLs passed to fetch, WebSocket and EventSource in source', () => {
    const fs = scanUrls({
      manifest: net(['https://api.example.com']),
      files: [{ path: 'a.js', text: 'https://api.example.com' }],
      source: [
        {
          path: 'src/net.ts',
          text: [
            "fetch('https://api.example.com/ok')",
            "fetch('https://other.example.com/feed.xml')",
            'const ws = new WebSocket(`wss://live.example.com/${room}`)',
            "const es = new  EventSource(\"https://push.example.com/s\")",
            "const BASE = 'https://hidden.example.com'",
            'fetch(`${BASE}/v1`)',
          ].join('\n'),
        },
      ],
    })
    const fo = fs.filter(f => f.rule === 'fetch-origin')
    expect(fo.map(f => [f.line, f.detail.split(' calls ')[1]])).toEqual([
      [2, 'https://other.example.com, which is not on the whitelist'],
      [3, 'wss://live.example.com, which is not on the whitelist'],
      [4, 'https://push.example.com, which is not on the whitelist'],
      [6, 'https://hidden.example.com, which is not on the whitelist'],
    ])
    expect(fo.every(f => f.path === 'src/net.ts' && f.severity === 'error')).toBe(true)
  })

  it('fetch-origin: skipped when no source is given', () => {
    expect(scanUrls({ manifest: relay.manifest, files: relay.files })).toEqual([])
  })
})
