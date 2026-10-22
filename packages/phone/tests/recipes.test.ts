import { describe, expect, it } from 'vitest'
import { frameHtml, pinHeights, pinVars } from '../src/frame.ts'
import type { GlassScreen } from '../src/glass.ts'
import { firstRunScreen, listScreen, settingsScreen } from '../src/recipes.ts'

const SCREEN: GlassScreen = {
  title: 'packing',
  rows: [{ text: 'passport', ticked: true }, { text: 'charger', ticked: false, selected: true }],
  bar: [{ label: 'tick', gesture: 'tap' }],
  align: 'left',
}
const TABS = [
  { id: 'lists', label: 'Lists', icon: 'list' as const },
  { id: 'items', label: 'Items', icon: 'check' as const },
]

const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0
/** Every class attribute, in order: a rough outline of the markup. */
const classes = (html: string) => [...html.matchAll(/class="([^"]+)"/g)].map(m => m[1]!)

describe('frameHtml', () => {
  it('draws the preview and the strip when given a screen, and fills the panel', () => {
    const html = frameHtml({ title: 'Packing', screen: SCREEN, meta: '1/2', panel: '<p>hi</p>' })
    expect(html).toContain('<span class="full"><svg viewBox="0 0 576 288"')
    expect(html).toContain('<span class="n">1/2</span>')
    expect(html).toContain('<div class="panel"><p>hi</p></div>')
    expect(html).not.toContain('tabbar')
  })

  it('draws the tab bar and the wide-screen segmented control from one tab list', () => {
    const html = frameHtml({ title: 'Packing', tabs: TABS, tab: 'items', tabAct: 'go' })
    expect(count(html, /data-act="go"/g)).toBe(4)
    expect(html).toContain('data-arg="items" aria-current="page"')
    expect(html).toContain('<nav class="tabbar" aria-label="Sections">')
  })

  it('works out the pin from its width, and fades the two layers across the shrink', () => {
    expect(pinHeights(390)).toEqual({ full: 8 + 27 + (390 - 59) / 2 + 8, strip: 75 })
    expect(pinVars(0)).toEqual({ '--p': '0.0000', '--a': '1.000', '--b': '0.000' })
    expect(pinVars(1)).toEqual({ '--p': '1.0000', '--a': '0.000', '--b': '1.000' })
  })
})

describe('settingsScreen', () => {
  const html = settingsScreen({
    title: 'Settings', screen: SCREEN,
    toggle: { title: 'Hide ticked items', on: true, act: { name: 'hide' } },
    value: { title: 'Untick every morning', value: '07:00', act: { name: 'open' } },
    choice: { segments: [{ label: 'Left', act: { name: 'align', arg: 'left' }, on: true }, { label: 'Centred', act: { name: 'align', arg: 'centre' }, on: false }] },
    slider: { label: 'At', value: 420, min: 300, max: 660, step: 15, format: v => `${v / 60}h`, change: 'slide' },
    note: 'Settings stay on this phone.',
  })

  it('puts the preview first, then one card holding the four rows in order, then the note', () => {
    const order = classes(html).filter(c => ['pin', 'card sh-gap', 'switch', 'open', 'seg', 'slider', 'note'].includes(c))
    expect(order).toEqual(['pin', 'card sh-gap', 'switch', 'open', 'seg', 'slider', 'note'])
    expect(count(html, /class="card/g)).toBe(1)
    expect(html).toContain('role="switch" aria-checked="true"')
    expect(html).toContain('<span class="chev" aria-hidden="true">›</span>')
    expect(html).toContain('type="range" min="300" max="660" step="15" value="420"')
    expect(html).toContain('<p class="note">Settings stay on this phone.</p>')
  })

  it('leaves out the rows it is not given', () => {
    const bare = settingsScreen({ title: 'Settings', screen: SCREEN, toggle: { title: 'A', on: false, act: { name: 'a' } } })
    expect(bare).toContain('role="switch"')
    expect(bare).not.toContain('class="seg')
    expect(bare).not.toContain('type="range"')
    expect(bare).not.toContain('class="note"')
  })

  it('escapes the text it is given', () => {
    const x = settingsScreen({ title: '<b>', screen: SCREEN, note: '"a" & <c>' })
    expect(x).toContain('<h1>&lt;b&gt;</h1>')
    expect(x).toContain('&quot;a&quot; &amp; &lt;c&gt;')
  })
})

describe('listScreen', () => {
  const html = listScreen({
    title: 'Packing', screen: SCREEN, meta: '1/2', tabs: TABS, tab: 'items', tabAct: 'tab',
    items: [{ id: 'p', text: 'Passport', ticked: true }, { id: 'c', text: 'Charger', ticked: false, pointer: true }],
    acts: { tick: 'tick', pick: 'pick', edit: 'edit' },
    add: { id: 'add-item', placeholder: 'Add an item', maxLength: 32, act: 'add' },
  })

  it('pins the preview, with the strip it shrinks to', () => {
    expect(html).toContain('<header class="pin">')
    expect(html).toContain('<span class="strip"><b>packing</b>')
  })

  it('draws a check row per item, carrying the item id to each handler', () => {
    expect(count(html, /class="row check-row/g)).toBe(2)
    expect(html).toContain('data-act="tick" data-arg="p" aria-pressed="true"')
    expect(html).toContain('data-act="pick" data-arg="c" aria-current="true"')
    expect(html).toContain('data-act="edit" data-arg="c" aria-label="Edit Charger"')
    expect(html).toContain('class="row check-row sel"')
  })

  it('ends the card with an add row, and draws the tab bar', () => {
    expect(html).toContain('id="add-item" type="text" placeholder="Add an item"')
    expect(html).toContain('data-enter="add"')
    expect(html).toContain('<button type="button" class="pill" data-act="add">Add</button>')
    expect(html.indexOf('data-enter="add"')).toBeGreaterThan(html.lastIndexOf('check-row'))
    expect(html).toContain('<nav class="tabbar"')
  })

  it('draws just the add row for an empty list, and disables it when asked', () => {
    const none = listScreen({
      title: 'Packing', screen: { ...SCREEN, rows: [] }, items: [], acts: { tick: 't', edit: 'e' },
      add: { id: 'a', placeholder: 'Full', maxLength: 32, act: 'add', disabled: true },
    })
    expect(none).not.toContain('check-row')
    expect(none).toContain('disabled')
  })
})

describe('firstRunScreen', () => {
  const html = firstRunScreen({
    title: 'Packing', empty: { title: 'No lists yet', body: 'Make one, and it shows on the glasses.' },
    action: { label: 'Make a list', act: { name: 'start' } }, note: 'Lists stay on this phone.',
  })

  it('draws the empty state, one ink button and a note, with no preview', () => {
    expect(html).toContain('<div class="empty"><b>No lists yet</b>')
    expect(count(html, /<button/g)).toBe(1)
    expect(html).toContain('<button type="button" class="pill" data-act="start">Make a list</button>')
    expect(html).toContain('<p class="note">Lists stay on this phone.</p>')
    expect(html).not.toContain('class="pin"')
  })
})
