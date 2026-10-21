/**
 * Calendar days in local time: day keys, age buckets and short lowercase time labels
 * ("3:50 pm", "yesterday", "tue", "sep 28"). The pixel font has lowercase letters only.
 * Days are counted by the calendar, not in 24-hour steps, so DST and late-night items land right.
 */

export type AgeBucket = 'today' | 'yesterday' | 'last week' | 'earlier'
export const AGE_BUCKETS: readonly AgeBucket[] = ['today', 'yesterday', 'last week', 'earlier']

const DAY_MS = 86_400_000
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** "2026-10-04" for the local day that holds `ms`. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Local midnight at the start of the day that holds `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole calendar days from `ms` back to `now`. 0 is today; the future also reads 0. */
export function daysAgo(ms: number, now: number): number {
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(ms)) / DAY_MS))
}

/** Today, yesterday, the five days before that, then earlier. */
export function ageBucket(ms: number, now: number): AgeBucket {
  const n = daysAgo(ms, now)
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : n <= 6 ? 'last week' : 'earlier'
}

/** "3:50 pm" today, "yesterday", a weekday within the week, then "sep 28" ("sep 28 2025" in another year). */
export function timeLabel(ms: number, now: number): string {
  const d = new Date(ms)
  switch (ageBucket(ms, now)) {
    case 'today': {
      const h = d.getHours()
      return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
    }
    case 'yesterday': return 'yesterday'
    case 'last week': return WEEKDAYS[d.getDay()]!
    case 'earlier': {
      const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`
      return d.getFullYear() === new Date(now).getFullYear() ? label : `${label} ${d.getFullYear()}`
    }
  }
}
