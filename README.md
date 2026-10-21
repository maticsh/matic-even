# G2 field notes

We measured a pair of Even Realities G2 glasses. This repo holds what we found, and the parts to build a G2 app on them. Each finding states a measured claim and what it means for your app.

Measured by Matic (matic.sh).

## Who measured it, and on what

- **Glasses:** one pair of Even G2. We did not record the firmware version.
- **SDK:** `@evenrealities/even_hub_sdk` 0.0.16.
- **Phone:** an iPhone with the Even app. We did not record the iOS and Even app versions.
- **Install:** QR sideload from a dev server, unless a finding says otherwise.
- **Tool:** the probe app in [apps/probe/](apps/probe/), versions 0.1.1 to 0.1.4.
- **Dates:** 2026-10-03 to 2026-10-09.

One person made every observation. Some findings come from a single run. Each finding says how often we saw it.

## How to read a finding

Each finding has an ID, H1 to H23. The IDs are stable, so you can cite them. Each finding has these parts:

| Part | What it says |
|---|---|
| **Claim** | What is true, with numbers and units |
| **Method** | How it was measured, so you can repeat it |
| **Setup** | Glasses, SDK, probe version, install type, phone |
| **Date** | When it was measured |
| **Confidence** | How often it was seen, and by whom |
| **For your app** | What to do about it |

Where a finding and Even's docs disagree, the finding holds for the setup it names. SDK and firmware updates can change any of it. If you see something different, [tell us](CONTRIBUTING.md).

## Findings

| ID | Claim | Topic | Link |
|---|---|---|---|
| H1 | A small, solid shape blinking at the edge catches the eye. Thin blinking text reads as flicker | Display | [display.md#H1](docs/findings/display.md#h1-blink-a-small-solid-shape-to-alert) |
| H2 | All five text levels render, but they look too alike to rank text | Display | [display.md#H2](docs/findings/display.md#h2-text-brightness-levels-look-too-alike-to-rank-text) |
| H3 | Images show all 16 grey levels | Images | [images.md#H3](docs/findings/images.md#h3-images-show-all-16-grey-levels) |
| H4 | A 144 x 144 PNG lands in 150 to 300 ms | Images | [images.md#H4](docs/findings/images.md#h4-a-small-image-lands-in-150-to-300-ms) |
| H5 | Replacing an image does not flicker, and rapid sends all land | Images | [images.md#H5](docs/findings/images.md#h5-image-replacement-does-not-flicker-and-rapid-sends-all-land) |
| H6 | `isWearing` changes while a plugin is open | Sensors | [sensors.md#H6](docs/findings/sensors.md#h6-the-wearing-sensor-reports-while-a-plugin-is-open) |
| H7 | OS overlays fire ENTER when they open and EXIT when they close | Lifecycle | [lifecycle.md#H7](docs/findings/lifecycle.md#h7-os-overlays-fire-foreground-events-enter-on-open-exit-on-close) |
| H8 | `●▲▼` look heavier in the simulator than on glass | Fonts | [fonts.md#H8](docs/findings/fonts.md#h8-the-simulator-makes-glyphs-look-heavier-than-they-are) |
| H9 | The firmware font reads a little large, and has no size control | Fonts | [fonts.md#H9](docs/findings/fonts.md#h9-the-firmware-font-reads-a-little-large) |
| H10 | With the phone unlocked, a 5 s heartbeat ran with no gaps | Lifecycle | [lifecycle.md#H10](docs/findings/lifecycle.md#h10-a-sideload-runs-without-gaps-with-the-phone-unlocked) |
| H11 | Quick repeated taps become a double tap | Input | [input.md#H11](docs/findings/input.md#h11-quick-repeated-taps-become-a-double-tap) |
| H12 | One long swipe can arrive as several scroll events | Input | [input.md#H12](docs/findings/input.md#h12-one-long-swipe-can-arrive-as-several-scroll-events) |
| H13 | The IMU is an accelerometer in g. x is pitch. Pace is ms between samples | Sensors | [sensors.md#H13](docs/findings/sensors.md#h13-the-imu-is-an-accelerometer-in-g) |
| H14 | At 1 Hz the IMU tells looking up, looking down, still and moving apart | Sensors | [sensors.md#H14](docs/findings/sensors.md#h14-the-imu-can-tell-what-the-wearer-is-doing-even-at-1-hz) |
| H15 | A QR sideload ran 18 min with the iPhone locked | Lifecycle | [lifecycle.md#H15](docs/findings/lifecycle.md#h15-a-qr-sideload-kept-running-for-18-minutes-with-the-iphone-locked) |
| H16 | A plain long press reaches the app | Input | [input.md#H16](docs/findings/input.md#h16-a-plain-long-press-reaches-the-app) |
| H17 | Wear detection is a user setting. With it off, `isWearing` stays false | Sensors | [sensors.md#H17](docs/findings/sensors.md#h17-wear-detection-is-a-user-setting) |
| H18 | The display sits above the line of sight | Display | [display.md#H18](docs/findings/display.md#h18-the-display-sits-above-the-line-of-sight) |
| H19 | Users can bind long press to a system action | Input | [input.md#H19](docs/findings/input.md#h19-users-can-take-long-press-for-a-system-action) |
| H20 | A page rebuild cannot animate | Display | [display.md#H20](docs/findings/display.md#h20-a-page-rebuild-cannot-animate) |
| H21 | Overflowing capture text scrolls in firmware | Display | [display.md#H21](docs/findings/display.md#h21-overflowing-text-scrolls-in-firmware) |
| H22 | Share, clipboard and mail links fail in the Even app's WebView | WebView | [webview.md#H22](docs/findings/webview.md#h22-share-clipboard-and-mail-links-fail-in-the-webview) |
| H23 | The firmware font has no Hindi. Send it as an image | Fonts | [fonts.md#H23](docs/findings/fonts.md#h23-the-firmware-font-has-no-hindi-send-it-as-an-image) |

By topic: [display](docs/findings/display.md), [fonts](docs/findings/fonts.md), [images](docs/findings/images.md), [input](docs/findings/input.md), [sensors](docs/findings/sensors.md), [lifecycle and the phone](docs/findings/lifecycle.md), [the WebView](docs/findings/webview.md).

## Store review

Lessons from rejections, written as checks you can run before you submit:

- [urls.md](docs/review/urls.md): review flags any URL string in your bundle that is not on your whitelist.
- [sensors.md](docs/review/sensors.md): turn sensors off on the exit events.
- [listing.md](docs/review/listing.md): portal field limits, the public privacy policy, and manifest checks.

## Open probes

Questions we have not answered yet. Each file is ready to post as an issue. Run one, and [report the result](CONTRIBUTING.md#report-a-probe-result).

| ID | Question |
|---|---|
| [P3](docs/probes/P3.md) | Does a plugin survive a 30-minute phone lock? |
| [P4](docs/probes/P4.md) | How fast does the wearing sensor react? |
| [P8](docs/probes/P8.md) | What fires when the phone backgrounds the Even app or locks? |
| [P10](docs/probes/P10.md) | What does an IMU and a slow animation cost in battery over 30 minutes? |
| [P12](docs/probes/P12.md) | Why did the IMU stream stop for 29 seconds? |
| [P13](docs/probes/P13.md) | Do image updates wipe text that was upgraded earlier? |
| [P14](docs/probes/P14.md) | Is the Even AI Agent setting shown to every user? |

## The probe app

[apps/probe/](apps/probe/) is the plugin that took these measurements. Run it on your own glasses to check a finding or answer a probe. [apps/probe/README.md](apps/probe/README.md) explains how to run it and how to turn a run into a finding.

```sh
npm ci                 # at the repo root
cd apps/probe
npm test
npm run dev            # then, in a second terminal: npm run qr
```

## Packages

Building blocks for G2 apps, in `packages/`, on npm at 0.1.0.

| Package | What it is |
|---|---|
| [@maticsh/glasses](packages/glasses/README.md) | The glasses side: input, text fitting, pages, rendering, storage, lifecycle and pixel drawing |
| [@maticsh/phone](packages/phone/README.md) | The phone page: a live glasses preview, tabs, rows, buttons and a dev-only remote |
| [@maticsh/testing](packages/testing/README.md) | A fake glasses bridge for tests, an `app.json` lint, and the URL scan that store review runs |

## The demo app

[apps/checklist/](apps/checklist/README.md) is a small app built on the packages: three short lists, ticked from the glasses and edited on the phone. It is also the template for a new app.

## Work in this repo

The packages and apps are one npm workspace. Node 24 or later.

```sh
npm ci
npm run check          # typecheck and test every package and app
npm run build          # build the packages, both apps and the site
npm run urls           # the URL scan on both builds
```

## Contribute

New findings, probe results and corrections are welcome. Findings take pull requests only in the format in [CONTRIBUTING.md](CONTRIBUTING.md). Probe results go in an issue, with the "Probe result" form.

## License

MIT. See [LICENSE](LICENSE).
