# Even Hub SDK reference (checked against `@evenrealities/even_hub_sdk` 0.0.16 `.d.ts`)

Load this when you need an exact signature, field or enum value. `SKILL.md` has the rules and traps.
If the installed SDK is newer, `node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts` wins.

## Bridge methods

| Method | Returns | Notes |
|---|---|---|
| `waitForEvenAppBridge()` | `Promise<EvenAppBridge>` | Await before any other call. |
| `EvenAppBridge.getInstance()` | `EvenAppBridge` | Sync. Use only after the bridge is ready. |
| `createStartUpPageContainer(c: CreateStartUpPageContainer)` | `Promise<StartUpPageCreateResult>` | Once per launch. |
| `rebuildPageContainer(c: RebuildPageContainer)` | `Promise<boolean>` | Full redraw. Same shape as create. |
| `textContainerUpgrade(c: TextContainerUpgrade)` | `Promise<boolean>` | In-place text. |
| `updateImageRawData(d: ImageRawDataUpdate)` | `Promise<ImageRawDataUpdateResult>` | Serial only. LZ4 in transit (0.0.12+). |
| `shutDownPageContainer(exitMode?: number)` | `Promise<boolean>` | `1` system confirm dialog, `0` immediate. |
| `audioControl(isOpen: boolean, source?: AudioInputSource)` | `Promise<boolean>` | Default source is Glasses. |
| `imuControl(isOpen: boolean, reportFrq?: ImuReportPace)` | `Promise<boolean>` | |
| `getUserInfo()` | `Promise<UserInfo>` | `{ uid, name, avatar, country }` |
| `getDeviceInfo()` | `Promise<DeviceInfo \| null>` | `{ model, sn, status }` |
| `setLocalStorage(key, value)` / `getLocalStorage(key)` | `Promise<boolean>` / `Promise<string>` | Strings only. Missing key gives `''`. |
| `getAppLocation(opts?)` | `Promise<AppLocation \| null>` | `opts: { accuracy, timeoutMs }` |
| `startAppLocationUpdates(opts?)` / `stopAppLocationUpdates()` | `Promise<boolean>` | `opts: { accuracy, intervalMs, distanceFilter }` |
| `pickImageFromAlbum()` / `captureImageFromCamera()` | `Promise<AppImageAsset \| null>` | `{ path, name, mimeType, size, base64 }` |
| `onEvenHubEvent(cb)` | unsubscribe fn | All input, lifecycle, audio, IMU, menu. |
| `onDeviceStatusChanged(cb)` | unsubscribe fn | Not emitted by the simulator. |
| `onAppLocationChanged(cb)` | unsubscribe fn | |
| `onLaunchSource(cb)` | unsubscribe fn | Fires once: `'appMenu' \| 'glassesMenu'`. |
| `callEvenApp(method, params?)` | `Promise<any>` | Raw escape hatch. Every typed method wraps it. |

## Page payloads

```ts
CreateStartUpPageContainer / RebuildPageContainer {
  containerTotalNum: number                 // 1-12, must equal the containers you pass
  textObject?: TextContainerProperty[]      // max 8 (text + list share the 8)
  listObject?: ListContainerProperty[]
  imageObject?: ImageContainerProperty[]    // max 4
  menuObject?: MenuContainerProperty        // 0.0.14+; omitted on rebuild = custom menu cleared
}

// shared by text / list / image
{ xPosition, yPosition, width, height, containerID, containerName /* ≤16 */, zOrderIndex? }

TextContainerProperty  += { content /* ≤1000 */, isEventCapture: 0|1, textColor? /* 0-4 */,
                            borderWidth /* 0-5 */, borderColor /* 0-15 */, borderRadius /* 0-10 */, paddingLength /* 0-32 */ }
ListContainerProperty  += { isEventCapture, border*, paddingLength,
                            itemContainer: { itemCount /* 1-20 */, itemName: string[] /* ≤64 each */,
                                             itemWidth? /* 0 = fill */, isItemSelectBorderEn? /* 0|1 */ } }
ImageContainerProperty    // width 20-288, height 20-144; cannot capture input; empty until updateImageRawData

TextContainerUpgrade  { containerID, containerName, content /* ≤2000 */, contentOffset?, contentLength?, textColor? }
ImageRawDataUpdate    { containerID, containerName, imageData: number[] | Uint8Array | ArrayBuffer | string /* base64 */ }
MenuContainerProperty { menuItems: { itemName /* ≤32 UTF-8 bytes */, itemID /* non-zero uint32, unique */ }[] /* ≤10 */ }
```

Each class takes `Partial<T>` in its constructor. Plain object literals also work.

## Events

```ts
type EvenHubEvent = {
  sysEvent?:  { eventType?, eventSource?: EventSourceType, imuData?: { x?, y?, z? }, systemExitReasonCode? }
  textEvent?: { containerID?, containerName?, eventType? }
  listEvent?: { containerID?, containerName?, currentSelectItemName?, currentSelectItemIndex?, eventType? }
  audioEvent?: { audioPcm: Uint8Array, source: AudioInputSource, direction: number | null, speakerRole: AudioSpeakerRole }
  menuItemClickEvent?: { itemID }
  jsonData?: Record<string, any>   // raw passthrough
}
```

Zero-valued fields arrive as `undefined` (protobuf). That covers `eventType` 0 (tap) and
`currentSelectItemIndex` 0.

## Enums

```ts
OsEventTypeList {
  CLICK_EVENT = 0, SCROLL_TOP_EVENT = 1, SCROLL_BOTTOM_EVENT = 2, DOUBLE_CLICK_EVENT = 3,
  FOREGROUND_ENTER_EVENT = 4, FOREGROUND_EXIT_EVENT = 5, ABNORMAL_EXIT_EVENT = 6, SYSTEM_EXIT_EVENT = 7,
  IMU_DATA_REPORT = 8, LONG_PRESS_EVENT = 9, LONG_PRESS_RELEASE_EVENT = 10
}
EventSourceType { TOUCH_EVENT_FORM_DUMMY_NULL = 0, TOUCH_EVENT_FROM_GLASSES_R = 1, TOUCH_EVENT_FROM_RING = 2, TOUCH_EVENT_FROM_GLASSES_L = 3 }
StartUpPageCreateResult { success = 0, invalid = 1, oversize = 2, outOfMemory = 3 }
ImageRawDataUpdateResult { success, imageException, imageSizeInvalid, imageToGray4Failed, sendFailed }   // string values
AudioInputSource { Glasses = 'glasses', Phone = 'phone' }
AudioSpeakerRole { Self = 'self', Other = 'other', Unknown = 'unknown' }
AppLocationAccuracy { Low = 'low', Medium = 'medium', High = 'high' }
ImuReportPace { P100 = 100, P200, …, P1000 = 1000 }   // on a G2: ms between samples (docs/findings/sensors.md#h13)
DeviceModel { G1 = 'g1', G2 = 'g2', Ring1 = 'ring1' }
DeviceConnectType { None, Connecting, Connected, Disconnected, ConnectionFailed }
EvenHubPageContainerValidationErrorCode {
  MISSING_Z_ORDER_INDEX, INVALID_Z_ORDER_INDEX, DUPLICATE_Z_ORDER_INDEX,
  TOO_MANY_MENU_ITEMS, INVALID_MENU_ITEM_ID, DUPLICATE_MENU_ITEM_ID, INVALID_MENU_ITEM_NAME,
  INVALID_TEXT_BRIGHTNESS
}
```

`DeviceStatus` carries `sn`, `connectType`, `isWearing?`, `batteryLevel?` (0-100), `isCharging?`,
`isInCase?`, and the helpers `isConnected()`, `isConnecting()`, `isDisconnected()`, `isConnectionFailed()`, `isNone()`.

## Validation helpers (run them in unit tests)

`validateEvenHubPageContainer(page)`, `validateEvenHubPageContainerZOrder`, `validateEvenHubPageContainerMenu`,
`validateEvenHubPageContainerTextBrightness` return `{ valid: true } | { valid: false, code, message, container? }`.
`formatEvenHubPageContainerValidationError(result)` gives a readable message. `utf8ByteLength`,
`isMenuNameWithinLimit`, `isValidMenuItemID` and `isValidTextBrightness` are exported too. The SDK
runs these checks before it calls native. A failed check makes create return `invalid` and rebuild
return `false`, and nothing reaches the glasses.

## Simulator automation API (`--automation-port 9898`)

| Endpoint | Behaviour |
|---|---|
| `GET /api/ping` | `pong` |
| `GET /api/screenshot/glasses` | 576 x 288 RGBA PNG of the framebuffer. Every lit pixel is RGB (0,255,0); brightness is in alpha. Test `alpha > 0`. Never convert to RGB. |
| `GET /api/screenshot/webview` | PNG of the phone-side page (html2canvas, 10 s timeout). |
| `GET /api/console[?since_id=N]` | `{ entries: [{ id, level, message, ts }], total }`. Prefixes: `[uncaught]`, `[unhandledrejection]`, `[fetch]`. `since_id` must be ≥ 0, so omit it on the first poll. |
| `DELETE /api/console` | Clears the buffer. Read the boot logs first, because they appear once. |
| `POST /api/input {"action": …}` | `up`, `down`, `click`, `double_click`, `context_menu` (toggles), `long_press`, `long_press_release` (send as a pair). Anything else returns 400. Input sent before a capturing container exists is dropped silently. |

No shutdown endpoint. Kill the process in teardown. Assert on framebuffer changes, not on sleeps.
A rebuild under an open menu leaves the old overlay on screen.

## Host push format (for fakes and tests)

The host posts messages into the WebView. The SDK parses all three event shapes:

```js
{ type: 'listen_even_app_data', method: 'evenHubEvent', data: { type: 'listEvent', jsonData: {...} } }
{ type: 'listen_even_app_data', method: 'evenHubEvent', data: { type: 'list_event', data: {...} } }
{ type: 'listen_even_app_data', method: 'evenHubEvent', data: ['list_event', {...}] }
{ type: 'listen_even_app_data', method: 'deviceStatusChanged', data: { sn, connectType, isWearing, batteryLevel, isCharging } }
{ method: 'evenAppLaunchSource', data: { launchSource: 'appMenu' } }
{ method: 'appLocationChanged', data: { latitude, longitude, accuracy, timestamp } }
```

Native calls go out through `window.flutter_inappwebview.callHandler`. Outside the Even app or the
simulator, the bridge throws `Flutter handler not available`. Inject a fake bridge for browser-only
unit tests. `FakeBridge` in `@maticsh/testing` is one (not on npm yet; see https://github.com/maticsh/matic-even).
