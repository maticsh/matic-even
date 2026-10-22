import { describe, expect, it } from 'vitest'
import { FakeBridge } from '@maticsh/testing'
import { LIMITS, checkText, missingGlyphs } from '../src/domain/budget.ts'
import { LINE_HEIGHT, SCREEN, inner, textWidth } from '../src/domain/fit.ts'
import { buildPage, type ContainerSpec } from '../src/domain/page.ts'
import { cardPage, imagePage, listPage, valuePage, type Preset } from '../src/domain/presets.ts'
import { createRenderer } from '../src/infra/renderer.ts'

const LONG = 'The quick brown fox jumps over the lazy dog while the parcel waits at the front desk until six, '
  + 'and the garage still needs a call about the brakes before noon tomorrow, or the day after at the latest.'
const BAR = { text: 'done ● next ▲▼' }

/** Every preset, with and without the optional parts. */
const ALL: Record<string, Preset> = {
  list: listPage({ title: 'packing', items: ['passport', 'charger', 'glasses case'], selected: 1 }),
  listBar: listPage({ title: 'packing', items: ['passport', 'charger'], selected: 0, bar: BAR }),
  value: valuePage({ label: 'heart rate', value: '72', unit: 'bpm', note: 'resting, 5 min ago' }),
  valueBar: valuePage({ label: 'next train', value: '4', unit: 'min', bar: BAR }),
  card: cardPage({ title: 'stand-up', body: 'Room 4. Bring the numbers from last week.' }),
  cardFull: cardPage({ title: 'stand-up', body: `${LONG} ${LONG}`, progress: 0.4, bar: BAR }),
  image: imagePage({ width: 144, height: 144 }),
  imageCaption: imagePage({ width: 200, height: 100, caption: 'tide at the pier' }),
}

const containers = (p: Preset) => p.spec.containers

async function mount(p: Preset) {
  const bridge = new FakeBridge()
  const errors: unknown[] = []
  const ui = createRenderer(bridge, { onError: e => errors.push(e) })
  const page = buildPage(p.spec)
  expect(await ui.mount(page)).toBe(true)
  for (const name of Object.keys(page.boxes)) if (page.kinds[name] === 'image') ui.image(name, [1, 2, 3])
  await ui.flush()
  expect(errors).toEqual([])
  return { bridge, page }
}

describe('page presets', () => {
  for (const [name, p] of Object.entries(ALL)) {
    it(`${name}: mounts on the fake bridge with no violations`, async () => {
      const { bridge, page } = await mount(p)
      bridge.assertNoViolations()
      expect(bridge.text('input')).toBe(' ')
      for (const [n, content] of Object.entries(p.text)) expect(bridge.text(n)).toBe(content)
      expect(bridge.images.size).toBe(Object.values(page.kinds).filter(k => k === 'image').length)
    })

    it(`${name}: one capture container, z-order on every container, short names, on screen, within the limits`, () => {
      const cs = containers(p)
      expect(cs.filter(c => c.kind !== 'image' && c.capture)).toHaveLength(1)
      const { create } = buildPage(p.spec)
      const all = [...(create.textObject ?? []), ...(create.listObject ?? []), ...(create.imageObject ?? [])]
      expect(all.every(c => typeof c.zOrderIndex === 'number' && c.zOrderIndex > 0)).toBe(true)
      for (const c of cs) {
        expect(new TextEncoder().encode(c.name).length).toBeLessThanOrEqual(LIMITS.containerNameBytes)
        expect(c.box.x).toBeGreaterThanOrEqual(0)
        expect(c.box.y).toBeGreaterThanOrEqual(0)
        expect(c.box.x + c.box.width).toBeLessThanOrEqual(SCREEN.width)
        expect(c.box.y + c.box.height).toBeLessThanOrEqual(SCREEN.height)
        if (c.kind === 'text') expect(checkText(c.content, 'create')).toEqual([])
      }
      expect(cs.length).toBeLessThanOrEqual(LIMITS.containers)
    })

    it(`${name}: no text line wider than its container, so nothing wraps or scrolls`, () => {
      for (const c of containers(p)) {
        if (c.kind !== 'text' || c.name === 'input') continue
        const area = inner({ ...c.box, paddingLength: c.padding, borderWidth: c.border?.width })
        const lines = c.content.split('\n')
        for (const l of lines) expect(textWidth(l)).toBeLessThanOrEqual(area.width)
        expect(lines.length * LINE_HEIGHT).toBeLessThanOrEqual(area.height)
      }
    })
  }

  it('draws the bar line into a grid the size of the slot, clamped to the image limits', () => {
    expect(ALL.listBar!.images.bar).toMatchObject({ w: 288, h: 20 })
    expect(ALL.listBar!.images.bar!.px.some(v => v > 0)).toBe(true)
    const big = listPage({ title: 't', items: ['a'], bar: { text: 'tick ●', width: 1000, height: 3 } })
    const bar = containers(big).find(c => c.name === 'bar')!
    expect(bar.box).toMatchObject({ width: 288, height: 20, x: 16, y: SCREEN.height - 12 - 20 })
    expect(listPage({ title: 't', items: ['a'], bar: { text: '', width: 100, height: 300 } }).images.bar).toMatchObject({ w: 100, h: 144 })
  })
})

describe('listPage', () => {
  it('puts the pointer on the selected row and keeps the other rows lined up', () => {
    const rows = ALL.list!.text.rows!.split('\n')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toBe('▶ charger')
    expect(rows[0]!.trimStart()).toBe('passport')
    expect(textWidth(rows[0]!.slice(0, rows[0]!.indexOf('p')))).toBe(textWidth('▶ '))
  })

  it('cuts long rows and a long title by pixels, ending in an ellipsis', () => {
    const p = listPage({ title: LONG, items: [LONG, 'short'], selected: 0 })
    const [first] = p.text.rows!.split('\n')
    expect(first!.startsWith('▶ The quick')).toBe(true)
    expect(first!.endsWith('...') || first!.endsWith('…')).toBe(true)
    expect(textWidth(first!)).toBeLessThanOrEqual(544)
    expect(textWidth(p.text.title!)).toBeLessThanOrEqual(544)
    expect(p.text.title!.length).toBeLessThan(LONG.length)
  })

  it('shows the empty text, or a blank, for an empty list', async () => {
    const blank = listPage({ title: 'packing', items: [] })
    expect(blank.text.rows).toBe(' ')
    expect(listPage({ title: 'packing', items: [], empty: 'nothing here yet' }).text.rows).toBe('nothing here yet')
    ;(await mount(blank)).bridge.assertNoViolations()
  })

  it('draws no pointer when the selected index is out of range', () => {
    for (const selected of [-1, 3, 99, 1.5, Number.NaN]) {
      const p = listPage({ title: 't', items: ['a', 'b', 'c'], selected })
      expect(p.text.rows).not.toContain('▶')
    }
  })

  it('fills the space down to the bar, and scrolls so the selected row shows', () => {
    const items = Array.from({ length: 20 }, (_, i) => `item ${i + 1}`)
    expect(listPage({ title: 't', items }).text.rows!.split('\n')).toHaveLength(8)
    const withBar = listPage({ title: 't', items, selected: 15, bar: BAR })
    const rows = withBar.text.rows!.split('\n')
    expect(rows).toHaveLength(7)
    expect(rows.at(-1)).toBe('▶ item 16')
  })

  it('swaps glyphs the font lacks and keeps rows within the character limit', () => {
    const p = listPage({ title: 'done ✓', items: ['i'.repeat(400), ...Array(19).fill('i'.repeat(400))] })
    expect(missingGlyphs(p.text.title!)).toEqual([])
    expect(checkText(p.text.rows!, 'create')).toEqual([])
  })
})

describe('valuePage', () => {
  it('centres the value on the display, the label above and the note below', () => {
    const cs = containers(ALL.value!)
    const box = (n: string) => cs.find(c => c.name === n)!.box
    expect(box('value').y + LINE_HEIGHT / 2).toBeCloseTo(SCREEN.height / 2, -1)
    expect(box('label').y + box('label').height).toBeLessThanOrEqual(box('value').y)
    expect(box('note').y).toBeGreaterThanOrEqual(box('value').y + LINE_HEIGHT)
    const value = ALL.value!.text.value!
    expect(value.trim()).toBe('72 bpm')
    const lead = textWidth(value) - textWidth(value.trimStart())
    expect(Math.abs(lead + textWidth('72 bpm') / 2 - 544 / 2)).toBeLessThanOrEqual(textWidth(' '))
  })

  it('fits a long note to two centred lines, and leaves out an empty one', () => {
    const p = valuePage({ label: 'l', value: '1', note: LONG })
    const note = p.text.note!.split('\n')
    expect(note).toHaveLength(2)
    expect(note[1]!.trimEnd().endsWith('…')).toBe(true)
    expect(containers(valuePage({ label: 'l', value: '1' })).some(c => c.name === 'note')).toBe(false)
  })
})

describe('cardPage', () => {
  it('borders the card and fits the body to its inner box', () => {
    const card = containers(ALL.cardFull!).find(c => c.name === 'card') as Extract<ContainerSpec, { kind: 'text' }>
    expect(card.border?.width).toBeGreaterThan(0)
    const lines = card.content.split('\n')
    const area = inner({ ...card.box, paddingLength: card.padding, borderWidth: card.border?.width })
    expect(lines).toHaveLength(Math.floor(area.height / LINE_HEIGHT))
    expect(lines[0]).toBe('stand-up')
    expect(lines.join(' ')).toContain('…')
  })

  it('puts the progress line from glyphs on the last line', () => {
    const lines = ALL.cardFull!.text.card!.split('\n')
    expect(lines.at(-1)).toMatch(/^━+─+$/)
    const short = cardPage({ title: 't', body: 'one line', progress: 1 }).text.card!.split('\n')
    expect(short.at(-1)).toMatch(/^━+$/)
    expect(short[1]).toBe('one line')
  })
})

describe('imagePage', () => {
  it('centres the image in front of a full-screen input layer', () => {
    const cs = containers(ALL.image!)
    expect(cs[0]).toMatchObject({ kind: 'text', name: 'input', content: ' ', capture: true, box: { x: 0, y: 0, width: 576, height: 288 } })
    expect(cs[1]).toMatchObject({ kind: 'image', name: 'image', box: { x: 216, y: 72, width: 144, height: 144 } })
  })

  it('clamps odd sizes to the image limits and keeps the image on screen', () => {
    const box = (o: Parameters<typeof imagePage>[0]) => buildPage(imagePage(o).spec).boxes.image
    expect(box({ width: 1000, height: 1000 })).toMatchObject({ width: 288, height: 144 })
    expect(box({ width: 3, height: -5 })).toMatchObject({ width: 20, height: 20 })
    expect(box({ width: 100.6, height: 50.4 })).toMatchObject({ width: 101, height: 50 })
    expect(box({ width: Number.NaN, height: Number.POSITIVE_INFINITY })).toMatchObject({ width: 20, height: 144 })
    expect(box({ width: 200, height: 100, x: 500, y: -10 })).toEqual({ x: 376, y: 0, width: 200, height: 100 })
  })

  it('puts the caption under the image, or above it when there is no room under', () => {
    const at = (p: Preset, n: string) => containers(p).find(c => c.name === n)!.box
    const p = ALL.imageCaption!
    expect(at(p, 'caption').y).toBeGreaterThanOrEqual(at(p, 'image').y + at(p, 'image').height)
    const low = imagePage({ width: 100, height: 100, y: 188, caption: 'low' })
    expect(at(low, 'caption').y + at(low, 'caption').height).toBeLessThanOrEqual(at(low, 'image').y)
  })
})

describe('container boxes', () => {
  it('match the snapshot for each preset', () => {
    const boxes = Object.fromEntries(Object.entries(ALL).map(([n, p]) => [n, containers(p).map(c => `${c.kind} ${c.name} ${c.box.x},${c.box.y} ${c.box.width}x${c.box.height}${c.kind !== 'image' && c.capture ? ' capture' : ''}`)]))
    expect(boxes).toMatchSnapshot()
  })
})
