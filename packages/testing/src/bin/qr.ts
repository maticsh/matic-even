#!/usr/bin/env node
// maticsh-qr <port>: prints a QR code for an app's dev server. Scan it in the Even app (Even Hub tab,
// Scan QR) to sideload. The address comes from DEV_HOST, or this machine's LAN address. DEV_PORT
// overrides the port. The QR code itself comes from Even's CLI (@evenrealities/evenhub-cli).
import { spawnSync } from 'node:child_process'
import { devHost, devPort } from '../dev.ts'

const fallback = Number(process.argv[2])
if (!Number.isInteger(fallback) || fallback <= 0) {
  console.error('usage: maticsh-qr <default-port>')
  process.exit(2)
}
const url = `http://${devHost()}:${devPort(fallback)}`
console.log(`QR for ${url}. Set DEV_HOST if the phone reaches this machine at another address.`)
const result = spawnSync('evenhub', ['qr', '--url', url], { stdio: 'inherit', shell: process.platform === 'win32' })
if (result.error) {
  console.error(`Could not run evenhub (${result.error.message}). Install it: npm i -D @evenrealities/evenhub-cli`)
  process.exit(1)
}
process.exit(result.status ?? 1)
