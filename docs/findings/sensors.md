# Sensors

The wearing sensor and the IMU.

Store review rejects an app that leaves a sensor on at exit. See [review/sensors.md](../review/sensors.md).

<a id="h6"></a>
## H6: The wearing sensor reports while a plugin is open

**Claim.** `onDeviceStatusChanged` reports `isWearing` going off and on while a plugin is open. We did not time the latency ([probe P4](../probes/P4.md)).

**Method.** Probe main page. Take the glasses off for 10 s, then put them back on. The page shows the wearing state and the time it changed.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.x, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Seen once.

**For your app.** The sensor works, but only when the user has wear detection on. Read [H17](#h17-wear-detection-is-a-user-setting) first.

<a id="h17"></a>
## H17: Wear detection is a user setting

**Claim.** Wear detection is a setting the user controls. With it off, `isWearing` reports false from the start and never changes.

**Method.** Probe main page, with wear detection off in the tester's settings.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.x, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** Seen on one pair of glasses.

**For your app.**
- Never depend on the wearing sensor.
- Use the IMU as a fallback. Glasses on a desk read dead still, at a new resting tilt ([H14](#h14-the-imu-can-tell-what-the-wearer-is-doing-even-at-1-hz)).

<a id="h13"></a>
## H13: The IMU is an accelerometer in g

**Claim.**
- `imuControl(true, pace)` works on the G2. The simulator refuses it.
- x, y and z are an accelerometer in g. The length of the vector is 1.0 at rest.
- x is head pitch. Positive x means the wearer looks up. Negative x means the wearer looks down.
- Pace is the gap between samples in ms, exactly: 100 gives 10 Hz, 200 gives 5 Hz, 500 gives 2 Hz, 1000 gives 1 Hz.

**Method.** Probe Sense page. Swipe up from the main page to turn the IMU on at pace 100. Swipe down to step through the paces. The page shows live x, y, z and the measured sample rate. Every sample streams to a CSV log on the dev server. One run of 18 min.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.3, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** One 18-minute run.

**For your app.**
- Test IMU code on glass. The simulator will not run it.
- Turn the IMU on only after your first page is mounted. The SDK refuses it before a page exists.
- The bridge drops zero values on the wire, so a missing axis means 0.
- Turn the IMU off on the exit events ([review/sensors.md](../review/sensors.md)).

<a id="h14"></a>
## H14: The IMU can tell what the wearer is doing, even at 1 Hz

**Claim.** Simple statistics on the accelerometer separate common activities. The measure below is the sum of the standard deviations of x, y and z over a 10 s window.

| Activity | Motion (sum of SDs, 10 s window) |
|---|---|
| Sitting still | 0.01 to 0.06 |
| Typing | 0.03 to 0.10 |
| Standing up, sitting down, walking | 0.3 to 0.9 |

| Head position | Pitch |
|---|---|
| Looking up | +16° to +30° |
| Looking down at a phone | −23° to −43° |

- Glasses off on a desk read dead still, at a new resting tilt.
- At 1 Hz, the log was enough to find a short seated break away from the desk, to the second. Its pattern: a large jolt, 40 s still with the head down, a heave, then a walk. We found the pattern by reading the CSV afterward.
- One IMU dropout of 29 s happened while the app kept running. The cause is unknown ([probe P12](../probes/P12.md)).

**Method.** Probe Sense page, following the IMU script in [apps/probe/README.md](../../apps/probe/README.md#the-imu-script). A long press marks the log at the start of each step. We analysed the CSV log afterward. Pitch angles come from the accelerometer vector.

**Setup.** Even G2, SDK 0.0.16, probe 0.1.3, QR sideload, iPhone. Firmware not recorded.

**Date.** 2026-10-03.

**Confidence.** One run, one wearer.

**For your app.**
- Pace 1000 (1 Hz) is enough to tell looking up, looking down, sitting still and moving apart.
- At slow paces, judge stillness over a window of about 10 s. At 1 Hz, a 1 s window holds one sample.
- The probe's `STILL_BELOW` threshold of 0.05 sits at the top of the still range.
