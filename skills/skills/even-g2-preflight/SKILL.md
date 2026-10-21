---
name: even-g2-preflight
description: Check an Even Realities G2 app before you pack it for Even Hub store review. Runs the URL scan against the app.json whitelist, the manifest lint, the sensors-off-at-exit check and the store-listing checks, then packs the .ehpk with an exact --sdk-ver. Use before `evenhub pack` for review, when the user says "submit", "ship to the store", "pack for review", "preflight", or after a review rejection.
---

# Even G2 preflight

Run these checks in order before you pack a build for store review. Each check comes from a review
rejection or a pack failure. Stop at the first failure, fix it, and run the checks again from step 1.

The `even-g2` skill has the background. The lessons behind each check are in
https://github.com/maticsh/matic-even under `docs/review/`. The tools below come from that repo. They are
not on npm yet, so clone the repo once:

```sh
git clone https://github.com/maticsh/matic-even matic-even
```

In the commands, `<app>` is your app folder (the one that holds `app.json`), and `<even>` is that clone.

## 0. Build

```sh
cd <app> && npm run build
```

The scan and the pack read `dist/`. A stale `dist/` gives a stale answer.

## 1. URL scan (`docs/review/urls.md`)

Review scans the built bundle for URL-shaped strings. It flags every one that is not on the network
whitelist in `app.json`, even one the app never calls.

```sh
node <even>/scripts/urls.ts <app>
```

It needs Node 24 and has no dependencies. It reads `<app>/app.json`, then scans `<app>/dist` and
`<app>/src`. Exit 0 means clean. Exit 1 means at least one error. Exit 2 means `app.json` or `dist/` is
missing: build first.

| Rule | Level | What it means | Fix |
|---|---|---|---|
| `url-not-whitelisted` | error | A URL string in the bundle is not on the whitelist. Review will flag it. | Remove it, move it to your server, or put it behind `import.meta.env.DEV`. Check your dependencies too. |
| `whitelist-shape` | error | A whitelist entry is not a bare `https://` or `wss://` origin. | Use the origin only: no path, no wildcard. |
| `whitelist-unused` | warning | A whitelisted origin never appears in the bundle. | Check that the app needs it. |
| `network-permission-empty` | error | A `network` permission has no whitelist. `pack` fails on it. | Add the origin, or remove the permission. |
| `fetch-origin` | error | `fetch`, `WebSocket` or `EventSource` in source names an origin off the whitelist. | Route the call through your whitelisted server. |

Common causes: starter data with addresses in it, demo data, and code that builds `https://${...}` from
user input. Review flags the start of a template literal too. Let the server add a missing scheme.

Without the clone, check by hand. This lists every URL string in the bundle. Compare each one with the
whitelist. It is rougher than the scanner:

```sh
grep -rhoE "(https?|wss?)://[^\"'\` )]+" <app>/dist | sort -u
```

XML namespace strings such as `http://www.w3.org/2000/svg` were not flagged in past submissions.

## 2. Manifest lint (`docs/review/listing.md`)

Call `lintManifest` from `@maticsh/testing` in a unit test. Pass the exact installed SDK version and
the permissions your code uses:

```ts
import manifest from '../app.json'
import { lintManifest } from '@maticsh/testing'

it('passes the manifest lint', () => {
  expect(lintManifest(manifest, { sdkVersion: '0.0.16', usedPermissions: ['network'] })).toEqual([])
})
```

Each issue has `level`, `field` and `message`.

| Field | What it means |
|---|---|
| `package_id` | Not lowercase reverse-DNS with 2 or more segments of letters and digits. It is permanent once released, so get it right now. |
| `edition` | Must be `"202601"`. |
| `name` | Not 1 to 20 characters, or it contains "Even" in any case. Review rejects that name. |
| `version` | Not `x.y.z`. No `v`, no suffix. |
| `entrypoint`, `min_sdk_version` | Missing. |
| `min_sdk_version` (warning) | Differs from the installed SDK. |
| `min_app_version` (warning) | Present. Leave it out. The CLI stamps it from `--sdk-ver`. |
| `permissions[i]` | Unknown name, or `desc` not 1 to 300 characters. |
| `permissions[i].whitelist` | Empty, or an entry that is not a bare `https://` or `wss://` origin. |
| `permissions` | Declared but unused (review flags it), or used but not declared. |
| `supported_languages` | Empty, or not one of `en de fr es it zh ja ko`. |

Then test every language you list on glass. A glyph that the firmware font lacks drops with no error
(`docs/findings/fonts.md#h23`).

## 3. Sensors off at exit (`docs/review/sensors.md`)

Review rejects an app that leaves a sensor on after exit. Turn off every sensor you turned on, on
`SYSTEM_EXIT_EVENT` and `ABNORMAL_EXIT_EVENT`: `imuControl(false)` for the IMU, `audioControl(false)` for
the mic. Do not turn them off when you open the exit dialog with `shutDownPageContainer(1)`. The user can
cancel the dialog.

Test both exit events with `FakeBridge` from `@maticsh/testing`:

```ts
it('turns the IMU off on both exit events, and not on the exit dialog', async () => {
  for (const exit of ['systemExit', 'abnormalExit'] as const) {
    const bridge = new FakeBridge()
    await startApp(bridge)          // your app's entry, with the bridge injected
    turnImuOn(bridge)               // the gesture that turns the IMU on in your app
    await new Promise(r => setTimeout(r, 0))
    bridge.doubleTap()              // the exit dialog opens; the user can still cancel it
    await new Promise(r => setTimeout(r, 0))
    expect(bridge.imu.open).toBe(true)
    bridge[exit]()
    await new Promise(r => setTimeout(r, 0))
    expect(bridge.imu.open).toBe(false)
  }
})
```

Use `bridge.audioOpen` the same way for the mic. Then check the cancel path on glass:

1. Open the app and turn the sensor on.
2. Double tap to open the exit dialog, then cancel it.
3. Check that the sensor still works.

## 4. Store listing (`docs/review/listing.md`)

Check each item in the portal before you submit:

- [ ] Short description is 50 characters or fewer. About is 2000 or fewer. Both are ASCII.
- [ ] The display name matches `name` in `app.json`.
- [ ] Store icon: 24 x 24, 1-bit, every lit pixel inside a 2 x 2 block. All assets greyscale.
- [ ] Screenshots come from the simulator.
- [ ] Release notes: 1 to 3 lines per locale, written for users.
- [ ] The privacy form covers every permission. It holds no personal phone number or home address,
      because the generated policy is public. Read the generated text.
- [ ] If the app needs an account of its own, the reviewer has a way in without one, and the note for
      the reviewer says how.
- [ ] No medical, financial or emergency features.
- [ ] On glass, with the build you ship (a beta build): a root double tap opens the exit dialog, and the
      WebView closes on confirm. The first run shows no black screen. With the phone locked, the core
      flow works on glasses and ring alone, and the app is alive after 2 min idle and after a 5-min lock.

## 5. Pack

Pack with the exact SDK version you built against:

```sh
cd <app>
SDK="$(npm pkg get dependencies.@evenrealities/even_hub_sdk | tr -d '"')"
evenhub pack app.json dist -o <name>.ehpk --sdk-ver "$SDK"
```

| Failure | What it means |
|---|---|
| `SDK` is empty or a range such as `^0.0.16` | The SDK is not pinned exactly. Run `npm i -E @evenrealities/even_hub_sdk@<version>`. |
| You left out `--sdk-ver` | The CLI derives `min_app_version` from the latest SDK on npm, not from the SDK you built against. Pack again with the flag. |
| Pack fails on the network permission | The whitelist is empty. See step 1. |
| The package id is taken | Run `evenhub pack ... -c` to check the id before you upload. |

Upload the `.ehpk` in the portal. CLI 0.2.0 also lists `create` and `upload` commands. Read
`evenhub upload --help` before you use them. A released version cannot be edited, so a fix needs a
higher `version`.
