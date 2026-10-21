import { defaultClientConditions, defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

// In this repo @maticsh/* load from their TypeScript source (the "@maticsh/source" export condition), so the
// tests never wait on a package build.
export default defineConfig({
  resolve: { conditions: ['@maticsh/source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['@maticsh/source', ...defaultServerConditions] } },
})
