import { afterEach, describe, expect, it } from 'vitest'
import { devHost, devPort, isPrivateAddress } from '../src/dev.ts'

const saved = { host: process.env.DEV_HOST, port: process.env.DEV_PORT }
afterEach(() => {
  for (const [key, value] of [['DEV_HOST', saved.host], ['DEV_PORT', saved.port]] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('dev server address', () => {
  it('uses DEV_HOST when it is set', () => {
    process.env.DEV_HOST = ' 10.0.0.12 '
    expect(devHost()).toBe('10.0.0.12')
  })

  it('falls back to some address when DEV_HOST is unset', () => {
    delete process.env.DEV_HOST
    expect(devHost()).toMatch(/\S/)
  })

  it('uses DEV_PORT only when it is a positive integer', () => {
    delete process.env.DEV_PORT
    expect(devPort(5210)).toBe(5210)
    process.env.DEV_PORT = '5750'
    expect(devPort(5210)).toBe(5750)
    process.env.DEV_PORT = 'abc'
    expect(devPort(5210)).toBe(5210)
  })

  it('lets loopback, LAN, VPN overlay and link-local addresses through, and nothing public', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:192.168.1.4', '10.1.2.3', '172.20.0.1', '100.64.0.1', '169.254.1.1', 'fd12::1', 'fe80::1']) {
      expect(isPrivateAddress(a), a).toBe(true)
    }
    for (const a of ['8.8.8.8', '172.32.0.1', '100.128.0.1', '2001:db8::1']) {
      expect(isPrivateAddress(a), a).toBe(false)
    }
  })
})
