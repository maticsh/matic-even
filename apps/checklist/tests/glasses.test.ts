import { describe, expect, it } from 'vitest'
import { FakeBridge } from '@maticsh/testing'
import type { Grid } from '@maticsh/glasses'
import { SWIPE_GATE_MS, run, type Env, type View } from '../src/app/glasses.ts'
import { barImage } from '../src/app/layout.ts'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime()

/** A clock under the test's control, a stub encoder that keeps every grid, and the phone's views. */
function harness(start = at(4, 9)) {
  let t = start
  const grids: Grid[] = []
  const views: View[] = []
  const env: Env = {
    now: () => t,
    encode: async g => { grids.push(g); return new Uint8Array([g.w & 255, g.w >> 8, g.h]) },
    onChange: v => void views.push(v),
  }
  return { env, grids, views, advance: (ms: number) => { t += ms }, set: (ms: number) => { t = ms } }
}

const settle = () => new Promise(r => setTimeout(r, 0))
/** Let encodes and the write queue drain, then read a container. */
async function glass(b: FakeBridge, app: { flush: () => Promise<void> }, name = 'rows') {
  await settle()
  await app.flush()
  await settle()
  await app.flush()
  return b.text(name) ?? ''
}
const lines = async (b: FakeBridge, app: { flush: () => Promise<void> }) => (await glass(b, app)).split('\n').map(l => l.trim())

/** A new launch on the same phone: the storage carries over, nothing else does. */
function relaunch(from: FakeBridge): FakeBridge {
  const next = new FakeBridge({ pageFromBefore: true })
  for (const [k, v] of from.storage) next.storage.set(k, v)
  return next
}

describe('on the glasses', () => {
  it('opens on Packing with the pointer on the first item and the bar drawn', async () => {
    const b = new FakeBridge()
    const h = harness()
    const app = await run(b, h.env)
    expect(await lines(b, app)).toEqual(['▶ □ passport', '□ charger', '□ glasses case', '□ toothbrush', '□ book'])
    expect(b.text('title')).toBe('packing')
    expect(b.images.has('bar')).toBe(true)
    expect(h.grids.at(-1)!.px).toEqual(barImage('tick ●   move ▲▼', 'left').px)
    b.assertNoViolations()
  })

  it('ticks on a tap, and the bar turns to untick', async () => {
    const b = new FakeBridge()
    const h = harness()
    const app = await run(b, h.env)
    b.tap()
    expect((await lines(b, app))[0]).toBe('▶ ■ passport')
    expect(h.grids.at(-1)!.px).toEqual(barImage('untick ●   move ▲▼', 'left').px)
    expect(h.views.at(-1)!.state.lists[0]!.items[0]!.ticked).toBe(true)
    b.tap()
    expect((await lines(b, app))[0]).toBe('▶ □ passport')
    b.assertNoViolations()
  })

  it('moves the pointer one item per swipe, gating the extra events of one long swipe', async () => {
    const b = new FakeBridge()
    const h = harness()
    const app = await run(b, h.env)
    b.swipe('down')
    b.swipe('down') // the same swipe, a moment later: ignored
    expect((await lines(b, app))[1]).toBe('▶ □ charger')
    h.advance(SWIPE_GATE_MS)
    b.swipe('down')
    expect((await lines(b, app))[2]).toBe('▶ □ glasses case')
    h.advance(SWIPE_GATE_MS)
    b.swipe('up')
    expect((await lines(b, app))[1]).toBe('▶ □ charger')
    b.tap()
    expect((await lines(b, app))[1]).toBe('▶ ■ charger')
    b.assertNoViolations()
  })

  it('asks the system to exit on a double tap, and saves on exit', async () => {
    const b = new FakeBridge()
    const app = await run(b, harness().env)
    b.tap()
    b.doubleTap()
    await settle()
    expect(b.shutDownRequests).toEqual([1])
    b.systemExit()
    await glass(b, app)
    expect(JSON.parse(b.storage.get('checklist.state')!).d.lists[0].items[0].ticked).toBe(true)
    b.assertNoViolations()
  })
})

describe('from the phone', () => {
  it('re-renders the glass at once when the phone changes something', async () => {
    const b = new FakeBridge()
    const app = await run(b, harness().env)
    await glass(b, app)
    app.show('groceries')
    expect(await glass(b, app, 'title')).toBe('groceries')
    expect((await lines(b, app))[0]).toBe('▶ □ oat milk')
    app.add('groceries', 'Bread')
    expect((await lines(b, app)).at(-1)).toBe('□ bread')
    app.toggle('groceries', app.state.lists[1]!.items[1]!.id)
    expect((await lines(b, app))[1]).toBe('■ lemons')
    b.assertNoViolations()
  })

  it('rebuilds the page to centre the text, with the words already in it', async () => {
    const b = new FakeBridge()
    const h = harness()
    const app = await run(b, h.env)
    await glass(b, app)
    app.setAlign('centre')
    const title = await glass(b, app, 'title')
    expect(b.calls.filter(c => c.method === 'rebuildPageContainer')).toHaveLength(1)
    expect(title.trimStart()).toBe('packing')
    expect(title.length).toBeGreaterThan('packing'.length + 30)
    expect(h.grids.at(-1)!.px).toEqual(barImage('tick ●   move ▲▼', 'centre').px)
    b.assertNoViolations()
  })

  it('shows the mood line when every item is ticked, and on an empty list', async () => {
    const b = new FakeBridge()
    const app = await run(b, harness().env)
    for (const it of app.state.lists[2]!.items) app.toggle('bed', it.id)
    app.show('bed')
    expect(await glass(b, app, 'mood')).toBe('all ticked. nothing left to carry')
    for (const it of [...app.state.lists[2]!.items]) app.remove('bed', it.id)
    expect(await glass(b, app, 'mood')).toBe('nothing on this list yet')
    expect(await glass(b, app)).toBe(' ')
    b.assertNoViolations()
  })
})

describe('storage', () => {
  it('survives a restart', async () => {
    const b = new FakeBridge()
    const h = harness()
    const app = await run(b, h.env)
    b.tap()
    app.show('groceries')
    app.setHideTicked(true)
    await app.flush()

    const b2 = relaunch(b)
    const app2 = await run(b2, h.env)
    expect(app2.state.showing).toBe('groceries')
    expect(app2.state.settings.hideTicked).toBe(true)
    expect(app2.state.lists[0]!.items[0]!.ticked).toBe(true)
    expect(await glass(b2, app2, 'title')).toBe('groceries')
    b2.assertNoViolations()
  })

  it('starts from the seed when the stored state is broken', async () => {
    const b = new FakeBridge()
    b.storage.set('checklist.state', JSON.stringify({ v: 1, d: { lists: 'nope' } }))
    const app = await run(b, harness().env)
    expect(app.state.lists.map(l => l.name)).toEqual(['Packing', 'Groceries', 'Before bed'])
  })
})

describe('the morning reset', () => {
  it('unticks across a day boundary: at a checkpoint after the time, and on a later launch', async () => {
    const b = new FakeBridge()
    const h = harness(at(4, 20))
    const app = await run(b, h.env)
    app.setMorningReset('07:00')
    b.tap()
    expect((await lines(b, app))[0]).toBe('▶ ■ passport')

    // Next day, before the time: an overlay opens and closes, nothing changes.
    h.set(at(5, 6, 59))
    b.foreground('enter')
    b.foreground('exit')
    expect((await lines(b, app))[0]).toBe('▶ ■ passport')

    // After the time: the next checkpoint unticks, once.
    h.set(at(5, 7, 5))
    b.foreground('enter')
    expect((await lines(b, app))[0]).toBe('▶ □ passport')
    b.tap()
    h.set(at(5, 9))
    b.foreground('exit')
    expect((await lines(b, app))[0]).toBe('▶ ■ passport')
    await app.flush()

    // Two days later the app opens again, after the time: it catches up on start.
    h.set(at(7, 8))
    const b2 = relaunch(b)
    const app2 = await run(b2, h.env)
    expect((await lines(b2, app2))[0]).toBe('▶ □ passport')
    b.assertNoViolations()
    b2.assertNoViolations()
  })
})
