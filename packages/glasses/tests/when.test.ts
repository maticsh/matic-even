import { describe, expect, it } from 'vitest'
import { ageBucket, dayKey, daysAgo, startOfDay, timeLabel } from '../src/domain/when.ts'

// Local times, so the tests hold in any time zone.
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()
const NOW = at(2026, 10, 4, 16, 30)   // Sunday afternoon

describe('when', () => {
  it('keys a local day', () => {
    expect(dayKey(at(2026, 10, 4, 0, 1))).toBe('2026-10-04')
    expect(dayKey(at(2026, 1, 9, 23, 59))).toBe('2026-01-09')
    expect(startOfDay(at(2026, 10, 4, 18))).toBe(at(2026, 10, 4, 0))
  })

  it('counts calendar days, so 11 pm yesterday is one day ago', () => {
    expect(daysAgo(at(2026, 10, 3, 23, 50), at(2026, 10, 4, 0, 10))).toBe(1)
    expect(daysAgo(at(2026, 10, 4, 0, 5), NOW)).toBe(0)
    expect(daysAgo(at(2026, 10, 5, 9), NOW)).toBe(0)   // a clock slightly ahead reads as today
  })

  it('buckets today, yesterday, the week, and earlier', () => {
    expect(ageBucket(at(2026, 10, 4, 8), NOW)).toBe('today')
    expect(ageBucket(at(2026, 10, 3, 8), NOW)).toBe('yesterday')
    expect(ageBucket(at(2026, 10, 2), NOW)).toBe('last week')
    expect(ageBucket(at(2026, 9, 28), NOW)).toBe('last week')
    expect(ageBucket(at(2026, 9, 27), NOW)).toBe('earlier')
  })

  it('labels times the way the glasses say them', () => {
    expect(timeLabel(at(2026, 10, 4, 15, 50), NOW)).toBe('3:50 pm')
    expect(timeLabel(at(2026, 10, 4, 0, 5), NOW)).toBe('12:05 am')
    expect(timeLabel(at(2026, 10, 4, 12, 0), NOW)).toBe('12:00 pm')
    expect(timeLabel(at(2026, 10, 3, 9), NOW)).toBe('yesterday')
    expect(timeLabel(at(2026, 9, 29), NOW)).toBe('tue')
    expect(timeLabel(at(2026, 9, 27), NOW)).toBe('sep 27')
    expect(timeLabel(at(2025, 12, 31), NOW)).toBe('dec 31 2025')
  })

  it('crosses daylight saving without slipping a day', () => {
    // US DST ends 2026-11-01; Europe 2026-10-25. Either way, counting stays by calendar.
    expect(daysAgo(at(2026, 10, 31, 12), at(2026, 11, 2, 12))).toBe(2)
    expect(daysAgo(at(2026, 10, 24, 12), at(2026, 10, 26, 12))).toBe(2)
  })
})
