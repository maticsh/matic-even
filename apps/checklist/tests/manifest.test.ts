import { describe, expect, it } from 'vitest'
import { lintManifest } from '@maticsh/testing'
import manifest from '../app.json'
import pkg from '../package.json'

describe('app.json', () => {
  it('passes the manifest lint', () => {
    expect(lintManifest(manifest)).toEqual([])
  })

  it('asks for no permissions and pins the SDK it declares', () => {
    expect(manifest.permissions).toEqual([])
    expect(pkg.dependencies['@evenrealities/even_hub_sdk']).toBe(manifest.min_sdk_version)
  })
})
