# Lifecycle and the phone

Foreground events, OS overlays, and how long a plugin keeps running.

Open questions here: [P3](../probes/P3.md) (a 30-minute lock) and [P8](../probes/P8.md) (what fires when the phone backgrounds the Even app).

<a id="h7"></a>
## H7: OS overlays fire foreground events: ENTER on open, EXIT on close

**Claim.**
- The OS has two overlays that sit over a plugin:
  - The contextual menu. The user taps, then holds.
  - The exit dialog. The user double taps, and the app calls `shutDownPageContainer(1)`.
- Both overlays fire foreground events. The page stays mounted under both.
- Opening an overlay fires `FOREGROUND_ENTER_EVENT`. Closing it fires `FOREGROUND_EXIT_EVENT`. This matches Even's docs.

**Method.** Probe main page, probe 0.1.2. The probe logs every raw foreground event, with its time, before any lifecycle code sees it. The phone page shows the full list. Open and close each overlay, then read the order.

The first version of the probe counted events after its lifecycle module. That module ignored an ENTER while the app was already active, so the counters hid the real order. Log raw events before any filter.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.2, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Confirmed with the raw event log.

**For your app.**
- Treat every foreground event, in either direction, as a checkpoint. Save state, then re-arm sockets, audio and location. Make that work cheap and safe to repeat.
- Never map EXIT to pause and ENTER to resume. With overlays, that mapping pauses your app when the menu closes, just as the user comes back to it. Matic's kit had this bug until this probe found it.
- Clean up on the exit events (`SYSTEM_EXIT_EVENT`, `ABNORMAL_EXIT_EVENT`). Do not clean up when you open the exit dialog, because the user can cancel it ([review/sensors.md](../review/sensors.md)).
- The contextual menu is a fifth input for rare actions. Your page sets its items. The probe uses it for its extra pages. An action bar can point at it with `● ●━`.
- `packages/glasses/src/infra/lifecycle.ts` is one small module that handles the checkpoints and the exit events.

<a id="h10"></a>
## H10: A sideload runs without gaps with the phone unlocked

**Claim.** Over one sideload session with the phone unlocked, the probe's 5 s heartbeat had 0 gaps. The longest interval between beats was 8 s.

**Method.** Probe main page. A timer beats every 5 s. A gap is any interval over 15 s, which means the WebView or its timers were suspended. The probe stores its stats, so a relaunch shows how long the last run lived.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.x, QR sideload, iPhone, phone unlocked. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** One session. Its length was not recorded.

**For your app.** With the phone unlocked, timers keep running. Expect some jitter: one interval of 5 s stretched to 8 s.

<a id="h15"></a>
## H15: A QR sideload kept running for 18 minutes with the iPhone locked

**Claim.** A QR sideload ran for 18 min with the phone locked. In that time:
- A sprite frame went out every 5 s: 184 frames, 0 failed.
- IMU samples kept arriving.
- The probe kept posting its log to the dev server over the network.

Even's docs say a QR sideload dies when the phone locks. This run contradicts that on an iPhone. It is a partial answer to [P3](../probes/P3.md).

**Method.** Probe Sense page, phone locked, CSV log streaming to the dev server.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.3, QR sideload, iPhone, phone locked. Firmware and iOS version not recorded.

**Date.** 2026-10-03.

**Confidence.** One run, one iPhone. Android was not tested.

**For your app.**
- A lock of 18 min did not stop a sideload on an iPhone. Longer locks are untested, so save state on every checkpoint.
- Store review locks the phone for 5 min. Test the lock with the build you ship.
