/**
 * Numbers for the sense page: IMU (H13, H14), display and battery cost (P10) and long press (H16).
 * Pure, so the maths is testable without a bridge.
 */
import { duration } from './stats.ts'

/** IMU report paces to compare. The SDK allows 100 to 1000 in steps of 100. Pace is ms between samples (H13). */
export const PACES = [100, 200, 500, 1000] as const
export type Pace = (typeof PACES)[number]
export const nextPace = (p: Pace): Pace => PACES[(PACES.indexOf(p) + 1) % PACES.length]!

export type Sample = { t: number; x: number; y: number; z: number }

/** Motion under this reads as "still". It sits at the top of the measured still range (H14). */
export const STILL_BELOW = 0.05
/** The window for motion and rate. At slow paces, judge stillness over ~10 s instead (H14). */
export const WINDOW_MS = 1_000
/** The edge sprite changes frame this often, like a slow breath. */
export const FRAME_MS = 5_000

/** The sum of the standard deviations of x, y and z over the last window, or null with under 2 samples. */
export function motion(samples: Sample[], now: number, windowMs = WINDOW_MS): number | null {
  const w = samples.filter(s => now - s.t <= windowMs)
  if (w.length < 2) return null
  const sd = (k: 'x' | 'y' | 'z') => {
    const mean = w.reduce((a, s) => a + s[k], 0) / w.length
    return Math.sqrt(w.reduce((a, s) => a + (s[k] - mean) ** 2, 0) / w.length)
  }
  return sd('x') + sd('y') + sd('z')
}

/** Samples per second, measured over the span of the last 5 s of samples. */
export function rate(samples: Sample[], now: number, windowMs = 5_000): number | null {
  const w = samples.filter(s => now - s.t <= windowMs)
  if (w.length < 2) return null
  const span = w[w.length - 1]!.t - w[0]!.t
  return span > 0 ? ((w.length - 1) * 1000) / span : null
}

/** One line of the log the dev server collects. `value` holds the pace, a press length or a battery level. */
export type Row = {
  t: number
  kind: 'imu' | 'hold' | 'release' | 'pace' | 'imuOff' | 'battery' | 'frame' | 'frameFail' | 'wearing'
  x?: number
  y?: number
  z?: number
  value?: number | string
}

export const CSV_HEADER = 't_ms,kind,x,y,z,value'

export function toCsv(rows: Row[]): string {
  return rows.map(r => [r.t, r.kind, r.x ?? '', r.y ?? '', r.z ?? '', r.value ?? ''].join(',')).join('\n')
}

export type SenseState = {
  imuOn: boolean
  pace: Pace
  samples: Sample[]
  last: Sample | null
  holds: { count: number; pressedAt: number | null; lastMs: number | null; source: string }
  battery: { start: number | null; startAt: number }
  frames: { sent: number; failed: number }
  log: { rows: number; sent: number; failed: number }
}

export function freshSense(now: number): SenseState {
  return {
    imuOn: false, pace: 100, samples: [], last: null,
    holds: { count: 0, pressedAt: null, lastMs: null, source: '' },
    battery: { start: null, startAt: now },
    frames: { sent: 0, failed: 0 },
    log: { rows: 0, sent: 0, failed: 0 },
  }
}

const n2 = (v: number) => (v >= 0 ? ' ' : '') + v.toFixed(2)

/** The sense page body. Six lines, so it never scrolls. */
export function senseBody(s: SenseState, battery: number | null, now: number): string {
  const r = rate(s.samples, now)
  const m = motion(s.samples, now)
  const xyz = s.last ? `x ${n2(s.last.x)}  y ${n2(s.last.y)}  z ${n2(s.last.z)}` : 'x y z: no samples yet'
  const feel = m === null ? 'motion: -' : `motion ${m.toFixed(3)} · ${m < STILL_BELOW ? 'still' : 'moving'}`
  const hold = s.holds.pressedAt !== null ? `hold ${s.holds.count} · pressing ${s.holds.source}`
    : `hold ${s.holds.count}${s.holds.lastMs === null ? '' : ` · last ${(s.holds.lastMs / 1000).toFixed(1)} s ${s.holds.source}`}`
  const drop = battery !== null && s.battery.start !== null
    ? ` · ${battery - s.battery.start >= 0 ? '+' : ''}${battery - s.battery.start}% in ${duration(now - s.battery.startAt)}` : ''
  return [
    `imu ${s.imuOn ? 'on' : 'off'} · pace ${s.pace} · ${r === null ? '-' : r.toFixed(1)}/s`,
    xyz,
    feel,
    hold,
    `bat ${battery ?? '-'}%${drop}`,
    `frames ${s.frames.sent} (${s.frames.failed} failed) · log ${s.log.sent}/${s.log.rows}`,
  ].join('\n')
}
