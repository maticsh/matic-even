#!/usr/bin/env node
// Packs each package as npm would (npm pack --dry-run) and checks the file list: every built file that
// package.json's exports and bin point at, plus README.md and LICENSE, and nothing from src/, tests/ or a
// tsconfig. Run it after the packages are built: npm run build:packages && node scripts/check-pack.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PACKAGES = ['glasses', 'phone', 'testing']
const ROOT = join(import.meta.dirname, '..')

/** Every file an exports or bin entry names, except the in-repo "@maticsh/source" condition. */
function targets(manifest) {
  const out = new Set()
  const walk = v => {
    if (typeof v === 'string') out.add(v.replace(/^\.\//, ''))
    else if (v && typeof v === 'object') for (const [k, sub] of Object.entries(v)) if (k !== '@maticsh/source') walk(sub)
  }
  walk(manifest.exports)
  walk(manifest.bin)
  return [...out]
}

let failed = 0
for (const name of PACKAGES) {
  const dir = join('packages', name)
  const manifest = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'))
  const json = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts', '--workspace', dir], {
    cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32',
  })
  // npm 11 returns a list of packs; npm 12 returns an object keyed by package name.
  const parsed = JSON.parse(json)
  const pack = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0]
  const files = pack.files.map(f => f.path)
  const problems = [
    ...[...targets(manifest), 'README.md', 'LICENSE'].filter(f => !files.includes(f)).map(f => `missing ${f}`),
    ...files.filter(f => /^(src|tests)\//.test(f) || /(^|\/)tsconfig[^/]*\.json$|\.tsbuildinfo$/.test(f)).map(f => `should not ship ${f}`),
  ]
  const kb = (pack.size / 1024).toFixed(1)
  if (problems.length) {
    failed++
    console.error(`${pack.name}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`)
  } else {
    console.log(`${pack.name}@${pack.version}: ${files.length} files, ${kb} kB packed`)
  }
}
process.exit(failed ? 1 : 0)
