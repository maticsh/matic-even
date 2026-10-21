# The probe

A G2 plugin that measures the glasses. Every finding in this repo came from it, or from an app built the same way.

Put one thing on the glasses. Measure it, or log it. Write down what you saw, with the setup and the date. Then turn it into a claim that someone else can check.

## Requirements

- Node 24 or later.
- Even Realities G2 glasses, paired with the Even app on your phone.
- Developer mode in the Even app (see below).
- A phone that can reach your computer: the same Wi-Fi, or a VPN.

## Install and check

The probe is one app in this repo's npm workspace. It builds on `@maticsh/glasses` and tests with `@maticsh/testing` (both in `packages/`). Install once, from the repo root:

```sh
npm ci
cd apps/probe
npm run typecheck
npm test
```

Run the scripts below from `apps/probe`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server on port 5199. It also collects the probe's log into `logs/` |
| `npm run qr` | Prints a QR code for the dev server, to sideload onto your glasses |
| `npm run sim` | Opens the probe in Even's simulator (needs `npm run dev` running) |
| `npm test` | Runs the unit tests on a fake bridge |
| `npm run typecheck` | Checks types |
| `npm run build` | Typechecks, then builds into `dist/` |
| `npm run pack` | Builds, then packs `probe.ehpk` for a private or beta install |

On a Linux machine with no display, run the simulator under `xvfb-run -a`.

## Run it on your glasses

### One-time setup

1. Pair your glasses in the Even app, and take any firmware update first.
2. Turn on developer mode. It has no switch. Sign in at https://hub.evenrealities.com with the same account as the phone app. Then force-quit the Even app and open it again. A **Scan QR** button now shows in the **Even Hub** tab.

### Each session

1. Run `npm run dev`.
2. In a second terminal, run `npm run qr`.
3. In the Even app, open the **Even Hub** tab, tap **Scan QR**, and scan the code. The probe opens on the glasses.
4. Keep the phone unlocked and the Even app in front, unless the test says otherwise.
5. The phone page mirrors the glasses and shows extra detail. `console` output shows in the Even app's developer console.

### Which address the QR code uses

The phone loads the probe from your computer, so the QR code and the hot-reload socket need an address the phone can reach.

- By default, the probe uses your computer's LAN address (a private IPv4 address such as `192.168.x.x`).
- If the phone reaches your computer at another address (a VPN, or a second network card), set `DEV_HOST`:

  ```sh
  DEV_HOST=10.0.0.12 npm run dev
  DEV_HOST=10.0.0.12 npm run qr
  ```

- Set `DEV_PORT` to use a port other than 5199. Set it for both commands.

`scripts/host.ts` at the repo root picks the address. Every app in this repo uses it.

To check the address, open `http://<address>:5199` in the phone's browser. The probe's phone page should load.

## The pages

The probe has four pages. Each one measures a few things. The bottom line on the glasses lists the gestures for the page.

### Main page

| Gesture | What it does | What it measures |
|---|---|---|
| Tap | Runs the next blink style: `hard`, `blank`, `edge` | Which alert catches the eye ([H1](../../docs/findings/display.md#h1-blink-a-small-solid-shape-to-alert)) |
| Swipe down | Sends a 144 x 144 test image and times it | Image speed, greys, flicker ([H3](../../docs/findings/images.md#h3-images-show-all-16-grey-levels), [H4](../../docs/findings/images.md#h4-a-small-image-lands-in-150-to-300-ms), [H5](../../docs/findings/images.md#h5-image-replacement-does-not-flicker-and-rapid-sends-all-land)) |
| Swipe up | Opens the Sense page | |
| Double tap | Opens the OS exit dialog | |

The six lines of the main page:

1. `beats 12 · gaps 0 · max 0:05`: a heartbeat every 5 s. A gap is an interval over 15 s, which means the app was suspended ([H10](../../docs/findings/lifecycle.md#h10-a-sideload-runs-without-gaps-with-the-phone-unlocked), [H15](../../docs/findings/lifecycle.md#h15-a-qr-sideload-kept-running-for-18-minutes-with-the-iphone-locked)).
2. `last beat 0:02 ago`.
3. `wearing: yes since 14:05:09 · bat 80%`: the wearing sensor and the battery ([H6](../../docs/findings/sensors.md#h6-the-wearing-sensor-reports-while-a-plugin-is-open), [H17](../../docs/findings/sensors.md#h17-wear-detection-is-a-user-setting)).
4. `ev: in 12s · out 8s`: the last three raw foreground events. The phone page lists all of them with clock times ([H7](../../docs/findings/lifecycle.md#h7-os-overlays-fire-foreground-events-enter-on-open-exit-on-close)).
5. `image: 240 ms (#3)`: the last image send.
6. `prev: up 18:02, died ~14:23:10`: how long the last run lived. The probe stores its stats, so this survives a relaunch.

### Sense page

Swipe up from the main page. The IMU turns on at pace 100. The corner sprite changes frame every 5 s.

| Gesture | What it does |
|---|---|
| Tap | IMU on or off |
| Swipe down | Next pace: 100, 200, 500, 1000 ms |
| Swipe up | Back to the main page. The IMU turns off |
| Long press | Counts and times the press, and marks the log |

The page shows live x, y and z, the measured sample rate, a still or moving guess, the long-press count and time, the battery change since the page opened, and the sprite frame count. It measures the IMU ([H13](../../docs/findings/sensors.md#h13-the-imu-is-an-accelerometer-in-g), [H14](../../docs/findings/sensors.md#h14-the-imu-can-tell-what-the-wearer-is-doing-even-at-1-hz)), long press ([H16](../../docs/findings/input.md#h16-a-plain-long-press-reaches-the-app)) and battery cost ([P10](../../docs/probes/P10.md)).

### Text levels page

Tap, then hold, to open the OS menu. Pick **Text levels**. The page shows one row at each `textColor` level, 0 to 4 ([H2](../../docs/findings/display.md#h2-text-brightness-levels-look-too-alike-to-rank-text)). Swipe up to go back.

### Scripts page

Pick **Scripts** from the OS menu. The left half shows six rows of Latin, Chinese and Hindi in the firmware font. The right half shows the same text drawn by the phone, as images at several sizes. The phone page shows the reference text to compare against ([H23](../../docs/findings/fonts.md#h23-the-firmware-font-has-no-hindi-send-it-as-an-image)). Swipe up to go back.

The OS menu also has **Reset stats**, **Blink**, **Send image** and **Sense**.

## The log

While `npm run dev` runs, the probe posts its log to the dev server every 5 s. Each launch writes one file: `logs/sense-<date>-<time>.csv`. The dev server takes posts only from this machine and from private networks. Nothing like this ships in `probe.ehpk`.

| Column | Meaning |
|---|---|
| `t_ms` | Time on the phone, in ms since 1970 |
| `kind` | `imu`, `hold`, `release`, `pace`, `imuOff`, `battery`, `frame`, `frameFail` or `wearing` |
| `x`, `y`, `z` | IMU sample, in g |
| `value` | The pace, the press length in ms, the battery level, the frame state or the wearing state |

### Mark the log with a long press

A long press on the Sense page writes a `hold` row, then a `release` row with the press length. Use it as a marker. Press once at the start of each step of a script, so you can line the data up with what you did.

Long press is fine for a test tool like this. Do not build app features on it: users can bind it to a system action ([H19](../../docs/findings/input.md#h19-users-can-take-long-press-for-a-system-action)).

### The IMU script

This is the run behind [H13](../../docs/findings/sensors.md#h13-the-imu-is-an-accelerometer-in-g) and [H14](../../docs/findings/sensors.md#h14-the-imu-can-tell-what-the-wearer-is-doing-even-at-1-hz). Open the Sense page. Long-press once at the start of each step.

1. **Sit and type**, 2 min. Work as normal.
2. **Look up and around**, 1 min. Look at the ceiling, the window, across the room.
3. **Look down at your phone**, 1 min.
4. **Stand up and sit down** three times, 1 min.
5. **Walk**, 2 min.
6. **Sit still** again, 1 min.
7. **Paces.** Swipe down to step through 200, 500 and 1000. Hold each one for 30 s while you sit still.
8. **Glasses off** for 10 s, then back on.

Then leave the page running for 30 min or more ([P10](../../docs/probes/P10.md), [P12](../../docs/probes/P12.md)).

## Turn a run into a finding

1. Ask one narrow question, such as "How fast does a 144 x 144 image land?"
2. Run it more than once. Note how many times, and say so in the finding.
3. Write the claim first. One or two sentences, with numbers and units.
4. Write the method. Which page, which gestures, what you watched or logged. Someone else must be able to repeat it.
5. Write the setup. Glasses and firmware, Even app version, SDK version, phone and OS, install type (QR sideload, private build or beta build), phone locked or unlocked.
6. Write the date you measured it.
7. Write what it means for an app. One or two rules a developer can follow.
8. Attach the raw log if you have one. Trim it to the part that matters.
9. Open an issue or a pull request in the format in [CONTRIBUTING.md](../../CONTRIBUTING.md).

Say what you do not know. "Not timed" and "seen once" are useful facts.

## Change the probe

- Add a page for your question. Keep each page to six lines of text, so it never scrolls.
- Put the maths in pure functions, and test them (`tests/probe.test.ts`).
- Run every change on the fake bridge first. `FakeBridge` checks each payload the way the SDK and firmware would, and `assertNoViolations()` fails the test on any silent error.
- Turn every sensor off on the exit events ([review/sensors.md](../../docs/review/sensors.md)).

## The packages

The probe uses the same packages as any app in this repo. They are MIT licensed, like the rest of the repo.

| Package | What the probe uses from it |
|---|---|
| [`@maticsh/glasses`](../../packages/glasses/README.md) | `toIntent`, `buildPage`, `strip`, `actionBar`, `resolve`, `missingGlyphs`, the renderer, the store and the lifecycle |
| [`@maticsh/testing`](../../packages/testing/README.md) | `FakeBridge` and `lintManifest`, in `tests/probe.test.ts` |
