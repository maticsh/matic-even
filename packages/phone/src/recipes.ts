/**
 * Page recipes: whole phone screens put together from the package's parts, as HTML strings. Each takes plain data,
 * the way the parts do, so it renders in a page, on a server and in a test with no DOM. Controls carry their
 * handler names as data attributes; route them with `delegate`, as with any part.
 *
 * The settings and list screens use the frame's markup (`frameHtml`): the glasses preview pinned at the top, which
 * shrinks to the strip as the page scrolls once `mountFrame` or a scroll handler drives it (`pinHeights`, `pinVars`).
 */
import { empty, note, slider, type SliderProps } from './blocks.ts'
import { button } from './buttons.ts'
import { frameHtml, introHtml } from './frame.ts'
import type { GlassScreen } from './glass.ts'
import type { Act } from './html.ts'
import { card, checkRow, inputRow, toggleRow, valueRow } from './rows.ts'
import { segmented, type Segment, type Tab } from './tabs.ts'

/** The frame around a recipe: the title, the preview's screen, and optional tabs. */
export type ScreenFrame = {
  title: string
  tag?: string
  /** What the preview draws. */
  screen: GlassScreen
  /** A short count for the strip, such as "2/5". */
  meta?: string
  tabs?: readonly Tab[]
  tab?: string
  /** The handler name the tab buttons carry. */
  tabAct?: string
}

/**
 * A settings screen: the preview at the top, then one card of rows (a toggle row, a value row with a chevron, a
 * segmented control and a slider), then a note. Leave out any row you do not need.
 */
export function settingsScreen(p: ScreenFrame & {
  toggle?: { title: string; sub?: string; on: boolean; act: Act }
  value?: { title: string; sub?: string; value?: string; act?: Act; aria?: string }
  choice?: { segments: readonly Segment[]; aria?: string }
  slider?: SliderProps
  note?: string
}): string {
  const rows = [
    p.toggle ? toggleRow(p.toggle) : '',
    p.value ? valueRow(p.value) : '',
    p.choice ? `<div class="row">${segmented(p.choice.segments, { aria: p.choice.aria })}</div>` : '',
    p.slider ? `<div class="slider">${slider(p.slider)}</div>` : '',
  ].join('')
  return frameHtml({ ...p, panel: (rows ? card(rows, { gap: true }) : '') + (p.note ? note(p.note) : '') })
}

/** One item on a list screen. `id` goes back to your handlers as the argument. */
export type ListItem = { id: string; text: string; ticked: boolean; pointer?: boolean }

/**
 * A list screen: the pinned preview, a card of check rows (tick box, name, Edit), a row to add an item, and the
 * tab bar. The tick, pick and edit handlers get the item's `id`. The add handler is called by Enter in the field
 * (with its value) and by the Add button (read the field by `add.id`).
 */
export function listScreen(p: ScreenFrame & {
  items: readonly ListItem[]
  acts: { tick: string; pick?: string; edit: string }
  add: { id: string; placeholder: string; maxLength: number; act: string; label?: string; disabled?: boolean }
  note?: string
}): string {
  const rows = p.items.map(it => checkRow({
    text: it.text, ticked: it.ticked, pointer: it.pointer,
    tick: { name: p.acts.tick, arg: it.id },
    ...(p.acts.pick && { pick: { name: p.acts.pick, arg: it.id } }),
    edit: { name: p.acts.edit, arg: it.id },
  })).join('')
  const add = inputRow({
    id: p.add.id, placeholder: p.add.placeholder, maxLength: p.add.maxLength, enter: p.add.act, disabled: p.add.disabled,
    button: { label: p.add.label ?? 'Add', act: { name: p.add.act } },
  })
  return frameHtml({ ...p, panel: card(rows + add, { gap: true }) + (p.note ? note(p.note) : '') })
}

/** A first-run screen: the title, an empty state with one ink button under it, and a note. No preview. */
export function firstRunScreen(p: {
  title: string
  tag?: string
  empty: { title: string; body: string }
  action: { label: string; act: Act }
  note?: string
}): string {
  const body = card(empty(p.empty.title, p.empty.body) + `<div class="row centre">${button({ label: p.action.label, act: p.action.act })}</div>`)
  return `<div class="stage first-run"><main class="content">${introHtml(p.title, p.tag)}${body}${p.note ? note(p.note) : ''}</main></div>`
}
