// Draws glasses output as inline SVG at build time: graphite ink on the page grey, as matic.sh shows glasses frames.
// Grids (images, the pixel font, dot text) are drawn pixel for pixel. Text in the firmware font is set at the
// firmware font's measured widths (@evenrealities/pretext), in the reader's system font, because the firmware font
// itself is not on the page. Box-drawing, block and shape glyphs are drawn as shapes, so bars and sparklines keep
// their real proportions.
import { LINE_HEIGHT, textWidth } from '@maticsh/glasses'

export const INK = '#141414'
const FAINT = '#9e9e9e'
/** Small label text: --quiet on the page grey, which passes AA. FAINT stays for the hairlines. */
const QUIET = '#5c5c5c'
const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'
/** Where the firmware font sits in its 27 px line, as the simulator draws it. */
const BASE = 20, SIZE = 19, MID = 14, TOP = 4, BOTTOM = 24

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A grid as SVG paths: one path per brightness level, one rectangle per run of lit pixels in a row. */
export function gridPaths(g, { x = 0, y = 0, s = 1 } = {}) {
  const byLevel = new Map()
  for (let j = 0; j < g.h; j++) {
    let i = 0
    while (i < g.w) {
      const v = g.px[j * g.w + i]
      if (!v) { i++; continue }
      const start = i
      while (i < g.w && g.px[j * g.w + i] === v) i++
      byLevel.set(v, (byLevel.get(v) ?? '') + `M${x + start * s} ${y + j * s}h${(i - start) * s}v${s}h${-(i - start) * s}z`)
    }
  }
  return [...byLevel].map(([v, d]) => `<path d="${d}"${v < 15 ? ` fill-opacity="${(v / 15).toFixed(3)}"` : ''}/>`).join('')
}

const BLOCKS = '▁▂▃▄▅▆▇█'

/** One glyph drawn as a shape, or null when it is a letter for the text run. */
function shape(ch, x, top, w) {
  const b = BLOCKS.indexOf(ch)
  if (b >= 0) {
    const h = ((b + 1) / 8) * (BOTTOM - TOP)
    return `<rect x="${x}" y="${top + BOTTOM - h}" width="${Math.max(1, w - 1)}" height="${h}"/>`
  }
  const cx = x + w / 2, cy = top + MID
  switch (ch) {
    case '━': return `<rect x="${x}" y="${cy - 2}" width="${w}" height="4"/>`
    case '─': return `<rect x="${x}" y="${cy - 0.5}" width="${w}" height="1"/>`
    case '●': return `<circle cx="${cx}" cy="${cy}" r="${w * 0.34}"/>`
    case '○': return `<circle cx="${cx}" cy="${cy}" r="${w * 0.34 - 0.75}" fill="none" stroke="${INK}" stroke-width="1.5"/>`
    case '■': return `<rect x="${cx - 7}" y="${cy - 7}" width="14" height="14"/>`
    case '□': return `<rect x="${cx - 6.25}" y="${cy - 6.25}" width="12.5" height="12.5" fill="none" stroke="${INK}" stroke-width="1.5"/>`
    case '▶': return `<path d="M${x + 2} ${cy - 8}L${x + w - 2} ${cy}L${x + 2} ${cy + 8}z"/>`
    case '▲': return `<path d="M${cx} ${cy - 6}L${cx + 7} ${cy + 6}H${cx - 7}z"/>`
    case '▼': return `<path d="M${cx - 7} ${cy - 6}H${cx + 7}L${cx} ${cy + 6}z"/>`
    default: return null
  }
}

/**
 * One line of firmware text with its top at `top`. Returns the SVG and the width it took. Each word is set at its
 * measured width on its own, so the firmware's wide spaces stay spaces and never stretch the letters.
 */
export function textLine(text, x, top) {
  let out = '', word = '', wordX = x, at = x
  const flush = () => {
    if (!word) return
    const w = textWidth(word)
    out += `<text x="${wordX}" y="${top + BASE}" textLength="${w}" lengthAdjust="spacingAndGlyphs">${esc(word)}</text>`
    at = wordX + w
    word = ''
  }
  for (const ch of text) {
    const w = textWidth(ch)
    if (ch === ' ') { flush(); at += w; continue }
    if (shape(ch, 0, 0, w)) { flush(); out += shape(ch, at, top, w); at += w; continue }
    if (!word) wordX = at
    word += ch
  }
  flush()
  return { svg: out, width: at - x }
}

/** Lines as the firmware wraps them: at spaces, by pixels. Newlines start a new line. */
export function wrap(text, width) {
  const lines = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && textWidth(next) > width) { lines.push(line); line = word } else line = next
    }
    lines.push(line)
  }
  return lines
}

/** Firmware text in a box: wrapped, one line every 27 px, clipped to the box like the glass clips it. */
export function textBox(text, box, { inset = 0 } = {}) {
  const lines = wrap(text, box.width - 2 * inset)
  const fit = Math.max(1, Math.floor((box.height - 2 * inset) / LINE_HEIGHT))
  return lines.slice(0, fit).map((l, i) => textLine(l, box.x + inset, box.y + inset + i * LINE_HEIGHT).svg).join('')
}

/** An SVG in glasses pixels. `zoom` sets its natural CSS size; the page lets it shrink to fit. */
export function svg(w, h, body, { label, zoom = 1, cls = '' }) {
  return `<svg class="gl${cls ? ` ${cls}` : ''}" viewBox="0 0 ${w} ${h}" width="${w * zoom}" height="${h * zoom}" role="img" aria-label="${esc(label)}"`
    + ` fill="${INK}" font-family="${FONT}" font-size="${SIZE}" font-weight="300">${body}</svg>`
}

/** A hairline outline for a container or a width limit, with its name in small type above it. */
export function outline(box, name) {
  const label = name ? `<text x="${box.x + 2}" y="${box.y - 3}" font-size="9" fill="${QUIET}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${esc(name)}</text>` : ''
  return `<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.width - 1}" height="${box.height - 1}" fill="none" stroke="${FAINT}" stroke-width="1" stroke-dasharray="3 3"/>${label}`
}

/** A text container's border, as the firmware draws it: width, radius, and a level from 0 to 15. */
export function border(box, b) {
  if (!b.borderWidth) return ''
  const w = b.borderWidth, level = b.borderColor ?? 15
  return `<rect x="${box.x + w / 2}" y="${box.y + w / 2}" width="${box.width - w}" height="${box.height - w}" rx="${b.borderRadius ?? 0}"`
    + ` fill="none" stroke="${INK}" stroke-width="${w}"${level < 15 ? ` stroke-opacity="${(level / 15).toFixed(3)}"` : ''}/>`
}
