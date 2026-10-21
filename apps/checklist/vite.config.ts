/// <reference types="vitest/config" />
import { existsSync } from 'node:fs'
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite'
import { devHost, devPort } from '@maticsh/testing/dev'

// Inside the matic-even repo, @maticsh/* load from their TypeScript source (the "@maticsh/source" export
// condition), so an edit to a package shows without building it. A copy of this app outside the repo gets
// them built, from npm.
const inRepo = existsSync(new URL('../../packages/glasses/src/index.ts', import.meta.url))
const source = inRepo ? ['@maticsh/source'] : []

// The phone loads the app from this machine after a QR sideload, so the hot-reload socket must use an
// address the phone can reach: DEV_HOST, or this machine's LAN address (devHost in @maticsh/testing/dev).
// The build has one entry, index.html. phone-preview.html (the Kit view and the remote) is dev only.
export default defineConfig({
  server: { host: true, port: devPort(5210), strictPort: true, hmr: { host: devHost() } },
  build: { target: 'esnext' },
  resolve: { conditions: [...source, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [...source, ...defaultServerConditions] } },
  // @maticsh/phone imports its stylesheet. Vitest runs the package through Vite, which handles the CSS.
  test: { server: { deps: { inline: [/@maticsh\/phone/] } } },
})
