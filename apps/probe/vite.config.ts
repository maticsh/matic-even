import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { defaultClientConditions, defaultServerConditions, defineConfig, type Plugin } from 'vite'
import { devHost, devPort, isPrivateAddress } from '@maticsh/testing/dev'

// Inside the matic-even repo, @maticsh/* load from their TypeScript source (the "@maticsh/source" export
// condition), so an edit to a package shows without building it. A copy of this app outside the repo gets
// them built, from npm.
const inRepo = existsSync(new URL('../../packages/glasses/src/index.ts', import.meta.url))
const source = inRepo ? ['@maticsh/source'] : []

/**
 * Dev only: the probe POSTs its sense log here, and the rows land in logs/<session>.csv next to this
 * file. Nothing like this ships in the .ehpk.
 */
const probeLog: Plugin = {
  name: 'probe-log',
  configureServer(server) {
    server.middlewares.use('/__probe/log', (req, res) => {
      // The dev server listens on every interface. Only this machine and private networks may write.
      if (!isPrivateAddress(req.socket.remoteAddress ?? '')) { res.statusCode = 403; return res.end() }
      const session = new URL(req.url ?? '', 'http://x').searchParams.get('session')?.replace(/[^\w-]/g, '')
      if (req.method !== 'POST' || !session) { res.statusCode = 400; return res.end() }
      let body = ''
      req.on('data', chunk => { body += chunk; if (body.length > 2_000_000) req.destroy() })
      req.on('end', () => {
        const dir = new URL('./logs/', import.meta.url).pathname
        mkdirSync(dir, { recursive: true })
        appendFileSync(`${dir}${session}.csv`, body)
        res.end('ok')
      })
    })
  },
}

// The phone loads the app from this machine after a QR sideload, so the hot-reload socket must use an
// address the phone can reach: DEV_HOST, or this machine's LAN address (devHost in @maticsh/testing/dev).
export default defineConfig({
  plugins: [probeLog],
  server: { host: true, port: devPort(5199), strictPort: true, hmr: { host: devHost() } },
  build: { target: 'esnext' },
  resolve: { conditions: [...source, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [...source, ...defaultServerConditions] } },
})
