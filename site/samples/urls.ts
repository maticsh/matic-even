import { scanUrls } from '@maticsh/testing'

const bundle = [
  'const FEEDS = ["https://example.org/feed.xml"]',
  'const url = `https://${host}/rss`',
  'fetch("https://api.example.com/items")',
].join('\n')

const findings = scanUrls({
  manifest: { permissions: [{
    name: 'network', desc: 'Reads feeds.',
    whitelist: ['https://api.example.com'],
  }] },
  files: [{ path: 'assets/index.js', text: bundle }],
})

for (const f of findings) {
  const at = f.path ? ` (${f.path}:${f.line})` : ''
  console.log(`${f.severity}  ${f.rule}: ${f.detail}${at}`)
}
