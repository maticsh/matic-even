/**
 * @maticsh/glasses: primitives for the glasses side of an Even Realities G2 app.
 * domain/ is pure (no bridge calls). infra/ talks to the SDK bridge.
 */

// domain
export { toIntent, type Intent, type GestureSource } from './domain/events.ts'
export { LIMITS, checkText, isMissingGlyph, missingGlyphs, sanitize, type TextIssue } from './domain/budget.ts'
export { LINE_HEIGHT, SCREEN, align, fitLines, inner, maxLines, measure, spread, textWidth, truncate, type Box, type Frame } from './domain/fit.ts'
export { GESTURE_GLYPH, GESTURE_ICON, bar, sparkline, spinner } from './domain/glyphs.ts'
export { createGate } from './domain/gate.ts'
export { AGE_BUCKETS, ageBucket, dayKey, daysAgo, startOfDay, timeLabel, type AgeBucket } from './domain/when.ts'
export { PIXEL_FONT_CHARS, pixelText, pixelTextWidth } from './domain/pixel-font.ts'
export { actionBar, gestureOf, recordUse, resolve, type Binding, type Gesture, type Keymap, type Learned } from './domain/keymap.ts'
export * as deadline from './domain/deadline.ts'
export * as pixels from './domain/pixels.ts'
export type { Grid } from './domain/pixels.ts'
export type { Phase, Position, Timeline } from './domain/deadline.ts'
export {
  PageSpecError, buildPage, corner, strip, textUpgrade,
  type BuiltPage, type ContainerSpec, type ImageSpec, type ListSpec, type PageSpec, type Ref, type TextSpec,
} from './domain/page.ts'
export { cardPage, imagePage, listPage, valuePage, type BarSlot, type Preset } from './domain/presets.ts'

// infra
export type { GlassesBridge } from './infra/bridge.ts'
export { createWriteQueue, withTimeout, BridgeTimeoutError, type WriteQueue } from './infra/write-queue.ts'
export { createRenderer, type RenderError, type Renderer } from './infra/renderer.ts'
export { createStore, type Codec, type KeySpec, type Store } from './infra/store.ts'
export { createLifecycle, type Lifecycle } from './infra/lifecycle.ts'
export { encodePng, gridToDataUrl, gridToInkDataUrl } from './infra/png.ts'
