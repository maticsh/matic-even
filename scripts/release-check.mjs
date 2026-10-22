// Checks that a release tag (v0.2.0) matches the version of every published package, and that the
// packages pin each other at that version. Run by .github/workflows/release.yml before publishing.
// Usage: node scripts/release-check.mjs v0.2.0
import { readFileSync } from 'node:fs'

const tag = process.argv[2] ?? ''
const want = tag.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+$/.test(want)) {
  console.error(`release-check: "${tag}" is not a version tag like v0.2.0`)
  process.exit(1)
}

const errors = []
for (const p of ['glasses', 'phone', 'testing']) {
  const pkg = JSON.parse(readFileSync(new URL(`../packages/${p}/package.json`, import.meta.url), 'utf8'))
  if (pkg.version !== want) errors.push(`${pkg.name} is ${pkg.version}, the tag says ${want}`)
  for (const [dep, range] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    if (dep.startsWith('@maticsh/') && range !== want) errors.push(`${pkg.name} pins ${dep} at ${range}, not ${want}`)
  }
}

if (errors.length) {
  for (const e of errors) console.error(`release-check: ${e}`)
  process.exit(1)
}
console.log(`release-check: all three packages are at ${want}`)
