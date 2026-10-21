import { describe, expect, it } from 'vitest'
import { buildPage, type PageSpec } from '../src/domain/page.ts'
import { createRenderer, type RenderError } from '../src/infra/renderer.ts'
import { FakeBridge } from '@maticsh/testing'

const spec = (label: string): PageSpec => ({
  containers: [
    { kind: 'text', name: 'main', box: { x: 0, y: 0, width: 576, height: 200 }, content: label, capture: true },
    { kind: 'image', name: 'tree', box: { x: 0, y: 200, width: 48, height: 48 } },
  ],
  menu: [{ id: 1, label: 'Skip' }],
})

function setup(imageLatencyMs = 0) {
  const bridge = new FakeBridge({ imageLatencyMs })
  const errors: RenderError[] = []
  const r = createRenderer(bridge, { onError: e => errors.push(e) })
  return { bridge, r, errors }
}

const count = (b: FakeBridge, method: string) => b.calls.filter(c => c.method === method).length

describe('renderer', () => {
  it('creates first, then rebuilds', async () => {
    const { bridge, r } = setup()
    await r.mount(buildPage(spec('one')))
    await r.mount(buildPage(spec('two')))
    expect(count(bridge, 'createStartUpPageContainer')).toBe(1)
    expect(count(bridge, 'rebuildPageContainer')).toBe(1)
    expect(bridge.text('main')).toBe('two')
    expect(bridge.menuLabels).toEqual(['Skip'])
    bridge.assertNoViolations()
  })

  it('recovers when the glasses still hold a page from before a reload: create is refused, rebuild works', async () => {
    const bridge = new FakeBridge({ pageFromBefore: true })
    const r = createRenderer(bridge)
    expect(await r.mount(buildPage(spec('after reload')))).toBe(true)
    expect(count(bridge, 'rebuildPageContainer')).toBe(1)
    expect(bridge.text('main')).toBe('after reload')
    r.text('main', 'still writable')
    await r.flush()
    expect(bridge.text('main')).toBe('still writable')
    bridge.assertNoViolations()
  })

  it('collapses a burst of text updates into the latest one', async () => {
    const { bridge, r } = setup()
    const page = buildPage(spec('0'))
    await r.mount(page)
    for (let i = 1; i <= 50; i++) r.text('main', String(i))
    await r.flush()
    expect(count(bridge, 'textContainerUpgrade')).toBe(1)
    expect(bridge.text('main')).toBe('50')
  })

  it('skips text that has not changed, including the content from mount', async () => {
    const { bridge, r } = setup()
    await r.mount(buildPage(spec('same')))
    r.text('main', 'same')
    await r.flush()
    r.text('main', 'new')
    await r.flush()
    r.text('main', 'new')
    await r.flush()
    expect(count(bridge, 'textContainerUpgrade')).toBe(1)
  })

  it('sends a brightness change even when the text is the same', async () => {
    const { bridge, r } = setup()
    await r.mount(buildPage(spec('blink')))
    r.text('main', 'blink', 1)
    await r.flush()
    expect(bridge.texts.get('main')).toEqual({ content: 'blink', textColor: 1 })
  })

  it('keeps a queued brightness when a later update leaves brightness unset', async () => {
    // Regression, found on a G2: a blink ended on textColor 0, queued a restore to 4, and a
    // render right after it (no colour) replaced the queued write, so the text stayed dim.
    const { bridge, r } = setup()
    await r.mount(buildPage(spec('x')))
    r.text('main', 'blink', 0)
    await r.flush()
    r.text('main', 'restored', 4)
    r.text('main', 'restored and refreshed')
    await r.flush()
    expect(bridge.texts.get('main')).toEqual({ content: 'restored and refreshed', textColor: 4 })
  })

  it('sends text before the next image, so an animating app still answers a gesture at once', async () => {
    const { bridge, r } = setup(20)
    await r.mount(buildPage(spec('0')))
    const twoPage = buildPage({ ...spec('0'), containers: [...spec('0').containers, { kind: 'image', name: 'bar', box: { x: 100, y: 200, width: 48, height: 48 } }] })
    await r.mount(twoPage)
    r.image('tree', [1]) // goes in flight
    await new Promise(res => setTimeout(res, 5))
    r.image('bar', [2]) // waiting
    r.text('main', 'pet') // arrives last, goes out next
    await r.flush()
    const order = bridge.calls.slice(-3).map(c => c.method)
    expect(order).toEqual(['updateImageRawData', 'textContainerUpgrade', 'updateImageRawData'])
    bridge.assertNoViolations()
  })

  it('keeps one image in flight and sends only the latest frame after it', async () => {
    const { bridge, r } = setup(20)
    await r.mount(buildPage(spec('x')))
    r.image('tree', [1])
    await new Promise(res => setTimeout(res, 5)) // first send is now in flight
    r.image('tree', [2])
    r.image('tree', [3])
    await r.flush()
    const sent = bridge.calls.filter(c => c.method === 'updateImageRawData').map(c => (c.arg as { imageData: number[] }).imageData)
    expect(sent).toEqual([[1], [3]])
    bridge.assertNoViolations()
  })

  it('reports writes to unknown containers instead of failing silently', async () => {
    const { r, errors } = setup()
    await r.mount(buildPage(spec('x')))
    r.text('ghost', 'boo')
    await r.flush()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ op: 'text', name: 'ghost' })
  })

  it('drops text queued for the old page when a new page mounts', async () => {
    const { bridge, r } = setup()
    await r.mount(buildPage(spec('a')))
    r.text('main', 'stale')
    void r.mount(buildPage(spec('fresh')))
    await r.flush()
    expect(bridge.text('main')).toBe('fresh')
    expect(count(bridge, 'textContainerUpgrade')).toBe(0)
  })
})
