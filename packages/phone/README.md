# @maticsh/phone

Parts for the phone page of an Even Realities G2 app. The phone page runs in the Even app's WebView, next to the glasses. These parts draw a live preview of the glasses, and the controls around it.

Each part is a plain function that returns an HTML string, so it renders in a page and in a test with no DOM. A control carries what it does as data attributes, and one listener per page (`delegate`) routes them to your handlers. Importing the package adds its stylesheet. It has a light theme and uses system fonts.

## Install

```sh
npm i -E @maticsh/phone@0.2.0
```

It ships ES modules with type declarations, and imports its stylesheets as CSS files, so build your app with Vite or another bundler that handles a CSS import. The stylesheet is also at `@maticsh/phone/shell.css`. Vitest needs `test: { server: { deps: { inline: [/@maticsh\/phone/] } } }` in `vite.config.ts` to load the package, so that Vite handles the CSS (`apps/checklist/vite.config.ts` has it). Inside this repo's npm workspace, apps load its source instead (the `@maticsh/source` export condition).

## Exports

| Export | Use it for |
|---|---|
| `mountFrame`, `frameHtml`, `pinHeights`, `pinVars` | The page frame: the glasses preview pinned to the top, which shrinks to a strip as the page scrolls, the title, and the tabs. At 900 px and up the preview sits in a sticky left column. `frameHtml` is the same markup as a string, and `pinHeights` and `pinVars` drive the shrink from your own scroll handler |
| `settingsScreen`, `listScreen`, `firstRunScreen` | Whole screens put together from these parts, as HTML strings: the preview over a card with a toggle row, a value row, a segmented control and a slider; the preview over check rows, an add row and the tab bar; an empty state with one ink button and a note |
| `glassSvg`, `stripHtml`, `centreRows`, `barLine`, `gridPath`, `GLASS` | Drawing a list-shaped glasses screen (`GlassScreen`) at its real 576 x 288 shape, and the strip it shrinks to |
| `tabBar`, `segmented`, `ICONS` | A bottom tab bar on the phone, and a segmented control for a choice of two to four things |
| `card`, `heading` | A white card, and a section heading above it |
| `valueRow`, `buttonRow`, `toggleRow`, `checkRow`, `editRow`, `inputRow` | Rows inside a card: one that opens something, one action on one thing, an on or off setting, an item with a tick box and Edit, the same item while editing, and a field with one button |
| `button`, `wide` | A pill button (`ink`, `ghost` or `sure`), and a full-width button inside a card |
| `slider`, `sliderCard`, `showSliderValue` | A number or a time picked from a range |
| `note`, `empty` | A plain line under a card, and a card with nothing in it yet |
| `createConfirm`, `CONFIRM_MS` | A two-tap confirm: the first tap arms, a second within 3 s confirms. Browser dialogs inside the Even app are untested |
| `delegate` | One set of listeners per page that routes `data-act`, `data-enter`, `data-input` and `data-change` to your handlers |
| `esc`, `actAttrs`, `attrs` | Escaping text, and writing the data attributes for a control |

### Dev only: `@maticsh/phone/dev`

| Export | Use it for |
|---|---|
| `mountRemote`, `remoteButtons`, `remoteHtml` | Tap, swipe up and swipe down buttons under the preview, plus the arrow keys and the space bar. They send real gestures to a fake bridge, so the app runs its real input path |
| `mountKitView` | A page that shows every part once, in each variant, with what it is for |

Import `@maticsh/phone/dev` only from a dev-only page (see `apps/checklist/phone-preview.html`), so neither part reaches your production build.

## Example

```ts
import { card, delegate, mountFrame, note, toggleRow, type GlassScreen } from '@maticsh/phone'

let on = false
const screen = (): GlassScreen => ({
  title: 'lamp',
  rows: [{ text: on ? 'on' : 'off' }],
  bar: [{ label: 'switch', gesture: 'tap' }],
  align: 'left',
})

const frame = mountFrame(document.getElementById('app')!, {
  title: 'Lamp',
  tabs: [{ id: 'main', label: 'Lamp', icon: 'sliders' }],
  tab: 'main',
  onTab: () => {},
})

function render() {
  frame.preview(screen())
  frame.panel.innerHTML = card(toggleRow({ title: 'Lamp', on, act: { name: 'switch' } })) + note('Stays on this phone.')
}
delegate(frame.panel, { switch: () => { on = !on; render() } })
render()
```

`apps/checklist` in this repo builds its whole phone page from these parts.

## Check

```sh
npm test --workspace packages/phone
npm run typecheck --workspace packages/phone
```

## License

MIT
