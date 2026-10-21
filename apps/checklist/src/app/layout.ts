/**
 * The glass page for a screen model: container boxes, the text for each container, and the bar as a
 * pixel-font image. Pure, so tests read exactly what the glasses would get.
 *
 * Text rows sit in one text container and are fitted by pixels with the `fit` helpers from @maticsh/glasses. The
 * firmware has no alignment, so centring pads with spaces measured in pixels. The rows centre as one
 * block, so the boxes stay in a column under each other.
 */
import {
  GESTURE_ICON, actionBar, align, buildPage, pixelText, pixelTextWidth, pixels, sanitize, textWidth, truncate,
  type BuiltPage, type Box, type Gesture, type Grid,
} from '@maticsh/glasses'
import type { Align } from '../domain/lists.ts'
import type { Screen } from './screen.ts'

/** The text column: a 16 px margin each side. */
export const TITLE: Box = { x: 16, y: 6, width: 544, height: 32 }
export const MOOD: Box = { x: 16, y: 38, width: 544, height: 32 }
/** Five firmware lines (27 px each) and a little air. */
export const ROWS: Box = { x: 16, y: 80, width: 544, height: 5 * 27 + 6 }
/** One pixel-font line along the bottom edge, below a gap. */
export const BAR_LEFT: Box = { x: 16, y: 256, width: 288, height: 20 }
export const BAR_CENTRE: Box = { x: 144, y: 256, width: 288, height: 20 }

const POINTER = '▶'
const TICKED = '■'
const OPEN = '□'
const SPACE_PX = textWidth(' ')

/** Spaces as close as the font allows to `px` pixels wide. */
const pad = (px: number): string => ' '.repeat(Math.max(0, Math.round(px / SPACE_PX)))
/** Characters the firmware font lacks would drop silently, or fail the page: swap them first. */
const glass = (s: string): string => sanitize(s).text

export type GlassText = { title: string; mood: string; rows: string }

export function glassText(screen: Screen): GlassText {
  const w = ROWS.width
  const centre = screen.align === 'centre'
  const line = (s: string) => (centre ? align(glass(s), w, 'center') : truncate(glass(s), w))

  // "▶ □ passport": an unselected row keeps the pointer's width in spaces, so the boxes line up.
  const slot = pad(textWidth(POINTER))
  const lines = screen.rows.map(r => {
    const head = `${r.selected ? POINTER : slot} ${r.ticked ? TICKED : OPEN} `
    return head + truncate(glass(r.text), w - textWidth(head))
  })
  const block = centre ? pad((w - Math.max(0, ...lines.map(l => textWidth(l)))) / 2) : ''

  return {
    title: line(screen.title),
    mood: screen.mood ? line(screen.mood) : ' ',
    rows: lines.length ? lines.map(l => block + l).join('\n') : ' ',
  }
}

/** The bar's words: each label, then its gesture, dropping whole actions that don't fit. */
export function barText(actions: readonly { label: string; gesture: Gesture }[]): string {
  return actionBar(actions.map(a => ({ ...a, action: null })), {
    widthPx: BAR_LEFT.width, glyphs: GESTURE_ICON, measure: s => pixelTextWidth(s), separator: '   ', max: 3,
  })
}

/** The bar drawn in the pixel font from @maticsh/glasses, at the left of its box or centred in it. */
export function barImage(text: string, to: Align): Grid {
  const g = pixels.grid(BAR_LEFT.width, BAR_LEFT.height)
  if (!text.trim()) return g
  const img = pixelText(text, { scale: 2 })
  pixels.blit(g, img, to === 'centre' ? Math.floor((g.w - img.w) / 2) : 0, Math.floor((g.h - img.h) / 2))
  return g
}

/** The page for an alignment, with its text already in place so a rebuild shows words at once. */
export function pageFor(to: Align, text: GlassText): BuiltPage {
  return buildPage({
    containers: [
      { kind: 'text', name: 'input', box: { x: 0, y: 0, width: 576, height: 288 }, content: ' ', capture: true },
      { kind: 'text', name: 'title', box: TITLE, content: text.title },
      { kind: 'text', name: 'mood', box: MOOD, content: text.mood },
      { kind: 'text', name: 'rows', box: ROWS, content: text.rows },
      { kind: 'image', name: 'bar', box: to === 'centre' ? BAR_CENTRE : BAR_LEFT },
    ],
  })
}
