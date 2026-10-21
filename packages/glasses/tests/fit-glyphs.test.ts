import { describe, expect, it } from 'vitest'
import { LINE_HEIGHT, align, fitLines, inner, maxLines, measure, spread, textWidth, truncate } from '../src/domain/fit.ts'
import { bar, sparkline, spinner } from '../src/domain/glyphs.ts'

describe('fit', () => {
  it('measures against the inner box', () => {
    expect(inner({ width: 300, height: 100, paddingLength: 8, borderWidth: 2 })).toEqual({ width: 280, height: 80 })
    expect(maxLines({ width: 300, height: 100, paddingLength: 8, borderWidth: 2 })).toBe(2)
  })

  it('reports whether wrapped text fits without scrolling', () => {
    const box = { width: 200, height: 54 }
    expect(measure('short', box).fits).toBe(true)
    expect(measure('The quick brown fox jumps over the lazy dog again and again', box).fits).toBe(false)
  })

  it('truncates by pixels', () => {
    const t = truncate('hello world this is long', 60)
    expect(t.endsWith('...')).toBe(true)
    expect(textWidth(t)).toBeLessThanOrEqual(60)
  })

  it('right-aligns and centres within a few pixels', () => {
    const right = align('25 min', 200, 'right')
    expect(Math.abs(textWidth(right) - 200)).toBeLessThanOrEqual(3)
    const centre = align('25 min', 200, 'center')
    const lead = centre.length - centre.trimStart().length
    expect(Math.abs(lead * textWidth(' ') - (200 - textWidth('25 min')) / 2)).toBeLessThanOrEqual(3)
  })

  it('spreads a status line across a width', () => {
    const line = spread('focus', '18 min', 300)
    expect(line.startsWith('focus')).toBe(true)
    expect(line.endsWith('18 min')).toBe(true)
    expect(Math.abs(textWidth(line) - 300)).toBeLessThanOrEqual(3)
  })
})

describe('glyphs', () => {
  it('draws a bar sized in pixels', () => {
    expect(bar(0.5, 200)).toBe('━━━━━─────') // 10 cells of 20 px
    expect(bar(1, 100)).toBe('━━━━━')
    expect(bar(-1, 100)).toBe('─────')
    expect(bar(NaN, 40)).toBe('──')
  })

  it('draws a sparkline between min and max', () => {
    expect(sparkline([0, 7])).toBe('▁█')
    expect(sparkline([3, 3])).toBe('▁▁')
    expect(sparkline([])).toBe('')
  })

  it('cycles spinner frames, including negative ones', () => {
    expect(spinner(0)).toBe('●○○')
    expect(spinner(4)).toBe('●○○')
    expect(spinner(-1)).toBe('○●○')
  })
  it('fits text to whole lines at a word', () => {
    const long = 'word '.repeat(60).trim()
    const out = fitLines(long, 300, 2)
    expect(out.endsWith('…')).toBe(true)
    expect(measure(out, { width: 300, height: 2 * LINE_HEIGHT }).fits).toBe(true)
    expect(fitLines('short', 300, 2)).toBe('short')
    expect(fitLines('x'.repeat(200), 100, 1).length).toBeLessThan(200)
  })
})
