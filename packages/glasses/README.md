# @maticsh/glasses

Primitives for the glasses side of an Even Realities G2 app. Each one handles a platform trap once, so your app does not have to: taps with no event type, text that overflows silently, writes that race, a menu that drops on rebuild, storage that does not persist.

It wraps `@evenrealities/even_hub_sdk` 0.0.16. It works in any app that runs in the Even app's WebView.

## Install

```sh
npm i -E @maticsh/glasses@0.1.0
```

It ships ES modules with type declarations. Inside this repo's npm workspace, apps load its TypeScript source instead (the `@maticsh/source` export condition).

## Exports

`domain/` is pure: no bridge calls, so it runs in plain unit tests. `infra/` talks to the bridge.

| Export | Use it for |
|---|---|
| `toIntent` | Turning a raw bridge event into one typed `Intent` (tap, double tap, scroll, long press, list, menu, IMU, audio, foreground, exit). A tap arrives with no `eventType`, and it can come on either envelope |
| `LIMITS`, `checkText`, `missingGlyphs`, `isMissingGlyph`, `sanitize` | Checking text before you send it: the character and byte limits, and glyphs the firmware font lacks (they drop with no error) |
| `SCREEN`, `LINE_HEIGHT`, `measure`, `maxLines`, `inner`, `fitLines`, `truncate`, `align`, `spread`, `textWidth` | Fitting text by pixels in the firmware font. The firmware has no alignment, so `align` and `spread` pad with spaces |
| `buildPage`, `textUpgrade`, `corner`, `strip`, `PageSpecError` | Building a page from a typed spec. It assigns IDs, checks the limits, keeps exactly one capture container and re-attaches the menu on every rebuild |
| `listPage`, `valuePage`, `cardPage`, `imagePage` | Assembled pages as data: a title over rows with a pointer; one value centred with a label and a note; a bordered card with a title, a body and a progress line; an image in front of a full-screen input layer. Each returns the spec for `buildPage`, the text in it, and the grids to send after mount. An optional `bar` slot holds a pixel-font line, such as `actionBar`'s, at the foot |
| `GESTURE_GLYPH`, `GESTURE_ICON`, `bar`, `sparkline`, `spinner` | Gesture glyphs, progress bars, sparklines and spinners from glyphs the font has |
| `resolve`, `actionBar`, `gestureOf`, `recordUse` | One table per screen that maps gestures to actions. The action bar line comes from the same table, so it cannot drift from what the gestures do |
| `createGate` | Letting one event through per window. One long swipe can arrive as several scroll events ([H12](https://github.com/maticsh/matic-even/blob/main/docs/findings/input.md#h12)) |
| `deadline` | Phased timers on the wall clock: `start`, `pause`, `resume`, `position`, `skip`, `msToBoundary`. The WebView can be suspended, so counting ticks drifts |
| `dayKey`, `daysAgo`, `ageBucket`, `timeLabel`, `startOfDay`, `AGE_BUCKETS` | Local calendar days and short labels ("3:50 pm", "yesterday", "tue", "sep 28") that stay right across DST and midnight |
| `pixels` | Greyscale grids at the 16 levels images show ([H3](https://github.com/maticsh/matic-even/blob/main/docs/findings/images.md#h3)): `grid`, `fillRect`, `blit`, `upscale`, `crop`, `ink`, `dotText`, `fromAscii`, and `storeIconIssues` for the 24 x 24 store icon |
| `pixelText`, `pixelTextWidth`, `PIXEL_FONT_CHARS` | A small proportional pixel font for text drawn into images, with gesture symbols |
| `encodePng`, `gridToInkDataUrl`, `gridToDataUrl` | Turning a grid into PNG bytes for the glasses, or a data URL for the phone page (browser only) |
| `createWriteQueue`, `withTimeout`, `BridgeTimeoutError` | Running glasses writes one at a time, each with a timeout. Overlapping writes race |
| `createRenderer` | All glasses writes for one app: latest wins per container, unchanged text is skipped, text goes before images |
| `createStore` | Typed, versioned state in bridge storage, with debounced writes. Even's docs and Even's skill pack disagree on whether browser `localStorage` persists in this WebView. Untested |
| `createLifecycle` | Foreground events as checkpoints, and clean-up once on exit. An OS overlay fires ENTER and EXIT while the page stays up ([H7](https://github.com/maticsh/matic-even/blob/main/docs/findings/lifecycle.md#h7)) |
| `GlassesBridge` | The slice of the SDK bridge these modules use. The real bridge and `FakeBridge` from `@maticsh/testing` both fit it |

## Example

```ts
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { buildPage, createLifecycle, createRenderer, createStore, resolve, toIntent, type Keymap } from '@maticsh/glasses'

const bridge = await waitForEvenAppBridge()
const ui = createRenderer(bridge, { onError: console.warn })
const store = createStore(bridge)
const lc = createLifecycle(bridge)
lc.onCheckpoint(() => store.flush())

let count = 0
const keys: Keymap<() => void> = [
  { gesture: 'tap', label: 'add', action: () => ui.text('count', String(++count)) },
  { gesture: 'doubleTap', label: 'exit', action: () => void lc.requestExit() },
]

bridge.onEvenHubEvent(e => {
  const intent = toIntent(e)
  if (!intent || lc.handle(intent)) return
  resolve(keys, intent)?.action()
})

await ui.mount(buildPage({
  containers: [{ kind: 'text', name: 'count', box: { x: 0, y: 0, width: 576, height: 288 }, content: '0', capture: true }],
}))
```

In tests, pass `new FakeBridge()` from `@maticsh/testing` instead of the real bridge.

`apps/checklist` and `apps/probe` in this repo are full apps built on this package.

## Check

```sh
npm test --workspace packages/glasses
npm run typecheck --workspace packages/glasses
```

## License

MIT
