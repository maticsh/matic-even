#!/usr/bin/env node
// Prints a QR code for an app's dev server. Scan it in the Even app (Even Hub tab, Scan QR) to sideload.
// Usage, from an app's folder: node ../../scripts/qr.ts <default-port>
// The address comes from DEV_HOST, or this machine's LAN address. DEV_PORT overrides the port.
import { spawnSync } from 'node:child_process'
import { devHost, devPort } from './host.ts'

const fallback = Number(process.argv[2])
if (!Number.isInteger(fallback) || fallback <= 0) {
  console.error('usage: node scripts/qr.ts <default-port>')
  process.exit(2)
}
const url = `http://${devHost()}:${devPort(fallback)}`
console.log(`QR for ${url}. Set DEV_HOST if the phone reaches this machine at another address.`)
const result = spawnSync('evenhub', ['qr', '--url', url], { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
