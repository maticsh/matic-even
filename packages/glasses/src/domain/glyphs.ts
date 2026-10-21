import { getTextWidth } from '@evenrealities/pretext'

/** One glyph string per gesture, for action bars. Each glyph is in the firmware font. */
export const GESTURE_GLYPH = {
  tap: '●',
  doubleTap: '●●',
  swipe: '▲▼',
  swipeUp: '▲',
  swipeDown: '▼',
  /** Tap, then hold: the OS opens the contextual menu. Display-only; apps never receive it. */
  menu: '● ●━',
  hold: '●━',
} as const

/** The same gestures for bars drawn with the pixel font (`pixelText`), which has an oval glyph for "hold". */
export const GESTURE_ICON: Record<keyof typeof GESTURE_GLYPH, string> = {
  tap: '●',
  doubleTap: '●●',
  swipe: '▲▼',
  swipeUp: '▲',
  swipeDown: '▼',
  hold: '⬬',
  menu: '●⬬',
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

/**
 * A horizontal bar sized in pixels. `fraction` 1 is all fill. Both default glyphs are 20 px wide.
 * Draining progress is `bar(1 - elapsed, ...)`.
 */
export function bar(fraction: number, widthPx: number, glyphs: { fill: string; empty: string } = { fill: '━', empty: '─' }): string {
  const cells = Math.max(0, Math.floor(widthPx / getTextWidth(glyphs.fill)))
  const filled = Math.round(clamp01(fraction) * cells)
  return glyphs.fill.repeat(filled) + glyphs.empty.repeat(cells - filled)
}

const SPARK = '▁▂▃▄▅▆▇█'

/** One glyph per value, scaled between the series min and max. */
export function sparkline(values: number[]): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const span = Math.max(...values) - min
  return values.map(v => SPARK[span === 0 ? 0 : Math.round(((v - min) / span) * (SPARK.length - 1))]).join('')
}

const SPINNER = ['●○○', '○●○', '○○●', '○●○']

/** A frame of a three-dot spinner. Keep frames ≥120 ms apart; every frame is a BLE write. */
export function spinner(frame: number): string {
  return SPINNER[((frame % SPINNER.length) + SPINNER.length) % SPINNER.length]!
}
