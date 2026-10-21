# Review: the store listing and the manifest

Lessons from filling in the Even Hub developer portal, and the manifest rules that a check can catch before you upload.

## Field limits in the portal

Seen in the portal on 2026-10-05:

| Portal field | Limit |
|---|---|
| Short description | 50 characters |
| About | 2000 characters |

- Keep the listing text in ASCII. Then characters and bytes agree, and you do not need to guess which one the portal counts.
- Write a test that checks the lengths, so a copy edit cannot break the upload.

## The privacy policy is public

The portal generates the privacy policy and the terms from a form. The form asks for a contact email, a phone number, an address, your permissions, data collection, location, AI and third-party services. You do not need to host a policy.

- Read the generated text and check that it is correct.
- The generated policy is public. Do not put a personal phone number or a home address in the form.

## Manifest checks

`lintManifest` in [packages/testing/src/manifest-lint.ts](../../packages/testing/src/manifest-lint.ts) checks `app.json` against the packaging and review rules we know. Call it from a test, as the probe does:

```ts
import manifest from '../app.json'
import { lintManifest } from '../src/kit/testing/index.ts'

it('passes the manifest lint', () => {
  expect(lintManifest(manifest, { sdkVersion: '0.0.16', usedPermissions: [] })).toEqual([])
})
```

It checks, among other things:
- `package_id` is lowercase reverse-DNS with 2 or more segments.
- `name` is 1 to 20 characters. Review rejects a name that holds "Even" in any case, per Even's submission docs.
- `version` is `x.y.z` with no prefix or suffix.
- Each network whitelist entry is a bare `https://` or `wss://` origin, with no path and no wildcard.
- Every declared permission is used, and every used permission is declared. Review flags a permission you declare and do not use.
