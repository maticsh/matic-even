import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

/** Which physical surface produced a gesture. The simulator always reports 'right'. */
export type GestureSource = 'right' | 'left' | 'ring' | 'unknown'

/** One user or lifecycle signal, after the SDK envelope quirks are resolved. */
export type Intent =
  | { kind: 'tap'; source: GestureSource }
  | { kind: 'doubleTap'; source: GestureSource }
  | { kind: 'scrollTop'; source: GestureSource }
  | { kind: 'scrollBottom'; source: GestureSource }
  | { kind: 'longPress'; source: GestureSource }
  | { kind: 'longPressRelease'; source: GestureSource }
  | { kind: 'listSelect'; index: number; name?: string }
  | { kind: 'menu'; itemID: number }
  | { kind: 'audio'; pcm: Uint8Array }
  | { kind: 'imu'; x: number; y: number; z: number }
  | { kind: 'foregroundEnter' }
  | { kind: 'foregroundExit' }
  | { kind: 'exit'; abnormal: boolean }

const SOURCES: Record<number, GestureSource> = { 1: 'right', 2: 'ring', 3: 'left' }

// Protobuf drops zero values, so a tap (CLICK_EVENT = 0) arrives with no eventType.
// Default it only when the envelope exists, or every audio frame reads as a tap.
function typeOf(env?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  return env ? (env.eventType ?? OsEventTypeList.CLICK_EVENT) : null
}

/**
 * Map a raw bridge event to one Intent, or null when it carries nothing we act on.
 * Taps can arrive on sysEvent or textEvent depending on the source, so both are read.
 */
export function toIntent(e: EvenHubEvent): Intent | null {
  if (e.audioEvent) return { kind: 'audio', pcm: e.audioEvent.audioPcm }
  if (e.menuItemClickEvent?.itemID) return { kind: 'menu', itemID: e.menuItemClickEvent.itemID }
  if (e.listEvent && e.listEvent.eventType === undefined) {
    return { kind: 'listSelect', index: e.listEvent.currentSelectItemIndex ?? 0, name: e.listEvent.currentSelectItemName }
  }

  const sys = typeOf(e.sysEvent)
  const txt = typeOf(e.textEvent)
  const is = (t: OsEventTypeList) => sys === t || txt === t
  const source = SOURCES[e.sysEvent?.eventSource ?? 0] ?? 'unknown'

  switch (sys) {
    case OsEventTypeList.FOREGROUND_ENTER_EVENT: return { kind: 'foregroundEnter' }
    case OsEventTypeList.FOREGROUND_EXIT_EVENT: return { kind: 'foregroundExit' }
    case OsEventTypeList.SYSTEM_EXIT_EVENT: return { kind: 'exit', abnormal: false }
    case OsEventTypeList.ABNORMAL_EXIT_EVENT: return { kind: 'exit', abnormal: true }
    case OsEventTypeList.IMU_DATA_REPORT: {
      // Protobuf drops zero values here too, so a missing axis reads 0.
      const d = e.sysEvent?.imuData
      return { kind: 'imu', x: d?.x ?? 0, y: d?.y ?? 0, z: d?.z ?? 0 }
    }
    case OsEventTypeList.LONG_PRESS_EVENT: return { kind: 'longPress', source }
    case OsEventTypeList.LONG_PRESS_RELEASE_EVENT: return { kind: 'longPressRelease', source }
  }

  // Explicit non-zero types first. CLICK is the fallback value, so it goes last.
  if (is(OsEventTypeList.DOUBLE_CLICK_EVENT)) return { kind: 'doubleTap', source }
  if (is(OsEventTypeList.SCROLL_TOP_EVENT)) return { kind: 'scrollTop', source }
  if (is(OsEventTypeList.SCROLL_BOTTOM_EVENT)) return { kind: 'scrollBottom', source }
  if (is(OsEventTypeList.CLICK_EVENT)) return { kind: 'tap', source }
  return null
}
