/**
 * Greyscale pixel grids for image containers. Values are 0 (off) to 15 (full), the 16 levels the G2
 * shows in images (docs/findings/images.md#h3). Pure data: apps encode a grid to PNG in the browser.
 */
export type Grid = { w: number; h: number; px: Uint8Array }

export const MAX_LEVEL = 15

export function grid(w: number, h: number): Grid {
  return { w, h, px: new Uint8Array(w * h) }
}

export function get(g: Grid, x: number, y: number): number {
  return x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.px[y * g.w + x]!
}

export function set(g: Grid, x: number, y: number, level: number): void {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return
  g.px[y * g.w + x] = Math.max(0, Math.min(MAX_LEVEL, Math.round(level)))
}

export function fillRect(g: Grid, x: number, y: number, w: number, h: number, level: number): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, level)
}

/** Copy `src` onto `dst` at (x, y). Off pixels (0) are transparent. */
export function blit(dst: Grid, src: Grid, x: number, y: number): void {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const v = get(src, i, j)
    if (v) set(dst, x + i, y + j, v)
  }
}

/** Every pixel becomes a k x k block. Pixel art drawn small, shown large. */
export function upscale(src: Grid, k: number): Grid {
  const out = grid(src.w * k, src.h * k)
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) fillRect(out, i * k, j * k, k, k, get(src, i, j))
  return out
}

/**
 * A w x h window of `src` from (x, y). Areas outside `src` come back off. An image container is at
 * most 288 wide, so a wider drawing (a pixel-font action bar) is cropped into several images.
 */
export function crop(src: Grid, x: number, y: number, w: number, h: number): Grid {
  const out = grid(w, h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(out, i, j, get(src, x + i, y + j))
  return out
}

/** Share of lit pixels, 0 to 1. The ink budget for images. */
export function ink(g: Grid): number {
  let lit = 0
  for (const v of g.px) if (v) lit++
  return g.px.length ? lit / g.px.length : 0
}

// 5 x 7 dot font. Each string is a row; '#' is a lit dot.
const FONT: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

export const DOT_CHARS = Object.keys(FONT).join('')

/**
 * Dot-matrix text, like the Even Hub Weather app's hero number. Each lit font cell becomes a
 * `dot` x `dot` square, with `gap` pixels between cells and one empty cell between characters.
 * Characters outside the font render as a space.
 */
export function dotText(text: string, opts: { dot?: number; gap?: number; level?: number } = {}): Grid {
  const { dot = 3, gap = 1, level = MAX_LEVEL } = opts
  const pitch = dot + gap
  const chars = [...text]
  const cols = Math.max(0, chars.length * 6 - 1)
  const out = grid(Math.max(1, cols * pitch - gap), 7 * pitch - gap)
  chars.forEach((ch, n) => {
    const rows = FONT[ch] ?? FONT[' ']!
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '#') fillRect(out, (n * 6 + x) * pitch, y * pitch, dot, dot, level)
    }))
  })
  return out
}

/**
 * Problems with a store icon, empty when it passes. The developer portal requires 24 x 24, 1-bit
 * (every pixel fully on or off), and every lit pixel inside a 2 x 2 block of lit pixels.
 */
export function storeIconIssues(g: Grid): string[] {
  const issues: string[] = []
  if (g.w !== 24 || g.h !== 24) issues.push(`must be 24 x 24, got ${g.w} x ${g.h}`)
  const on = (x: number, y: number) => get(g, x, y) > 0
  let grey = 0, orphan = 0
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const v = get(g, x, y)
    if (v !== 0 && v !== MAX_LEVEL) grey++
    if (!on(x, y)) continue
    const inBlock = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) =>
      on(x + dx!, y + dy!) && on(x + dx! + 1, y + dy!) && on(x + dx!, y + dy! + 1) && on(x + dx! + 1, y + dy! + 1))
    if (!inBlock) orphan++
  }
  if (grey) issues.push(`${grey} pixels are grey; the icon must be 1-bit`)
  if (orphan) issues.push(`${orphan} lit pixels are not part of a 2 x 2 block`)
  if (!g.px.some(v => v)) issues.push('the icon is empty')
  return issues
}

/** Parse a pixel map: one string per row, "#" lit at full level, anything else off. */
export function fromAscii(rows: string[]): Grid {
  const g = grid(Math.max(...rows.map(r => r.length)), rows.length)
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') set(g, x, y, MAX_LEVEL) }))
  return g
}
