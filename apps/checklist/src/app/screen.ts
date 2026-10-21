/**
 * State → what the glass shows. The glasses renderer and the phone preview both draw from this one
 * model, so the preview can't drift from the glass.
 */
import { allTicked, selectedItem, showingList, visibleIndexes, MAX_ITEMS, type Align, type State } from '../domain/lists.ts'
import { copy } from './copy.ts'

export type Row = { text: string; selected: boolean; ticked: boolean }

/** One action on the bar. `id` names what it does; the glasses bind it to a handler. */
export type BarAction =
  | { id: 'toggle'; label: string; gesture: 'tap' }
  | { id: 'move'; label: string; gesture: 'swipe' }

export type Screen = {
  title: string
  /** Up to five rows, in list order. */
  rows: Row[]
  /** A line under the title when the list is done or empty, else null. */
  mood: string | null
  /** Only the actions that do something right now. Double-tap exit is left off. */
  bar: BarAction[]
  align: Align
}

export function screenOf(s: State): Screen {
  const list = showingList(s)
  const hide = s.settings.hideTicked
  const pointed = selectedItem(list, hide)
  const rows = visibleIndexes(list, hide).slice(0, MAX_ITEMS).map(i => {
    const it = list.items[i]!
    return { text: copy.glass(it.text), selected: it === pointed, ticked: it.ticked }
  })
  const mood = !list.items.length ? copy.empty : allTicked(list) ? copy.allTicked : null
  const bar: BarAction[] = []
  if (pointed) bar.push({ id: 'toggle', label: pointed.ticked ? copy.untick : copy.tick, gesture: 'tap' })
  if (rows.length > 1) bar.push({ id: 'move', label: copy.move, gesture: 'swipe' })
  return { title: copy.glass(list.name), rows, mood, bar, align: s.settings.align }
}
