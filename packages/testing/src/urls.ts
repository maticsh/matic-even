/**
 * Checks an app's built bundle against its `app.json` network whitelist, the way Even Hub review does.
 *
 * Review scans the bundle for URL-shaped strings and flags any that is not on the whitelist, even a
 * string literal the app never calls (docs/review/urls.md). Pure: the caller reads the files
 * (`scripts/urls.ts` in this repo does it for a built app).
 */
export type UrlRule =
  | 'url-not-whitelisted'
  | 'whitelist-shape'
  | 'whitelist-unused'
  | 'network-permission-empty'
  | 'fetch-origin'

export type UrlFinding = { rule: UrlRule; severity: 'error' | 'warn'; detail: string; path?: string; line?: number }

export type ScanFile = { path: string; text: string }

export type ScanUrlsInput = {
  /** The built files (`dist/`), as review sees them. */
  files: ScanFile[]
  /** The parsed `app.json`. */
  manifest: unknown
  /** The app's source. When given, absolute URLs passed to fetch / WebSocket / EventSource are checked too. */
  source?: ScanFile[]
}

// A URL literal, or the start of one built from a template (`https://${host}/...`). The lookbehind keeps
// `news://` from reading as `ws://`.
const URL_RE = /(?<![A-Za-z0-9+.-])(?:https?|wss?):\/\/(?:\$\{[^}]*\}|[^\s"'`<>()\\,;])*/g

// XML namespaces and spec identifiers are names, not requests; review has never flagged them.
const NAMES = [/^http:\/\/www\.w3\.org\//]

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function networkPermissions(manifest: unknown): Record<string, unknown>[] {
  if (!isObj(manifest) || !Array.isArray(manifest.permissions)) return []
  return manifest.permissions.filter((p): p is Record<string, unknown> => isObj(p) && p.name === 'network')
}

/** Every whitelist entry in the manifest's network permissions, as written. */
export function whitelistOf(manifest: unknown): string[] {
  return networkPermissions(manifest).flatMap(p => (Array.isArray(p.whitelist) ? p.whitelist.map(String) : []))
}

/** True when `url` is the origin itself or a URL under it (path, query, fragment or `${...}` follows). */
export function onWhitelist(url: string, whitelist: string[]): boolean {
  return NAMES.some(n => n.test(url)) || whitelist.some(o => under(url, o))
}

const under = (url: string, origin: string) =>
  url === origin || (url.startsWith(origin) && /^(?:[/?#]|\$\{)/.test(url.slice(origin.length)))

/** Why a whitelist entry is not a bare https:// or wss:// origin, or null when it is one. */
function shapeProblem(entry: string): string | null {
  if (entry.includes('*')) return 'has a wildcard'
  let u: URL
  try {
    u = new URL(entry)
  } catch {
    return 'is not a URL'
  }
  if (u.protocol !== 'https:' && u.protocol !== 'wss:') return 'must start with https:// or wss://'
  if (u.search || entry.includes('?')) return 'has a query'
  if (u.hash || entry.includes('#')) return 'has a fragment'
  if (entry.endsWith('/')) return 'has a trailing slash'
  if (u.pathname !== '/' && u.pathname !== '') return 'has a path'
  if (u.origin !== entry) return `is not written as its origin (${u.origin})`
  return null
}

function lineOf(text: string, index: number): number {
  let n = 1
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

/** `https://host/path` → `https://host`. Works on template starts too (`https://${host}`). */
function originOf(url: string): string {
  return /^[a-z]+:\/\/(?:\$\{[^}]*\}|[^/?#$])*/i.exec(url)?.[0] ?? url
}

// The calls that open a connection: fetch(...), new WebSocket(...), new EventSource(...).
const CALL = String.raw`\b(fetch|new\s+WebSocket|new\s+EventSource)\s*\(\s*`
const CALL_LITERAL_RE = new RegExp(CALL + String.raw`(['"\x60])((?:https?|wss?):\/\/[^'"\x60\s]*)`, 'g')
const CALL_NAMED_RE = new RegExp(CALL + String.raw`(?:\x60\$\{\s*([A-Za-z_$][\w$]*)\s*\}|([A-Za-z_$][\w$]*)\s*[,)+])`, 'g')
// const NAME = 'https://...' (exported or not), so `fetch(\`${API_BASE}/x\`)` resolves to its origin.
const CONST_URL_RE = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(['"`])((?:https?|wss?):\/\/[^'"`\s]*)\2/g

function fetchOrigins(source: ScanFile[], whitelist: string[]): UrlFinding[] {
  const consts = new Map<string, string>()
  for (const f of source) for (const m of f.text.matchAll(CONST_URL_RE)) consts.set(m[1]!, m[3]!)

  const out: UrlFinding[] = []
  const flag = (f: ScanFile, index: number, call: string, url: string, via?: string) => {
    if (onWhitelist(originOf(url), whitelist)) return
    const name = call.replace(/\s+/g, ' ')
    out.push({
      rule: 'fetch-origin',
      severity: 'error',
      detail: `${name}(${via ? `${via} = ` : ''}${url}) calls ${originOf(url)}, which is not on the whitelist`,
      path: f.path,
      line: lineOf(f.text, index),
    })
  }
  for (const f of source) {
    for (const m of f.text.matchAll(CALL_LITERAL_RE)) flag(f, m.index, m[1]!, m[3]!)
    for (const m of f.text.matchAll(CALL_NAMED_RE)) {
      const name = m[2] ?? m[3]!
      const url = consts.get(name)
      if (url) flag(f, m.index, m[1]!, url, name)
    }
  }
  return out
}

export function scanUrls({ files, manifest, source }: ScanUrlsInput): UrlFinding[] {
  const findings: UrlFinding[] = []
  const whitelist = whitelistOf(manifest)

  for (const p of networkPermissions(manifest)) {
    if (!Array.isArray(p.whitelist) || p.whitelist.length === 0) {
      findings.push({ rule: 'network-permission-empty', severity: 'error', detail: 'the network permission has no whitelist; `evenhub pack` fails' })
    }
  }

  for (const entry of whitelist) {
    const problem = shapeProblem(entry)
    if (problem) {
      findings.push({ rule: 'whitelist-shape', severity: 'error', detail: `"${entry}" ${problem}; write a bare https:// or wss:// origin` })
    }
  }

  const seen = new Set<string>()
  const used = new Set<string>()
  for (const f of files) {
    for (const m of f.text.matchAll(URL_RE)) {
      const url = m[0]
      for (const o of whitelist) if (under(url, o)) used.add(o)
      if (onWhitelist(url, whitelist) || seen.has(`${f.path}\n${url}`)) continue
      seen.add(`${f.path}\n${url}`)
      findings.push({ rule: 'url-not-whitelisted', severity: 'error', detail: url, path: f.path, line: lineOf(f.text, m.index) })
    }
  }

  for (const entry of whitelist) {
    if (!used.has(entry)) {
      findings.push({ rule: 'whitelist-unused', severity: 'warn', detail: `"${entry}" appears nowhere in the bundle; review flags unused permissions` })
    }
  }

  if (source) findings.push(...fetchOrigins(source, whitelist))
  return findings
}
