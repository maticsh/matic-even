# How Checklist is built

[apps/checklist](../apps/checklist/README.md) is the demo app. This page describes how its code fits together: the folders, how a gesture becomes a change, how the glasses and the phone draw, and how its state survives a restart. Every path is in `apps/checklist`.

## The parts

```
+--------------------------- phone: the Even app ----------------------------+
|                                                                            |
| WebView: the app's own page                                                |
|                                                                            |
|   infra/phone.ts  -- controls -->  app/glasses.ts  -->  domain/lists.ts    |
|   the phone page  <---- View ----  run(), apply()       pure state         |
|                                      |          ^                          |
|                          renderer,   |          |   toIntent,              |
|                        write queue   v          |   keymap                 |
|                          +-------------------------------+                 |
|                          |  bridge: even_hub_sdk         |                 |
|                          +-------------------------------+                 |
|                                      |          ^                          |
+---------+----------------------------+----------+--------------------------+
          |                            |          ^
          | fetch, one                 | writes   | events
          | whitelisted origin         v          |
          v                      +-------------------+
   +------------+                |    G2 glasses     |
   | apps/relay |                +-------------------+
   +------------+
          |
          v
   feeds, APIs, pages users add
```

The app runs as a web page in the Even app's WebView, on the phone. It reaches the glasses only through the bridge from `@evenrealities/even_hub_sdk`. Checklist makes no network calls. The relay box shows where a server goes when an app needs outside data: see [Add a server](#add-a-server).

## The folders

| Folder | What it holds |
|---|---|
| `src/domain/` | `lists.ts`: the state and every change to it, as pure functions. State goes in, new state comes out. Nothing here knows about the glasses, the phone or storage |
| `src/app/` | `screen.ts`: the screen model. `glasses.ts`: the glasses wiring. `layout.ts`: the page boxes and the text for each box. `copy.ts`: every line the glasses show |
| `src/infra/` | `phone.ts`: the phone page, built from `@maticsh/phone` |
| `src/` | `main.ts` connects the parts to the real bridge. `phone-preview.ts` connects them to `FakeBridge`, for the dev preview |

A change that cannot happen, such as a sixth item or an empty name, returns the same state object. The caller tells with `===` that nothing changed.

## One screen model

`screenOf(state)` in `src/app/screen.ts` turns the state into a `Screen`: the title, up to five rows, an optional line under the title, the actions on the bar, and the alignment.

Two things draw from that one model:

- The glasses. `glassText` and `pageFor` in `src/app/layout.ts` turn the screen into text for each container, and the bar into a pixel-font image.
- The phone preview. `src/infra/phone.ts` passes the same screen to `frame.preview` from `@maticsh/phone`.

So the preview shows what the glasses show. `tests/phone.test.ts` checks that both pick the same bar words.

## Input

All glasses input arrives through `bridge.onEvenHubEvent` in `src/app/glasses.ts`:

1. `toIntent` from `@maticsh/glasses` turns the raw event into one typed intent.
2. The lifecycle sees it first. Foreground and exit events stop there.
3. A swipe passes a gate of 700 ms (`SWIPE_GATE_MS`), because one long swipe can arrive as several scroll events ([H12](findings/input.md#h12-one-long-swipe-can-arrive-as-several-scroll-events)).
4. `resolve` looks the intent up in the keymap for the current screen, and runs the action it finds.

The keymap comes from the screen's bar actions, plus a double tap that asks the OS for its exit dialog. The bar's words come from the same keymap, so the bar cannot show a gesture that does nothing.

The phone page calls the same app through its controls: `show`, `toggle`, `add`, `rename` and the rest. Both paths end in one function, `apply`.

## Writes to the glasses

`apply(next)` in `src/app/glasses.ts` stores the new state, saves it, and calls `paint`. `paint` builds the screen and sends it:

- The first time, and when the alignment changes, it mounts a whole page with `ui.mount`. The page carries its text already.
- Otherwise it sends the title, the line under it and the rows with `ui.text`.
- The bar goes as an image with `ui.image`, once its PNG is encoded. Encodes can finish out of order, so only the newest bar is sent.

`ui` is the renderer from `createRenderer` in `@maticsh/glasses`. It runs every write through one write queue, one at a time, each with a timeout. Per container the newest content wins, and it does not send text that has not changed.

## State

`createStore` in `@maticsh/glasses` keeps the state in bridge storage, under the key `checklist.state`, at version 1. `parseState` in `src/domain/lists.ts` checks the stored shape. If the shape is wrong, the store falls back to the seed lists.

- Each `apply` saves through the store, which waits 500 ms before it writes, so a burst of changes becomes one write.
- Each foreground event is a checkpoint (`lc.onCheckpoint`). It runs the morning reset and flushes the store.
- The exit event flushes the store again (`lc.onExit`).

A cold start rebuilds everything from storage. `run` reads the stored state, catches up the morning reset, and paints. The renderer handles glasses that still hold a page from before the reload: if the startup page is refused, it rebuilds the page instead.

## Tests

The tests need no glasses and no phone.

| File | What it covers |
|---|---|
| `tests/lists.test.ts` | The domain, as plain unit tests: ticks, moves, edits, settings, the morning reset and stored state |
| `tests/screen.test.ts` | The screen model for each state |
| `tests/glasses.test.ts` | The whole app on `FakeBridge` from `@maticsh/testing`: taps, swipes, the swipe gate, phone changes, a restart from storage, and the morning reset across a day |
| `tests/phone.test.ts` | The preview and the dev remote pick the same words as the glasses |
| `tests/manifest.test.ts` | `app.json` passes the manifest lint |

`FakeBridge` keeps what the app sends to each container, so a test reads the glasses as text. For a relaunch, `tests/glasses.test.ts` copies the storage into a new `FakeBridge` that still holds a page from before.

## Add a server

An app can only call origins on its `app.json` whitelist, and store review flags every other URL string in the bundle ([docs/review/urls.md](review/urls.md)). An app that needs feeds, APIs or pages that its users add whitelists one origin, its own server, and the server fetches the rest.

[apps/relay](../apps/relay/README.md) is that server, ready to copy. The app calls it with the outside URL as data:

```ts
const res = await fetch(`${RELAY}/v1/fetch?url=${encodeURIComponent(u)}`)
```

The relay checks the scheme, the port and the address of every URL and every redirect, caps size, time and rate, and adds the CORS headers.
