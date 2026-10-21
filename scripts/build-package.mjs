#!/usr/bin/env node
// Builds one package for npm. Run from the package's folder (its `build` script): node ../../scripts/build-package.mjs
// Clears dist/, then tsc -b tsconfig.build.json writes .js, .d.ts and source maps (packages it references build
// first). Files in src/ that are not TypeScript (the phone's stylesheets) are copied beside the .js that imports
// them, and the bins in dist/bin/ are made executable.
import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

rmSync('dist', { recursive: true, force: true })
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
try {
  execFileSync(process.execPath, [tsc, '-b', 'tsconfig.build.json'], { stdio: 'inherit' })
} catch {
  process.exit(1)
}
cpSync('src', 'dist', { recursive: true, filter: f => !f.endsWith('.ts') })
const bin = join('dist', 'bin')
if (existsSync(bin)) for (const f of readdirSync(bin)) if (f.endsWith('.js')) chmodSync(join(bin, f), 0o755)
