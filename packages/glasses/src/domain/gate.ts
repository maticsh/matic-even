/**
 * Let one event through, then ignore the rest for `ms`. On a G2 one long swipe can arrive as several
 * scroll events (docs/findings/input.md#h12), so gate swipes to get one screen change per swipe.
 */
export function createGate(ms: number): (now: number) => boolean {
  let last = -Infinity
  return now => {
    if (now - last < ms) return false
    last = now
    return true
  }
}
