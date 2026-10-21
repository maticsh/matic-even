/**
 * The glasses preview, drawn from a screen model at the glass's real shape, 576 x 288: dark ink on
 * white, as the Even app shows glasses content. Pure string building, so it renders anywhere and tests
 * read it without a DOM. The bar uses the pixel font from @maticsh/glasses, the same glyphs the glass draws.
 */
import { GESTURE_ICON, actionBar, pixelText, pixelTextWidth, type Gesture, type Grid } from '@maticsh/glasses'
import { esc } from './html.ts'

export const GLASS = { width: 576, height: 288 } as const

/** One row on the glass. `ticked` null draws no box. */
export type GlassRow = { text: string; selected?: boolean; ticked?: boolean | null }

/** What any list-shaped glasses screen shows. An app's own screen model only needs to fit this shape. */
export type GlassScreen = {
  title: string
  mood?: string | null
  rows: readonly GlassRow[]
  bar: readonly { label: string; gesture: Gesture }[]
  align: 'left' | 'centre'
}

/** The glass's bar is 288 px of pixel font at scale 2; the same width keeps the same actions. */
const BAR_WIDTH = 288
/** One pixel-font cell, in preview units. Larger than the glass's 2, so the bar reads on a phone. */
const BAR_SCALE = 3
const INK = '#222'
const X = 24

/**
 * A grid as one SVG path, one rectangle per run of lit pixels in a row. `s` is the size of a pixel.
 * Levels are ignored: the pixel font is one ink.
 */
export function gridPath(g: Grid, s: number): string {
  let d = ''
  for (let y = 0; y < g.h; y++) {
    let x = 0
    while (x < g.w) {
      if (!g.px[y * g.w + x]) { x++; continue }
      const start = x
      while (x < g.w && g.px[y * g.w + x]) x++
      d += `M${start * s} ${y * s}h${(x - start) * s}v${s}h${-(x - start) * s}z`
    }
  }
  return d
}

/** The bar's words, chosen exactly as the glass chooses them. */
export function barLine(bar: GlassScreen['bar']): string {
  return actionBar(bar.map(b => ({ ...b, action: null })), {
    widthPx: BAR_WIDTH, glyphs: GESTURE_ICON, measure: s => pixelTextWidth(s), separator: '   ', max: 3,
  })
}

/** The glass draws `▶` in the firmware font, a solid triangle, so the preview does too. */
const POINTER = `M${X} -18L${X + 15} -9.5L${X} -1z`

/**
 * The whole glass as an SVG string. With centred text, the title and mood centre on their own and the
 * rows sit in a `.rows` group that `centreRows` centres as one block once the SVG is in the page.
 */
export function glassSvg(screen: GlassScreen, opts: { label?: string } = {}): string {
  const centre = screen.align === 'centre'
  const tx = centre ? `x="${GLASS.width / 2}" text-anchor="middle"` : `x="${X}"`
  let s = `<svg viewBox="0 0 ${GLASS.width} ${GLASS.height}" xmlns="http://www.w3.org/2000/svg" role="img"`
    + ` aria-label="${esc(opts.label ?? `Glasses screen: ${screen.title}`)}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" fill="${INK}">`
  s += `<rect width="${GLASS.width}" height="${GLASS.height}" fill="#fff"/>`
  s += `<text ${tx} y="36" font-size="24" font-weight="600">${esc(screen.title)}</text>`
  if (screen.mood) s += `<text ${tx} y="64" font-size="20" fill="#6a6a6a">${esc(screen.mood)}</text>`

  s += `<g class="rows"${centre ? ' data-centre="1"' : ''}>`
  screen.rows.slice(0, 5).forEach((r, n) => {
    const y = 104 + n * 32
    s += `<g transform="translate(0 ${y})">`
    if (r.selected) s += `<path class="pointer" d="${POINTER}"/>`
    if (r.ticked === true) s += `<rect x="49" y="-16" width="16" height="16"/>`
    if (r.ticked === false) s += `<rect x="50.25" y="-14.75" width="13.5" height="13.5" fill="none" stroke="${INK}" stroke-width="2.5"/>`
    s += `<text x="${r.ticked === null || r.ticked === undefined ? 49 : 78}" y="0" font-size="23">${esc(r.text)}</text></g>`
  })
  s += `</g>`

  const line = barLine(screen.bar)
  if (line) {
    const w = pixelTextWidth(line, 1) * BAR_SCALE
    const bx = centre ? Math.round((GLASS.width - w) / 2) : X
    s += `<path class="bar" transform="translate(${bx} 252)" d="${gridPath(pixelText(line, { scale: 1 }), BAR_SCALE)}" shape-rendering="crispEdges"/>`
  }
  return s + '</svg>'
}

/** Centre each `.rows` group marked for it as one block, measured after it is drawn. */
export function centreRows(root: ParentNode): void {
  root.querySelectorAll<SVGGElement>('g.rows[data-centre="1"]').forEach(g => {
    const box = g.getBBox()
    if (box.width) g.setAttribute('transform', `translate(${Math.round((GLASS.width - box.width) / 2 - box.x)} 0)`)
  })
}

/**
 * The strip the preview shrinks to: the title, the row the glass points at (or the mood line),
 * and an optional count on the right.
 */
export function stripHtml(screen: GlassScreen, meta?: string): string {
  const sel = screen.rows.find(r => r.selected)
  const box = (r: GlassRow) => (r.ticked === true ? '<i class="box on"></i>' : r.ticked === false ? '<i class="box"></i>' : '')
  const at = sel
    ? `<i class="tri"></i>${box(sel)}<span>${esc(sel.text)}</span>`
    : `<span>${esc(screen.mood ?? '')}</span>`
  return `<b>${esc(screen.title)}</b><span class="at">${at}</span>${meta ? `<span class="n">${esc(meta)}</span>` : ''}`
}
