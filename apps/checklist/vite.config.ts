import { defineConfig } from 'vite'
import { devHost, devPort } from '../../scripts/host.ts'

// The phone loads the app from this machine after a QR sideload, so the hot-reload socket must use an
// address the phone can reach: DEV_HOST, or this machine's LAN address (scripts/host.ts).
// The build has one entry, index.html. phone-preview.html (the Kit view and the remote) is dev only.
export default defineConfig({
  server: { host: true, port: devPort(5210), strictPort: true, hmr: { host: devHost() } },
  build: { target: 'esnext' },
})
