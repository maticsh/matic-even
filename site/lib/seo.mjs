// Search and link-preview metadata for even.matic.sh: the <head> tags, the JSON-LD, robots.txt and sitemap.xml.
// build.mjs passes in its URL constants, so each URL is written once. site/og.mjs draws the share images.
// Node built-ins only, so site/og.mjs can import OG_IMAGE from here with plain Node.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Under about 60 characters, with the words people search for first. */
export const TITLE = 'Open-source Even Realities G2 glasses app toolkit · matic even'
/** 140 to 160 characters. Also the og: and twitter: description. */
export const DESCRIPTION = 'Open-source toolkit and field notes for building Even Realities G2 glasses apps: measured findings, '
  + 'glasses and phone UI, test tools, a demo app and AI skills.'
export const NAME = 'matic even'
export const KEYWORDS = ['Even Realities', 'Even G2', 'Even Realities G2', 'smart glasses', 'HUD', 'Even Hub',
  'glasses app', 'toolkit', 'TypeScript', 'field notes', 'Claude Code']

/** The share card, drawn by site/og.mjs at this size. checkHead() reads the PNG's header to hold the two together. */
export const OG_IMAGE = {
  path: 'assets/og.png', width: 1200, height: 630,
  alt: 'matic even: what we measured on Even Realities G2, and the parts to build apps on them. '
    + 'Beside the line, the demo checklist as the glasses show it.',
}
const PAGE_GREY = '#ededed'

/** The tags between the viewport and the stylesheet. `site` is the page's URL with no trailing slash. */
export function headTags({ site, repo, studio }) {
  const url = `${site}/`
  const image = `${site}/${OG_IMAGE.path}`
  const meta = (attr, key, value) => `<meta ${attr}="${key}" content="${esc(value)}">`
  return [
    `<title>${esc(TITLE)}</title>`,
    meta('name', 'description', DESCRIPTION),
    `<link rel="canonical" href="${url}">`,
    meta('name', 'theme-color', PAGE_GREY),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', NAME),
    meta('property', 'og:title', TITLE),
    meta('property', 'og:description', DESCRIPTION),
    meta('property', 'og:url', url),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', OG_IMAGE.width),
    meta('property', 'og:image:height', OG_IMAGE.height),
    meta('property', 'og:image:alt', OG_IMAGE.alt),
    meta('property', 'og:locale', 'en_US'),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', TITLE),
    meta('name', 'twitter:description', DESCRIPTION),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', OG_IMAGE.alt),
    '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="assets/favicon-32.png" type="image/png" sizes="32x32">',
    '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png" sizes="180x180">',
    `<script type="application/ld+json">${jsonLd({ site, repo, studio })}</script>`,
  ].join('\n  ')
}

/** A WebSite and a SoftwareSourceCode, as one @graph. `<` is escaped so the JSON cannot close the script tag. */
function jsonLd({ site, repo, studio }) {
  const url = `${site}/`
  const matic = { '@type': 'Organization', name: 'Matic', url: studio }
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${url}#website`, name: NAME, url, description: DESCRIPTION, inLanguage: 'en',
        publisher: matic },
      { '@type': 'SoftwareSourceCode', '@id': `${url}#code`, name: NAME, description: DESCRIPTION, url,
        codeRepository: repo, license: 'https://opensource.org/licenses/MIT', programmingLanguage: 'TypeScript',
        image: `${site}/${OG_IMAGE.path}`, keywords: KEYWORDS.join(', '), author: matic, publisher: matic },
    ],
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export const robotsTxt = site => `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`

/** The page only. setup.md, setup.txt and llms.txt are plain text for AI tools, not pages to land on from search. */
export const sitemapXml = (site, lastmod) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}/</loc><lastmod>${lastmod}</lastmod></url>
</urlset>
`

/**
 * Throws unless the built page carries every tag above, absolute image URLs, JSON-LD that parses, and a share card
 * in `dist` at the size the tags state.
 */
export function checkHead(html, site, dist) {
  const head = html.slice(0, html.indexOf('</head>'))
  const content = key => head.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1]
  const required = ['description', 'theme-color', 'og:type', 'og:site_name', 'og:title', 'og:description', 'og:url',
    'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'og:locale', 'twitter:card', 'twitter:title',
    'twitter:description', 'twitter:image', 'twitter:image:alt']
  const problems = required.filter(k => !content(k)).map(k => `no ${k}`)
  if (!head.includes(`<link rel="canonical" href="${site}/">`)) problems.push('no canonical link to the site URL')
  for (const k of ['og:image', 'twitter:image']) {
    if (content(k) && !content(k).startsWith(`${site}/`)) problems.push(`${k} is not an absolute URL on ${site}`)
  }
  const scripts = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1])
  if (!scripts.length) problems.push('no JSON-LD')
  for (const s of scripts) {
    let data
    try { data = JSON.parse(s) } catch (e) { problems.push(`JSON-LD does not parse: ${e.message}`); continue }
    const types = (data['@graph'] ?? [data]).map(n => n['@type'])
    for (const t of ['WebSite', 'SoftwareSourceCode']) if (!types.includes(t)) problems.push(`JSON-LD has no ${t}`)
  }
  const png = readFileSync(join(dist, OG_IMAGE.path))
  const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)]
  if (w !== OG_IMAGE.width || h !== OG_IMAGE.height) {
    problems.push(`${OG_IMAGE.path} is ${w}x${h}, not ${OG_IMAGE.width}x${OG_IMAGE.height}. Run node site/og.mjs`)
  }
  if (problems.length) throw new Error(`The page's <head> is missing search or share metadata:\n  ${problems.join('\n  ')}`)
}
