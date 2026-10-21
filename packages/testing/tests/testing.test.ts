import { describe, expect, it } from 'vitest'
import { CreateStartUpPageContainer, TextContainerProperty, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import { FakeBridge, lintManifest } from '../src/index.ts'
import { toIntent, type Intent } from '@maticsh/glasses'

describe('FakeBridge', () => {
  it('emits gestures shaped like the device, which toIntent reads correctly', () => {
    const bridge = new FakeBridge()
    const seen: (Intent | null)[] = []
    bridge.onEvenHubEvent(e => seen.push(toIntent(e)))
    bridge.tap()
    bridge.doubleTap()
    bridge.swipe('down')
    bridge.hold()
    bridge.menu(4)
    expect(seen.map(i => i?.kind)).toEqual(['tap', 'doubleTap', 'scrollBottom', 'longPress', 'menu'])
  })

  it('streams IMU samples only while reporting is on, and only after a page exists', async () => {
    const bridge = new FakeBridge()
    const seen: (Intent | null)[] = []
    bridge.onEvenHubEvent(e => seen.push(toIntent(e)))
    expect(await bridge.imuControl(true, 200)).toBe(false)
    expect(() => bridge.assertNoViolations()).toThrow(/imuControl before/)
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({ containerID: 1, containerName: 'main', content: 'hi', isEventCapture: 1, width: 100, height: 30 })],
    }))
    bridge.imuSample(1, 1, 1)
    expect(seen).toEqual([])
    await bridge.imuControl(true, 200)
    expect(bridge.imu).toEqual({ open: true, pace: 200 })
    bridge.imuSample(0, 9.8, 0)
    expect(seen).toEqual([{ kind: 'imu', x: 0, y: 9.8, z: 0 }])
  })

  it('records a violation for an upgrade the device would silently ignore', async () => {
    const bridge = new FakeBridge()
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({ containerID: 1, containerName: 'main', content: 'hi', isEventCapture: 1, width: 100, height: 30 })],
    }))
    expect(await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'mian', content: 'x' }))).toBe(false)
    expect(() => bridge.assertNoViolations()).toThrow(/unknown container/)
  })

  it('rejects a page with no capture container', async () => {
    const bridge = new FakeBridge()
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({ containerID: 1, containerName: 'main', content: 'hi', width: 100, height: 30 })],
    }))
    expect(bridge.violations.join()).toMatch(/exactly one capture/)
  })

  it('emits device status for wearing-sensor tests', () => {
    const bridge = new FakeBridge()
    const wearing: (boolean | undefined)[] = []
    bridge.onDeviceStatusChanged(s => wearing.push(s.isWearing))
    bridge.status({ isWearing: false })
    expect(wearing).toEqual([false])
  })
})

const good = {
  package_id: 'com.example.notes',
  edition: '202601',
  name: 'Notes',
  version: '0.1.0',
  min_sdk_version: '0.0.16',
  entrypoint: 'index.html',
  permissions: [{ name: 'network', desc: 'Transcribes your voice.', whitelist: ['https://api.example.com'] }],
  supported_languages: ['en'],
}

describe('lintManifest', () => {
  it('passes a good manifest', () => {
    expect(lintManifest(good, { sdkVersion: '0.0.16', usedPermissions: ['network'] })).toEqual([])
  })

  it('catches the review traps', () => {
    const issues = lintManifest({
      ...good,
      package_id: 'Com.Example',
      name: 'Even Better Timer Pro',
      version: 'v1.0',
      min_app_version: '2.2.10',
      permissions: [
        { name: 'network', desc: 'x', whitelist: ['https://api.example.com/v1', 'https://*.example.com'] },
        { name: 'camera', desc: 'unused' },
      ],
    }, { usedPermissions: ['network'] })
    const fields = issues.map(i => `${i.level}:${i.field}`)
    expect(fields).toContain('error:package_id')
    expect(fields).toContain('error:name')
    expect(fields).toContain('error:version')
    expect(fields).toContain('warning:min_app_version')
    expect(issues.filter(i => i.field === 'permissions[0].whitelist')).toHaveLength(2)
    expect(issues.some(i => i.message.includes('"camera" is declared but unused'))).toBe(true)
  })

  it('rejects "even" in any case, and warns on an SDK mismatch', () => {
    const issues = lintManifest({ ...good, name: 'Seven Trees', min_sdk_version: '0.0.15' }, { sdkVersion: '0.0.16' })
    expect(issues.map(i => `${i.level}:${i.field}`)).toEqual(['error:name', 'warning:min_sdk_version'])
  })
})
