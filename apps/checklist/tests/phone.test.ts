import { describe, expect, it } from 'vitest'
import { barLine, glassSvg } from '@maticsh/phone'
import { remoteButtons } from '@maticsh/phone/dev'
import { seed, tickSelected } from '../src/domain/lists.ts'
import { screenOf } from '../src/app/screen.ts'
import { barText } from '../src/app/layout.ts'

// Checklist's screen model on the phone parts from @maticsh/phone.
describe('the preview', () => {
  it('picks the same bar words as the glass, from the same screen model', () => {
    for (const s of [seed(), tickSelected(seed())]) {
      const sc = screenOf(s)
      expect(barLine(sc.bar)).toBe(barText(sc.bar))
    }
  })

  it('takes the app screen model as it is', () => {
    const svg = glassSvg(screenOf(seed()))
    expect(svg).toContain('>glasses case</text>')
  })
})

describe('the dev remote', () => {
  it('mirrors the bar: the tap verb, the swipe verb up and down, and disables what does nothing', () => {
    expect(remoteButtons(screenOf(seed()).bar)).toEqual([
      { gesture: 'tap', label: 'tick', enabled: true },
      { gesture: 'swipeUp', label: 'move', enabled: true },
      { gesture: 'swipeDown', label: 'move', enabled: true },
    ])
    expect(remoteButtons([]).every(b => !b.enabled)).toBe(true)
  })
})
