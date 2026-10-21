---
name: even-g2
description: Build apps for Even Realities G2 smart glasses (and the R1 ring) on the Even Hub platform. Covers the plugin model (a web app in the phone's WebView, bridged to the glasses), hardware limits, the @evenrealities/even_hub_sdk display, input and device APIs and their traps, app.json and .ehpk packaging, the simulator and its automation API, QR sideload, private and beta installs, store review, and facts measured on a real G2. Use when the user mentions Even Realities, Even G2, R1 ring, Even Hub, evenhub, evenhub-simulator, .ehpk, even_hub_sdk, or a smart-glasses or HUD app for the G2.
---

# Even Realities G2 on Even Hub

**Snapshot: 2026-10-03, CLI checked 2026-10-20.** Sources: the pages of hub.evenrealities.com/docs,
`evenhub-templates`, `everything-evenhub` (Even's own Claude Code plugin), `EvenDemoApp`, the SDK 0.0.16
npm package, and Matic's measurements on a real G2. The platform is pre-1.0 and ships a patch every 2 to
3 weeks. Check versions before you trust a number here (see **Keep this skill current**). Full signatures
and enums are in `references/sdk.md`.

This skill sits next to Even's `everything-evenhub` plugin. Use that plugin for step-by-step scaffolds and
the full SDK walk-through. Use this skill for the traps, the measured facts and the review checks.

Paths such as `docs/findings/display.md#h1` are relative to the root of https://github.com/maticsh/matic-even.
A finding ID (H1 to H23) names one measurement with its method, setup and confidence.

## Links

| What | Where |
|---|---|
| Docs (start at Overview) | https://hub.evenrealities.com/docs/get-started/overview |
| Developer portal (login, builds, beta groups) | https://hub.evenrealities.com/login |
| Phone app download | https://evenapp.evenrealities.com |
| SDK, CLI, simulator | npm `@evenrealities/even_hub_sdk`, `@evenrealities/evenhub-cli`, `@evenrealities/evenhub-simulator` |
| Text measurement (LVGL-accurate) | npm `@evenrealities/pretext` |
| Templates (`minimal`, `asr`, `image`, `text-heavy`) | https://github.com/even-realities/evenhub-templates |
| Even's Claude Code plugin | https://github.com/even-realities/everything-evenhub |
| G1 raw-BLE demo (Flutter) | https://github.com/even-realities/EvenDemoApp |
| Design guidelines (Figma) | https://www.figma.com/design/X82y5uJvqMH95jgOfmV34j/Even-Realities---Software-Design-Guidelines--Public-?node-id=2922-80782 |
| Community notes (glyph tables, quirks, G2 internals) | https://github.com/nickustinov/even-g2-notes |
| Community toolkit (React components, pixel icons) | https://github.com/fabioglimb/even-toolkit, npm `even-toolkit` |
| Matic's field notes, packages and demo app | https://github.com/maticsh/matic-even, https://even.matic.sh |
| Discord | https://discord.gg/Y4jHMCU4sv |
| Enterprise or deeper hardware access | software@evenrealities.com |

## The shape of an app

```
Even Hub Cloud ──HTTPS── Phone: Even Realities App (Flutter) ──BLE 5.2── Even G2
                         └─ WebView runs your web app             (renders containers,
                            (WKWebView iOS / Chromium Android)     emits input)
```

- A **plugin** is a plain web app (HTML and TS, any framework, ESM). It runs in the phone app's WebView.
  The glasses run no app logic. They draw containers and send input events.
- The page has two outputs. The DOM shows on the phone: use it for setup, settings or a mirror view.
  The glasses show only what you push through the bridge. The DOM never reaches the glasses.
- Every glasses call goes through `const bridge = await waitForEvenAppBridge()`. A call made before the
  bridge resolves does nothing, with no error.
- All state lives on the phone. The glasses store nothing.
- Plugins are the only live surface. Even has announced dashboard widgets, dashboard layouts and AI skills.

## Hardware: have and have-not

| Have | Detail |
|---|---|
| Display | 576 x 288 px per eye, monochrome green, 16 levels. Black is off, so it reads as transparent. |
| Mic | 4-mic array, one mono stream, PCM s16le 16 kHz. The phone mic is also selectable. |
| Input | Temple touchpads (L and R): press, double press, swipe up and down, long press. R1 ring: the same gestures. |
| Sensors | IMU (x, y, z), wearing, battery, charging, in-case. |
| Through the phone | Location, a single-image album pick, phone camera capture, whitelisted network. |

**Have-not:** glasses camera, speaker or any audio out, haptics, colour, fonts or font sizes, bold, text
alignment, background fills, arbitrary pixels, animation, emoji, push notifications, network while
backgrounded, direct Bluetooth, programmatic scroll position.

**Bandwidth.** BLE moves about 10 to 30 KB/s. Even's guidance says one image frame takes 0.5 to 2 s. On a
G2, a 144 x 144 PNG landed in 150 to 300 ms (`docs/findings/images.md#h4`). A text update is fast. Build
turn-based screens, and use text for anything that must feel instant.

## Display model

- **Containers** are rectangles at absolute pixel positions. The origin is top-left. Three types: text,
  list, image. A page holds at most 12: up to 8 text or list, and up to 4 image.
- **Exactly one** container per page sets `isEventCapture: 1`. Image containers cannot capture. For an
  image-first page, put a full-screen text container with `content: ' '` behind the image as the input layer.
- `containerID` and `containerName` (max 16 chars) are unique per page.
- `zOrderIndex` (SDK 0.0.12+): set it on every container or on none. Values are unique. Larger draws in front.
- Text and list containers take `borderWidth` 0-5, `borderColor` 0-15, `borderRadius` 0-10 and
  `paddingLength` 0-32. The border is the only decoration. Nothing has a fill.
- **Text** is left- and top-aligned and wraps at the container width. `\n` breaks a line. Overflow
  scrolls in firmware when the container captures input. Limits: 1000 chars on create and rebuild, 2000 on
  `textContainerUpgrade`. The simulator enforces 999 *bytes*, so count UTF-8 bytes for non-ASCII text.
  About 400 to 500 chars fill the screen. To centre text, pad it with spaces.
- `textColor` 0-4 (SDK 0.0.14+) sets glyph brightness. The default is 4.
- **Font:** one proportional LVGL font with a fixed 27 px line height. Glyphs outside the font drop with
  no error. The fallback chain is Latin, then Cyrillic and Greek, then CJK (`pretext` `getAdvW`). Chinese,
  kana and Vietnamese work. Devanagari, Bengali, Tamil, Arabic, Hebrew and Thai have no glyphs. Draw them
  on the phone into an image (`docs/findings/fonts.md#h23`).
- Size text with `@evenrealities/pretext` (`measureTextWrap`, `pxTruncate`) against the inner box:
  `width - 2 * (paddingLength + borderWidth)`.
- Glyphs that render: `━ ─ █▇▆▅▄▃▂▁ ▲△▶▷▼▽◀◁ ●○ ■□ ★☆ ╭╮╯╰ │`.
- **List:** up to 20 items of up to 64 chars (the simulator caps at 63 bytes). Items are 40 px tall with
  12 px side padding. Firmware owns scroll and highlight. A list has no in-place update, so a change
  means a page rebuild. No per-item style.
- **Image:** 20-288 wide, 20-144 tall, greyscale. A new image container is empty. Fill it with
  `updateImageRawData` after the page exists. Keep one send in flight and await each one. Sends are paced
  at 100 ms (0.0.14+). Encoded PNG or JPEG bytes work, because the SDK converts them. Dither a photo only
  when it looks muddy. A `'success'` result means "accepted". It does not prove the pixels lit.

| Call | Use |
|---|---|
| `createStartUpPageContainer` | Once, at boot. Returns 0 ok, 1 invalid, 2 oversize, 3 out of memory. |
| `textContainerUpgrade` | Every text change. No flicker. ID and name must match exactly, or it does nothing, with no error. |
| `rebuildPageContainer` | Layout changes only. Flickers. Drops the custom menu unless you pass `menuObject` again. |
| `updateImageRawData` | Image pixels. One at a time. |
| `shutDownPageContainer(1)` | Exit from the root page (system confirm dialog). Use `0` only on inner pages. |

The SDK runs its validators (`validateEvenHubPageContainer` and others, see `references/sdk.md`) before it
calls native. A failed check makes create return `invalid` and rebuild return `false`. Nothing reaches the
glasses. Run the same validators in your unit tests.

## Input and events

One subscription carries everything: `bridge.onEvenHubEvent(cb)`. Envelopes: `sysEvent`, `textEvent`,
`listEvent`, `audioEvent`, `menuItemClickEvent`.

**Trap 1: protobuf drops zero values.** `CLICK_EVENT` is 0, so a tap arrives with no `eventType`. List
index 0 arrives as `undefined`. **Trap 2: the official sources disagree** on which envelope carries a tap.
The templates say `sysEvent`. The docs' examples read `textEvent`. Handle both:

```ts
function eventTypeOf(env?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  return env ? (env.eventType ?? OsEventTypeList.CLICK_EVENT) : null  // default inside the envelope check
}

bridge.onEvenHubEvent(e => {
  if (e.audioEvent) return handlePcm(e.audioEvent.audioPcm)
  if (e.menuItemClickEvent) return menu[e.menuItemClickEvent.itemID]?.()
  if (e.listEvent && e.listEvent.eventType === undefined) return select(e.listEvent.currentSelectItemIndex ?? 0)
  const sys = eventTypeOf(e.sysEvent), txt = eventTypeOf(e.textEvent)
  const is = (t: OsEventTypeList) => sys === t || txt === t
  // explicit non-zero types first; CLICK is the fallback, so it goes last
  if (is(OsEventTypeList.DOUBLE_CLICK_EVENT)) return void bridge.shutDownPageContainer(1)   // root page
  if (is(OsEventTypeList.SCROLL_TOP_EVENT)) return prev()
  if (is(OsEventTypeList.SCROLL_BOTTOM_EVENT)) return next()
  if (sys === OsEventTypeList.LONG_PRESS_EVENT) return pressStart()
  if (sys === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) return pressEnd()
  if (sys === OsEventTypeList.FOREGROUND_ENTER_EVENT) return checkpoint()   // see Lifecycle: not "resume"
  if (sys === OsEventTypeList.FOREGROUND_EXIT_EVENT) return checkpoint()    // not "pause"
  if (sys === OsEventTypeList.SYSTEM_EXIT_EVENT || sys === OsEventTypeList.ABNORMAL_EXIT_EVENT) return cleanup()
  if (sys === OsEventTypeList.IMU_DATA_REPORT) return imu(e.sysEvent!.imuData)
  if (is(OsEventTypeList.CLICK_EVENT)) return tap()
})
```

Never flatten it to `e.sysEvent?.eventType ?? CLICK`. That reads a tap on every audio frame.
`toIntent` in `@maticsh/glasses` does this mapping once and returns one typed intent per event.

- **Text container capturing:** swipes arrive on `textEvent`. Taps and double taps usually arrive on `sysEvent`.
- **List container capturing:** swipes move the list in firmware and send no event. A tap sends
  `listEvent` with `currentSelectItemIndex`. A double tap arrives on `sysEvent`.
- **Long press** (9 starts, 10 releases; SDK 0.0.14+, app 2.2.9+) always arrives on `sysEvent`. A plain
  press and hold reaches the app (`docs/findings/input.md#h16`). Users can bind long press to a system
  action, such as Even AI on one temple (`docs/findings/input.md#h19`). Do not make a feature depend on it.
- `eventSource` (present from 0.0.15): 1 right temple, 2 ring, 3 left temple. The simulator always sends 1.
- **Quick repeated taps become a double tap** (`docs/findings/input.md#h11`). On the root page that opens
  the exit dialog. Never ask for quick repeated taps.
- **One long swipe can arrive as several scroll events** (`docs/findings/input.md#h12`). Act on the first
  event and ignore swipes for about 700 ms. `createGate` in `@maticsh/glasses` does this.
- **Contextual menu** (0.0.14+): the user taps, then holds. Pass `menuObject: { menuItems: [{ itemName,
  itemID }] }` on create or rebuild. Max 10 items. `itemID` is a non-zero, unique uint32. `itemName` is max
  32 UTF-8 bytes and reads best under 16 ASCII chars. Each item fires once and the menu closes. A rebuild
  replaces the menu, so pass it every time. The OS owns Display off, Brightness and Close, so do not add
  your own Exit item.
- **Exit contract:** a double tap on the root page calls `shutDownPageContainer(1)`. Do not clean up
  before that call, because the user can cancel the dialog. Clean up on `SYSTEM_EXIT_EVENT` (7) or
  `ABNORMAL_EXIT_EVENT` (6).

## Device APIs (signatures in `references/sdk.md`)

- The glasses mic and the IMU need a successful `createStartUpPageContainer` first. The phone mic,
  location and photos do not.
- **Audio:** `audioControl(true, AudioInputSource.Glasses | Phone)`, and `audioControl(false)` to stop.
  PCM comes on `audioEvent.audioPcm`, about 100 ms (3200 bytes) per event. 0.0.14 adds `direction` and
  `speakerRole` (self, other or unknown, a heuristic).
- **IMU:** `imuControl(true, ImuReportPace.P100 … P1000)`. Samples come on `sysEvent` type 8 as
  `imuData {x, y, z}`. On a G2 the values are an accelerometer in g, and pace is ms between samples
  (`docs/findings/sensors.md#h13`). Protobuf drops zero axes, so read a missing axis as 0. The simulator
  refuses `imuControl`.
- **Location:** `getAppLocation({ accuracy, timeoutMs })` returns a fix or `null`.
  `startAppLocationUpdates` and `onAppLocationChanged` stream fixes. Always check for null.
- **Photos:** `pickImageFromAlbum()` and `captureImageFromCamera()` return base64 or `null`. Downscale
  before you send pixels to the glasses.
- **Status:** `getDeviceInfo()`, `onDeviceStatusChanged` (battery, wearing, charging, in case),
  `getUserInfo()`. `onLaunchSource` fires once (`'appMenu'` or `'glassesMenu'`), so register it early.
- **Wearing:** `isWearing` changes while a plugin is open (`docs/findings/sensors.md#h6`), but wear
  detection is a user setting. With it off, `isWearing` stays false (`docs/findings/sensors.md#h17`).
  Never depend on it.
- **Storage:** `bridge.setLocalStorage(k, v)` and `getLocalStorage(k)` take strings and return `''` for
  a missing key. Even's skill pack says browser `localStorage` and IndexedDB do not persist reliably in
  this WebView. The docs say browser `localStorage` survives. Put anything that matters in bridge storage
  and debounce the writes. `createStore` in `@maticsh/glasses` does this, with typed and versioned keys.

## Bridge discipline

- Chain glasses writes through one promise queue. Overlapping upgrades race, and parallel image sends fail.
- Put a timeout on every bridge call (`Promise.race`, a few seconds). One bad BLE hop can hang for about 30 s.
- Debounce renders of streaming data, and skip a write when the content has not changed. The `asr`
  template uses 120 ms.
- If you merge queued text writes per container, keep a queued colour when a later write sets none.
  Otherwise a blink that ends on level 0 leaves the text dim (`docs/findings/display.md#h1`).
- Use SDK 0.0.16 or later. 0.0.15 ran `setTimeout` and `setInterval` callbacks more than once. The SDK
  wraps the page timers to keep the WebView alive in the background.

`createWriteQueue` and `withTimeout` in `@maticsh/glasses` give you the queue and the timeout.
`createRenderer` adds latest-wins writes per container, skips unchanged text and keeps queued colours.

## Lifecycle and the locked phone

- **Foreground events are checkpoints, not pause and resume.** The contextual menu and the exit dialog
  are OS overlays. Opening one fires `FOREGROUND_ENTER_EVENT`. Closing it fires `FOREGROUND_EXIT_EVENT`.
  The page stays mounted under both (`docs/findings/lifecycle.md#h7`, confirmed with a raw event log). If
  you map EXIT to pause, your app pauses just as the user closes the menu and comes back to it. On every
  foreground event, save state and re-arm sockets, audio and location. Make that work cheap and safe to
  repeat. `createLifecycle` in `@maticsh/glasses` gives you `onCheckpoint` and `onExit`.
- What fires when the phone itself backgrounds the Even app is not measured yet (`docs/probes/P8.md`).
- iOS keeps the WKWebView running in the background. Android can reclaim it under memory pressure. Treat
  every launch as a possible cold start: persist eagerly and rebuild from storage.
- Suspension drops WebSockets and stops audio capture and location streams. Re-arm them on a checkpoint.
- Even's skill pack documents `setBackgroundState` and `onBackgroundRestore`. SDK 0.0.16 does not export
  them. Wait until they appear in the `.d.ts`.
- **Lock survival.** Even's docs say a QR sideload dies on lock and a private build survives briefly. On an
  iPhone, a QR sideload ran 18 min locked, with images, IMU and network still working
  (`docs/findings/lifecycle.md#h15`). With the phone unlocked, a 5 s timer ran with no gaps
  (`docs/findings/lifecycle.md#h10`). A 30-minute lock is untested (`docs/probes/P3.md`). Store review
  locks the phone for 5 min, so test the lock with the build you ship.

## Networking and secrets

- Two gates guard each request. The origin must be in the `app.json` network whitelist (full origin,
  `https://`, no path, no wildcard; add `wss://` origins for sockets). The server must also send CORS
  headers. The whitelist does not bypass CORS. If `curl` works and the WebView fails, suspect CORS.
- When you cannot change a third party's CORS, route through your own server and whitelist that.
- **Review scans the bundle for URL strings.** Every URL-shaped string in the built bundle must be on the
  whitelist, even one the app never calls. That includes the start of a template literal such as
  `` `https://${host}` `` and demo data. Keep outside URLs on your server, and keep demo data behind
  `import.meta.env.DEV` (`docs/review/urls.md`). Run the `even-g2-preflight` skill before you pack.
- **Never bundle a secret.** Anyone can unzip a released `.ehpk`. Keep keys on a server. A per-user token
  typed in at first run and kept in bridge storage is fine. The `asr` template builds `VITE_STT_API_KEY`
  into the bundle: fine to try it out, never for a shipped build.
- The docs do not say what `location.origin` a packaged build has. Log it from a private build before you
  write a server CORS allowlist.
- **The phone page's WebView** lacks some browser features (`docs/findings/webview.md#h22`, iPhone):
  `navigator.share` is missing, `navigator.clipboard.writeText` does not copy and does not throw,
  `target="_blank"` opens Even's in-app browser, and `mailto:` and `sms:` links do nothing. Copy through a
  selected textarea with `document.execCommand('copy')`, and show links as selectable text.

## app.json

```json
{
  "package_id": "com.example.notes",
  "edition": "202601",
  "name": "Notes",
  "version": "0.1.0",
  "min_sdk_version": "0.0.16",
  "entrypoint": "index.html",
  "permissions": [
    { "name": "network", "desc": "Syncs your notes.", "whitelist": ["https://api.your-app.example"] }
  ],
  "supported_languages": ["en"]
}
```

- `package_id`: lowercase reverse-DNS, 2 or more segments, letters and digits only, each segment starts
  with a letter. Permanent once released.
- `name`: max 20 chars. A name that contains "Even" in any case is rejected at review. The templates'
  default names break that rule, so rename them after `degit`.
- `version`: `x.y.z`, no `v`, no suffix. `edition`: `"202601"`.
- `min_sdk_version`: required. Set it to the installed SDK. Bump it only when you use a newer API.
- `min_app_version`: leave it out. The CLI (0.1.14+) stamps it from the SDK. Pass
  `--sdk-ver <installed>` to `evenhub pack`, because without it the CLI uses the latest SDK on npm.
- `permissions`: an array of `{ name, desc (1-300 chars), whitelist? }`. Names: `network`, `location`,
  `g2-microphone`, `phone-microphone`, `album`, `camera`. Review flags unused ones. An empty network
  whitelist fails `pack`. Prompts fire on first use, not at launch.
- `supported_languages`: `en de fr es it zh ja ko`. A missing glyph fails with no error, so test every
  language you list (`docs/findings/fonts.md#h23`).

`lintManifest` in `@maticsh/testing` checks all of these rules in a unit test.

## Dev loop

```bash
npm i -g @evenrealities/evenhub-cli @evenrealities/evenhub-simulator   # the CLI also installs `eh`
npx degit even-realities/evenhub-templates/minimal my-app && cd my-app && npm i
npm i -E @evenrealities/even_hub_sdk@latest      # templates pin ^0.0.10; pin exact
npm run dev
evenhub-simulator http://localhost:5173 --automation-port 9898   # RUST_LOG=debug to see bridge calls
evenhub qr --url "http://<your-computer-LAN-IP>:5173"             # phone app: Even Hub tab, Scan QR
npm run build && evenhub pack app.json dist -o app.ehpk --sdk-ver "$(npm pkg get dependencies.@evenrealities/even_hub_sdk | tr -d '\"')"
```

To start from Matic's demo app instead, which already uses the packages below:
`npx degit maticsh/matic-even/apps/checklist my-app`.

For a QR sideload, the phone must reach your dev server. Set `server: { host: true, hmr: { host:
'<your-computer-LAN-IP>' } }` in `vite.config.ts`. Set `strictPort: true` too, so Vite fails instead of
moving to a port the QR code does not name. HMR over the phone is brittle. Scan the QR again to force a
reload.

| Mode | Hardware | Loop | Survives lock | Real .ehpk | Use for |
|---|---|---|---|---|---|
| Simulator | no | instant | n/a | no | layout, copy, event logic, CI |
| Local (QR sideload) | yes | <1 s, HMR | see Lifecycle | no | daily on-device work |
| Private build | yes | ~10 s | briefly (docs) | yes | manifest, permissions, launch UX |
| Beta build | yes | ~30 s | yes | yes | lock test, teammates, pre-review |

**CLI.** Up to 0.1.14 the CLI had four commands (`login`, `init`, `pack`, `qr`) and no upload, so private
and beta builds went through the portal. CLI 0.2.0 (2026-10-20) lists more in its `--help`: `self-check`,
`create`, `upload`, `update`, `ls`, `promote` (to beta only; public publishing stays in the portal),
`delist`, `testers`, `rm`, `download` and `logout`. This skill has not exercised them yet. Read
`evenhub <command> --help` before you script them.

**Phone setup.** Wake new glasses from shipping mode in the plugged-in case, pair them, and take the
firmware update first. Developer Mode has no toggle. Sign in at the developer portal with the phone app's
account, then force-quit and reopen the phone app. Scan QR appears top-right in the Even Hub tab. The
app's developer console shows your `console.*` output.

**Simulator.** A desktop LVGL window. It does not emulate hardware. It sends no device status, its IMU
data is null, `eventSource` is always 1, and its fonts and brightness are approximate. It makes `●▲▼` look
heavier than they look on glass (`docs/findings/fonts.md#h8`). Older notes say it does not decompress LZ4
images, but on simulator 0.9.5 with SDK 0.0.16 a PNG sent through `updateImageRawData` rendered, grey
steps included (checked 2026-10-03). In simulator 0.9.5, text set by `textContainerUpgrade` vanishes about
a second after the next few image sends. Nobody has checked this on glass (`docs/probes/P13.md`). Until
then, an app that animates images next to text should send the text again after the images.

**Headless Linux (CI).** Simulator 0.9.5 runs on Ubuntu 24.04 x64 with no display:

```bash
apt-get install -y --no-install-recommends libwebkit2gtk-4.1-0 libgtk-3-0t64 libsoup-3.0-0   # once
xvfb-run -a -s "-screen 0 1600x1000x24" evenhub-simulator http://localhost:5173 --automation-port 9898
```

The libEGL "DRI3 / DRI2" warnings are harmless. Rendering falls back to software.

## Simulator automation API

Start the simulator with `--automation-port <port>`. Details are in `references/sdk.md`.

| Endpoint | Use |
|---|---|
| `GET /api/ping` | Health check. Returns `pong`. |
| `GET /api/screenshot/glasses` | The 576 x 288 framebuffer as RGBA PNG. Brightness is in alpha. Test `alpha > 0` for a lit pixel. |
| `GET /api/screenshot/webview` | The phone-side page. |
| `GET /api/console?since_id=N` | Console entries. Omit `since_id` on the first poll. |
| `POST /api/input {"action": …}` | `up`, `down`, `click`, `double_click`, `context_menu`, `long_press`, `long_press_release`. |

A loop an agent can run alone:

1. Start the dev server and the simulator. Wait for your app's ready log line (about 4 s) before you send
   input. Input sent before a capturing container exists is dropped with no error.
2. Drive each screen with `POST /api/input`, and take `/api/screenshot/glasses` after each step.
3. Composite each frame on black to look at it. On a transparent background it looks blank.
4. Assert on framebuffer changes and lit-pixel counts, not on sleeps.
5. Then move to glass for feel, real brightness, Bluetooth timing, the wearing sensor, the IMU and the mic.

## Measured on a real G2

Matic measured these with its probe app (SDK 0.0.16, iPhone, QR sideload unless noted). Each finding has
a method, a setup and a confidence level. A finding outranks the docs for the setup it names. Firmware
updates can change any of it.

| ID | Fact | What to do |
|---|---|---|
| H1 | A small, dense, solid shape that blinks at the screen edge catches the eye. Thin blinking text reads as flicker. `textColor` 4 to 0 works, 4 to 1 does not. | Alert with a small filled sprite (48 x 48 at 500 ms frames worked). `docs/findings/display.md#h1` |
| H2 | All five `textColor` levels render, but they look too alike to rank text. | Leave text at the default level. Rank by position, spacing, borders and glyph weight. `docs/findings/display.md#h2` |
| H3 | Images show all 16 grey levels. | Draw an image for real shades or smaller text. `docs/findings/images.md#h3` |
| H4 | A 144 x 144 PNG lands in 150 to 300 ms. | A few frames of animation work. Video does not. `docs/findings/images.md#h4` |
| H5 | Replacing an image does not flicker, and rapid sends all land (one at a time). | Queue image sends. `docs/findings/images.md#h5` |
| H6 | `isWearing` changes while a plugin is open. | Read H17 first. `docs/findings/sensors.md#h6` |
| H7 | OS overlays fire ENTER on open and EXIT on close. The page stays mounted. | Treat foreground events as checkpoints. `docs/findings/lifecycle.md#h7` |
| H8 | The simulator makes `●▲▼` look heavier than on glass. | Judge glyph weight on glass. `docs/findings/fonts.md#h8` |
| H9 | The firmware font reads a little large, and has no size control. | Smaller text means an image. `docs/findings/fonts.md#h9` |
| H10 | With the phone unlocked, a 5 s heartbeat ran with no gaps (longest interval 8 s). | Expect some timer jitter. `docs/findings/lifecycle.md#h10` |
| H11 | Quick repeated taps become a double tap. | One tap per action. `docs/findings/input.md#h11` |
| H12 | One long swipe can arrive as several scroll events. | Gate swipes for about 700 ms. `docs/findings/input.md#h12` |
| H13 | The IMU is an accelerometer in g (length 1.0 at rest). x is head pitch, positive looks up. Pace is ms between samples: 100 gives 10 Hz, 1000 gives 1 Hz. | Turn it on after the first page mounts. Test on glass. `docs/findings/sensors.md#h13` |
| H14 | At 1 Hz the IMU separates looking up (+16° to +30°), looking at a phone (−23° to −43°), sitting still and moving. | Judge stillness over windows of about 10 s. `docs/findings/sensors.md#h14` |
| H15 | A QR sideload ran 18 min with the iPhone locked. | Save state on every checkpoint anyway. `docs/findings/lifecycle.md#h15` |
| H16 | A plain long press reaches the app as `LONG_PRESS_EVENT`, then `LONG_PRESS_RELEASE_EVENT`. | Read H19 first. `docs/findings/input.md#h16` |
| H17 | Wear detection is a user setting. With it off, `isWearing` stays false. | Never depend on it. The IMU is a fallback. `docs/findings/sensors.md#h17` |
| H18 | The display sits above the line of sight. The hands-free wake is a head tilt up of about 30°. | Put what people look up for in the centre. A "head up" IMU rule fires on every glance. `docs/findings/display.md#h18` |
| H19 | Users can bind long press to a system action. | No feature may depend on long press. `docs/findings/input.md#h19` |
| H20 | A page rebuild cannot animate. It cuts to the new layout. | Build each new page with its text already in it. `docs/findings/display.md#h20` |
| H21 | A capturing text container that overflows scrolls in firmware on swipe. Taps still arrive. | Long text needs no scroll code. No end-of-scroll event is known. `docs/findings/display.md#h21` |
| H22 | Share, clipboard and mail links fail in the Even app's WebView. | Copy with a selected textarea. `docs/findings/webview.md#h22` |
| H23 | The firmware font has no Devanagari. Chinese renders. | Send Hindi as an image at about 18 px. Chinese images read well at 16 or 20 px. `docs/findings/fonts.md#h23` |

Open questions with ready-to-run steps are in `docs/probes/`: a 30-minute lock (P3), wearing-sensor
latency (P4), what fires when the phone backgrounds the app (P8), IMU battery cost (P10), an IMU dropout
(P12), image sends and upgraded text (P13), and who sees the Even AI agent setting (P14).

## Matic's packages: where they remove a trap

The repo https://github.com/maticsh/matic-even holds MIT packages built from these traps. **They are not on npm
yet.** Until they are, clone the repo and use them from its workspace. Names are provisional until 1.0.

| Package | What | Trap it removes |
|---|---|---|
| `@maticsh/glasses` | `toIntent` | The tap envelope split, zero values on the wire, audio frames read as taps |
| | `createWriteQueue`, `withTimeout` | Racing upgrades, parallel image sends, a BLE call that hangs |
| | `createRenderer` | Repeated writes of the same text, a queued colour lost in a merge |
| | `createStore` | Unreliable browser storage, undebounced bridge writes |
| | `createLifecycle` | EXIT mapped to pause, cleanup before the exit dialog is confirmed |
| | `inner`, `measure`, `fitLines`, `truncate`, `align`, `spread` (fit) | Measuring against the outer box, no text alignment |
| | `LIMITS`, `checkText`, `missingGlyphs`, `sanitize` (budget) | Char and byte limits, glyphs that drop with no error |
| | `buildPage`, `textUpgrade` (page) | ID 0 dropped on the wire, a name mismatch that no-ops, a menu lost on rebuild |
| | `createGate` | One swipe read as several |
| `@maticsh/testing` | `FakeBridge` | Tests that need glasses. It checks payloads against the SDK validators and container limits, drives gestures, foreground and exit events, and records sensor state |
| | `lintManifest` | `app.json` rules that only fail at pack or review |
| | `scanUrls` | Review's URL scan |
| `@maticsh/phone` | Phone-page primitives: preview, strip, tabs, rows, buttons, slider, toggle, empty state, note, a dev remote | Building the phone page from nothing |
| `apps/checklist` | The demo app on all three packages, also a template | A blank start |

## Install without review

Review gates only the public store. For a personal app, upload the `.ehpk` in the portal and install it
from **Me → Apps → Private builds**. Or push it to a beta group that holds only you, and install it from
**Me → Beta tester**. The beta path survives a locked phone, so use it for daily wear.

## Shipping to the store

Run the `even-g2-preflight` skill before you pack a build for review.

Builds move Draft → Test → Submitted → Released. A released version cannot be edited or rolled back, so
you fix forward with a higher version. A review decision sends an email from noreply@evenrealities.com with
no content. The verdict is in the portal.

**Listing.** The portal's short description takes 50 characters and About takes 2000 (seen 2026-10-05).
Keep listing text in ASCII so characters and bytes agree (`docs/review/listing.md`).

**Privacy policy.** The portal generates a "Privacy Policy and Terms & Conditions" PDF from a form:
developer name, contact email, telephone, address, access permissions, data collection, location tracked,
AI used and third-party services. You do not need to host a policy. The output is generic text whatever
you declare, and it prints the phone number and address in a public document. Keep personal details out
of those fields. The form's access-permission options are: Microphone of Even Smart Glasses, Location,
Push notifications, Local network, Bluetooth, Run background services, Other. A timer that must survive a
locked phone declares "Run background services". A plugin never needs Bluetooth, because the Even app
owns the glasses link.

**What reviewers check:**

- A double tap on the root page opens the system exit dialog, the phone WebView closes on confirm, and
  Conversate launches afterwards.
- With the phone locked: the app renders, the core flow works on glasses and ring alone, and the app is
  alive after 2 min idle and after a 5-min lock.
- First run never shows a black screen. Explain any setup on the glasses. Remember setup across launches.
- Every permission is used. A privacy policy covers each one. No medical, financial or emergency features.
- Every URL string in the bundle is on the whitelist (`docs/review/urls.md`).
- Sensors you switched on are off at exit: `imuControl(false)` and `audioControl(false)` on
  `SYSTEM_EXIT_EVENT` or `ABNORMAL_EXIT_EVENT`, not on the exit dialog, which the user can cancel. Review
  rejected an app for leaving the IMU on (`docs/review/sensors.md`).
- Store icon: 24 x 24, 1-bit, every lit pixel inside a 2 x 2 block. Greyscale assets only. Screenshots
  from the simulator. The display name matches `app.json`.
- Release notes: 1 to 3 lines per locale, written for users.
- The portal has no demo-account field. If your app needs an account of its own, give the reviewer a way
  in without one, such as a demo on sample data, and say so in the note for the reviewer.

**Even AI's custom agent** (Even app: Settings, Even AI, Agent configuration) takes a full
`/v1/chat/completions` URL and a bearer key. One unsourced report (2026-10-06) says only developers see the
setting. No page from Even confirms it (`docs/probes/P14.md`). Do not make it the only way into an app.

## Version state

| Package | Latest | Notes |
|---|---|---|
| SDK | 0.0.16 (2026-09-24) | App floor 2.2.10. The docs describe 0.0.14. |
| CLI | 0.2.0 (2026-10-20) | Adds upload and channel commands. Facts here were checked on 0.1.14. |
| Simulator | 0.9.5 (2026-09-01) | The docs describe 0.9.3. 0.9.5 fixes crashes under heavy bridge traffic. |
| pretext | 0.1.4 | |
| Templates | pin SDK ^0.0.10, simulator ^0.7.2 | Bump after `degit`. |
| everything-evenhub | partly at SDK 0.0.12 | Useful. Check it against the `.d.ts`. |

Pin the SDK exactly in shipped apps. Every pre-1.0 release is a `0.0.x` patch that can add surface, so
read the changelog before each bump.

## Where the sources disagree

- Tap envelope (`sysEvent` or `textEvent`): handle both, as above.
- Foreground events: `everything-evenhub` maps `FOREGROUND_EXIT_EVENT` to "app goes to background". On a
  G2, OS overlays fire it while the page stays mounted (H7). Treat both directions as checkpoints.
- Browser `localStorage` persistence: prefer bridge storage.
- `setBackgroundState` and `onBackgroundRestore`: in the skill pack, absent from SDK 0.0.16.
- `ImuReportPace`: "protocol codes" or "ms between reports". On a G2 it is ms between samples (H13).
- `min_app_version`: the skill pack calls it required. CLI 0.1.14 and later derive it.
- Text limits: the docs count characters. The simulator counts bytes.
- QR sideload on lock: the docs say it dies. On an iPhone it ran 18 min (H15).
- Image speed: Even's guidance says 0.5 to 2 s per frame. A 144 x 144 PNG took 150 to 300 ms (H4).
- Withdrawing a release: up to CLI 0.1.14, nothing could withdraw a released version. CLI 0.2.0 lists
  `delist` (clear a beta or public channel pointer) and `rm`. What they do to a released version is untested.

When sources conflict, the SDK `.d.ts` wins, then behaviour on glass, then the docs, then the skill pack.

## G1 and raw BLE

`EvenDemoApp` is a Flutter demo for the **G1**. It drives the glasses directly over BLE: two peripherals
(left and right arm), the Nordic UART service `6E400001-…`, LC3 audio, 1-bit 576 x 136 BMP images.
None of it applies to G2 plugins. The G2 SDK exposes no Bluetooth, and the G2 protocol differs. For G2
internals, see `even-g2-notes`.

## Keep this skill current

1. Run `npm view @evenrealities/even_hub_sdk version`. Repeat for the CLI, the simulator and `pretext`.
2. Read `node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts` and the README changelog. They are
   authoritative. Read `evenhub --help` for the CLI.
3. The docs at hub.evenrealities.com/docs render on the server, so `curl` works on any page. The sidebar
   of `/docs/get-started/overview` lists every page path. Only the developer portal is a client-rendered
   shell. To save every page as text at once, run `node scripts/fetch-docs.cjs <out-dir>` from this
   skill's folder (it needs Playwright), then read `reference__changelog.txt` first.
4. Check new findings and probe results in https://github.com/maticsh/matic-even under `docs/`.
5. Update the snapshot date, the version table and the conflicts list in this file. If you measure
   something on glass, report it to the repo with its method and setup.
