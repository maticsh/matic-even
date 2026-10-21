// A tiny static server for local review of site/dist.
// Usage: node site/serve.mjs [--host 127.0.0.1] [--port 5700]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

// On a host that sets PORT (most container hosts), the server listens on every interface.
const { values } = parseArgs({ options: {
  host: { type: 'string', default: process.env.PORT ? '0.0.0.0' : '127.0.0.1' },
  port: { type: 'string', default: process.env.PORT ?? '5700' },
} })
const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  // Plain text, so a browser shows setup.md and llms.txt instead of downloading them.
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
}

if (!existsSync(ROOT)) {
  console.error('site/dist does not exist. Run `node site/build.mjs` first.')
  process.exit(1)
}

const server = createServer((req, res) => {
  let path
  try { path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname) } catch { res.writeHead(400).end(); return }
  let file = normalize(join(ROOT, path))
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found\n')
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
  createReadStream(file).pipe(res)
})

server.listen(Number(values.port), values.host, () => console.log(`Serving site/dist at http://${values.host}:${values.port}/`))
