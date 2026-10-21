import { getTextWidth, measureTextWrap, pxTruncate } from '@evenrealities/pretext'

export const SCREEN = { width: 576, height: 288 } as const
export const LINE_HEIGHT = 27

export type Box = { x: number; y: number; width: number; height: number }
export type Frame = { paddingLength?: number; borderWidth?: number }

const SPACE_PX = getTextWidth(' ')

/** The text area inside padding and border. Measure against this, never the outer box. */
export function inner(box: Pick<Box, 'width' | 'height'> & Frame): { width: number; height: number } {
  const inset = 2 * ((box.paddingLength ?? 0) + (box.borderWidth ?? 0))
  return { width: box.width - inset, height: box.height - inset }
}

export const textWidth = getTextWidth

/** How many whole lines fit in the box. */
export function maxLines(box: Pick<Box, 'width' | 'height'> & Frame): number {
  return Math.floor(inner(box).height / LINE_HEIGHT)
}

/** Wrap text the way the firmware does and report whether it fits without scrolling. */
export function measure(text: string, box: Pick<Box, 'width' | 'height'> & Frame) {
  const area = inner(box)
  const m = measureTextWrap(text, area.width)
  return { ...m, fits: m.height <= area.height }
}

const fitted = new Map<string, string>()

/**
 * Cut text at a word so it fits `lines` firmware lines in `widthPx`, ending in '…' when it had to cut.
 * Answers are cached, because apps redraw the same text often.
 */
export function fitLines(text: string, widthPx: number, lines: number): string {
  const key = `${widthPx}|${lines}|${text}`
  let out = fitted.get(key)
  if (out === undefined) {
    out = fitLinesUncached(text, widthPx, lines)
    if (fitted.size > 2_000) fitted.clear()
    fitted.set(key, out)
  }
  return out
}

function fitLinesUncached(text: string, widthPx: number, lines: number): string {
  const box = { width: widthPx, height: lines * LINE_HEIGHT }
  if (measure(text, box).fits) return text
  const words = text.split(' ')
  let lo = 0, hi = words.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(words.slice(0, mid).join(' ') + '…', box).fits) lo = mid
    else hi = mid - 1
  }
  return lo ? words.slice(0, lo).join(' ') + '…' : truncate(text, widthPx)
}

/** Cut a single line to a pixel width, ending in '...' when it had to cut. */
export function truncate(text: string, maxPx: number): string {
  return pxTruncate(text, maxPx)
}

function spaces(px: number): string {
  return ' '.repeat(Math.max(0, Math.round(px / SPACE_PX)))
}

/**
 * Align one line inside a pixel width by padding with spaces. The firmware has no alignment,
 * so this is the only way to centre or right-align. Accurate to about half a space (~3 px).
 */
export function align(text: string, widthPx: number, to: 'left' | 'center' | 'right'): string {
  const line = truncate(text, widthPx)
  const free = widthPx - getTextWidth(line)
  if (to === 'left' || free <= 0) return line
  return (to === 'center' ? spaces(free / 2) : spaces(free)) + line
}

/** Put `left` at the start and `right` at the end of one line, the TUI status-bar shape. */
export function spread(left: string, right: string, widthPx: number): string {
  const r = truncate(right, widthPx)
  const l = truncate(left, Math.max(0, widthPx - getTextWidth(r) - SPACE_PX))
  const gap = widthPx - getTextWidth(l) - getTextWidth(r)
  return l + spaces(Math.max(gap, SPACE_PX)) + r
}
