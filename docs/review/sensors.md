# Review: switch sensors off at exit

**The rule.** When your app exits, turn off every sensor it turned on. Review rejects an app that leaves one on.

**What it cost.** Review rejected one of our apps for leaving the IMU on after exit.

## The fix

Turn sensors off on the exit events:
- `SYSTEM_EXIT_EVENT`
- `ABNORMAL_EXIT_EVENT`

Call `imuControl(false)` for the IMU, and `audioControl(false)` for the microphone.

Do not turn them off when you open the exit dialog with `shutDownPageContainer(1)`. The user can cancel the dialog, and your app then runs on with its sensors dead.

```ts
import { OsEventTypeList } from '@evenrealities/even_hub_sdk'

bridge.onEvenHubEvent(e => {
  const type = e.sysEvent?.eventType
  if (type === OsEventTypeList.SYSTEM_EXIT_EVENT || type === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    void bridge.imuControl(false).catch(() => false)
    void bridge.audioControl(false).catch(() => false)
  }
})
```

The probe does this through its lifecycle module: see `lc.onExit` in [apps/probe/src/probe.ts](../../apps/probe/src/probe.ts).

## Check it in a test

Drive both exit events in a unit test, and check that the sensor is off. The probe's test uses `FakeBridge` from `@maticsh/testing` (`packages/testing`):

```ts
it('turns the IMU off on both exit events, and not on the exit dialog', async () => {
  for (const exit of ['systemExit', 'abnormalExit'] as const) {
    const bridge = new FakeBridge()
    await run(bridge, harness().env)
    bridge.swipe('up') // the sense page turns the IMU on
    await new Promise(r => setTimeout(r, 0))
    bridge.doubleTap() // the exit dialog opens; the user can still cancel it
    await new Promise(r => setTimeout(r, 0))
    expect(bridge.imu.open).toBe(true)
    bridge[exit]()
    await new Promise(r => setTimeout(r, 0))
    expect(bridge.imu.open).toBe(false)
  }
})
```

Run it with `npm test` in `apps/probe/`.

## Check the cancel path on glass

1. Open your app and turn the sensor on.
2. Double tap to open the exit dialog, then cancel it.
3. Check that the sensor still works.

We know of no way to read the sensor state on glass after the app exits. The unit test above is the check for the exit itself.
