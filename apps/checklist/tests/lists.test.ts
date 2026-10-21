import { describe, expect, it } from 'vitest'
import {
  MAX_ITEMS, MAX_TEXT, add, listById, minutesOf, morningReset, move, parseState, remove, rename, seed, select,
  selectedItem, setAlign, setHideTicked, setMorningReset, show, showingList, tickSelected, toggle, type State,
} from '../src/domain/lists.ts'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime()
const packing = (s: State) => listById(s, 'packing')!
const texts = (s: State, id = 'packing') => listById(s, id)!.items.map(i => i.text)
const pointed = (s: State) => selectedItem(showingList(s), s.settings.hideTicked)?.text

describe('the seed', () => {
  it('holds the three example lists, Packing on the glasses, all open', () => {
    const s = seed()
    expect(s.lists.map(l => l.name)).toEqual(['Packing', 'Groceries', 'Before bed'])
    expect(texts(s)).toEqual(['Passport', 'Charger', 'Glasses case', 'Toothbrush', 'Book'])
    expect(texts(s, 'bed')).toEqual(['Lights off', 'Alarm set', 'Water by the bed'])
    expect(s.showing).toBe('packing')
    expect(s.lists.flatMap(l => l.items).every(i => !i.ticked)).toBe(true)
    expect(new Set(s.lists.flatMap(l => l.items.map(i => i.id))).size).toBe(12)
  })
})

describe('tick and move', () => {
  it('ticks and unticks the item under the pointer', () => {
    const s1 = tickSelected(seed())
    expect(packing(s1).items[0]!.ticked).toBe(true)
    expect(packing(tickSelected(s1)).items[0]!.ticked).toBe(false)
  })

  it('moves one item per step and stops at both ends', () => {
    let s = seed()
    expect(move(s, -1)).toBe(s)
    for (let i = 0; i < 10; i++) s = move(s, 1)
    expect(pointed(s)).toBe('Book')
    const end = s
    expect(move(end, 1)).toBe(end)
    expect(pointed(move(end, -1))).toBe('Toothbrush')
  })

  it('skips ticked items when they are hidden', () => {
    let s = seed()
    s = toggle(s, 'packing', packing(s).items[1]!.id) // Charger
    s = toggle(s, 'packing', packing(s).items[2]!.id) // Glasses case
    s = setHideTicked(s, true)
    expect(pointed(s)).toBe('Passport')
    expect(pointed(move(s, 1))).toBe('Toothbrush')
    expect(pointed(move(move(s, 1), -1))).toBe('Passport')
  })

  it('moves the pointer on when the pointed item ticks and hides', () => {
    let s = setHideTicked(seed(), true)
    s = tickSelected(s)
    expect(pointed(s)).toBe('Charger')
    // Tick the last one: the pointer steps back to the nearest one above.
    s = select(s, 'packing', packing(s).items[4]!.id)
    s = tickSelected(s)
    expect(pointed(s)).toBe('Toothbrush')
  })

  it('points at nothing when every item is ticked and hidden, and ticks nothing', () => {
    let s = setHideTicked(seed(), true)
    for (let i = 0; i < MAX_ITEMS; i++) s = tickSelected(s)
    expect(pointed(s)).toBeUndefined()
    expect(tickSelected(s)).toBe(s)
    expect(move(s, 1)).toBe(s)
  })
})

describe('the phone', () => {
  it('adds at the end and refuses a sixth item', () => {
    const s = add(seed(), 'groceries', '  Bread  ')
    expect(texts(s, 'groceries')).toEqual(['Oat milk', 'Lemons', 'Rice', 'Coffee', 'Bread'])
    expect(add(s, 'groceries', 'Eggs')).toBe(s)
    expect(add(seed(), 'groceries', '   ')).toEqual(seed())
  })

  it('cuts long names and keeps ids unique', () => {
    const s = add(remove(seed(), 'packing', 'i4'), 'packing', 'x'.repeat(80))
    expect(packing(s).items.at(-1)!.text).toHaveLength(MAX_TEXT)
    expect(packing(s).items.at(-1)!.id).not.toBe('i4')
  })

  it('points a new item when the list was empty', () => {
    let s = seed()
    for (const it of [...listById(s, 'bed')!.items]) s = remove(s, 'bed', it.id)
    s = add(s, 'bed', 'Read')
    expect(listById(s, 'bed')!.selected).toBe(0)
  })

  it('renames, and refuses an empty name', () => {
    const s = rename(seed(), 'packing', 'i0', 'Visa')
    expect(texts(s)[0]).toBe('Visa')
    expect(rename(s, 'packing', 'i0', '  ')).toBe(s)
    expect(rename(s, 'packing', 'nope', 'X')).toBe(s)
  })

  it('removes, keeping the pointer on the same item or the next one', () => {
    let s = select(seed(), 'packing', 'i3') // Toothbrush
    s = remove(s, 'packing', 'i0')
    expect(pointed(s)).toBe('Toothbrush')
    s = remove(s, 'packing', 'i3')
    expect(pointed(s)).toBe('Book')
    s = remove(s, 'packing', 'i4')
    expect(pointed(s)).toBe('Glasses case')
  })

  it('shows another list, and ignores unknown ids', () => {
    const s = show(seed(), 'groceries')
    expect(showingList(s).name).toBe('Groceries')
    expect(show(s, 'groceries')).toBe(s)
    expect(show(s, 'nope')).toBe(s)
  })

  it('cannot point at a hidden item', () => {
    let s = toggle(seed(), 'packing', 'i2')
    s = setHideTicked(s, true)
    expect(select(s, 'packing', 'i2')).toBe(s)
  })

  it('changes settings only when they change', () => {
    const s = seed()
    expect(setAlign(s, 'left')).toBe(s)
    expect(setAlign(s, 'centre').settings.align).toBe('centre')
    expect(setHideTicked(s, false)).toBe(s)
    expect(setMorningReset(s, '25:00', at(4, 8))).toBe(s)
  })
})

describe('the morning reset', () => {
  const ticked = (s: State) => s.lists.flatMap(l => l.items).filter(i => i.ticked).length

  it('reads times', () => {
    expect(minutesOf('07:30')).toBe(450)
    expect(minutesOf('7:30')).toBeNull()
    expect(minutesOf('24:00')).toBeNull()
  })

  it('does nothing while off', () => {
    const s = tickSelected(seed())
    expect(morningReset(s, at(5, 9))).toBe(s)
  })

  it('unticks every list once a day, at or after the time', () => {
    let s = setMorningReset(seed(), '07:00', at(4, 6))
    s = tickSelected(toggle(s, 'groceries', 'i6'))
    expect(ticked(s)).toBe(2)
    expect(morningReset(s, at(4, 6, 59))).toBe(s)
    const reset = morningReset(s, at(4, 7))
    expect(ticked(reset)).toBe(0)
    expect(reset.lastReset).toBe('2026-10-04')
    // Ticked again later that day: no second reset until tomorrow's time.
    const later = tickSelected(reset)
    expect(morningReset(later, at(4, 23))).toBe(later)
    expect(morningReset(later, at(5, 6))).toBe(later)
    expect(ticked(morningReset(later, at(5, 7, 1)))).toBe(0)
  })

  it('catches up a missed day when the app opens late', () => {
    let s = setMorningReset(seed(), '07:00', at(4, 6))
    s = tickSelected(s)
    expect(ticked(morningReset(s, at(9, 18)))).toBe(0)
  })

  it('does not untick today when switched on after the time', () => {
    let s = tickSelected(seed())
    s = setMorningReset(s, '07:00', at(4, 12))
    expect(morningReset(s, at(4, 12, 1))).toBe(s)
    expect(ticked(morningReset(s, at(5, 7)))).toBe(0)
  })
})

describe('stored state', () => {
  it('round-trips through JSON', () => {
    const s = setMorningReset(setHideTicked(tickSelected(seed()), true), '06:45', at(4, 5))
    expect(parseState(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('refuses a bad shape', () => {
    expect(() => parseState({ lists: [] })).toThrow()
    expect(() => parseState({ ...seed(), settings: { align: 'right', hideTicked: false, morningReset: null } })).toThrow()
  })

  it('repairs a showing id that points nowhere', () => {
    expect(parseState({ ...seed(), showing: 'gone' }).showing).toBe('packing')
  })
})
