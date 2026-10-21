import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore, type Codec } from '../src/infra/store.ts'
import { createLifecycle } from '../src/infra/lifecycle.ts'
import { toIntent } from '../src/domain/events.ts'
import { FakeBridge } from '@maticsh/testing'

type Settings = { focusMin: number; breakMin: number }
const settings: Codec<Settings> = {
  parse(raw) {
    const r = raw as Settings
    if (typeof r?.focusMin !== 'number' || typeof r?.breakMin !== 'number') throw new Error('bad settings')
    return r
  },
}
const spec = { version: 2, codec: settings, fallback: { focusMin: 25, breakMin: 5 } }

afterEach(() => vi.useRealTimers())

describe('store', () => {
  it('returns the fallback for a missing key', async () => {
    const store = createStore(new FakeBridge())
    expect(await store.key('settings', spec).get()).toEqual({ focusMin: 25, breakMin: 5 })
  })

  it('debounces writes and reads back its own pending value', async () => {
    vi.useFakeTimers()
    const bridge = new FakeBridge()
    const s = createStore(bridge, { debounceMs: 500 }).key('settings', spec)
    s.set({ focusMin: 30, breakMin: 5 })
    s.set({ focusMin: 50, breakMin: 10 })
    expect(await s.get()).toEqual({ focusMin: 50, breakMin: 10 })
    expect(bridge.storage.size).toBe(0)
    await vi.advanceTimersByTimeAsync(500)
    expect(bridge.calls.filter(c => c.method === 'setLocalStorage')).toHaveLength(1)
    expect(JSON.parse(bridge.storage.get('settings')!)).toEqual({ v: 2, d: { focusMin: 50, breakMin: 10 } })
  })

  it('flush writes at once', async () => {
    const bridge = new FakeBridge()
    const store = createStore(bridge, { debounceMs: 60_000 })
    store.key('settings', spec).set({ focusMin: 45, breakMin: 5 })
    await store.flush()
    expect(bridge.storage.has('settings')).toBe(true)
  })

  it('migrates old versions', async () => {
    const bridge = new FakeBridge()
    bridge.storage.set('settings', JSON.stringify({ v: 1, d: { minutes: 50 } }))
    const s = createStore(bridge).key('settings', {
      ...spec,
      migrate: (d, from) => (from === 1 ? { focusMin: (d as { minutes: number }).minutes, breakMin: 5 } : undefined),
    })
    expect(await s.get()).toEqual({ focusMin: 50, breakMin: 5 })
  })

  it('falls back and reports on corrupt data', async () => {
    const bridge = new FakeBridge()
    bridge.storage.set('settings', '{not json')
    const errors: string[] = []
    const s = createStore(bridge, { onError: k => errors.push(k) }).key('settings', spec)
    expect(await s.get()).toEqual(spec.fallback)
    expect(errors).toEqual(['settings'])
  })
})

describe('lifecycle', () => {
  function setup() {
    const bridge = new FakeBridge()
    const lc = createLifecycle(bridge)
    const log: string[] = []
    lc.onCheckpoint(() => void log.push('checkpoint'))
    lc.onExit(() => void log.push('exit'))
    bridge.onEvenHubEvent(e => { const i = toIntent(e); if (i) lc.handle(i) })
    return { bridge, lc, log }
  }

  it('runs a checkpoint on every foreground event, in either direction', async () => {
    // On a G2 an overlay opening fires ENTER and closing fires EXIT (docs/findings/lifecycle.md#h7),
    // so neither direction means "paused". Both are checkpoints.
    const { bridge, log } = setup()
    bridge.foreground('enter') // the OS menu opens
    bridge.foreground('exit') // the OS menu closes
    await Promise.resolve()
    expect(log).toEqual(['checkpoint', 'checkpoint'])
  })

  it('runs exit once and ignores later events', async () => {
    const { bridge, lc, log } = setup()
    bridge.systemExit()
    bridge.systemExit()
    bridge.foreground('enter')
    await Promise.resolve()
    expect(log).toEqual(['exit'])
    expect(lc.exited).toBe(true)
  })

  it('passes non-lifecycle intents through', () => {
    const { lc } = setup()
    expect(lc.handle({ kind: 'tap', source: 'right' })).toBe(false)
  })

  it('asks the OS for the confirm dialog on exit, without cleaning up', async () => {
    const { bridge, lc, log } = setup()
    await lc.requestExit()
    expect(bridge.shutDownRequests).toEqual([1])
    expect(log).toEqual([])
  })
})
