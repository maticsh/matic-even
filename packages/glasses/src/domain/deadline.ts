/**
 * Phased timers on the wall clock. State is plain JSON, so it survives storage and a cold start.
 * Every query takes `now`, so suspension never causes drift and tests need no fake timers.
 */
export type Phase<K extends string = string> = { kind: K; ms: number }

export type Timeline<K extends string = string> = {
  phases: Phase<K>[]
  startedAt: number
  pausedAt: number | null
  pausedMs: number
}

export type Position<K extends string = string> =
  | { done: false; index: number; phase: Phase<K>; elapsedMs: number; remainingMs: number; fraction: number; paused: boolean }
  | { done: true; index: number }

export function start<K extends string>(phases: Phase<K>[], now: number): Timeline<K> {
  return { phases, startedAt: now, pausedAt: null, pausedMs: 0 }
}

function activeMs(t: Timeline, now: number): number {
  const until = t.pausedAt ?? now
  return Math.max(0, until - t.startedAt - t.pausedMs)
}

export function pause<K extends string>(t: Timeline<K>, now: number): Timeline<K> {
  return t.pausedAt === null ? { ...t, pausedAt: now } : t
}

export function resume<K extends string>(t: Timeline<K>, now: number): Timeline<K> {
  return t.pausedAt === null ? t : { ...t, pausedAt: null, pausedMs: t.pausedMs + (now - t.pausedAt) }
}

/** Where the timeline is at `now`. Rolls forward across any number of phases that elapsed meanwhile. */
export function position<K extends string>(t: Timeline<K>, now: number): Position<K> {
  let left = activeMs(t, now)
  for (let i = 0; i < t.phases.length; i++) {
    const phase = t.phases[i]!
    if (left < phase.ms) {
      return {
        done: false, index: i, phase, elapsedMs: left, remainingMs: phase.ms - left,
        fraction: phase.ms === 0 ? 1 : left / phase.ms, paused: t.pausedAt !== null,
      }
    }
    left -= phase.ms
  }
  return { done: true, index: t.phases.length }
}

/** Milliseconds until the current phase ends, for scheduling the next check. Null when paused or done. */
export function msToBoundary(t: Timeline, now: number): number | null {
  const p = position(t, now)
  return p.done || p.paused ? null : p.remainingMs
}

/** Jump to the start of the next phase. */
export function skip<K extends string>(t: Timeline<K>, now: number): Timeline<K> {
  const p = position(t, now)
  return p.done ? t : { ...t, startedAt: t.startedAt - p.remainingMs }
}
