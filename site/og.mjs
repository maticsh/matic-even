// Dev only: draws the share images in site/assets/ with Playwright. The build never runs this; it copies the PNGs
// checked in next to it, so building the site needs no browser.
//
//   og.png                1200 x 630, the link preview card (og:image, twitter:image, GitHub's social preview)
//   og-square.png         1200 x 1200, the same card for a channel that wants a square
//   apple-touch-icon.png  180 x 180, favicon.svg on an ink square (iOS rounds the corners itself)
//   favicon-32.png        32 x 32, favicon.svg for browsers that skip SVG icons
//
// The cards wear the page's look: page grey, graphite ink, the system font and system mono, and the real glasses
// frame from assets/checklist.png at its 2:1 shape. Usage, from the repo root:
//
//   node site/og.mjs [--font <sans .woff2 or .ttf>] [--mono <mono .woff2 or .ttf>]
//
// Without --font the card is set in the machine's system font. A Linux box without San Francisco looks closer to
// the page with Inter passed in. Needs Playwright with Chromium (`npx playwright install chromium`).
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { OG_IMAGE } from './lib/seo.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')
const SITE = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(SITE, 'assets')
const MAX_BYTES = 300 * 1024
const { values: args } = parseArgs({ options: { font: { type: 'string' }, mono: { type: 'string' } } })

const dataUrl = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`
const fontFace = (family, path) => (path
  ? `@font-face { font-family: "${family}"; src: url(${dataUrl(path, `font/${extname(path).slice(1)}`)}); }`
  : '')
const frame = dataUrl(join(ASSETS, 'checklist.png'), 'image/png')
const icon = dataUrl(join(ASSETS, 'favicon.svg'), 'image/svg+xml')

/** The tokens from site.css. */
const css = `${fontFace('Card Sans', args.font)}${fontFace('Card Mono', args.mono)}
:root { --page:#ededed; --ink:#141414; --quiet:#5c5c5c; --rule:#cfcfcf;
  --sans: "Card Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --mono: "Card Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
* { box-sizing: border-box; margin: 0; }
html, body { background: var(--page); color: var(--ink); -webkit-font-smoothing: antialiased; }
.card { display: flex; flex-direction: column; font-family: var(--sans); }
.labels { display: flex; align-items: center; justify-content: space-between; font-family: var(--mono);
  letter-spacing: .12em; color: var(--quiet); border-bottom: 1px solid var(--rule); }
.labels .site { display: flex; align-items: center; color: var(--ink); }
.labels img { display: block; }
h1 { font-weight: 400; letter-spacing: -0.03em; line-height: 1; }
.line { line-height: 1.3; letter-spacing: -0.005em; }
.glass { border: 1px solid var(--rule); background: var(--page); }
.glass img { display: block; width: 100%; aspect-ratio: 2 / 1; }`

const labels = size => `<p class="labels" style="font-size:${size}px;padding-bottom:${size}px">
  <span class="site"><img src="${icon}" width="${size * 1.5}" height="${size * 1.5}" alt="" style="margin-right:${size * 0.75}px">even.matic.sh</span>
  <span>open source&nbsp;&nbsp;·&nbsp;&nbsp;MIT</span></p>`
const title = 'matic even'
const line = 'What we measured on Even&nbsp;Realities&nbsp;G2, and the parts to build apps on them'

/** 1200 x 630: the title across the top, the line bottom left, the frame bottom right. */
const wide = `<div class="card" style="width:1200px;height:630px;padding:56px 64px">
  ${labels(18)}
  <h1 style="font-size:112px;margin-top:24px">${title}</h1>
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:56px;margin-top:auto">
    <p class="line" style="font-size:30px;max-width:440px">${line}</p>
    <figure class="glass" style="width:556px;flex:none;padding:22px"><img src="${frame}" alt=""></figure>
  </div>
</div>`

/** 1200 x 1200: the same parts stacked, the frame across the full width. */
const square = `<div class="card" style="width:1200px;height:1200px;padding:80px">
  ${labels(22)}
  <h1 style="font-size:150px;margin-top:72px">${title}</h1>
  <p class="line" style="font-size:42px;margin-top:32px;max-width:900px">${line}</p>
  <figure class="glass" style="padding:36px;margin-top:auto"><img src="${frame}" alt=""></figure>
</div>`

/** The favicon on a square. `inset` keeps the outer dots off the edge where iOS masks the icon. */
const iconPage = (size, bg, inset = 0) => `<div style="width:${size}px;height:${size}px;background:${bg};padding:${inset}px">`
  + `<img src="${icon}" width="${size - 2 * inset}" height="${size - 2 * inset}" alt="" style="display:block"></div>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  /** Renders one HTML card at its exact size and writes the PNG. Returns its size in bytes. */
  const shoot = async (name, html, width, height, { transparent = false } = {}) => {
    await page.setViewportSize({ width, height })
    await page.setContent(`<!doctype html><html><head><style>${css}${transparent ? 'html,body{background:transparent}' : ''}</style></head><body>${html}</body></html>`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0))
    const png = await page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width, height } })
    writeFileSync(join(ASSETS, name), png)
    console.log(`${name}: ${width} x ${height}, ${Math.round(png.length / 1024)} KB`)
    return png.length
  }
  const bytes = await shoot('og.png', wide, OG_IMAGE.width, OG_IMAGE.height)
  await shoot('og-square.png', square, 1200, 1200)
  await shoot('apple-touch-icon.png', iconPage(180, '#141414', 16), 180, 180)
  await shoot('favicon-32.png', iconPage(32, 'transparent'), 32, 32, { transparent: true })
  if (bytes > MAX_BYTES) throw new Error(`og.png is ${Math.round(bytes / 1024)} KB. Link previews want it under 300 KB.`)
} finally {
  await browser.close()
}
