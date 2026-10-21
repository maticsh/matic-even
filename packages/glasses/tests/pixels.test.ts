import { describe, expect, it } from 'vitest'
import { blit, crop, dotText, fillRect, fromAscii, get, grid, ink, set, storeIconIssues, upscale } from '../src/domain/pixels.ts'

const ascii = (g: ReturnType<typeof grid>) =>
  Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (get(g, x, y) ? '#' : '.')).join(''))

describe('pixels', () => {
  it('crops a window, and reads off the edge as off', () => {
    const g = fromAscii(['#..#', '.##.'])
    expect(crop(g, 1, 0, 2, 2).px).toEqual(new Uint8Array([0, 0, 15, 15]))
    const edge = crop(g, 3, 1, 2, 2)
    expect([edge.w, edge.h]).toEqual([2, 2])
    expect(edge.px).toEqual(new Uint8Array([0, 0, 0, 0]))
  })

  it('clamps levels and ignores writes off the grid', () => {
    const g = grid(2, 2)
    set(g, 0, 0, 99)
    set(g, 1, 1, -3)
    set(g, 5, 5, 9)
    expect([...g.px]).toEqual([15, 0, 0, 0])
  })

  it('blits with off pixels transparent', () => {
    const dst = grid(3, 1)
    fillRect(dst, 0, 0, 3, 1, 4)
    const src = grid(2, 1)
    set(src, 1, 0, 15)
    blit(dst, src, 0, 0)
    expect([...dst.px]).toEqual([4, 15, 4])
  })

  it('upscales each pixel into a block and measures ink', () => {
    const g = grid(2, 1)
    set(g, 0, 0, 15)
    const big = upscale(g, 2)
    expect(ascii(big)).toEqual(['##..', '##..'])
    expect(ink(big)).toBe(0.5)
  })

  it('draws dot-matrix digits with gaps between dots', () => {
    const one = dotText('1', { dot: 1, gap: 0 })
    expect(ascii(one)).toEqual(['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'])
    const spaced = dotText('1', { dot: 2, gap: 1 })
    expect(spaced.w).toBe(5 * 3 - 1)
    expect(spaced.h).toBe(7 * 3 - 1)
    expect(get(spaced, 6, 0)).toBe(15) // the top dot of "1": cell x=2 → pixel 6
    expect(get(spaced, 8, 0)).toBe(0) // the gap after it
  })

  it('lays characters out with one empty cell between them', () => {
    expect(dotText('25', { dot: 1, gap: 0 }).w).toBe(11)
  })
})

describe('store icon', () => {
  it('passes a 12 x 12 design drawn at 2x', () => {
    const design = fromAscii(Array.from({ length: 12 }, (_, y) => (y < 6 ? '....####....' : '.....##.....')))
    expect(storeIconIssues(upscale(design, 2))).toEqual([])
  })

  it('flags size, grey pixels and lone pixels', () => {
    const g = grid(24, 24)
    set(g, 0, 0, 15)
    set(g, 5, 5, 8)
    fillRect(g, 10, 10, 1, 2, 15)
    expect(storeIconIssues(g)).toEqual(['1 pixels are grey; the icon must be 1-bit', '4 lit pixels are not part of a 2 x 2 block'])
    expect(storeIconIssues(grid(10, 10))[0]).toMatch(/24 x 24/)
  })
})
