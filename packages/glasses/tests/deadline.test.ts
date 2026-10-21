import { describe, expect, it } from 'vitest'
import { msToBoundary, pause, position, resume, skip, start } from '../src/domain/deadline.ts'

const MIN = 60_000
const pomodoro = [
  { kind: 'focus', ms: 25 * MIN },
  { kind: 'break', ms: 5 * MIN },
  { kind: 'focus', ms: 25 * MIN },
] as const

describe('deadline', () => {
  const t0 = start([...pomodoro], 1_000)

  it('reports the current phase and what is left', () => {
    const p = position(t0, 1_000 + 10 * MIN)
    expect(p).toMatchObject({ done: false, index: 0, remainingMs: 15 * MIN, fraction: 0.4, paused: false })
  })

  it('rolls forward over phases that elapsed while suspended', () => {
    expect(position(t0, 1_000 + 31 * MIN)).toMatchObject({ index: 2, elapsedMs: 1 * MIN })
    expect(position(t0, 1_000 + 999 * MIN)).toEqual({ done: true, index: 3 })
  })

  it('freezes while paused and excludes paused time after resume', () => {
    const paused = pause(t0, 1_000 + 10 * MIN)
    expect(position(paused, 1_000 + 50 * MIN)).toMatchObject({ index: 0, remainingMs: 15 * MIN, paused: true })
    expect(msToBoundary(paused, 1_000 + 50 * MIN)).toBeNull()
    const resumed = resume(paused, 1_000 + 50 * MIN)
    expect(position(resumed, 1_000 + 51 * MIN)).toMatchObject({ index: 0, remainingMs: 14 * MIN, paused: false })
  })

  it('pause and resume are idempotent', () => {
    const once = pause(t0, 5)
    expect(pause(once, 99)).toBe(once)
    expect(resume(t0, 99)).toBe(t0)
  })

  it('skips to the start of the next phase', () => {
    const skipped = skip(t0, 1_000 + 10 * MIN)
    expect(position(skipped, 1_000 + 10 * MIN)).toMatchObject({ index: 1, elapsedMs: 0 })
  })

  it('survives a JSON round trip, as it would through storage', () => {
    const restored = JSON.parse(JSON.stringify(pause(t0, 1_000 + MIN)))
    expect(position(restored, 1_000 + 9 * MIN)).toMatchObject({ remainingMs: 24 * MIN, paused: true })
  })
})
