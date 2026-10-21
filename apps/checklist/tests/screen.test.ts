import { describe, expect, it } from 'vitest'
import { textWidth } from '@maticsh/glasses'
import { listById, remove, seed, setAlign, setHideTicked, show, tickSelected, toggle, type State } from '../src/domain/lists.ts'
import { screenOf } from '../src/app/screen.ts'
import { ROWS, barText, glassText } from '../src/app/layout.ts'

const tickAll = (s: State, id = 'packing') => listById(s, id)!.items.reduce((acc, it) => (it.ticked ? acc : toggle(acc, id, it.id)), s)

describe('the screen model', () => {
  it('shows the list: lowercase title, five rows, the pointer on the first, tick and move on the bar', () => {
    const sc = screenOf(seed())
    expect(sc.title).toBe('packing')
    expect(sc.rows.map(r => r.text)).toEqual(['passport', 'charger', 'glasses case', 'toothbrush', 'book'])
    expect(sc.rows.map(r => r.selected)).toEqual([true, false, false, false, false])
    expect(sc.mood).toBeNull()
    expect(sc.bar).toEqual([{ id: 'toggle', label: 'tick', gesture: 'tap' }, { id: 'move', label: 'move', gesture: 'swipe' }])
    expect(sc.align).toBe('left')
  })

  it('says untick on a ticked item', () => {
    const sc = screenOf(tickSelected(seed()))
    expect(sc.rows[0]).toEqual({ text: 'passport', selected: true, ticked: true })
    expect(sc.bar[0]!.label).toBe('untick')
  })

  it('shows the mood line when every item is ticked', () => {
    const sc = screenOf(tickAll(seed()))
    expect(sc.mood).toBe('all ticked. nothing left to carry')
    expect(sc.rows.every(r => r.ticked)).toBe(true)
    expect(sc.bar.map(b => b.label)).toEqual(['untick', 'move'])
  })

  it('shows an empty list with its line and an empty bar', () => {
    let s = show(seed(), 'bed')
    for (const it of [...listById(s, 'bed')!.items]) s = remove(s, 'bed', it.id)
    const sc = screenOf(s)
    expect(sc.title).toBe('before bed')
    expect(sc.rows).toEqual([])
    expect(sc.mood).toBe('nothing on this list yet')
    expect(sc.bar).toEqual([])
  })

  it('hides ticked items, and drops move when one row is left', () => {
    let s = setHideTicked(seed(), true)
    for (let i = 0; i < 4; i++) s = tickSelected(s)
    const sc = screenOf(s)
    expect(sc.rows).toEqual([{ text: 'book', selected: true, ticked: false }])
    expect(sc.bar.map(b => b.id)).toEqual(['toggle'])
  })

  it('hides every row when all are ticked and hidden, and keeps the mood line', () => {
    const sc = screenOf(setHideTicked(tickAll(seed()), true))
    expect(sc.rows).toEqual([])
    expect(sc.mood).toBe('all ticked. nothing left to carry')
    expect(sc.bar).toEqual([])
  })

  it('carries the alignment', () => {
    expect(screenOf(setAlign(seed(), 'centre')).align).toBe('centre')
  })
})

describe('the glass text', () => {
  it('draws rows as pointer, box, name, with the boxes in one column', () => {
    const t = glassText(screenOf(tickSelected(seed())))
    const lines = t.rows.split('\n')
    expect(lines[0]).toBe('▶ ■ passport')
    expect(lines[1]!.trimStart()).toBe('□ charger')
    // The unpointed rows keep the pointer's width in spaces, within the font's half-space accuracy.
    const boxAt = (l: string) => textWidth(l.slice(0, l.search(/[■□]/)))
    expect(Math.abs(boxAt(lines[1]!) - boxAt(lines[0]!))).toBeLessThanOrEqual(textWidth(' ') / 2 + 0.5)
    expect(t.title).toBe('packing')
    expect(t.mood).toBe(' ')
  })

  it('centres the title and the rows as one block', () => {
    const t = glassText(screenOf(setAlign(seed(), 'centre')))
    const lines = t.rows.split('\n')
    const pads = lines.map(l => l.length - l.trimStart().length)
    expect(t.title.trimStart()).toBe('packing')
    expect(t.title.length - 'packing'.length).toBeGreaterThan(30)
    // Every row starts with the same block padding; the unpointed rows add the pointer slot.
    const block = pads[0]!
    expect(block).toBeGreaterThan(10)
    expect(pads.slice(1).every(p => p > block)).toBe(true)
    // The widest row sits in the middle, to within a space.
    const widest = Math.max(...lines.map(l => textWidth(l.trimStart()) + (l.length - l.trimStart().length - block) * textWidth(' ')))
    const left = block * textWidth(' ')
    expect(Math.abs(left - (ROWS.width - widest) / 2)).toBeLessThanOrEqual(textWidth(' '))
  })

  it('fills empty containers with a space, so the firmware clears them', () => {
    let s = show(seed(), 'bed')
    for (const it of [...listById(s, 'bed')!.items]) s = remove(s, 'bed', it.id)
    const t = glassText(screenOf(s))
    expect(t.rows).toBe(' ')
    expect(t.mood).toBe('nothing on this list yet')
  })

  it('writes the bar verb first, gesture second', () => {
    expect(barText(screenOf(seed()).bar)).toBe('tick ●   move ▲▼')
    expect(barText(screenOf(tickSelected(seed())).bar)).toBe('untick ●   move ▲▼')
    expect(barText([])).toBe('')
  })
})
