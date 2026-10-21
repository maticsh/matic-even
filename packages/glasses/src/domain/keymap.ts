import type { Intent } from './events.ts'
import { GESTURE_GLYPH } from './glyphs.ts'
import { truncate } from './fit.ts'

export type Gesture = keyof typeof GESTURE_GLYPH

export type Binding<A> = { gesture: Gesture; label: string; action: A }

/** One table per screen. Behaviour and the action bar both read from it, so they cannot drift. */
export type Keymap<A> = readonly Binding<A>[]

/** Gesture use counts. Persist them in the app, so learned bindings stay hidden across launches. */
export type Learned = Partial<Record<Gesture, number>>

export function gestureOf(intent: Intent): Gesture | null {
  switch (intent.kind) {
    case 'tap': return 'tap'
    case 'doubleTap': return 'doubleTap'
    case 'scrollTop': return 'swipeUp'
    case 'scrollBottom': return 'swipeDown'
    case 'longPress': return 'hold'
    default: return null
  }
}

/** Exact gesture first. A directional swipe falls back to a plain `swipe` binding. */
export function resolve<A>(keymap: Keymap<A>, intent: Intent): Binding<A> | null {
  const g = gestureOf(intent)
  if (!g) return null
  const exact = keymap.find(b => b.gesture === g)
  if (exact) return exact
  return g === 'swipeUp' || g === 'swipeDown' ? (keymap.find(b => b.gesture === 'swipe') ?? null) : null
}

export function recordUse(learned: Learned, gesture: Gesture): Learned {
  return { ...learned, [gesture]: (learned[gesture] ?? 0) + 1 }
}

/**
 * An action bar line, such as `pause ●   next ▲▼   exit ●●`: each binding's label, then its gesture glyph.
 * Shows at most `max` bindings (default 3), leaves out the ones used `threshold` times (default 3),
 * and fits `widthPx`. Returns '' when every binding is left out.
 */
export function actionBar<A>(
  keymap: Keymap<A>,
  opts: {
    widthPx: number
    learned?: Learned
    threshold?: number
    max?: number
    /** Symbol per gesture. Defaults to GESTURE_GLYPH (firmware font); pass GESTURE_ICON for a pixel-font bar. */
    glyphs?: Record<Gesture, string>
    /** Measure in another font (e.g. `pixelTextWidth`). Then whole actions drop from the end instead of truncating. */
    measure?: (text: string) => number
    separator?: string
  },
): string {
  const { widthPx, learned = {}, threshold = 3, max = 3, glyphs = GESTURE_GLYPH, measure, separator = '   ' } = opts
  const shown = keymap.filter(b => (learned[b.gesture] ?? 0) < threshold).slice(0, max)
  const join = (bs: typeof shown) => bs.map(b => `${b.label} ${glyphs[b.gesture]}`).join(separator)
  if (!measure) return truncate(join(shown), widthPx)
  while (shown.length && measure(join(shown)) > widthPx) shown.pop()
  return join(shown)
}
