/**
 * The two-tap confirm: the first tap arms ("Remove" turns to "Sure?"), a second tap on the same thing
 * within `ms` confirms. Browser dialogs inside the Even app are untested, so this replaces them.
 * The clock and the timer are injected, so tests drive it without waiting.
 */
export type Confirm = {
  /** 'armed' on the first tap, 'confirmed' on the second within the window. */
  press(id: string): 'armed' | 'confirmed'
  isArmed(id: string): boolean
  reset(): void
}

export const CONFIRM_MS = 3_000

export function createConfirm(opts: {
  ms?: number
  now?: () => number
  /** Called when an armed press runs out, so the page can turn "Sure?" back. */
  onExpire?: () => void
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (t: unknown) => void
} = {}): Confirm {
  const ms = opts.ms ?? CONFIRM_MS
  const now = opts.now ?? Date.now
  const setTimer = opts.setTimer ?? ((fn, t) => setTimeout(fn, t))
  const clearTimer = opts.clearTimer ?? (t => clearTimeout(t as ReturnType<typeof setTimeout>))
  let armed: { id: string; until: number } | null = null
  let timer: unknown = null

  const isArmed = (id: string) => armed !== null && armed.id === id && now() < armed.until

  return {
    press(id) {
      if (timer !== null) clearTimer(timer)
      timer = null
      if (isArmed(id)) {
        armed = null
        return 'confirmed'
      }
      armed = { id, until: now() + ms }
      timer = setTimer(() => { timer = null; armed = null; opts.onExpire?.() }, ms)
      return 'armed'
    },
    isArmed,
    reset() {
      if (timer !== null) clearTimer(timer)
      timer = null
      armed = null
    },
  }
}
