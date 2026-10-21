# @maticsh/testing

Test tools for Even Realities G2 apps. They catch on your machine what would otherwise fail silently on the glasses, or at store review.

## Install

```sh
npm i -D -E @maticsh/testing@0.1.0
```

Import it from tests, scripts and `vite.config.ts` only, never from app code. It ships ES modules with type declarations, and its bins run on plain Node.

## Exports

| Export | Use it for |
|---|---|
| `FakeBridge` | An in-memory glasses bridge for unit tests. It records every call, keeps the page and text state, and checks each payload the way the SDK and firmware would. Drive it with `tap()`, `doubleTap()`, `swipe()`, `hold()`, `release()`, `imuSample()`, `menu()`, `foreground()`, `systemExit()`, `abnormalExit()` and `status()` |
| `FakeBridge.assertNoViolations()` | Failing a test on any write the device would drop with no error: a second startup page, an upgrade to an unknown container, parallel image sends, a sensor opened before the page |
| `lintManifest` | Checking `app.json` against the packaging and review rules: `package_id` shape, a name with no "Even", an `x.y.z` version, declared and used permissions, whitelist shape, languages |
| `scanUrls`, `whitelistOf`, `onWhitelist` | Checking a built bundle the way store review does: every URL string must be on the network whitelist, even one the app never calls ([docs/review/urls.md](https://github.com/maticsh/matic-even/blob/main/docs/review/urls.md)). Also at `@maticsh/testing/urls`, which has no other imports |

### Dev server: `@maticsh/testing/dev`

Node only, for an app's `vite.config.ts` and for `maticsh-qr`.

| Export | Use it for |
|---|---|
| `devHost` | The address the phone reaches this machine at, for the QR code and the hot-reload socket: `DEV_HOST`, else this machine's LAN address |
| `devPort` | The dev server's port: `DEV_PORT`, else the app's own default |
| `isPrivateAddress` | Letting only this machine and private networks reach a dev-only endpoint |

### Bins

| Bin | What it does |
|---|---|
| `maticsh-qr <port>` | Prints a QR code for the dev server, to sideload from the Even app. It needs `@evenrealities/evenhub-cli` |
| `maticsh-urls [app-folder...]` | Runs `scanUrls` on a built app: `app.json`'s whitelist against `dist/` and `src/`. With no folder it scans the current one. Exit 1 on an error, 2 when `app.json` or `dist/` is missing |

In this repo, `node scripts/urls.ts apps/<app>` runs the same scan from source.

## Example

```ts
import { describe, expect, it } from 'vitest'
import { FakeBridge, lintManifest } from '@maticsh/testing'
import manifest from '../app.json'
import { run } from '../src/app.ts'

describe('the app', () => {
  it('ticks on a tap, and sends nothing the glasses would drop', async () => {
    const bridge = new FakeBridge()
    await run(bridge)
    bridge.tap()
    await new Promise(r => setTimeout(r, 0))
    expect(bridge.text('title')).toBe('1 ticked')
    bridge.assertNoViolations()
  })

  it('has a manifest that passes the lint', () => {
    expect(lintManifest(manifest)).toEqual([])
  })
})
```

## Check

```sh
npm test --workspace packages/testing
npm run typecheck --workspace packages/testing
```

## License

MIT
