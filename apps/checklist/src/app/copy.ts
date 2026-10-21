/**
 * Every line Checklist puts on the glasses, in one place.
 */
export const copy = {
  /** Under the title when every item is ticked. */
  allTicked: 'all ticked. nothing left to carry',
  /** Under the title when the list has no items. */
  empty: 'nothing on this list yet',
  /** Bar verbs. */
  tick: 'tick',
  untick: 'untick',
  move: 'move',
  exit: 'exit',
  /** User text, as the glasses say it. */
  glass: (s: string): string => s.toLowerCase(),
} as const
