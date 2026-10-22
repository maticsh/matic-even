# Checklist

A demo G2 app: three short lists, ticked from the glasses and edited on the phone. It is built on `@maticsh/glasses` and `@maticsh/phone`, and tested with `@maticsh/testing`. It is also the template for a new app.

## What it does

On the glasses, one list shows at a time, five items at most, with `▶` on one item.

| Gesture | What it does |
|---|---|
| Tap | Ticks or unticks the item under `▶` |
| Swipe | Moves `▶` up or down |
| Double tap | Opens the OS exit dialog |

The bottom line shows the gestures that do something right now, drawn in the pixel font.

On the phone, the page shows a live preview of the glasses and three tabs:

- **Lists**: puts a list on the glasses.
- **Items**: adds, renames, removes and ticks items. Tap a name to move `▶` to it.
- **Settings**: text on the left or centred, hide ticked items, and untick every list each morning at a set time.

Lists stay on the phone, in bridge storage. The app asks for no permissions and makes no network calls.

## What it shows

| Part | Where |
|---|---|
| Gestures to actions, and the bar, from one table | `src/app/glasses.ts`, `src/app/screen.ts` |
| A page with text fitted by pixels and the bar as a pixel-font image | `src/app/layout.ts` |
| One screen model that the glasses and the phone preview both draw | `src/app/screen.ts` |
| State as pure functions, saved through a typed store | `src/domain/lists.ts` |
| Foreground events as checkpoints, and saving on exit | `src/app/glasses.ts` |
| A phone page built only from `@maticsh/phone` | `src/infra/phone.ts` |
| A dev preview on `FakeBridge`, with the remote and the Kit view | `phone-preview.html`, `src/phone-preview.ts` |
| Tests on `FakeBridge`, and a manifest lint | `tests/` |

## Run it

Node 24 or later. From the repo root:

```sh
npm ci
cd apps/checklist
npm test
npm run dev            # dev server on port 5210
npm run qr             # in a second terminal: a QR code to sideload onto the glasses
```

In the Even app, open the **Even Hub** tab, tap **Scan QR**, and scan the code. [apps/probe/README.md](../probe/README.md#run-it-on-your-glasses) explains developer mode and which address the QR code uses (`DEV_HOST`, `DEV_PORT`).

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server on port 5210 |
| `npm run qr` | Prints a QR code for the dev server |
| `npm run sim` | Opens the app in Even's simulator (needs `npm run dev` running) |
| `npm test` | Runs the tests on `FakeBridge` |
| `npm run build` | Typechecks, then builds into `dist/` |
| `npm run urls` | The URL scan that store review runs, on `dist/` |
| `npm run pack` | Builds, then packs `checklist.ehpk` |

### The dev preview

`http://localhost:5210/phone-preview.html` runs the phone page with the real app behind it, on `FakeBridge`. It needs no glasses and no Even app. Vite builds `index.html` only, so nothing on this page reaches `dist/`.

| Query | What it does |
|---|---|
| `?remote` | Tap and swipe buttons under the preview, plus the arrow keys and the space bar |
| `?ui` | The Kit view: every phone part in each variant |
| `?tab=lists`, `items` or `settings` | Opens on that tab |
| `?align=centre`, `?hide`, `?done`, `?empty` | Start states for screenshots |

On the real page, `?demo` starts from the example lists in their own storage (dev server only).

## Use it as a template

The `@maticsh/*` packages are on npm at 0.2.0, and this folder declares every package it needs, so a copy runs on its own. Node 24 or later:

```sh
npx degit maticsh/matic-even/apps/checklist my-app && cd my-app && npm install
```

Then:

1. Set your own `package_id` and `name` in `app.json`, your own `name` in `package.json`, and your own `.ehpk` name in the `pack` script.
2. Run `npm test`, then `npm run dev` and `npm run qr`.
3. Before you submit, run `npm run build`, then `npm run urls`: the URL scan that store review runs ([docs/review/urls.md](../../docs/review/urls.md)). Then `npm run pack`.

To build an app inside this repo instead, copy the folder to `apps/<your-app>`. npm links the packages from the workspace, and the app loads their TypeScript source, so a change to a package shows without a build.

## License

MIT
