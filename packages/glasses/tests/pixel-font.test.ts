import { describe, expect, it } from 'vitest'
import { PIXEL_FONT_CHARS, pixelText, pixelTextWidth } from '../src/domain/pixel-font.ts'
import { get, ink } from '../src/domain/pixels.ts'
import { createGate } from '../src/domain/gate.ts'
import { actionBar, type Keymap } from '../src/domain/keymap.ts'
import { GESTURE_ICON } from '../src/domain/glyphs.ts'

const ascii = (g: ReturnType<typeof pixelText>) =>
  Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (get(g, x, y) ? '#' : '.')).join(''))

describe('pixel font', () => {
  it('is proportional: "i" is narrower than "m"', () => {
    expect(pixelTextWidth('i', 1)).toBe(3)
    expect(pixelTextWidth('m', 1)).toBe(5)
    expect(pixelTextWidth('im', 1)).toBe(3 + 1 + 5)
  })

  it('draws a glyph at scale 1 and lowercases input', () => {
    expect(ascii(pixelText('O', { scale: 1 }))).toEqual(['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....'])
  })

  it('draws "hold" as an oval, wider than the tap dot', () => {
    expect(pixelTextWidth('⬬', 1)).toBe(8)
    expect(pixelTextWidth('●', 1)).toBe(5)
  })

  it('scales every pixel and treats unknown characters as space', () => {
    const g = pixelText('a', { scale: 2 })
    expect(g.h).toBe(16)
    expect(pixelTextWidth('a?a', 1)).toBe(pixelTextWidth('a a', 1))
  })

  it('every icon in GESTURE_ICON exists in the font', () => {
    for (const icon of Object.values(GESTURE_ICON)) {
      for (const ch of icon) expect(pixelTextWidth(ch, 1)).not.toBe(3) // 3 = the space fallback
    }
  })
})

describe('measured action bar', () => {
  const keys: Keymap<string> = [
    { gesture: 'tap', label: 'pause', action: 'a' },
    { gesture: 'swipe', label: 'peek', action: 'b' },
    { gesture: 'menu', label: 'more', action: 'c' },
  ]

  it('uses pixel icons and drops whole actions that do not fit', () => {
    const full = actionBar(keys, { widthPx: 999, glyphs: GESTURE_ICON, measure: t => pixelTextWidth(t), separator: '  ' })
    expect(full).toBe('pause ●  peek ▲▼  more ●⬬')
    const narrow = actionBar(keys, { widthPx: pixelTextWidth('pause ●  peek ▲▼'), glyphs: GESTURE_ICON, measure: t => pixelTextWidth(t), separator: '  ' })
    expect(narrow).toBe('pause ●  peek ▲▼')
  })
})

describe('gate', () => {
  it('lets one event through per window', () => {
    const gate = createGate(700)
    expect([0, 100, 699, 700, 800, 1500].map(t => gate(t))).toEqual([true, false, false, true, false, true])
  })
  it('draws punctuation and symbols', () => {
    for (const ch of ["'", ',', '/', '%', '&', '★', '▶']) {
      expect(PIXEL_FONT_CHARS, ch).toContain(ch)
      expect(ink(pixelText(ch, { scale: 1 })), ch).toBeGreaterThan(0)
    }
    expect(pixelTextWidth('38%', 1)).toBeGreaterThan(pixelTextWidth('38', 1))
  })
})
