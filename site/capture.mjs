// Dev only: re-takes the pictures in site/assets/ that come from a running app. The build never runs this; it uses
// the PNGs checked in next to it, so building the site needs no simulator.
//
//   checklist.png         Checklist on Even's simulator, as it opens
//   checklist-ticked.png  the same, after tap, swipe down, tap, swipe down
//   checklist-phone.png   Checklist's phone page, Items tab (apps/checklist/phone-preview.html) at 390 x 844, same state
//   probe.png             the probe's main page on Even's simulator
//
// Glasses frames come from the simulator's /api/screenshot/glasses (RGBA, brightness in alpha) and are re-inked as
// graphite on the page grey. Usage, from the repo root after `npm ci`:
//
//   node site/capture.mjs
//
// Needs xvfb-run on a Linux machine with no display, and Playwright with Chromium for the phone page
// (`npx playwright install chromium`). Ports: dev servers 5745 and 5746, simulator automation 9845 and 9846.
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const SITE = dirname(fileURLToPath(import.meta.url))
const REPO = join(SITE, '..')
const ASSETS = join(SITE, 'assets')
const LOGS = join(tmpdir(), 'matic-even-capture')
mkdirSync(LOGS, { recursive: true })

/** The page grey and the graphite ink, as on matic.sh. A lit pixel at full brightness becomes INK. */
const PAGE = 237
const INK = 20

// processes: each one in its own group, stopped by its pid

const started = []

function start(name, cmd, args, opts = {}) {
  const log = openSync(join(LOGS, `${name}.log`), 'w')
  const child = spawn(cmd, args, { detached: true, stdio: ['ignore', log, log], ...opts })
  closeSync(log)
  child.exited = new Promise(res => child.on('exit', code => res(code ?? 1)))
  started.push(child)
  return child
}

function stopAll() {
  for (const c of started) {
    if (c.exitCode !== null || c.signalCode !== null) continue
    try { process.kill(-c.pid, 'SIGTERM') } catch { /* already gone */ }
  }
}
process.on('SIGINT', () => { stopAll(); process.exit(130) })

/** Retry `fn` with exponential backoff until it returns a value, the child exits, or time runs out. */
async function until(what, child, fn, ms = 60_000) {
  const end = Date.now() + ms
  let wait = 250, last
  while (Date.now() < end) {
    if (child && child.exitCode !== null) throw new Error(`${what}: the process exited with ${child.exitCode} (logs in ${LOGS})`)
    try {
      const v = await fn()
      if (v) return v
    } catch (e) { last = e }
    await sleep(wait)
    wait = Math.min(wait * 2, 4_000)
  }
  throw new Error(`${what}: timed out${last ? ` (${last.message})` : ''} (logs in ${LOGS})`)
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

function devServer(app, port) {
  const child = start(`${app}-dev`, 'npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: join(REPO, 'apps', app),
    env: { ...process.env, DEV_PORT: String(port), DEV_HOST: '127.0.0.1' },
  })
  return until(`${app} dev server`, child, async () => (await fetch(`http://127.0.0.1:${port}/`)).ok).then(() => child)
}

function simulator(name, url, port) {
  const sim = ['evenhub-simulator', url, '--automation-port', String(port)]
  const headless = process.platform === 'linux' && !process.env.DISPLAY
  return headless
    ? start(`${name}-sim`, 'xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', 'npx', ...sim], { cwd: REPO })
    : start(`${name}-sim`, 'npx', sim, { cwd: REPO })
}

// PNG: just enough to read the simulator's RGBA frames and write greyscale ones

function decodePng(buf) {
  let o = 8, ihdr
  const idat = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') ihdr = data
    if (type === 'IDAT') idat.push(data)
    o += 12 + len
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4)
  if (ihdr[8] !== 8 || ihdr[9] !== 6) throw new Error('expected an 8-bit RGBA PNG')
  const bpp = 4, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      cur[x] = v & 255
    }
    cur.copy(px, y * stride)
    prev = cur
  }
  return { w, h, px }
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
function encodeGrey(w, h, grey) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0
  const raw = Buffer.alloc(h * (w + 1))
  for (let y = 0; y < h; y++) grey.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** Lit pixels (alpha > 0) become graphite, by brightness, on the page grey. */
function reink({ w, h, px }) {
  const grey = Buffer.alloc(w * h)
  let lit = 0
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3]
    if (a) lit++
    grey[i] = Math.round(PAGE - (a / 255) * (PAGE - INK))
  }
  return { png: encodeGrey(w, h, grey), lit }
}

// the simulator

async function frame(port) {
  const res = await fetch(`http://127.0.0.1:${port}/api/screenshot/glasses`)
  if (!res.ok) throw new Error(`screenshot: HTTP ${res.status}`)
  return reink(decodePng(Buffer.from(await res.arrayBuffer())))
}

/** Wait until the frame has lit pixels and two frames in a row agree, then return it. */
async function settled(port, sim) {
  let last = null
  return until('a settled glasses frame', sim, async () => {
    const f = await frame(port)
    const same = last && f.lit > 0 && f.png.equals(last.png)
    last = f
    return same ? f : null
  })
}

async function input(port, action) {
  const res = await fetch(`http://127.0.0.1:${port}/api/input`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error(`input ${action}: HTTP ${res.status}`)
  // Swipes pass a 700 ms gate in Checklist (H12), so wait it out between gestures.
  await sleep(900)
}

function save(name, png) {
  writeFileSync(join(ASSETS, name), png)
  console.log(`wrote site/assets/${name} (${png.length} bytes)`)
}

// run

try {
  const checklist = await devServer('checklist', 5745)
  const probe = await devServer('probe', 5746)

  // ?demo starts Checklist from its example lists, in fresh storage (dev server only).
  const simA = simulator('checklist', 'http://127.0.0.1:5745/?demo', 9845)
  save('checklist.png', (await settled(9845, simA)).png)
  for (const a of ['click', 'down', 'click', 'down']) await input(9845, a)
  save('checklist-ticked.png', (await settled(9845, simA)).png)

  const simB = simulator('probe', 'http://127.0.0.1:5746/', 9846)
  await settled(9846, simB)
  await sleep(11_000) // a couple of heartbeats, so the first lines have numbers in them
  save('probe.png', (await settled(9846, simB)).png)

  // The phone page in the same state as checklist-ticked.png: two ticks, the pointer on the third item.
  const require = createRequire(import.meta.url)
  const { chromium } = require('playwright')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
    await page.goto('http://127.0.0.1:5745/phone-preview.html?tab=items')
    await page.waitForSelector('.glass .full svg')
    await page.waitForTimeout(300)
    save('checklist-phone.png', await page.screenshot())
  } finally {
    await browser.close()
  }
  void checklist; void probe
} finally {
  stopAll()
}
