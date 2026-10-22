// Builds even.matic.sh: one page that scrolls through the whole project, from the repo itself.
//   - the docs markdown (findings, review lessons, probes, the probe's guide, contributing) with `marked`
//   - glasses primitives drawn as SVG by @maticsh/glasses, from the samples in site/samples/
//   - test tool output, by running the tool samples in site/samples/ with Node
//   - the phone parts, bundled from @maticsh/phone for the browser by Vite (site/live/phone.ts)
//   - the demo app and the probe, from the PNGs in site/assets/ (taken by site/capture.mjs)
//   - the AI section, from the skills' SKILL.md files, the plugin manifests and docs/ai/setup.md
// Output: site/dist/index.html, site/dist/assets/, and beside the page setup.md, setup.txt (docs/ai/setup.md as it
// is), llms.txt (an index of the docs for AI tools), robots.txt and sitemap.xml. The build fails on a broken link or
// anchor, or on missing search and share tags (lib/seo.mjs).
// Usage: npm run build --workspace site, after `npm ci` at the repo root. By hand: node --conditions=@maticsh/source site/build.mjs
// (the condition loads @maticsh/* from their TypeScript source, so the page never waits on a package build).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'
import { build as vite, defaultClientConditions } from 'vite'
import { LINE_HEIGHT } from '@maticsh/glasses'
import { PARTS } from './live/catalog.ts'
import { border, esc, gridPaths, outline, svg, textBox, textLine } from './lib/draw.mjs'
import { checkHead, headTags, robotsTxt, sitemapXml } from './lib/seo.mjs'

/** The repo's home. Not live yet: every GitHub link on the page is built from this one constant. */
const REPO = 'https://github.com/maticsh/matic-even'
/** Where the page is served. The suggested prompts, llms.txt, the canonical and share tags and the sitemap point here. */
const SITE_URL = 'https://even.matic.sh'
const ISSUES = `${REPO}/issues`
/** Issue numbers for the open questions on GitHub. A probe without one links to an issue search for its ID. */
const PROBE_ISSUES = { P3: 1, P4: 2, P8: 3, P10: 4, P12: 5, P13: 6, P14: 7 }
const MATIC = 'https://matic.sh'

const SITE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SITE, '..')
const DIST = join(SITE, 'dist')

const read = p => readFileSync(join(ROOT, p), 'utf8')
const exists = p => existsSync(join(ROOT, p))
const stripTags = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
/** GitHub's heading slug, so the repo's own #anchors keep working. */
const slug = text => text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')
const plain = s => s.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
const FINDING = /^H(\d+):\s*(.*)$/
const github = (path, frag = '') =>
  `${REPO}/${exists(path) && statSync(join(ROOT, path)).isDirectory() ? 'tree' : 'blob'}/main/${path}${frag ? `#${frag}` : ''}`
const issueHref = id => (PROBE_ISSUES[id] ? `${ISSUES}/${PROBE_ISSUES[id]}` : `${ISSUES}?q=${encodeURIComponent(`${id} in:title`)}`)

// Markdown: ids under a prefix per document, and links rewritten to anchors on this page or to GitHub

/** Repo files and folders that live on this page, and the id a link to them (and its #fragment) lands on. */
function anchorFor(path, frag) {
  let m
  if ((m = /^docs\/findings\/([\w-]+)\.md$/.exec(path))) {
    const h = /^h(\d+)(-|$)/i.exec(frag)
    return h ? `h${h[1]}` : frag ? `findings-${m[1]}-${frag}` : `findings-${m[1]}`
  }
  if ((m = /^docs\/probes\/(P\d+)\.md$/i.exec(path))) return `${m[1].toLowerCase()}${frag ? `-${frag}` : ''}`
  if ((m = /^docs\/review\/([\w-]+)\.md$/.exec(path))) return `review-${m[1]}${frag ? `-${frag}` : ''}`
  if (path === 'apps/probe/README.md' || path === 'apps/probe') return frag ? `probe-${frag}` : 'probe'
  if (path === 'CONTRIBUTING.md') return frag ? `contribute-${frag}` : 'contribute'
  if (path === 'docs/architecture.md') return frag ? `architecture-${frag}` : 'architecture'
  const whole = {
    'README.md': 'top', 'docs/findings': 'findings', 'docs/review': 'review', 'docs/probes': 'probes',
    'packages/glasses/README.md': 'glasses', 'packages/glasses': 'glasses', 'packages/phone/README.md': 'phone',
    'packages/phone': 'phone', 'packages/testing/README.md': 'tools', 'packages/testing': 'tools',
    'apps/checklist/README.md': 'demo', 'apps/checklist': 'demo', 'apps/relay/README.md': 'relay', 'apps/relay': 'relay',
    'skills/README.md': 'skills', 'skills': 'skills',
  }[path]
  return whole && !frag ? whole : null
}

/** The document being rendered: its path (for relative links) and the prefix for its heading ids. */
let ctx = { src: '', prefix: '', shift: 1 }
/** Every #id the page links to, checked once the page is written. */
const linked = []

/** Rewrite one href from the markdown. Returns the new href, and the id when it lands on this page. */
function rewrite(href) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { href }
  const [path, frag = ''] = href.split('#')
  const repoPath = path ? posix.normalize(posix.join(posix.dirname(ctx.src), path)).replace(/\/$/, '') : ctx.src
  const id = anchorFor(repoPath, frag)
  if (id) { linked.push({ id, from: `${ctx.src}: ${href}` }); return { href: `#${id}`, id } }
  if (!exists(repoPath)) { linked.push({ missing: repoPath, from: `${ctx.src}: ${href}` }); return { href: '#' } }
  return { href: github(repoPath, frag) }
}

/** What a part of this page is called, for links whose text is a repo file name ("lifecycle.md", "display.md#H1"). */
const titles = new Map([
  ['top', 'the README'], ['findings', 'findings'], ['review', 'store review'], ['probes', 'open questions'],
  ['probe', 'the probe app'], ['contribute', 'contributing'], ['demo', 'Checklist'], ['skills', 'the skills'],
  ['glasses', '@maticsh/glasses'], ['phone', '@maticsh/phone'], ['tools', '@maticsh/testing'], ['relay', 'the relay server'],
  ['architecture', 'how Checklist is built'],
])
function titleOf(id) {
  if (/^[hp]\d+$/.test(id)) return id.toUpperCase()
  for (let parts = id.split('-'); parts.length; parts.pop()) {
    const t = titles.get(parts.join('-'))
    if (t) return t
  }
  return null
}
const FILE_NAME = /^[\w./-]+(\.md|\/)(#[\w-]+)?$/i

const md = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens)
      const level = Math.min(6, depth + ctx.shift)
      return `<h${level} id="${ctx.prefix}-${slug(stripTags(inner))}">${inner}</h${level}>\n`
    },
    link({ href, title, tokens }) {
      const t = title ? ` title="${esc(title)}"` : ''
      const to = rewrite(href)
      let inner = this.parser.parseInline(tokens)
      // On this page a link reads as the part it opens, not as the file it came from.
      const name = to.id && FILE_NAME.test(stripTags(inner)) && titleOf(to.id)
      if (name) inner = esc(name)
      return `<a href="${esc(to.href)}"${t}>${inner}</a>`
    },
    table(token) {
      const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`
      const head = token.header.map(c => cell(c, 'th')).join('')
      const body = token.rows.map(r => `<tr>${r.map(c => cell(c, 'td')).join('')}</tr>`).join('\n')
      return `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>\n`
    },
    code({ text, lang }) {
      return `<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(text)}</code></pre>\n`
    },
  },
})

/** `<a id="h12"></a>` lines give GitHub short anchors. The page sets the same ids itself. */
const isAnchorLine = t => (t.type === 'paragraph' || t.type === 'html') && /^<a id="[hp]\d+"><\/a>$/.test(t.raw.trim())

function render(tokens, src, prefix, shift = 2) {
  const saved = ctx
  ctx = { src, prefix, shift }
  try { return md.parser(tokens.filter(t => !isAnchorLine(t))) } finally { ctx = saved }
}
function inline(text, src) {
  const saved = ctx
  ctx = { src, prefix: '', shift: 1 }
  try { return md.parseInline(text) } finally { ctx = saved }
}
const lex = src => md.lexer(read(src))
/** A paragraph's HTML without its <p>, for a line the page wraps itself. */
const bare = html => html.trim().replace(/^<p>|<\/p>$/g, '')

/** Split tokens at headings of `depth`: what comes before the first one, then each heading with its body. */
function split(tokens, depth) {
  const head = [], parts = []
  for (const t of tokens) {
    if (t.type === 'heading' && t.depth === depth) parts.push({ title: t.text, tokens: [] })
    else (parts.at(-1)?.tokens ?? head).push(t)
  }
  return { head, parts }
}
const drop = (tokens, type) => tokens.filter(t => t.type !== type)
/** Every code block in some tokens, inside list items too. */
const codeTokens = tokens => tokens.flatMap(t => (t.type === 'code' ? [t]
  : [...codeTokens(t.tokens ?? []), ...(t.items ?? []).flatMap(i => codeTokens(i.tokens ?? []))]))
const withoutTitle = tokens => tokens.filter(t => !(t.type === 'heading' && t.depth === 1))

/** Each `## section` of a document as a <details>, id'd under the document's prefix. */
function sectionsAsDetails(parts, src, prefix, { open = [] } = {}) {
  return parts.map(p => {
    const id = `${prefix}-${slug(plain(p.title))}`
    return `<details class="more" id="${id}"${open.includes(p.title) ? ' open' : ''}><summary>${inline(p.title, src)}</summary>`
      + `<div class="md">${render(drop(p.tokens, 'hr'), src, prefix, 3)}</div></details>`
  }).join('\n')
}

// The repo's content

const readme = split(lex('README.md'), 2)
const section = name => {
  const s = readme.parts.find(p => p.title === name)
  if (!s) throw new Error(`README.md has no "## ${name}" section`)
  return s.tokens
}
/** Link targets in a run of tokens, in order. */
function linksIn(tokens) {
  const out = []
  const walk = ts => {
    for (const t of ts ?? []) {
      if (t.type === 'link') out.push(t.href.split('#')[0])
      walk(t.tokens)
      if (t.items) walk(t.items)
      if (t.rows) t.rows.flat().forEach(c => walk(c.tokens))
    }
  }
  walk(tokens)
  return out
}
function ordered(dir, preferred, sort = (a, b) => a.localeCompare(b)) {
  const files = readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.md')).map(f => `${dir}/${f}`).sort(sort)
  const first = [...new Set(preferred.map(p => posix.normalize(p)).filter(p => files.includes(p)))]
  return [...first, ...files.filter(f => !first.includes(f))]
}

// Findings, by topic, in the README's order.
const topics = ordered('docs/findings', linksIn(section('Findings'))).map(src => {
  const tokens = lex(src)
  const title = plain(tokens.find(t => t.type === 'heading' && t.depth === 1)?.text ?? '')
  const { head, parts } = split(withoutTitle(tokens), 2)
  const key = posix.basename(src, '.md')
  const findings = [], notes = []
  for (const p of parts) {
    const f = FINDING.exec(p.title)
    const body = drop(p.tokens, 'hr')
    if (f) findings.push({ n: Number(f[1]), title: f[2], src, body, date: /\*\*Date\.\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(body.map(t => t.raw).join(''))?.[1] })
    else notes.push({ title: p.title, body })
  }
  return { src, key, title, intro: drop(head, 'hr'), findings, notes }
})
const findings = topics.flatMap(t => t.findings)
const ids = findings.map(f => f.n)
const dates = findings.map(f => f.date).filter(Boolean).sort()

// Review lessons, in the README's order.
const lessons = ordered('docs/review', linksIn(section('Store review'))).map(src => {
  const tokens = lex(src)
  const h1 = tokens.find(t => t.type === 'heading' && t.depth === 1)?.text ?? ''
  const { head, parts } = split(withoutTitle(tokens), 2)
  return { src, key: posix.basename(src, '.md'), title: plain(h1).replace(/^Review:\s*(.)/, (_, c) => c.toUpperCase()), head, parts }
})

// Open probes, by number.
const probeNum = f => Number(/P(\d+)/.exec(f)?.[1] ?? 0)
const probes = ordered('docs/probes', [], (a, b) => probeNum(a) - probeNum(b)).map(src => {
  const tokens = lex(src)
  const h1 = tokens.find(t => t.type === 'heading' && t.depth === 1)?.text ?? ''
  const m = /^(P\d+):\s*(.*)$/.exec(h1)
  if (!m) throw new Error(`${src}: the title must read "P<n>: <question>"`)
  return { src, id: m[1], question: m[2], tokens: withoutTitle(tokens) }
})

for (const t of topics) titles.set(`findings-${t.key}`, t.title.toLowerCase())
for (const l of lessons) titles.set(`review-${l.key}`, l.title.charAt(0).toLowerCase() + l.title.slice(1))

const probeGuide = split(withoutTitle(lex('apps/probe/README.md')), 2)
const probePkg = JSON.parse(read('apps/probe/package.json'))
const checklist = split(withoutTitle(lex('apps/checklist/README.md')), 2)
const architecture = split(withoutTitle(lex('docs/architecture.md')), 2)
const relayDoc = split(withoutTitle(lex('apps/relay/README.md')), 2)
const contributing = split(withoutTitle(lex('CONTRIBUTING.md')), 2)
const skills = split(withoutTitle(lex('skills/README.md')), 2)
const testing = split(withoutTitle(lex('packages/testing/README.md')), 2)

// The skills, from each SKILL.md: its name, the first sentence of its description, and its ## headings.
/** Headings about the skill file itself, not what it teaches. */
const SKILL_META = ['Links', 'Keep this skill current']
const skillList = readdirSync(join(ROOT, 'skills/skills')).sort().map(dir => `skills/skills/${dir}/SKILL.md`).filter(exists).map(src => {
  const text = read(src)
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text)
  const field = key => front && new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front[1])?.[1].trim()
  const name = field('name'), description = field('description')
  if (!name || !description) throw new Error(`${src} needs a name and a description in its frontmatter`)
  const topics = md.lexer(text.slice(front[0].length)).filter(t => t.type === 'heading' && t.depth === 2)
    .map(t => plain(t.text).replace(/^\d+\.\s*/, '').replace(/\s*\([^)]*\)$/, ''))
    .filter(t => !SKILL_META.includes(t))
  return { src, name, summary: /^.+?\.(?=\s|$)/.exec(description)?.[0] ?? description, topics }
})
const plugin = JSON.parse(read('skills/.claude-plugin/plugin.json'))
const marketplace = JSON.parse(read('.claude-plugin/marketplace.json'))
/** "maticsh/matic-even": what `plugin marketplace add` takes. */
const REPO_SLUG = new URL(REPO).pathname.replace(/^\/|\/$/g, '')
const SETUP = 'docs/ai/setup.md'

/** Rows in a package README's first "## Exports" table: the primitives it names. */
function exportRows(pkg) {
  const { parts } = split(lex(`packages/${pkg}/README.md`), 2)
  const table = parts.find(p => p.title === 'Exports')?.tokens.find(t => t.type === 'table')
  if (!table) throw new Error(`packages/${pkg}/README.md has no Exports table`)
  return table.rows.length
}
const primitives = { glasses: exportRows('glasses'), phone: exportRows('phone'), testing: exportRows('testing') }
const counts = {
  findings: findings.length, topics: topics.length, lessons: lessons.length, probes: probes.length,
  primitives: primitives.glasses + primitives.phone + primitives.testing,
}

// Glasses UI: each picture drawn from a sample's own exports

const sample = name => import(`./samples/${name}.ts`)
const sampleCode = name => readFileSync(join(SITE, 'samples', `${name}.ts`), 'utf8').trim()

async function glassesSpecimens() {
  const ab = await sample('action-bar')
  const gl = await sample('glyphs')
  const fit = await sample('fit')
  const pg = await sample('page')

  const actionBar = svg(288, 34 + ab.font.h, gridPaths(ab.bar, { y: 2 }) + gridPaths(ab.font, { y: 34 }),
    { label: 'An action bar drawn in the pixel font, then every character the pixel font has.', zoom: 2, cls: 'px' })

  const glyphLines = [gl.progress, gl.draining, gl.steps, gl.frames.join('   ')]
  const glyphs = svg(288, glyphLines.length * LINE_HEIGHT + 4,
    glyphLines.map((l, i) => textLine(l, 0, 2 + i * LINE_HEIGHT).svg).join(''),
    { label: 'A progress bar, a draining bar, a sparkline and four spinner frames, as firmware text.', zoom: 1.5 })

  const W = 288, gap = 24
  const boxes = [
    { y: 14, lines: 2, name: 'fitLines · 2 lines', text: fit.fitted, many: true },
    { y: 14 + 2 * LINE_HEIGHT + gap, lines: 1, name: 'truncate', text: fit.line },
    { y: 14 + 3 * LINE_HEIGHT + 2 * gap, lines: 1, name: 'spread', text: fit.status },
  ]
  const fitted = svg(W, boxes.at(-1).y + LINE_HEIGHT + 2, boxes.map(b => {
    const box = { x: 0, y: b.y, width: W, height: b.lines * LINE_HEIGHT }
    return outline(box, b.name) + (b.many ? textBox(b.text, box) : textLine(b.text, 0, b.y).svg)
  }).join(''), { label: 'Text cut to two lines with an ellipsis, one line cut by pixels, and a line with text at both ends, each 288 px wide.', zoom: 1.5 })

  // The page builder's own output: the payload it built, drawn where the glasses would draw it.
  const { create } = pg.page
  const all = [...(create.textObject ?? []), ...(create.listObject ?? []), ...(create.imageObject ?? [])]
    .sort((a, b) => a.zOrderIndex - b.zOrderIndex)
  let body = ''
  for (const c of all) {
    const box = { x: c.xPosition, y: c.yPosition, width: c.width, height: c.height }
    body += outline(box)
    if ('content' in c) body += border(box, c) + textBox(c.content ?? '', box, { inset: (c.paddingLength ?? 0) + (c.borderWidth ?? 0) })
    const img = pg.images[c.containerName]
    if (img) body += gridPaths(img, { x: box.x, y: box.y + Math.floor((box.height - img.h) / 2) })
  }
  const page = svg(576, 288, body, { label: 'A page built by buildPage: a dot-matrix clock, the day, a note, a bordered box and an action bar.', cls: 'frame' })
  const kind = c => ('content' in c ? 'text' : 'itemContainer' in c ? 'list' : 'image')
  const rows = all.map(c => `<tr><td class="mono">${c.containerID}</td><td class="mono">${esc(c.containerName)}</td><td>${kind(c)}</td>`
    + `<td class="mono">${c.xPosition}, ${c.yPosition}</td><td class="mono">${c.width} × ${c.height}</td><td>${c.isEventCapture ? 'yes' : ''}</td></tr>`).join('')
  const table = `<div class="tw"><table class="mini"><thead><tr><th>id</th><th>name</th><th>kind</th><th>x, y</th><th>size</th><th>capture</th></tr></thead><tbody>${rows}</tbody></table></div>`

  return [
    { id: 'action-bar', title: 'Action bar in the pixel font', code: 'action-bar', pic: actionBar,
      cap: '288 × 20 image, then the font. Drawn at 2×.',
      use: 'a line of gestures and what they do, sent as an image. The pixel font is smaller than the firmware font, and has gesture symbols the firmware font lacks.' },
    { id: 'glyphs', title: 'Bars, sparklines and spinners', code: 'glyphs', pic: glyphs,
      cap: 'Firmware text. Drawn at 1.5×.',
      use: 'progress, a trend or a wait, as plain text from glyphs the firmware font has.' },
    { id: 'fit', title: 'Text that fits', code: 'fit', pic: fitted,
      cap: 'Firmware text in 288 px. Drawn at 1.5×.',
      use: 'text that has to fit a box. The firmware wraps by pixels, scrolls what overflows, and has no alignment.' },
    { id: 'page', title: 'A page from a spec', code: 'page', pic: page, wide: true, after: table,
      cap: 'buildPage output at 576 × 288, each container outlined.',
      use: 'a page as data. It assigns IDs, checks the limits, keeps exactly one capture container and re-attaches the menu on every rebuild.' },
  ]
}

// Test tools: each sample run with Node, its output shown as printed

function runSample(name) {
  // execArgv passes --conditions=@maticsh/source on to the sample, so it runs the packages' source too.
  return execFileSync(process.execPath, [...process.execArgv, join(SITE, 'samples', `${name}.ts`)], { cwd: SITE, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }).trimEnd()
}
const TOOLS = [
  { id: 'fake-bridge', title: 'FakeBridge', code: 'fake-bridge',
    use: 'unit tests with no glasses. It records every call, and checks each payload the way the SDK and firmware would.' },
  { id: 'manifest', title: 'Manifest lint', code: 'manifest',
    use: 'checking `app.json` against the packaging and review rules, in your tests.' },
  { id: 'urls', title: 'URL scan', code: 'urls',
    use: 'checking a built bundle the way store review does: every URL string must be on the network whitelist. `npx maticsh-urls` in an app\'s folder runs it on a build.' },
]

// The page

/** Prompts to copy, under Get started, "With AI". */
const PROMPTS = [
  `Set up matic even on this computer by following ${SITE_URL}/setup.md`,
  'Build a G2 app that shows my next calendar event, starting from apps/checklist.',
  "Add a settings page to my app's phone side with @maticsh/phone: a toggle and a slider.",
  "Why doesn't my tap reach the app on the glasses? Check the findings first.",
  'Run the preflight on my app before I submit it to Even Hub.',
  'Help me run open question P3 with the probe app, and write up the result for a pull request.',
]

/**
 * The page's outline: four sections, each with its subsections. The contents card, the top bar, the section
 * numbers and the headings all come from here. A subsection keeps the id it had before the page had sections.
 */
const SECTIONS = [
  { id: 'components', title: 'Components', lede: 'Three packages to build a G2 app from, shown working on this page, the demo app that puts them together, and a server for outside data.', subs: [
    { id: 'glasses', title: 'Glasses UI', line: 'Action bars, glyphs, text fit and pages, drawn by the package.', count: `${primitives.glasses} exports`, html: glassesSection },
    { id: 'phone', title: 'Phone UI', line: 'The phone page\'s parts, live on this page.', count: `${PARTS.length} parts`, html: phoneSection },
    { id: 'tools', title: 'Test tools', line: 'A fake bridge, the manifest lint and the URL scan.', count: `${primitives.testing} exports`, html: toolsSection },
    { id: 'demo', title: 'The demo app', line: 'Checklist puts the parts together on the glasses and the phone. Copy it to start your own app.', count: 'apps/checklist', html: demoSection },
    { id: 'relay', title: 'Relay server', line: 'A small server your app can whitelist, to fetch everything else.', count: 'apps/relay', html: relaySection },
  ] },
  { id: 'research', title: 'Probe & findings', lede: 'How we measure the G2 with our probe app, and what store review taught us.', subs: [
    { id: 'probe', title: 'The probe app', line: 'The app we measure with.', count: `v${probePkg.version}`, html: probeSection },
    { id: 'findings', title: 'Findings', line: 'What we found, by topic.', count: `${counts.findings} findings`, html: findingsSection },
    { id: 'probes', title: 'Open questions', line: 'Questions anyone with a G2 can help answer.', count: `${counts.probes} questions`, html: probesSection },
    { id: 'review', title: 'Store review', line: 'Checks to run before you submit.', count: `${counts.lessons} lessons`, html: reviewSection },
  ] },
  { id: 'ai', title: 'AI', lede: 'Two skills: one teaches your AI the G2 platform and its traps, one checks your app before review.', subs: [
    { id: 'skills', title: 'Skills', line: 'The topics the skills cover.', count: `${skillList.length} skills`, html: skillsSection },
    { id: 'plugin', title: 'Claude Code plugin', line: 'Install the skills in Claude Code, or point another AI at them.', count: `v${plugin.version}`, html: pluginSection },
  ] },
  { id: 'get-started', title: 'Get started', lede: 'Let your AI set up your computer, or do it by hand. Then send back what you learn.', subs: [
    { id: 'ai-start', title: 'Start building with AI', line: 'Setup steps your AI can follow, and prompts to try.', count: `${PROMPTS.length} prompts`, html: aiStartSection },
    { id: 'start', title: 'Start building by hand', line: 'Clone, check, run the demo, sideload.', count: '', html: startSection },
    { id: 'contribute', title: 'Contribute', line: 'Send a finding, a probe result or code.', count: '', html: contributeSection },
  ] },
]
/** "01" for a section, "1.1" for a subsection, as in the contents. */
const numbers = new Map(SECTIONS.flatMap((s, i) => [[s.id, String(i + 1).padStart(2, '0')], ...s.subs.map((u, j) => [u.id, `${i + 1}.${j + 1}`])]))
const subTitles = new Map(SECTIONS.flatMap(s => s.subs.map(u => [u.id, u.title])))

const codeBlock = (text, lang = '') => `<pre class="code"${lang ? ` data-lang="${lang}"` : ''}><code>${esc(text)}</code></pre>`
/** A subsection's heading: its number and title, a small label, and a lede. */
const head = (id, label, lede) =>
  `<div class="sh"><h3><a href="#${id}"><span class="no mono">${numbers.get(id)}</span>${esc(subTitles.get(id))}</a></h3>${label ? `<p class="k">${label}</p>` : ''}</div>${lede ? `<p class="lede">${lede}</p>` : ''}`
const sourceLink = path => `<p class="src mono">source · <a href="${github(path)}">${esc(path)}</a></p>`
const firstParagraph = tokens => tokens.find(t => t.type === 'paragraph')
/** A button that copies the text of the element with this id. It shows only with script. */
const copyButton = (target, label, cls = '') => `<button class="copy mono${cls ? ` ${cls}` : ''}" type="button" data-copy="${target}" aria-label="${esc(label)}">Copy</button>`

function hero() {
  const range = dates.length ? `<span class="nw">${dates[0]}</span> to <span class="nw">${dates.at(-1)}</span>` : ''
  return `<section class="hero" aria-labelledby="title">
  <div class="hero-text">
    <h1 id="title">matic even</h1>
    <p class="lede">We measured a pair of Even Realities G2 glasses. Here is what we found, and the parts to build a G2 app on them: glasses UI, phone UI, test tools, a demo app and a skill for your AI.</p>
    <p class="cta"><a class="btn ink" href="#ai-start">Get started with AI</a><a class="btn" href="${REPO}">GitHub</a></p>
    <p class="manual"><a href="#start">or get started manually</a></p>
    <ul class="counts mono">
      <li><a href="#findings">${counts.findings} findings</a></li><li><a href="#review">${counts.lessons} review lessons</a></li>
      <li><a href="#probes">${counts.probes} open questions</a></li><li><a href="#glasses">${counts.primitives} primitives</a></li>
    </ul>
    ${range ? `<p class="by">Measured by <a href="${MATIC}">Matic</a>, ${range}.</p>` : ''}
  </div>
  <figure class="glass hero-glass">
    <img src="assets/checklist.png" width="576" height="288" alt="Checklist on the glasses: the title packing, five items with empty tick boxes, a pointer on passport, and the gestures tick and move along the bottom.">
    <figcaption class="mono">checklist, the demo app, on even's simulator</figcaption>
  </figure>
</section>`
}

/** The contents under the hero: the four sections, and under each its subsections with a line and a count. */
function toc() {
  const subRow = u => `<li><a href="#${u.id}"><span class="n mono">${numbers.get(u.id)}</span><span class="t">${esc(u.title)}</span><span class="d">${esc(u.line)}</span><span class="c mono">${esc(u.count)}</span></a></li>`
  const blocks = SECTIONS.map(s => `<li class="ts">
      <a class="ts-h" href="#${s.id}"><span class="n mono">${numbers.get(s.id)}</span><span class="t">${esc(s.title)}</span></a>
      <ol>${s.subs.map(subRow).join('')}</ol>
    </li>`).join('\n    ')
  return `<nav class="toc" id="toc" aria-labelledby="toc-title">
  <h2 id="toc-title" class="mono">contents</h2>
  <ol class="toc-secs">
    ${blocks}
  </ol>
</nav>`
}

/** One of the four sections: number, title and lede over an ink rule, then its subsections. */
async function sectionHtml(s) {
  const subs = []
  for (const u of s.subs) subs.push(await u.html())
  return `<section id="${s.id}" class="sec">
<div class="sh"><h2><a href="#${s.id}"><span class="no mono">${numbers.get(s.id)}</span>${esc(s.title)}</a></h2></div>
<p class="lede">${s.lede}</p>
${subs.join('\n\n')}
</section>`
}

async function glassesSection() {
  const specs = await glassesSpecimens()
  const items = specs.map(s => `<article class="spec${s.wide ? ' wide' : ''}" id="glasses-${s.id}">
  <figure class="pic"><div class="well${s.wide ? ' full' : ''}">${s.pic}</div><figcaption class="mono">${esc(s.cap)}</figcaption>${s.after ?? ''}</figure>
  <div class="about"><h4>${esc(s.title)}</h4><p class="use">Use it for ${esc(s.use)}</p>${codeBlock(sampleCode(s.code), 'ts')}${sourceLink(`site/samples/${s.code}.ts`)}</div>
</article>`).join('\n')
  return `<section id="glasses" class="sub">
${head('glasses', `@maticsh/glasses · ${primitives.glasses} exports`, `Drawn by <code>@maticsh/glasses</code> when this page was built, from the code beside each picture. Text in the firmware font is set at that font's measured widths, in your system font.`)}
<div class="specs">
${items}
</div>
<p class="more-link">The package also covers input, the write queue, the renderer, storage, the lifecycle, time labels and PNG encoding: <a href="${github('packages/glasses/README.md')}">packages/glasses</a>.</p>
</section>`
}

function phoneSection() {
  const items = PARTS.map(p => `<article class="part" id="phone-${p.id}">
  <h4>${esc(p.name)}${p.live ? '' : ' <span class="static mono">static</span>'}</h4>
  <div class="ph" data-part="${p.id}" role="group" aria-label="${esc(p.name)}"></div>
  <p class="said mono" data-said="${p.id}" aria-live="polite"></p>
  <p class="use">Use it for ${esc(p.use)}</p>
  <p class="call mono">${esc(p.call)}</p>
</article>`).join('\n')
  return `<section id="phone" class="sub">
${head('phone', `@maticsh/phone · ${primitives.phone} exports`, `Parts from <code>@maticsh/phone</code>, running on this page with the package's own code and stylesheet. Tap them. The rows, the toggle and the segmented control drive the preview and the strip.`)}
<noscript><p class="lede">The phone parts need JavaScript.</p></noscript>
<div class="parts">
${items}
</div>
<p class="more-link">Each part is a plain function that returns HTML, and one listener per page routes the taps: <a href="${github('packages/phone/README.md')}">packages/phone</a>. A dev-only Kit view shows every part in each variant.</p>
</section>`
}

function demoSection() {
  const shows = checklist.parts.find(p => p.title === 'What it shows')
  const template = checklist.parts.find(p => p.title === 'Use it as a template')
  if (!shows || !template) throw new Error('apps/checklist/README.md needs "What it shows" and "Use it as a template"')
  const src = 'apps/checklist/README.md'
  return `<section id="demo" class="sub">
${head('demo', 'apps/checklist', bare(render([firstParagraph(checklist.head)], src, 'demo')))}
<div class="demo-pics">
  <figure class="glass"><img src="assets/checklist-ticked.png" width="576" height="288" loading="lazy" alt="Checklist on the glasses after two ticks: passport and charger ticked, the pointer on glasses case.">
    <figcaption class="mono">the glasses, on even's simulator, after tap · swipe · tap · swipe</figcaption></figure>
  <figure class="phone-shot"><img src="assets/checklist-phone.png" width="390" height="844" loading="lazy" alt="Checklist's phone page on the Items tab: the glasses preview, the list picker, and five items with tick boxes and Edit buttons.">
    <figcaption class="mono">its phone page, at 390 wide</figcaption></figure>
</div>
<div class="cols">
  <div class="md"><h4 id="demo-what-it-shows">What it shows</h4>${render(shows.tokens, src, 'demo', 3)}</div>
  <div class="md"><h4 id="demo-use-it-as-a-template">Use it as a template</h4>${render(template.tokens, src, 'demo', 3)}</div>
</div>
${architectureHtml()}
</section>`
}

/** docs/architecture.md under the demo: the diagram open, every other part folded. */
function architectureHtml() {
  const src = 'docs/architecture.md'
  const [parts, ...rest] = architecture.parts
  if (parts?.title !== 'The parts' || !rest.length) throw new Error(`${src} needs "The parts" first, then more sections`)
  return `<div class="arch">
<h4 id="architecture">How it's built</h4>
<div class="md">${render(parts.tokens, src, 'architecture', 3)}</div>
<div class="guide">
${sectionsAsDetails(rest, src, 'architecture')}
</div>
<p class="more-link">The whole page is <a href="${github(src)}">${src}</a>.</p>
</div>`
}

function relaySection() {
  const src = 'apps/relay/README.md'
  const part = title => relayDoc.parts.find(p => p.title === title) ?? (() => { throw new Error(`${src} needs "${title}"`) })()
  const safety = part('Safety').tokens.find(t => t.type === 'table')
  const app = codeTokens(part('The app side').tokens)
  const manifest = app.find(t => t.lang === 'json')
  const call = app.find(t => t.lang === 'ts')
  const degit = codeTokens(part('Use it as a template').tokens).find(t => t.text.includes('degit'))
  if (!safety || !manifest || !call || !degit) throw new Error(`${src}: the site needs the Safety table, the app side's json and ts blocks, and the degit line`)
  const intro = relayDoc.head.filter(t => t.type === 'paragraph')
  return `<section id="relay" class="sub">
${head('relay', 'apps/relay · node 24 · no dependencies')}
<div class="md lede-md">${render(intro, src, 'relay')}</div>
<div class="cols">
  <div class="md"><h4 id="relay-safety">Safety, on by default</h4>${render([safety], src, 'relay', 3)}</div>
  <div class="md">
    <h4 id="relay-the-app-side">The app side</h4>
    <p>Put the relay's origin on the whitelist in <code>app.json</code>:</p>${codeBlock(manifest.text, 'json')}
    <p>Then call it with the outside URL as data:</p>${codeBlock(call.text, 'ts')}
    <h4 id="relay-use-it-as-a-template">Use it as a template</h4>${codeBlock(degit.text, 'sh')}
  </div>
</div>
<p class="more-link">The routes, the settings, open mode, the key, the cache and how to deploy it: <a href="${github(src)}">apps/relay/README.md</a>.</p>
</section>`
}

function toolsSection() {
  const lede = bare(render([firstParagraph(testing.head)], 'packages/testing/README.md', 'tools'))
  const items = TOOLS.map(t => `<article class="tool" id="tools-${t.id}">
  <h4>${esc(t.title)}</h4><p class="use">Use it for ${inline(t.use, 'README.md')}</p>
  <div class="io">
    <div>${codeBlock(sampleCode(t.code), 'ts')}${sourceLink(`site/samples/${t.code}.ts`)}</div>
    <div><p class="k">output</p><pre class="out"><code>${esc(runSample(t.code))}</code></pre></div>
  </div>
</article>`).join('\n')
  return `<section id="tools" class="sub">
${head('tools', `@maticsh/testing · ${primitives.testing} exports`, lede)}
${items}
</section>`
}

function findingsSection() {
  const setup = render(section('Who measured it, and on what'), 'README.md', 'findings-setup', 3)
  const groups = topics.map(t => {
    const rows = t.findings.map(f => `<details class="f" id="h${f.n}">
  <summary><a class="hid mono" href="#h${f.n}">H${f.n}</a><span class="claim">${inline(f.title, f.src)}</span></summary>
  <div class="md">${render(f.body, f.src, `h${f.n}`, 3)}</div>
</details>`).join('\n')
    const notes = t.notes.map(n => `<div class="open-note" id="findings-${t.key}-${slug(plain(n.title))}"><p class="k">${inline(n.title, t.src)}</p>${render(n.body, t.src, `findings-${t.key}`, 3)}</div>`).join('')
    return `<div class="topic-group" id="findings-${t.key}">
  <div class="tg-head"><h4>${esc(t.title)} <span class="mono n">${t.findings.length}</span></h4>${render(t.intro, t.src, `findings-${t.key}`, 3)}</div>
  ${rows}${notes}
</div>`
  }).join('\n')
  // A topic, its count and the dot after it never break apart.
  const byTopic = topics.map((t, i) => `<span class="nw"><a href="#findings-${t.key}">${esc(t.title.toLowerCase())}</a> <span class="n">${t.findings.length}</span>`
    + `${i < topics.length - 1 ? '<span class="sep"> ·</span>' : ''}</span>`).join(' ')
  return `<section id="findings" class="sub">
${head('findings', `H${Math.min(...ids)} to H${Math.max(...ids)} · ${counts.topics} topics`, `Each finding states a measured claim and what it means for your app. The IDs are stable, so you can cite them: <a href="#h12">#h12</a>.`)}
<p class="topics mono">${byTopic}</p>
<details class="more setup" id="findings-setup"><summary>Who measured it, and on what</summary><div class="md">${setup}</div></details>
${groups}
</section>`
}

function reviewSection() {
  const items = lessons.map(l => `<article class="lesson" id="review-${l.key}">
  <h4>${esc(l.title)}</h4>
  <div class="md">${render(l.head, l.src, `review-${l.key}`, 3)}</div>
  ${sectionsAsDetails(l.parts, l.src, `review-${l.key}`)}
</article>`).join('\n')
  return `<section id="review" class="sub">
${head('review', `${counts.lessons} lessons`, 'Lessons from rejections at Even Hub review, written as checks you can run before you submit.')}
<div class="lessons">
${items}
</div>
</section>`
}

function probesSection() {
  const rows = probes.map(p => `<details class="f probe" id="${p.id.toLowerCase()}">
  <summary><a class="hid mono" href="#${p.id.toLowerCase()}">${p.id}</a><span class="claim">${inline(p.question, p.src)}</span><a class="topic mono" href="${issueHref(p.id)}">issue</a></summary>
  <div class="md">${render(p.tokens, p.src, p.id.toLowerCase(), 3)}</div>
</details>`).join('\n')
  const report = contributing.parts.find(p => p.title === 'Report a probe result')
  if (!report) throw new Error('CONTRIBUTING.md needs "Report a probe result"')
  return `<section id="probes" class="sub">
${head('probes', `${counts.probes} questions`, 'Questions we have not answered yet. Anyone with a G2 can run one and send the result.')}
<div class="cols probes-cols">
  <div class="rows">${rows}</div>
  <div class="md how"><h4 id="probes-how">How to run one</h4>${render(report.tokens, 'CONTRIBUTING.md', 'probes-how', 3)}</div>
</div>
</section>`
}

function probeSection() {
  const intro = probeGuide.head.filter(t => t.type === 'paragraph')
  return `<section id="probe" class="sub">
${head('probe', `apps/probe · v${esc(probePkg.version)}`)}
<div class="cols probe-top">
  <div class="md">${render(intro, 'apps/probe/README.md', 'probe')}
    ${codeBlock('npm ci                 # at the repo root\ncd apps/probe\nnpm run dev            # the dev server, on port 5199\nnpm run qr             # in a second terminal: scan it in the Even app', 'sh')}
    <p>The first time, turn on developer mode in the Even app: <a href="#probe-run-it-on-your-glasses">run it on your glasses</a>.</p>
  </div>
  <figure class="glass"><img src="assets/probe.png" width="576" height="288" loading="lazy" alt="The probe's main page on the glasses: uptime, a heartbeat count with gaps, the wearing sensor, the last events and image, and a gesture bar.">
    <figcaption class="mono">the probe's main page, on even's simulator</figcaption></figure>
</div>
<div class="guide">
${sectionsAsDetails(probeGuide.parts, 'apps/probe/README.md', 'probe', { open: ['The pages'] })}
</div>
</section>`
}

function skillsSection() {
  const rows = skillList.map(k => `<article class="skill" id="skills-${k.name}">
  <p class="name mono"><a href="${github(k.src)}">${esc(k.name)}</a></p>
  <div class="what"><p>${esc(k.summary)}</p><p class="topics-line">${k.topics.map((t, i) => `<span class="nw">${esc(t)}${i < k.topics.length - 1 ? '<span class="sep"> ·</span>' : ''}</span>`).join(' ')}</p></div>
  <p class="call mono">/${esc(plugin.name)}:${esc(k.name)}</p>
</article>`).join('\n')
  return `<section id="skills" class="sub">
${head('skills', `skills/skills · ${skillList.length} skills`, 'Skills that teach your AI to build, test and ship G2 apps. Claude Code loads one when your request matches it, and you can call one by name.')}
<div class="skills">
${rows}
</div>
</section>`
}

function pluginSection() {
  const install = `${plugin.name}@${marketplace.name}`
  const ways = [
    ['In a terminal', 'Adds the repo as a plugin marketplace, then installs the plugin from it.',
      codeBlock(`claude plugin marketplace add ${REPO_SLUG}\nclaude plugin install ${install}`, 'sh')],
    ['Inside a Claude Code session', 'The same two steps, as slash commands.',
      codeBlock(`/plugin marketplace add ${REPO_SLUG}\n/plugin install ${install}`)],
    ['From a clone, without installing', 'At the root of the repo. The plugin lasts for that session.',
      codeBlock('claude --plugin-dir skills', 'sh')],
    ['Other AI tools', `Point them at <a href="${github('skills/skills/even-g2/SKILL.md')}"><code>skills/skills/even-g2/SKILL.md</code></a>.`, ''],
  ]
  const next = skills.parts.find(p => p.title === "Next to Even's plugin")
  if (!next) throw new Error('skills/README.md needs "Next to Even\'s plugin"')
  return `<section id="plugin" class="sub">
${head('plugin', `${esc(plugin.name)} · v${esc(plugin.version)}`, `The skills come as one Claude Code plugin, <code>${esc(plugin.name)}</code>. Install it once and every session has them.`)}
<div class="ways" id="skills-install">
${ways.map(([t, note, code]) => `<div class="way"><h4>${t}</h4><p>${note}</p>${code}</div>`).join('\n')}
</div>
${sectionsAsDetails([next], 'skills/README.md', 'skills')}
</section>`
}

function aiStartSection() {
  const prompts = PROMPTS.map((p, i) => `<li><span class="n mono">${String(i + 1).padStart(2, '0')}</span><p class="prompt" id="prompt-${i + 1}">${esc(p)}</p>${copyButton(`prompt-${i + 1}`, `Copy prompt ${i + 1}`, 'sm')}</li>`).join('\n')
  return `<section id="ai-start" class="sub">
${head('ai-start', esc(SETUP), 'Give these steps to your AI. It checks Node.js, gets the repo and runs its checks, adds the plugin, and opens the demo in Even\'s simulator.')}
<div class="copybox">
  <div class="cb-bar"><p class="k">setup.md</p>${copyButton('setup-text', 'Copy the setup steps')}</div>
  <pre class="setup" id="setup-text"><code>${esc(read(SETUP))}</code></pre>
</div>
<p class="links">Or give your AI the link: <a class="mono" href="setup.md" title="${SITE_URL}/setup.md">setup.md</a><span class="sep"> · </span><a class="mono" href="setup.txt" title="${SITE_URL}/setup.txt">setup.txt</a></p>
<h4 class="prompts-h" id="ai-start-prompts">Suggested prompts</h4>
<ol class="prompts">
${prompts}
</ol>
<p class="more-link">For AI tools that read it, <a href="llms.txt">llms.txt</a> lists the findings, the review lessons, the open questions, the package READMEs and the skills as files on GitHub.</p>
<p class="sr" id="copy-status" aria-live="polite"></p>
</section>`
}

function startSection() {
  const steps = [
    ['Clone it', 'Node 24 or later.', `git clone ${REPO} matic-even\ncd matic-even`],
    ['Install and check', 'One npm workspace: the packages, both apps and this page.', 'npm ci\nnpm run check          # typecheck and test every package and app'],
    ['Run the demo in the simulator', 'Even\'s simulator comes in as a dev dependency.', 'cd apps/checklist\nnpm run dev            # dev server on port 5210\nnpm run sim            # in a second terminal'],
    ['Sideload it by QR', 'In the Even app, open the Even Hub tab, tap Scan QR, and scan the code. The first time, turn on <a href="#probe-run-it-on-your-glasses">developer mode</a>.', 'npm run qr             # with npm run dev still running'],
  ]
  return `<section id="start" class="sub">
${head('start', `${steps.length} steps`, `To have your AI run these steps, use <a href="#ai-start">${numbers.get('ai-start')} ${subTitles.get('ai-start')}</a>.`)}
<ol class="steps">
${steps.map(([t, note, code], i) => `<li><p class="k">${String(i + 1).padStart(2, '0')}</p><div><h4>${t}</h4><p>${note}</p>${codeBlock(code, 'sh')}</div></li>`).join('\n')}
</ol>
</section>`
}

function contributeSection() {
  const intro = contributing.head.filter(t => t.type === 'paragraph')
  return `<section id="contribute" class="sub">
${head('contribute', 'findings · probe results · code')}
<div class="md lede-md">${render(intro, 'CONTRIBUTING.md', 'contribute')}</div>
${sectionsAsDetails(contributing.parts, 'CONTRIBUTING.md', 'contribute')}
</section>`
}

function page(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${headTags({ site: SITE_URL, repo: REPO, studio: MATIC })}
  <link rel="stylesheet" href="assets/site.css">
  <script type="module" src="assets/phone.js"></script>
</head>
<body>
<a class="skip" href="#toc">Skip to the content</a>
<header class="bar">
  <div class="bar-in">
    <a class="brand" href="#top">matic even</a>
    <button class="menu mono" type="button" aria-expanded="false" aria-controls="nav"><i></i>menu</button>
    <nav id="nav" aria-label="Sections">${SECTIONS.map(s => `<div class="ng"><a class="ns" href="#${s.id}"><span class="no">${numbers.get(s.id)}</span>${esc(s.title.toLowerCase())}</a>`
      + `<div class="nsub">${s.subs.map(u => `<a href="#${u.id}"><span class="no">${numbers.get(u.id)}</span>${esc(u.title.toLowerCase())}</a>`).join('')}</div></div>`).join('')}</nav>
    <a class="gh" href="${REPO}">GitHub</a>
  </div>
</header>
<main id="top">
${body}
</main>
<footer class="foot">
  <p>Independent. Not affiliated with Even Realities.</p>
  <p class="labels mono"><a href="${MATIC}">a matic project</a><a href="${github('LICENSE')}">mit license</a><a href="${REPO}">github</a><a href="#apps">apps by matic</a><a href="#contribute">contribute</a></p>
</footer>
<script>
  // A phone gets a plain menu button for the nav. Without script, the nav stays a list.
  document.documentElement.classList.add('js')
  const menu = document.querySelector('.menu')
  const close = () => { document.documentElement.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false') }
  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(document.documentElement.classList.toggle('menu-open'))))
  document.getElementById('nav').addEventListener('click', e => { if (e.target.closest('a')) close() })
  addEventListener('keydown', e => { if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) { close(); menu.focus() } })
  // The bar stays out of the way on landing. It comes in once the hero has scrolled out of view.
  new IntersectionObserver(([e]) => document.documentElement.classList.toggle('bar-on', !e.isIntersecting), { rootMargin: '-52px 0px 0px 0px' })
    .observe(document.querySelector('.hero'))
  // A link to a finding, a probe or a section inside a closed <details> opens it.
  function reveal() {
    const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (!el) return
    for (let d = el.closest('details'); d; d = d.parentElement.closest('details')) d.open = true
    el.scrollIntoView()
  }
  addEventListener('hashchange', reveal)
  reveal()
  // Copy buttons: the clipboard API, or a hidden textarea and execCommand where the API is missing or refused.
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true } catch {}
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0'
    document.body.append(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    ta.remove()
    return ok
  }
  const status = document.getElementById('copy-status')
  document.addEventListener('click', async e => {
    const button = e.target.closest('button[data-copy]')
    if (!button) return
    const ok = await copyText(document.getElementById(button.dataset.copy).textContent)
    button.textContent = ok ? 'Copied' : 'Copy failed'
    if (status) status.textContent = ok ? 'Copied' : 'Copy failed. Select the text and copy it.'
    clearTimeout(button.timer)
    button.timer = setTimeout(() => { button.textContent = 'Copy'; if (status) status.textContent = '' }, 2000)
  })
</script>
</body>
</html>
`
}

// Beside the page, for AI tools

/** llms.txt: a title, a summary, then the repo's docs by kind, each a link to the file on GitHub. */
function llmsTxt() {
  // Raw files, so an AI tool gets plain text, not GitHub's page around it.
  const blob = path => `${REPO}/raw/main/${path}`
  const text = s => plain(s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')).replace(/\s+/g, ' ').trim()
  const sentence = s => /^.+?\.(?=\s|$)/.exec(text(s))?.[0] ?? text(s)
  // A doc's first sentence, past a bold label such as **The rule.**
  const lead = tokens => { const p = firstParagraph(tokens); return p ? `: ${sentence(p.text.replace(/^\*\*[^*]+\*\*\s*/, ''))}` : '' }
  const list = rows => rows.map(([title, path, note = '']) => `- [${title}](${blob(path)})${note}`).join('\n')
  const packages = readdirSync(join(ROOT, 'packages')).sort().map(d => `packages/${d}/README.md`).filter(exists)
  const references = skillList.flatMap(k => {
    const dir = posix.join(posix.dirname(k.src), 'references')
    return exists(dir) ? readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.md')).sort().map(f => [`${k.name}: references/${f}`, `${dir}/${f}`]) : []
  })
  return `# matic even

> We measured a pair of Even Realities G2 glasses. Here is what we found, and the parts to build a G2 app on them: glasses UI, phone UI, test tools, a demo app and a skill for your AI.

The page is ${SITE_URL}. The files below are markdown in ${REPO}.

## Setup

${list([['Set up a computer for matic even', SETUP, `: steps for an AI to follow. Also at ${SITE_URL}/setup.md`]])}

## Findings

${list(topics.map(t => [t.title, t.src, `: ${t.findings.map(f => `H${f.n} ${text(f.title)}`).join('; ')}`]))}

## Review lessons

${list(lessons.map(l => [l.title, l.src, lead(l.head)]))}

## Open questions

${list(probes.map(p => [`${p.id}: ${text(p.question)}`, p.src]))}

## Packages

${list(packages.map(path => [lex(path).find(t => t.type === 'heading' && t.depth === 1)?.text ?? path, path, lead(withoutTitle(lex(path)))]))}

## Apps

${list([
  ['Checklist, the demo app', 'apps/checklist/README.md', lead(checklist.head)],
  ['How Checklist is built', 'docs/architecture.md', ': its folders, the screen model, input, writes to the glasses, state and tests'],
  ['Relay server', 'apps/relay/README.md', lead(relayDoc.head)],
])}

## Skills

${list([...skillList.map(k => [k.name, k.src, `: ${k.summary}`]), ...references])}
`
}

// Write, then check every internal link

rmSync(DIST, { recursive: true, force: true })
mkdirSync(join(DIST, 'assets'), { recursive: true })

const sections = []
for (const s of SECTIONS) sections.push(await sectionHtml(s))
/** Matic's own apps on Even Hub, after the sections. Taglines are the listings' own (2026-10-22). */
const HUB = 'https://hub.evenrealities.com/catalogue/'
const APPS = [
  { id: 'sh.matic.chromatic', name: 'Chromatic', line: 'AI agent for G2. Any model. Your tools. No server.' },
  { id: 'sh.matic.sapling', name: 'Sapling', line: 'Pomodoro focus timer that grows a forest.' },
  { id: 'sh.matic.kiosk', name: 'Kiosk', line: 'RSS feed reader for news and blogs, at a glance.' },
  { id: 'sh.matic.seatback', name: 'Seatback', line: 'Flight progress, like a seatback map.' },
  { id: 'sh.matic.perch', name: 'Perch', line: 'Virtual pet that keeps you company while you work.' },
]
function appsSection() {
  const rows = APPS.map(a => `<li><a href="${HUB}${a.id}" target="_blank" rel="noopener"><span class="t">${esc(a.name)}</span><span class="d">${esc(a.line)}</span><span class="c mono">on even hub ↗</span></a></li>`).join('\n    ')
  return `<section id="apps" class="sec apps" aria-labelledby="apps-title">
  <div class="sh"><h2 id="apps-title"><a href="#apps">Apps by Matic</a></h2><p class="k">${APPS.length} on even hub</p></div>
  <p class="lede">Our own apps for Even Realities G2, built on the same parts. Find them on Even Hub.</p>
  <ul class="app-list">
    ${rows}
  </ul>
</section>`
}

const body = [hero(), toc(), ...sections, appsSection()].join('\n\n')
const html = page(body)
writeFileSync(join(DIST, 'index.html'), html)
cpSync(join(SITE, 'assets'), join(DIST, 'assets'), { recursive: true })
writeFileSync(join(DIST, 'setup.md'), read(SETUP))
writeFileSync(join(DIST, 'setup.txt'), read(SETUP))
writeFileSync(join(DIST, 'llms.txt'), llmsTxt())
// For search engines: allow everything, and a sitemap of the page dated by this build.
writeFileSync(join(DIST, 'robots.txt'), robotsTxt(SITE_URL))
writeFileSync(join(DIST, 'sitemap.xml'), sitemapXml(SITE_URL, new Date().toISOString().slice(0, 10)))
checkHead(html, SITE_URL, DIST)

// The phone parts for the browser: @maticsh/phone's code and its stylesheet, as one script.
const PHONE_INDEX = join(ROOT, 'packages/phone/src/index.ts')
await vite({
  configFile: false, root: SITE, logLevel: 'warn', publicDir: false,
  resolve: { conditions: ['@maticsh/source', ...defaultClientConditions] },
  plugins: [{
    // The package imports its stylesheet for a whole page. Here it goes into each part's shadow root
    // (live/phone.ts imports it as text), so the page-wide import is left out.
    name: 'shell-css-in-shadow-roots-only', enforce: 'pre',
    resolveId: (source, importer) => (source === './shell.css' && importer === PHONE_INDEX ? '\0no-page-css' : null),
    load: id => (id === '\0no-page-css' ? 'export {}' : null),
  }],
  build: {
    outDir: join(DIST, 'assets'), emptyOutDir: false, target: 'es2022', modulePreload: false, copyPublicDir: false,
    rolldownOptions: { input: join(SITE, 'live/phone.ts'), output: { entryFileNames: 'phone.js', chunkFileNames: 'phone-[hash].js' } },
  },
})

const all = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
const pageIds = new Set(all)
const hrefs = [...html.matchAll(/\shref="#([^"]*)"/g)].map(m => m[1])
const broken = [
  ...linked.filter(l => l.missing).map(l => `${l.from} (no such file in the repo)`),
  ...linked.filter(l => l.id && !pageIds.has(l.id)).map(l => `${l.from} (no #${l.id} on the page)`),
  ...hrefs.filter(h => !pageIds.has(h)).map(h => `href="#${h}" (no such id on the page)`),
  ...[...new Set(all.filter((id, i) => all.indexOf(id) !== i))].map(id => `id="${id}" appears more than once`),
  ...[...html.matchAll(/\s(?:src|href)="(\/[^"]*)"/g)].map(m => `${m[1]} is not a relative link`),
  ...[...html.matchAll(/\s(?:src|href)="(?![a-z][a-z0-9+.-]*:|[#/])([^"#?]+)/gi)].map(m => m[1])
    .filter(path => !existsSync(join(DIST, path))).map(path => `${path} is not in site/dist`),
]
if (broken.length) {
  console.error(`Broken links:\n  ${[...new Set(broken)].join('\n  ')}`)
  process.exit(1)
}
console.log(`Built site/dist/index.html: ${counts.findings} findings in ${counts.topics} topics, ${counts.lessons} review lessons, `
  + `${counts.probes} open questions, ${counts.primitives} primitives, ${PARTS.length} phone parts. ${hrefs.length} anchor links checked.`)
