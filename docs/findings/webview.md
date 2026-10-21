# The WebView

A plugin's phone page runs in the Even app's WebView. Some browser features you expect are missing there.

<a id="h22"></a>
## H22: Share, clipboard and mail links fail in the WebView

**Claim.** In the Even app's WebView on iPhone:

| Feature | Result |
|---|---|
| `navigator.share` | Missing |
| `navigator.clipboard.writeText` | Does not copy, and does not throw |
| A link with `target="_blank"` | Opens in Even's own in-app browser. Safari does not open |
| `mailto:` and `sms:` links | Do nothing |
| Copy from a selected textarea with `document.execCommand('copy')` | Works |
| A selectable link on the page | Works. Press and hold it, and iOS shows its own Copy and Share menu |

**Method.** Seen while building the phone page of a reader app. We tried each share and copy path on the phone.

**Setup.** Even app WebView on iPhone, QR sideload, SDK 0.0.16. iOS and Even app versions not recorded.

**Date.** 2026-10-05.

**Confidence.** Seen on one iPhone. Android was not tested.

**For your app.**
- Do not offer a Share button that calls `navigator.share`.
- Copy through a selected textarea first. Fall back to the clipboard API with a timeout, because it can hang with no error.
- Show links as selectable text, so the user can press and hold to copy or share.

The copy pattern that worked:

```ts
async function copyText(text: string): Promise<boolean> {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'
  document.body.append(ta)
  ta.focus()
  ta.setSelectionRange(0, text.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  if (ok) return true
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, fail) => setTimeout(() => fail(new Error('timeout')), 1_000)),
    ])
    return true
  } catch {
    return false
  }
}
```
