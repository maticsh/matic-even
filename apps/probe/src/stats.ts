/** Heartbeat stats for the long-session test. Pure, so the gap logic is testable. */
export type Beats = { launchedAt: number; lastBeat: number; beats: number; gaps: number; maxGapMs: number }

export const BEAT_MS = 5_000
/** A gap this long means the WebView or its timers were suspended. */
export const GAP_MS = 15_000

export function fresh(now: number): Beats {
  return { launchedAt: now, lastBeat: now, beats: 0, gaps: 0, maxGapMs: 0 }
}

export function beat(s: Beats, now: number): Beats {
  const gap = now - s.lastBeat
  return {
    ...s,
    lastBeat: now,
    beats: s.beats + 1,
    gaps: s.gaps + (gap > GAP_MS ? 1 : 0),
    maxGapMs: Math.max(s.maxGapMs, gap),
  }
}

export function isBeats(raw: unknown): raw is Beats {
  const r = raw as Beats
  return ['launchedAt', 'lastBeat', 'beats', 'gaps', 'maxGapMs'].every(k => typeof r?.[k as keyof Beats] === 'number')
}

/** 75_000 → "1:15", 3_725_000 → "1:02:05". */
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`
}

/** Local wall-clock time, "14:05:09". */
export function clock(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8)
}

export type ProbeState = {
  run: Beats
  prev: Beats | null
  wearing: boolean | null
  wearingChangedAt: number | null
  battery: number | null
  /** Raw lifecycle events, oldest first, exactly as they arrived. */
  events: { kind: 'enter' | 'exit' | 'sysExit'; at: number }[]
  image: string
}

const EVENT_LABEL = { enter: 'in', exit: 'out', sysExit: 'quit' } as const

/** The last few raw events with their age: "ev: in 12s · out 8s · in 2s". */
export function eventLine(events: ProbeState['events'], now: number, last = 3): string {
  if (events.length === 0) return 'ev: none yet'
  const shown = events.slice(-last).map(e => `${EVENT_LABEL[e.kind]} ${Math.max(0, Math.round((now - e.at) / 1000))}s`)
  return `ev: ${shown.join(' · ')}`
}

/** The full event log for the phone screen, with wall-clock times. */
export function eventLog(events: ProbeState['events']): string {
  return events.map(e => `${clock(e.at)}  ${e.kind}`).join('\n')
}

/** The body text on the glasses. Six lines, so it never scrolls. */
export function body(s: ProbeState, now: number): string {
  const r = s.run
  const prev = s.prev
    ? `prev: up ${duration(s.prev.lastBeat - s.prev.launchedAt)}, died ~${clock(s.prev.lastBeat)}`
    : 'prev: none'
  const wear = s.wearing === null ? 'wearing: no data' :
    `wearing: ${s.wearing ? 'yes' : 'no'}${s.wearingChangedAt ? ` since ${clock(s.wearingChangedAt)}` : ''}`
  return [
    `beats ${r.beats} · gaps ${r.gaps} · max ${duration(r.maxGapMs)}`,
    `last beat ${duration(now - r.lastBeat)} ago`,
    `${wear}${s.battery === null ? '' : ` · bat ${s.battery}%`}`,
    eventLine(s.events, now),
    `image: ${s.image}`,
    prev,
  ].join('\n')
}
