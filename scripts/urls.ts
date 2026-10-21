#!/usr/bin/env node
// Runs Even Hub review's URL scan on built apps, before you pack: every URL string in dist/ must be on
// app.json's network whitelist, even ones the app never calls (docs/review/urls.md). The rules are
// scanUrls in @maticsh/testing (packages/testing/src/urls.ts), where they are tested.
// Usage: node scripts/urls.ts <app-folder>...   (Node 24; after `npm run build`)
// Exits 1 on any error, 2 if a folder has no app.json or no dist/.
import fs from 'node:fs'
import path from 'node:path'
import { scanUrls, whitelistOf, type ScanFile, type UrlFinding, type UrlRule } from '@maticsh/testing/urls'

const ORDER: UrlRule[] = ['network-permission-empty', 'whitelist-shape', 'url-not-whitelisted', 'fetch-origin', 'whitelist-unused']
const HEADINGS: Record<UrlRule, string> = {
  'network-permission-empty': 'network permission with no whitelist',
  'whitelist-shape': 'whitelist entries that are not bare origins',
  'url-not-whitelisted': 'URL strings in the bundle that are not on the whitelist',
  'fetch-origin': 'calls in src/ to origins that are not on the whitelist',
  'whitelist-unused': 'whitelist origins the bundle never names',
}

const rel = (p: string) => {
  const r = path.relative(process.cwd(), p)
  return r.startsWith('..') ? p : r || '.'
}

function walk(dir: string, keep: (name: string) => boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, keep)
    return keep(e.name) ? [p] : []
  })
}

/** Scans one app folder and prints the result. Returns the exit code for that folder. */
function scanApp(appDir: string): number {
  const app = path.basename(appDir)
  const read = (files: string[]): ScanFile[] =>
    files.map(f => ({ path: path.relative(appDir, f), text: fs.readFileSync(f, 'utf8') }))

  const manifestPath = path.join(appDir, 'app.json')
  if (!fs.existsSync(manifestPath)) {
    console.error(`no ${rel(manifestPath)}: pass an app folder, e.g. node scripts/urls.ts apps/checklist`)
    return 2
  }
  const dist = path.join(appDir, 'dist')
  if (!fs.existsSync(dist)) {
    console.error(`no ${rel(dist)}: build the app first (npm run build in ${rel(appDir)})`)
    return 2
  }

  const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  // Every text file review can see in the package.
  const files = read(walk(dist, n => /\.(js|mjs|cjs|html|css|json|map|svg|txt|xml|webmanifest)$/.test(n)))
  const src = path.join(appDir, 'src')
  const source = fs.existsSync(src) ? read(walk(src, n => /\.(ts|tsx|js|mjs)$/.test(n) && !/\.test\./.test(n))) : undefined

  const findings = scanUrls({ files, manifest, source })
  const where = (f: UrlFinding) => (f.path ? `    (${f.path}${f.line ? `:${f.line}` : ''})` : '')
  const errors = findings.filter(f => f.severity === 'error')
  const warns = findings.filter(f => f.severity === 'warn')
  for (const rule of ORDER) {
    const group = findings.filter(f => f.rule === rule)
    if (!group.length) continue
    const out = group[0]!.severity === 'error' ? console.error : console.warn
    out(`${group[0]!.severity} ${rule}: ${group.length} ${HEADINGS[rule]}`)
    for (const f of group) out(`  ${f.detail}${where(f)}`)
  }

  if (errors.length) {
    console.error(`urls: ${app} has ${errors.length} error(s)${warns.length ? ` and ${warns.length} warning(s)` : ''}.`)
    if (findings.some(f => f.rule === 'url-not-whitelisted' || f.rule === 'fetch-origin')) {
      console.error(
        'Fix: whitelist one server origin of your own and let that server fetch every other address, ' +
          'so the bundle names only that origin (docs/review/urls.md).',
      )
    }
    return 1
  }
  console.log(`urls: ${app} is clean${warns.length ? ` apart from ${warns.length} warning(s)` : ''} (whitelist: ${whitelistOf(manifest).join(', ') || 'none'})`)
  return 0
}

const dirs = process.argv.slice(2)
const codes = (dirs.length ? dirs : ['.']).map(d => scanApp(path.resolve(d)))
process.exit(Math.max(0, ...codes))
