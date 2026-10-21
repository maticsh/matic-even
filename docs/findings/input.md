# Input

Taps, swipes and presses on the temples, and which of them reach your app.

The OS menu (tap, then hold) and the exit dialog (double tap) are in [lifecycle.md](lifecycle.md#h7-os-overlays-fire-foreground-events-enter-on-open-exit-on-close).

<a id="h11"></a>
## H11: Quick repeated taps become a double tap

**Claim.** The glasses read quick repeated taps as a double tap. On the root page a double tap opens the exit dialog. So a triple tap never reaches the app as three taps.

**Method.** Observation on glass with the probe.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.x, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Seen once.

**For your app.**
- Never ask for quick repeated taps.
- Cycling through options by tapping works only when each tap waits for the last one to finish.

<a id="h12"></a>
## H12: One long swipe can arrive as several scroll events

**Claim.** One long swipe can arrive as several scroll events. A screen that changes on swipe then flips more than once. Only a very short swipe gives exactly one event.

**Method.** Seen in one of Matic's apps on glass. Not measured with the probe.

**Setup.** Even G2, SDK 0.0.16, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Seen in use. Not measured. The event count and spacing per swipe are unknown.

**For your app.** Gate swipes: act on the first event, then ignore swipes for about 700 ms. A sketch:

```ts
/** Let one event through, then ignore the rest for `ms`. */
export function createGate(ms: number): (now: number) => boolean {
  let last = -Infinity
  return now => {
    if (now - last < ms) return false
    last = now
    return true
  }
}

const swipeGate = createGate(700)
// In your event handler: if (swipeGate(Date.now())) nextScreen()
```

<a id="h16"></a>
## H16: A plain long press reaches the app

**Claim.** A plain press and hold reaches the plugin as `LONG_PRESS_EVENT`, then `LONG_PRESS_RELEASE_EVENT`. The event source is the right temple. The OS does not take this gesture. (Tap, then hold, is a different gesture: it opens the OS menu, [H7](lifecycle.md#h7-os-overlays-fire-foreground-events-enter-on-open-exit-on-close).) The probe timed presses of 2.0 to 3.7 s correctly.

**Method.** Probe Sense page (swipe up from the main page). It counts presses, shows the source, and times each press from press to release.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.3, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Several presses.

**For your app.** Read [H19](#h19-users-can-take-long-press-for-a-system-action) before you use long press.

<a id="h19"></a>
## H19: Users can take long press for a system action

**Claim.** Users can bind a temple's long press to a system action. On the tester's glasses, a long press on the left temple starts Even AI. So an app cannot count on a long press reaching it.

**Method.** Observation from daily wear, in the Even app's settings.

**Setup.** Even G2, Even app on iPhone. Versions not recorded.

**Date.** 2026-10-04.

**Confidence.** One wearer's settings.

**For your app.**
- Do not make any feature depend on long press. Treat it as unavailable.
- A long press is fine as a debug marker in a test tool. The probe uses one to mark its log ([apps/probe/README.md](../../apps/probe/README.md#mark-the-log-with-a-long-press)).
- For rare actions, use the OS menu (tap, then hold). Your page sets its items ([H7](lifecycle.md#h7-os-overlays-fire-foreground-events-enter-on-open-exit-on-close)).
