import { defineConfig } from 'vitest/config'

// These modules hold no state that one test file could leak into another, so files share workers.
// It makes the suite several times faster.
export default defineConfig({ test: { isolate: false } })
