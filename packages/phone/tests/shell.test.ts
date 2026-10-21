import { describe, expect, it } from 'vitest'
import { pixelText, pixels } from '@maticsh/glasses'
import { createConfirm } from '../src/confirm.ts'
import { glassSvg, gridPath, stripHtml, type GlassScreen } from '../src/glass.ts'
import { esc } from '../src/html.ts'
import { button } from '../src/buttons.ts'
import { checkRow, editRow } from '../src/rows.ts'
import { remoteButtons } from '../src/remote.ts'

const SCREEN: GlassScreen = {
  title: 'packing',
  mood: null,
  rows: [{ text: 'passport', selected: true, ticked: true }, { text: 'charger', ticked: false }, { text: 'a <b> & "c"', ticked: false }],
  bar: [{ label: 'untick', gesture: 'tap' }, { label: 'move', gesture: 'swipe' }],
  align: 'left',
}

describe('the preview', () => {
  it('draws at the glass shape, 576 x 288', () => {
    expect(glassSvg(SCREEN)).toMatch(/^<svg viewBox="0 0 576 288"/)
  })

  it('draws the title, a row per item, the pointer, a filled box when ticked and an outline when open', () => {
    const svg = glassSvg(SCREEN)
    expect(svg).toContain('>packing</text>')
    expect(svg.match(/<g transform="translate\(0 /g)).toHaveLength(3)
    expect(svg.match(/class="pointer"/g)).toHaveLength(1)
    expect(svg.match(/<rect x="49"/g)).toHaveLength(1)
    expect(svg.match(/fill="none" stroke=/g)).toHaveLength(2)
  })

  it('escapes user text', () => {
    const svg = glassSvg(SCREEN)
    expect(svg).toContain('a &lt;b&gt; &amp; &quot;c&quot;')
    expect(svg).not.toContain('<b>')
  })

  it('marks the rows for block centring and centres the title, only when centred', () => {
    expect(glassSvg(SCREEN)).not.toContain('data-centre')
    const c = glassSvg({ ...SCREEN, align: 'centre' })
    expect(c).toContain('<g class="rows" data-centre="1">')
    expect(c).toContain('x="288" text-anchor="middle"')
  })

  it('draws the mood line, and no bar when nothing works', () => {
    const svg = glassSvg({ ...SCREEN, rows: [], mood: 'nothing on this list yet', bar: [] })
    expect(svg).toContain('nothing on this list yet')
    expect(svg).not.toContain('class="bar"')
  })

  it('shrinks to a strip with the title, the pointed row and a count', () => {
    const html = stripHtml(SCREEN, '1/3')
    expect(html).toContain('<b>packing</b>')
    expect(html).toContain('<i class="box on"></i><span>passport</span>')
    expect(html).toContain('<span class="n">1/3</span>')
    expect(stripHtml({ ...SCREEN, rows: [], mood: 'all ticked' })).toContain('<span>all ticked</span>')
  })
})

describe('gridPath', () => {
  it('draws one rectangle per run of lit pixels', () => {
    const g = pixels.grid(4, 2)
    pixels.fillRect(g, 0, 0, 3, 1, 15)
    pixels.fillRect(g, 3, 1, 1, 1, 15)
    expect(gridPath(g, 2)).toBe('M0 0h6v2h-6zM6 2h2v2h-2z')
  })

  it('draws the pixel font', () => {
    expect(gridPath(pixelText('●', { scale: 1 }), 1).length).toBeGreaterThan(0)
  })
})

describe('the two-tap confirm', () => {
  function clock() {
    let t = 0
    let timer: (() => void) | null = null
    return {
      now: () => t,
      setTimer: (fn: () => void) => { timer = fn; return 1 },
      clearTimer: () => { timer = null },
      advance(ms: number) { t += ms },
      fire() { timer?.() },
    }
  }

  it('arms on the first tap and confirms on a second within 3 s', () => {
    const c = clock()
    const confirm = createConfirm(c)
    expect(confirm.press('a')).toBe('armed')
    expect(confirm.isArmed('a')).toBe(true)
    c.advance(2_900)
    expect(confirm.press('a')).toBe('confirmed')
    expect(confirm.isArmed('a')).toBe(false)
  })

  it('runs out after 3 s and tells the page', () => {
    const c = clock()
    let expired = 0
    const confirm = createConfirm({ ...c, onExpire: () => void expired++ })
    confirm.press('a')
    c.advance(3_000)
    expect(confirm.isArmed('a')).toBe(false)
    c.fire()
    expect(expired).toBe(1)
    expect(confirm.press('a')).toBe('armed')
  })

  it('arms afresh when a different thing is tapped', () => {
    const confirm = createConfirm(clock())
    confirm.press('a')
    expect(confirm.press('b')).toBe('armed')
    expect(confirm.isArmed('a')).toBe(false)
  })
})

describe('parts', () => {
  it('escapes everything they print', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    expect(button({ label: '<x>', act: { name: 'go', arg: '"1"' } })).toBe('<button type="button" class="pill" data-act="go" data-arg="&quot;1&quot;">&lt;x&gt;</button>')
  })

  it('gives an item row a tick box, the name and one Edit button, and keeps Remove inside Edit', () => {
    const row = checkRow({ text: 'Book', ticked: false, tick: { name: 't' }, pick: { name: 'p' }, edit: { name: 'e' } })
    expect(row.match(/<button/g)).toHaveLength(3)
    expect(row).toContain('>Edit</button>')
    expect(row).not.toContain('Remove')
    const editing = editRow({ id: 'r', value: 'Book', maxLength: 32, save: { name: 's' }, remove: { name: 'x' }, sure: false })
    expect(editing).toContain('>Remove</button>')
    expect(editRow({ id: 'r', value: 'Book', maxLength: 32, save: { name: 's' }, remove: { name: 'x' }, sure: true })).toContain('class="pill sure" data-act="x">Sure?</button>')
  })
})

describe('the dev remote', () => {
  it('mirrors the bar: the tap verb, the swipe verb up and down, and disables what does nothing', () => {
    expect(remoteButtons(SCREEN.bar)).toEqual([
      { gesture: 'tap', label: 'untick', enabled: true },
      { gesture: 'swipeUp', label: 'move', enabled: true },
      { gesture: 'swipeDown', label: 'move', enabled: true },
    ])
    expect(remoteButtons([]).every(b => !b.enabled)).toBe(true)
  })
})
