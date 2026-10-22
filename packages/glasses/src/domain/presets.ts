/**
 * Page presets: four assembled glasses pages, as data. Each one returns the spec that `buildPage` takes, the text in
 * each text container, and the grids to send once the page is up. They are built from `buildPage`, the `fit`
 * helpers, `glyphs` and the pixel font, so they keep the same limits.
 *
 * Every preset puts a full-screen text container with content ' ' first, as the one container that captures input.
 * The other containers sit in front of it. Text is cut and padded by pixels in the firmware font, and characters
 * the font lacks are swapped or dropped (`sanitize`), so the page builder never refuses a preset's text.
 */
import { LIMITS, checkText, sanitize } from './budget.ts'
import { LINE_HEIGHT, SCREEN, align, fitLines, inner, textWidth, truncate, type Box } from './fit.ts'
import { bar as progressBar } from './glyphs.ts'
import type { ContainerSpec, PageSpec, TextSpec } from './page.ts'
import { pixelText, pixelTextWidth } from './pixel-font.ts'
import { blit, grid, type Grid } from './pixels.ts'

/** What a preset gives you: the page spec, the text it holds, and the grids to send after mount. */
export type Preset = {
  spec: PageSpec
  /** The content of each text container, as the spec holds it. Send one again with `textUpgrade` when it changes. */
  text: Record<string, string>
  /** Grids the preset drew, by image container name. Encode them (`encodePng`) and send them once the page is up. */
  images: Record<string, Grid>
}

/**
 * An image slot along the foot of the page, for a line drawn in the pixel font, such as `actionBar`'s output.
 * Its size is clamped to the image limits: 20 to 288 wide, 20 to 144 tall. Default 288 x 20.
 */
export type BarSlot = { text: string; width?: number; height?: number }

/** The text column: 16 px in from each side. */
const MARGIN = 16
const COLUMN = SCREEN.width - 2 * MARGIN
/** Space between blocks, and the bar's distance from the bottom edge. */
const GAP = 8
const FOOT = 12
/** One line of firmware text, with a little room under it. */
const ONE_LINE = LINE_HEIGHT + 4
const POINTER = '▶'
const SPACE_PX = textWidth(' ')

const pad = (px: number): string => ' '.repeat(Math.max(0, Math.round(px / SPACE_PX)))
/** A whole number in [lo, hi]. A missing number or NaN becomes `fallback`; infinities go to the ends. */
const clamp = (n: number | undefined, lo: number, hi: number, fallback = lo): number =>
  Math.min(hi, Math.max(lo, typeof n === 'number' && !Number.isNaN(n) ? Math.round(n) : fallback))
/** One line of caller text: glyphs the font lacks swapped or dropped, runs of whitespace as one space. */
const oneLine = (s: string): string => sanitize(String(s ?? '').replace(/\s+/g, ' ').trim()).text
/** Caller text that may hold line breaks. */
const lines = (s: string): string => sanitize(String(s ?? '').replace(/[^\S\n]+/g, ' ').trim()).text

const input = (): TextSpec => ({
  kind: 'text', name: 'input', box: { x: 0, y: 0, width: SCREEN.width, height: SCREEN.height }, content: ' ', capture: true,
})
const text = (name: string, box: Box, content: string, extra: Partial<TextSpec> = {}): TextSpec =>
  ({ kind: 'text', name, box, content: content || ' ', ...extra })

/** Words greedily wrapped at `width` px, as the firmware wraps them. */
function wrapWords(s: string, width: number): string[] {
  const out: string[] = []
  for (const para of s.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && textWidth(next) > width) { out.push(line); line = word } else line = next
    }
    out.push(line)
  }
  return out
}

/** Text fitted to `max` lines of `width` px, each line centred by padding with spaces. */
function centred(s: string, width: number, max: number): string {
  if (max < 1 || !s) return ''
  return wrapWords(fitLines(s, width, max), width).slice(0, max).map(l => align(l, width, 'center')).join('\n')
}

/** Drop lines from the end until the text passes the character and byte limits for a page. */
function withinBudget(rows: string[]): string[] {
  const out = [...rows]
  while (out.length && checkText(out.join('\n'), 'create').some(i => i.kind !== 'missingGlyphs')) out.pop()
  return out
}

/** Cut a pixel-font line at a word until it fits `width` px. */
function fitPixel(s: string, width: number): string {
  const words = s.split(' ')
  while (words.length && pixelTextWidth(words.join(' ')) > width) words.pop()
  return words.join(' ').trimEnd()
}

/** The bar slot's box along the foot of the page, and its line drawn in the pixel font at scale 2. */
function barSlot(slot: BarSlot): { box: Box; grid: Grid } {
  const width = clamp(slot.width, LIMITS.imageMinSide, LIMITS.imageMaxWidth, 288)
  const height = clamp(slot.height, LIMITS.imageMinSide, LIMITS.imageMaxHeight, 20)
  const box = { x: MARGIN, y: SCREEN.height - FOOT - height, width, height }
  const g = grid(width, height)
  const line = fitPixel(String(slot.text ?? '').trim(), width)
  if (line) {
    const img = pixelText(line, { scale: 2 })
    blit(g, img, 0, Math.max(0, Math.floor((height - img.h) / 2)))
  }
  return { box, grid: g }
}

/** Put the spec, the text and the images together. */
function preset(containers: ContainerSpec[], images: Record<string, Grid>): Preset {
  const text: Record<string, string> = {}
  for (const c of containers) if (c.kind === 'text') text[c.name] = c.content
  return { spec: { containers }, text, images }
}

/**
 * A title line, then rows of text with a pointer glyph on the selected row, and an optional bar at the foot.
 * The rows fill the space down to the bar. When there are more items than rows, the rows scroll so the
 * selected one shows. A `selected` index outside the list draws no pointer. `empty` shows when there are no items.
 */
export function listPage(o: { title: string; items: readonly string[]; selected?: number; bar?: BarSlot; empty?: string }): Preset {
  const foot = o.bar ? barSlot(o.bar) : null
  const title: Box = { x: MARGIN, y: 6, width: COLUMN, height: ONE_LINE }
  const top = title.y + title.height + GAP
  const bottom = foot ? foot.box.y - GAP : SCREEN.height - 6
  const count = Math.max(1, Math.floor((bottom - top) / LINE_HEIGHT))
  const rowsBox: Box = { x: MARGIN, y: top, width: COLUMN, height: count * LINE_HEIGHT }

  const items = (o.items ?? []).map(oneLine)
  const sel = Number.isInteger(o.selected) && o.selected! >= 0 && o.selected! < items.length ? o.selected! : -1
  const start = sel < count ? 0 : sel - count + 1
  // An unselected row keeps the pointer's width in spaces, so the rows line up.
  const head = (on: boolean) => `${on ? POINTER : pad(textWidth(POINTER))} `
  const rows = items.slice(start, start + count).map((item, i) => {
    const h = head(start + i === sel)
    return h + truncate(item, COLUMN - textWidth(h))
  })
  const body = rows.length ? withinBudget(rows).join('\n') : truncate(oneLine(o.empty ?? ''), COLUMN)

  return preset([
    input(),
    text('title', title, truncate(oneLine(o.title), COLUMN)),
    text('rows', rowsBox, body),
    ...(foot ? [{ kind: 'image' as const, name: 'bar', box: foot.box }] : []),
  ], foot ? { bar: foot.grid } : {})
}

/**
 * One value in the middle of the display, centred both ways, with a label above it and a note of up to two lines
 * below. The value and its unit share one firmware line. The firmware has one text size and no alignment,
 * so the lines are centred by padding with spaces measured in pixels.
 */
export function valuePage(o: { label: string; value: string; unit?: string; note?: string; bar?: BarSlot }): Preset {
  const foot = o.bar ? barSlot(o.bar) : null
  const valueBox: Box = { x: MARGIN, y: Math.floor((SCREEN.height - LINE_HEIGHT) / 2), width: COLUMN, height: ONE_LINE }
  const labelBox: Box = { x: MARGIN, y: valueBox.y - GAP - LINE_HEIGHT, width: COLUMN, height: ONE_LINE }
  const noteY = valueBox.y + LINE_HEIGHT + GAP
  const noteBottom = foot ? foot.box.y - GAP : SCREEN.height - 6
  const noteLines = Math.min(2, Math.floor((noteBottom - noteY) / LINE_HEIGHT))
  const note = centred(oneLine(o.note ?? ''), COLUMN, noteLines)
  const value = [oneLine(o.value), oneLine(o.unit ?? '')].filter(Boolean).join(' ')

  return preset([
    input(),
    text('label', labelBox, align(oneLine(o.label), COLUMN, 'center')),
    text('value', valueBox, align(value, COLUMN, 'center')),
    ...(note ? [text('note', { x: MARGIN, y: noteY, width: COLUMN, height: noteLines * LINE_HEIGHT + 4 }, note)] : []),
    ...(foot ? [{ kind: 'image' as const, name: 'bar', box: foot.box }] : []),
  ], foot ? { bar: foot.grid } : {})
}

/** The card's frame: a 2 px border with rounded corners, 10 px of padding inside it. */
const CARD = { border: { width: 2, color: 15, radius: 8 }, padding: 10 } as const

/**
 * A bordered text container with a title line and a body, both fitted to the container's inner box, and an
 * optional progress line (`bar` from `glyphs`) on the card's last line. `progress` runs from 0 to 1.
 */
export function cardPage(o: { title: string; body: string; progress?: number; bar?: BarSlot }): Preset {
  const foot = o.bar ? barSlot(o.bar) : null
  const top = 10
  const bottom = foot ? foot.box.y - GAP : SCREEN.height - 10
  const box: Box = { x: MARGIN, y: top, width: COLUMN, height: bottom - top }
  const area = inner({ ...box, paddingLength: CARD.padding, borderWidth: CARD.border.width })
  const total = Math.max(1, Math.floor(area.height / LINE_HEIGHT))
  const hasProgress = o.progress !== undefined && total >= 3

  const title = truncate(oneLine(o.title), area.width)
  const room = total - 1 - (hasProgress ? 1 : 0)
  const raw = lines(o.body)
  // The body is broken into lines here, as the firmware would wrap it, so the progress line's place is known.
  const body = room > 0 && raw ? wrapWords(fitLines(raw, area.width, room), area.width).slice(0, room) : []
  const out = [title, ...body]
  if (hasProgress) {
    // Blank lines push the progress line down to the card's last line.
    out.push(...Array<string>(room - body.length).fill(''), progressBar(o.progress!, area.width))
  }

  return preset([
    input(),
    text('card', box, out.join('\n'), { border: { ...CARD.border }, padding: CARD.padding }),
    ...(foot ? [{ kind: 'image' as const, name: 'bar', box: foot.box }] : []),
  ], foot ? { bar: foot.grid } : {})
}

/**
 * A full-screen text container with content ' ' as the input layer, an image container in front of it, and an
 * optional caption line. The image's size is clamped to the image limits (20 to 288 wide, 20 to 144 tall) and
 * rounded to whole pixels. It sits centred unless `x` or `y` places it, and always stays on screen. The caption goes
 * under the image, or above it when there is no room under, centred on the image by padding with spaces.
 * The caller draws the image and sends it to the container named 'image'; `buildPage(spec).boxes.image` is its size.
 */
export function imagePage(o: { width: number; height: number; x?: number; y?: number; caption?: string }): Preset {
  const width = clamp(o.width, LIMITS.imageMinSide, LIMITS.imageMaxWidth)
  const height = clamp(o.height, LIMITS.imageMinSide, LIMITS.imageMaxHeight)
  const caption = truncate(oneLine(o.caption ?? ''), COLUMN)
  const block = height + (caption ? GAP + LINE_HEIGHT : 0)
  const x = clamp(o.x, 0, SCREEN.width - width, Math.round((SCREEN.width - width) / 2))
  const y = clamp(o.y, 0, SCREEN.height - height, Math.round((SCREEN.height - block) / 2))
  const image: Box = { x, y, width, height }

  let captionSpec: TextSpec[] = []
  if (caption) {
    const below = y + height + GAP
    const capY = below + ONE_LINE <= SCREEN.height ? below : Math.max(0, y - GAP - ONE_LINE)
    // Centre the caption on the image, kept inside the column with a space to spare for rounding.
    const w = textWidth(caption)
    const at = Math.min(Math.max(0, x + width / 2 - MARGIN - w / 2), Math.max(0, COLUMN - w - SPACE_PX))
    captionSpec = [text('caption', { x: MARGIN, y: capY, width: COLUMN, height: ONE_LINE }, pad(at) + caption)]
  }

  return preset([input(), { kind: 'image', name: 'image', box: image }, ...captionSpec], {})
}
