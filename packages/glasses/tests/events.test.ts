import { describe, expect, it } from 'vitest'
import { OsEventTypeList as T, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { toIntent } from '../src/domain/events.ts'

const ev = (e: Record<string, unknown>) => e as EvenHubEvent

describe('toIntent', () => {
  it('reads a tap with no eventType as a tap (protobuf drops zero)', () => {
    expect(toIntent(ev({ sysEvent: {} }))).toEqual({ kind: 'tap', source: 'unknown' })
    expect(toIntent(ev({ textEvent: {} }))).toEqual({ kind: 'tap', source: 'unknown' })
  })

  it('never reads an audio frame as a tap', () => {
    const pcm = new Uint8Array([1, 2])
    expect(toIntent(ev({ audioEvent: { audioPcm: pcm } }))).toEqual({ kind: 'audio', pcm })
  })

  it('returns null for an empty event', () => {
    expect(toIntent(ev({}))).toBeNull()
  })

  it('maps list index 0, which arrives as undefined', () => {
    expect(toIntent(ev({ listEvent: { currentSelectItemName: 'First' } })))
      .toEqual({ kind: 'listSelect', index: 0, name: 'First' })
  })

  it('reads swipes on the text envelope', () => {
    expect(toIntent(ev({ textEvent: { eventType: T.SCROLL_BOTTOM_EVENT } })))
      .toEqual({ kind: 'scrollBottom', source: 'unknown' })
  })

  it('prefers an explicit double tap over the click fallback', () => {
    expect(toIntent(ev({ sysEvent: { eventType: T.DOUBLE_CLICK_EVENT, eventSource: 2 }, textEvent: {} })))
      .toEqual({ kind: 'doubleTap', source: 'ring' })
  })

  it('maps lifecycle, long press and menu events', () => {
    expect(toIntent(ev({ sysEvent: { eventType: T.FOREGROUND_EXIT_EVENT } }))).toEqual({ kind: 'foregroundExit' })
    expect(toIntent(ev({ sysEvent: { eventType: T.ABNORMAL_EXIT_EVENT } }))).toEqual({ kind: 'exit', abnormal: true })
    expect(toIntent(ev({ sysEvent: { eventType: T.LONG_PRESS_EVENT, eventSource: 3 } })))
      .toEqual({ kind: 'longPress', source: 'left' })
    expect(toIntent(ev({ menuItemClickEvent: { itemID: 7 } }))).toEqual({ kind: 'menu', itemID: 7 })
  })

  it('passes IMU samples through', () => {
    expect(toIntent(ev({ sysEvent: { eventType: T.IMU_DATA_REPORT, imuData: { x: 1, y: 2, z: 3 } } })))
      .toEqual({ kind: 'imu', x: 1, y: 2, z: 3 })
  })

  it('reads a dropped IMU axis as 0', () => {
    expect(toIntent(ev({ sysEvent: { eventType: T.IMU_DATA_REPORT, imuData: { y: -0.5 } } })))
      .toEqual({ kind: 'imu', x: 0, y: -0.5, z: 0 })
  })
})
