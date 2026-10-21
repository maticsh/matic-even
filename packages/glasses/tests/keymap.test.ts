import { describe, expect, it } from 'vitest'
import { actionBar, recordUse, resolve, type Keymap } from '../src/domain/keymap.ts'
import { textWidth } from '../src/domain/fit.ts'

const running: Keymap<string> = [
  { gesture: 'tap', label: 'pause', action: 'toggle' },
  { gesture: 'swipe', label: 'next', action: 'next' },
  { gesture: 'doubleTap', label: 'exit', action: 'exit' },
  { gesture: 'hold', label: 'talk', action: 'voice' },
]

describe('keymap', () => {
  it('resolves intents to bindings, with both swipe directions as one gesture', () => {
    expect(resolve(running, { kind: 'tap', source: 'right' })?.action).toBe('toggle')
    expect(resolve(running, { kind: 'scrollTop', source: 'ring' })?.action).toBe('next')
    expect(resolve(running, { kind: 'scrollBottom', source: 'ring' })?.action).toBe('next')
    expect(resolve(running, { kind: 'foregroundEnter' })).toBeNull()
  })

  it('prefers a directional swipe binding over the plain swipe', () => {
    const split: Keymap<string> = [
      { gesture: 'swipeUp', label: 'levels', action: 'levels' },
      { gesture: 'swipe', label: 'image', action: 'image' },
    ]
    expect(resolve(split, { kind: 'scrollTop', source: 'right' })?.action).toBe('levels')
    expect(resolve(split, { kind: 'scrollBottom', source: 'right' })?.action).toBe('image')
    expect(actionBar(split, { widthPx: 576 })).toBe('levels ▲   image ▲▼')
  })

  it('shows the OS menu as a hint but never resolves it, because the OS owns that gesture', () => {
    const withMenu: Keymap<string> = [
      { gesture: 'tap', label: 'pause', action: 'toggle' },
      { gesture: 'menu', label: 'more', action: 'unused' },
    ]
    expect(actionBar(withMenu, { widthPx: 576 })).toBe('pause ●   more ● ●━')
    expect(resolve(withMenu, { kind: 'longPress', source: 'right' })).toBeNull()
  })

  it('renders each label then its glyph, three bindings by default', () => {
    expect(actionBar(running, { widthPx: 576 })).toBe('pause ●   next ▲▼   exit ●●')
  })

  it('drops learned gestures and goes empty when all are learned', () => {
    let learned = {}
    for (let i = 0; i < 3; i++) learned = recordUse(learned, 'tap')
    expect(actionBar(running, { widthPx: 576, learned })).toBe('next ▲▼   exit ●●   talk ●━')
    const all = { tap: 3, swipe: 3, doubleTap: 3, hold: 3 }
    expect(actionBar(running, { widthPx: 576, learned: all })).toBe('')
  })

  it('fits the bar to the width', () => {
    expect(textWidth(actionBar(running, { widthPx: 120 }))).toBeLessThanOrEqual(120)
  })
})
