import { describe, expect, it, vi } from 'vitest'
import manifest from '../app.json'
import { FakeBridge, lintManifest } from '@maticsh/testing'
import { GAP_MS, beat, body, duration, fresh } from '../src/stats.ts'
import { run, type Env } from '../src/probe.ts'
import { PACES, STILL_BELOW, motion, nextPace, rate, senseBody, freshSense, toCsv } from '../src/sense.ts'

describe('stats', () => {
  it('counts a gap only when beats stop for over 15 s', () => {
    let s = fresh(0)
    s = beat(s, 5_000)
    s = beat(s, 10_000)
    expect(s.gaps).toBe(0)
    s = beat(s, 10_000 + GAP_MS + 1)
    expect(s).toMatchObject({ beats: 3, gaps: 1, maxGapMs: GAP_MS + 1 })
  })

  it('formats durations', () => {
    expect(duration(75_000)).toBe('1:15')
    expect(duration(3_725_000)).toBe('1:02:05')
  })

  it('keeps the body to six lines, so it never scrolls', () => {
    const text = body({ run: fresh(0), prev: fresh(0), wearing: true, wearingChangedAt: 0, battery: 80, events: [], image: '1200 ms' }, 0)
    expect(text.split('\n')).toHaveLength(6)
  })
})

function harness() {
  let t = 1_000_000
  const ticks: (() => void)[] = []
  const mirrored: string[] = []
  const shipped: string[] = []
  const env: Env = {
    now: () => t,
    every: (_ms, fn) => void ticks.push(fn),
    makeImage: async () => new Uint8Array([137, 80, 78, 71]),
    makeSprite: async on => new Uint8Array([on ? 1 : 0]),
    makeScript: async script => new Uint8Array([script === 'hindi' ? 2 : 3]),
    mirror: text => void mirrored.push(text),
    ship: async csv => { shipped.push(csv); return true },
  }
  const advance = (ms: number) => { t += ms; ticks.forEach(f => f()) }
  return { env, advance, mirrored, shipped }
}

describe('probe on a fake bridge', () => {
  it('boots, shows the action bar and records heartbeats', async () => {
    const bridge = new FakeBridge()
    const { env, advance } = harness()
    const probe = await run(bridge, env)
    advance(5_000)
    advance(5_000)
    await probe.flush()
    expect(bridge.text('bar')).toBe('blink ●   image ▼   sense ▲   exit ●●')
    expect(bridge.text('body')).toMatch(/^beats 2 · gaps 0/)
    expect(JSON.parse(bridge.storage.get('probe.beats')!).d.beats).toBe(2)
    bridge.assertNoViolations()
  })

  it('shows the previous run after a relaunch', async () => {
    const bridge = new FakeBridge()
    const first = harness()
    const p1 = await run(bridge, first.env)
    first.advance(5_000)
    await p1.flush()

    const relaunched = new FakeBridge()
    relaunched.storage.set('probe.beats', bridge.storage.get('probe.beats')!)
    const second = harness()
    const p2 = await run(relaunched, second.env)
    await p2.flush()
    expect(relaunched.text('body')).toMatch(/prev: up 0:05/)
  })

  it('tracks wearing, foreground changes and image sends', async () => {
    const bridge = new FakeBridge()
    const { env } = harness()
    const probe = await run(bridge, env)
    bridge.status({ isWearing: false, batteryLevel: 71 })
    bridge.foreground('exit')
    bridge.foreground('enter')
    bridge.swipe('down')
    await new Promise(r => setTimeout(r, 10))
    await probe.flush()
    const text = bridge.text('body')!
    expect(text).toMatch(/wearing: no since/)
    expect(text).toMatch(/bat 71%/)
    expect(text).toMatch(/ev: out 0s · in 0s/)
    expect(text).toMatch(/image: 0 ms \(#1\)/)
    expect(bridge.images.has('img')).toBe(true)
    bridge.assertNoViolations()
  })

  it('the menu shows the text levels page, and swipe up goes back', async () => {
    const bridge = new FakeBridge()
    const probe = await run(bridge, harness().env)
    bridge.menu(4)
    await new Promise(r => setTimeout(r, 0))
    await probe.flush()
    expect(bridge.texts.get('level0')).toMatchObject({ textColor: 0 })
    expect(bridge.texts.get('level4')).toMatchObject({ textColor: 4 })
    expect(bridge.menuLabels).toContain('Text levels')
    bridge.swipe('up')
    await new Promise(r => setTimeout(r, 0))
    await probe.flush()
    expect(bridge.text('body')).toMatch(/^beats/)
    bridge.assertNoViolations()
  })

  it('the scripts page sends the Hindi rows as upgrades and both images', async () => {
    const bridge = new FakeBridge()
    const { env, mirrored } = harness()
    const probe = await run(bridge, env)
    bridge.menu(6)
    await new Promise(r => setTimeout(r, 0))
    await probe.flush()
    expect(bridge.text('rowC')).toBe('C कि की')
    expect(bridge.text('rowD')).toBe('D क्ष त्र ज्ञ')
    expect(bridge.images.get('hindi')).toEqual(new Uint8Array([2]))
    expect(bridge.images.get('cjk')).toEqual(new Uint8Array([3]))
    const page = mirrored.at(-1)!
    expect(page).toMatch(/C कि की .* accepted/)
    expect(page).toMatch(/firmware font lacks: क ख ग/)
    bridge.swipe('up')
    await new Promise(r => setTimeout(r, 0))
    await probe.flush()
    expect(bridge.text('body')).toMatch(/^beats/)
    bridge.assertNoViolations()
  })

  it('runs every blink style without leaving the screen changed', async () => {
    const bridge = new FakeBridge()
    const probe = await run(bridge, harness().env)
    vi.useFakeTimers()
    for (const style of ['hard', 'blank', 'edge'] as const) {
      const done = probe.blink(style)
      await vi.advanceTimersByTimeAsync(12 * 500)
      await done
    }
    await vi.runAllTimersAsync() // drain image sends and store writes scheduled under fake time
    vi.useRealTimers()
    await probe.flush()
    // The bug found on a G2: after a hard blink the header stayed at brightness 0.
    expect(bridge.texts.get('head')).toMatchObject({ textColor: 4 })
    expect(bridge.text('head')).toMatch(/^PROBE · up/)
    expect(bridge.images.get('edge')).toEqual(new Uint8Array([1]))
    bridge.assertNoViolations()
  })

  it('logs raw events even when the lifecycle module ignores them', async () => {
    const bridge = new FakeBridge()
    const probe = await run(bridge, harness().env)
    bridge.foreground('enter') // already active: the lifecycle module ignores this one
    bridge.foreground('exit')
    await probe.flush()
    expect(probe.state.events.map(e => e.kind)).toEqual(['enter', 'exit'])
    expect(bridge.text('body')).toMatch(/ev: in 0s · out 0s/)
  })

  it('double tap asks the OS for the exit dialog', async () => {
    const bridge = new FakeBridge()
    await run(bridge, harness().env)
    bridge.doubleTap()
    expect(bridge.shutDownRequests).toEqual([1])
  })

  // Store review rejects an app that leaves the IMU on at exit (review/sensors.md).
  it('turns the IMU off on both exit events, and not on the exit dialog', async () => {
    for (const exit of ['systemExit', 'abnormalExit'] as const) {
      const bridge = new FakeBridge()
      await run(bridge, harness().env)
      bridge.swipe('up') // the sense page turns the IMU on
      await new Promise(r => setTimeout(r, 0))
      expect(bridge.imu.open).toBe(true)
      bridge.doubleTap() // the exit dialog opens; the user can still cancel it
      await new Promise(r => setTimeout(r, 0))
      expect(bridge.imu.open).toBe(true)
      bridge[exit]()
      await new Promise(r => setTimeout(r, 0))
      expect(bridge.imu.open).toBe(false)
    }
  })
})

describe('app.json', () => {
  it('passes the manifest lint', () => {
    expect(lintManifest(manifest, { sdkVersion: '0.0.16', usedPermissions: [] })).toEqual([])
  })
})

describe('sense maths', () => {
  const at = (t: number, x: number, y = 0, z = 0) => ({ t, x, y, z })

  it('reads a steady head as still and a moving one as moving', () => {
    const steady = [at(0, 0.01), at(100, 0.012), at(200, 0.011), at(300, 0.01)]
    expect(motion(steady, 300)!).toBeLessThan(STILL_BELOW)
    const moving = [at(0, 0), at(100, 1), at(200, -1), at(300, 1)]
    expect(motion(moving, 300)!).toBeGreaterThan(STILL_BELOW)
    expect(motion([at(0, 1)], 0)).toBeNull()
  })

  it('only counts the last second of samples', () => {
    const old = [at(0, 5), at(100, -5), at(2_000, 0), at(2_100, 0)]
    expect(motion(old, 2_100)).toBe(0)
  })

  it('measures the sample rate over the span of samples', () => {
    const tenHz = Array.from({ length: 11 }, (_, i) => at(i * 100, 0))
    expect(rate(tenHz, 1_000)).toBeCloseTo(10)
  })

  it('cycles the paces and wraps', () => {
    expect(PACES.map(nextPace)).toEqual([200, 500, 1000, 100])
  })

  it('writes CSV rows with empty cells for missing values', () => {
    expect(toCsv([{ t: 1, kind: 'imu', x: 0.5, y: -1, z: 0 }, { t: 2, kind: 'hold', value: 'right' }]))
      .toBe('1,imu,0.5,-1,0,\n2,hold,,,,right')
  })

  it('keeps the sense body to six lines', () => {
    expect(senseBody(freshSense(0), 80, 0).split('\n')).toHaveLength(6)
  })
})

describe('sense page on a fake bridge', () => {
  const settle = () => new Promise(r => setTimeout(r, 0))

  it('swipe up turns the IMU on, swipe down changes pace, and leaving turns it off', async () => {
    const bridge = new FakeBridge()
    const probe = await run(bridge, harness().env)
    bridge.swipe('up')
    await settle()
    expect(bridge.imu).toEqual({ open: true, pace: 100 })
    expect(bridge.text('bar')).toBe('imu ●   pace ▼   back ▲   exit ●●')
    bridge.swipe('down')
    await settle()
    expect(bridge.imu).toEqual({ open: true, pace: 200 })
    bridge.swipe('up')
    await settle()
    await probe.flush()
    expect(bridge.imu.open).toBe(false)
    expect(bridge.text('body')).toMatch(/^beats/)
    bridge.assertNoViolations()
  })

  it('shows samples, times long presses and ships the log', async () => {
    const bridge = new FakeBridge()
    const h = harness()
    const probe = await run(bridge, h.env)
    bridge.status({ batteryLevel: 80 })
    bridge.swipe('up')
    await settle()
    bridge.imuSample(0.1, -9.8, 0.3)
    bridge.hold()
    h.advance(1_200)
    bridge.release()
    bridge.status({ batteryLevel: 79 })
    h.advance(5_000)
    await probe.flush()
    const text = bridge.text('body')!
    expect(text).toMatch(/imu on · pace 100/)
    expect(text).toMatch(/x  0\.10  y -9\.80  z  0\.30/)
    expect(text).toMatch(/hold 1 · last 1\.2 s right/)
    expect(text).toMatch(/bat 79% · -1% in 0:06/)
    expect(text).toMatch(/frames 1/)
    const log = h.shipped.join('\n')
    expect(log).toMatch(/,imu,0\.1,-9\.8,0\.3,/)
    expect(log).toMatch(/,release,,,,1200/)
    expect(probe.sense.log.sent).toBe(probe.sense.log.rows)
    bridge.assertNoViolations()
  })
})
