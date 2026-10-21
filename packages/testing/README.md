# @maticsh/testing

Test tools for Even Realities G2 apps. They catch on your machine what would otherwise fail silently on the glasses, or at store review.

## Install

The package is not on npm yet. Use it from this repo's npm workspace:

```sh
npm ci                 # at the repo root
```

Then add `"@maticsh/testing": "0.1.0"` to your app's `devDependencies`. Import it from tests and scripts only, never from app code.

## Exports

| Export | Use it for |
|---|---|
| `FakeBridge` | An in-memory glasses bridge for unit tests. It records every call, keeps the page and text state, and checks each payload the way the SDK and firmware would. Drive it with `tap()`, `doubleTap()`, `swipe()`, `hold()`, `release()`, `imuSample()`, `menu()`, `foreground()`, `systemExit()`, `abnormalExit()` and `status()` |
| `FakeBridge.assertNoViolations()` | Failing a test on any write the device would drop with no error: a second startup page, an upgrade to an unknown container, parallel image sends, a sensor opened before the page |
| `lintManifest` | Checking `app.json` against the packaging and review rules: `package_id` shape, a name with no "Even", an `x.y.z` version, declared and used permissions, whitelist shape, languages |
| `scanUrls`, `whitelistOf`, `onWhitelist` | Checking a built bundle the way store review does: every URL string must be on the network whitelist, even one the app never calls ([docs/review/urls.md](../../docs/review/urls.md)). Also at `@maticsh/testing/urls`, which has no other imports |

`scripts/urls.ts` at the repo root runs `scanUrls` on a built app: `node scripts/urls.ts apps/<app>`.

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
