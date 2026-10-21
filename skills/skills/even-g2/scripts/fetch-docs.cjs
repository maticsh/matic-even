// Save every page of the Even Hub docs as plain text, one file per page.
// The pages also render on the server, so curl works for a single page. This script walks the
// sidebar and saves them all. It needs Playwright with Chromium (npm i playwright).
// Usage: node fetch-docs.cjs [outDir]   (default /tmp/er-docs)
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const START = 'https://hub.evenrealities.com/docs/get-started/overview'
const outDir = process.argv[2] || '/tmp/er-docs'

async function render(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(800)
  return page.evaluate(() => (document.querySelector('main') || document.body).innerText)
}

;(async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(START, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  // The sidebar nav lists every page; strip anchors and dedupe.
  // A trailing-slash link duplicates the section's index page, so skip it.
  const urls = await page.$$eval('a[href*="/docs/"]', as =>
    [...new Set(as.map(a => a.href.split('#')[0]))].filter(u => !u.endsWith('/')))
  let failed = 0
  for (const url of urls) {
    try {
      const text = await render(page, url)
      const name = url.split('/docs/')[1].replace(/\//g, '__') + '.txt'
      fs.writeFileSync(path.join(outDir, name), `URL: ${url}\n\n${text}`)
      console.log(`${text.length.toString().padStart(6)}  ${url}`)
    } catch (err) {
      failed++
      console.error(`FAIL  ${url}  ${err.message}`)
    }
  }
  await browser.close()
  console.log(`\n${urls.length - failed}/${urls.length} pages written to ${outDir}`)
  process.exit(failed ? 1 : 0)
})()
