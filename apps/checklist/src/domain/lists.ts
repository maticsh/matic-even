/**
 * Checklist's state and every change to it, as pure functions: state in, new state out.
 * Nothing here knows about the glasses, the phone or storage. A change that cannot happen
 * (a sixth item, an empty name, an unknown id) returns the same state object, so callers can
 * tell with `===`.
 */
import { dayKey } from '@maticsh/glasses'

/** The glasses show a list whole, with no scrolling. */
export const MAX_ITEMS = 5
/** Long enough for "water by the bed", short enough to fit one glass row. */
export const MAX_TEXT = 32

export type Item = { id: string; text: string; ticked: boolean }
export type List = {
  id: string
  name: string
  items: Item[]
  /** Index into `items` of the item the glasses point at. Kept on a visible item whenever one exists. */
  selected: number
}
export type Align = 'left' | 'centre'
export type Settings = {
  align: Align
  hideTicked: boolean
  /** "HH:MM" local time to untick every list each morning, or null for off. */
  morningReset: string | null
}
export type State = {
  lists: List[]
  /** The id of the list on the glasses. */
  showing: string
  settings: Settings
  /** dayKey of the last morning reset, so it runs once a day. */
  lastReset: string | null
  /** The next item id. Ids stay unique across lists and removals. */
  seq: number
}

// reading

export const listById = (s: State, id: string): List | undefined => s.lists.find(l => l.id === id)

/** The list on the glasses. The seed and every change keep `showing` pointing at a real list. */
export const showingList = (s: State): List => listById(s, s.showing) ?? s.lists[0]!

/** Indexes of the items the glasses draw, in order. */
export function visibleIndexes(list: List, hideTicked: boolean): number[] {
  return list.items.flatMap((it, i) => (hideTicked && it.ticked ? [] : [i]))
}

/** The item the glasses point at, or null when nothing is visible. */
export function selectedItem(list: List, hideTicked: boolean): Item | null {
  return visibleIndexes(list, hideTicked).includes(list.selected) ? list.items[list.selected]! : null
}

export const tickedCount = (list: List): number => list.items.filter(i => i.ticked).length
export const allTicked = (list: List): boolean => list.items.length > 0 && list.items.every(i => i.ticked)

/** "07:30" → 450, or null when it is not a valid time. */
export function minutesOf(time: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

// helpers

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT).trim()

/**
 * Keep the selection on a visible item: the same one if it still shows, else the next visible one
 * below it, else the nearest one above. With nothing visible it rests clamped to the list.
 */
function settle(list: List, hideTicked: boolean): List {
  const visible = visibleIndexes(list, hideTicked)
  const clamped = Math.max(0, Math.min(list.selected, list.items.length - 1))
  if (!visible.length) return clamped === list.selected ? list : { ...list, selected: clamped }
  if (visible.includes(list.selected)) return list
  const next = visible.find(i => i > list.selected) ?? visible[visible.length - 1]!
  return { ...list, selected: next }
}

/** Replace one list, then settle its selection. Unknown ids leave the state as it was. */
function withList(s: State, id: string, change: (l: List) => List): State {
  const list = listById(s, id)
  if (!list) return s
  const next = change(list)
  if (next === list) return s
  const settled = settle(next, s.settings.hideTicked)
  return { ...s, lists: s.lists.map(l => (l.id === id ? settled : l)) }
}

// the glasses' two gestures

/** Tap: tick or untick the item the glasses point at. */
export function tickSelected(s: State): State {
  const list = showingList(s)
  const it = selectedItem(list, s.settings.hideTicked)
  return it ? toggle(s, list.id, it.id) : s
}

/** Swipe: move the pointer one visible item, stopping at either end. */
export function move(s: State, dir: 1 | -1): State {
  const list = showingList(s)
  const visible = visibleIndexes(list, s.settings.hideTicked)
  const at = visible.indexOf(list.selected)
  if (at < 0) return s
  const to = visible[Math.max(0, Math.min(visible.length - 1, at + dir))]!
  return to === list.selected ? s : withList(s, list.id, l => ({ ...l, selected: to }))
}

// the phone

/** Tick or untick any item. Ticking the pointed item with hide-ticked on moves the pointer on. */
export function toggle(s: State, listId: string, itemId: string): State {
  return withList(s, listId, l => {
    if (!l.items.some(i => i.id === itemId)) return l
    return { ...l, items: l.items.map(i => (i.id === itemId ? { ...i, ticked: !i.ticked } : i)) }
  })
}

/** Point the glasses at an item. Hidden items can't be pointed at. */
export function select(s: State, listId: string, itemId: string): State {
  return withList(s, listId, l => {
    const i = l.items.findIndex(x => x.id === itemId)
    if (i < 0 || i === l.selected || !visibleIndexes(l, s.settings.hideTicked).includes(i)) return l
    return { ...l, selected: i }
  })
}

/** Add an item at the end. Refused on a full list or an empty name. */
export function add(s: State, listId: string, text: string): State {
  const name = clean(text)
  const list = listById(s, listId)
  if (!name || !list || list.items.length >= MAX_ITEMS) return s
  const item: Item = { id: `i${s.seq}`, text: name, ticked: false }
  const next = withList(s, listId, l => ({ ...l, items: [...l.items, item] }))
  return { ...next, seq: s.seq + 1 }
}

export function rename(s: State, listId: string, itemId: string, text: string): State {
  const name = clean(text)
  if (!name) return s
  return withList(s, listId, l => {
    const it = l.items.find(i => i.id === itemId)
    if (!it || it.text === name) return l
    return { ...l, items: l.items.map(i => (i.id === itemId ? { ...i, text: name } : i)) }
  })
}

/** Remove an item. The pointer stays on the same item, or moves to the next one when it was this one. */
export function remove(s: State, listId: string, itemId: string): State {
  return withList(s, listId, l => {
    const at = l.items.findIndex(i => i.id === itemId)
    if (at < 0) return l
    return { ...l, items: l.items.filter(i => i.id !== itemId), selected: at < l.selected ? l.selected - 1 : l.selected }
  })
}

/** Put a list on the glasses. */
export function show(s: State, listId: string): State {
  return s.showing === listId || !listById(s, listId) ? s : { ...s, showing: listId }
}

export function setAlign(s: State, align: Align): State {
  return s.settings.align === align ? s : { ...s, settings: { ...s.settings, align } }
}

export function setHideTicked(s: State, hideTicked: boolean): State {
  if (s.settings.hideTicked === hideTicked) return s
  return { ...s, settings: { ...s.settings, hideTicked }, lists: s.lists.map(l => settle(l, hideTicked)) }
}

/**
 * Turn the morning reset on at a time, or off with null. When the time has already passed today,
 * today counts as done: switching it on at noon must not untick the morning's work.
 */
export function setMorningReset(s: State, time: string | null, now: number): State {
  if (time !== null && minutesOf(time) === null) return s
  if (s.settings.morningReset === time) return s
  const passed = time !== null && localMinutes(now) >= minutesOf(time)!
  return { ...s, settings: { ...s.settings, morningReset: time }, lastReset: passed ? dayKey(now) : s.lastReset }
}

// the clock

const localMinutes = (ms: number): number => {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Untick every list once per local day, at or after the set time. Runs off the clock on start and
 * at every checkpoint, never on a timer, so a day the app was closed is caught up
 * the next time it opens.
 */
export function morningReset(s: State, now: number): State {
  const at = s.settings.morningReset === null ? null : minutesOf(s.settings.morningReset)
  const today = dayKey(now)
  if (at === null || s.lastReset === today || localMinutes(now) < at) return s
  const lists = s.lists.map(l => settle({ ...l, items: l.items.map(i => (i.ticked ? { ...i, ticked: false } : i)) }, s.settings.hideTicked))
  return { ...s, lists, lastReset: today }
}

// the first run

/** The three example lists a first run starts with. */
export function seed(): State {
  let seq = 0
  const list = (id: string, name: string, texts: string[]): List =>
    ({ id, name, selected: 0, items: texts.map(text => ({ id: `i${seq++}`, text, ticked: false })) })
  const lists = [
    list('packing', 'Packing', ['Passport', 'Charger', 'Glasses case', 'Toothbrush', 'Book']),
    list('groceries', 'Groceries', ['Oat milk', 'Lemons', 'Rice', 'Coffee']),
    list('bed', 'Before bed', ['Lights off', 'Alarm set', 'Water by the bed']),
  ]
  return { lists, showing: 'packing', settings: { align: 'left', hideTicked: false, morningReset: null }, lastReset: null, seq }
}

// storage

const isItem = (v: unknown): v is Item => {
  const i = v as Item
  return typeof i === 'object' && i !== null && typeof i.id === 'string' && typeof i.text === 'string' && typeof i.ticked === 'boolean'
}
const isList = (v: unknown): v is List => {
  const l = v as List
  return typeof l === 'object' && l !== null && typeof l.id === 'string' && typeof l.name === 'string'
    && Array.isArray(l.items) && l.items.length <= MAX_ITEMS && l.items.every(isItem) && Number.isInteger(l.selected)
}

/** Check stored state before trusting it. Throws on a bad shape; the store falls back to the seed. */
export function parseState(raw: unknown): State {
  const s = raw as State
  const st = s?.settings
  const ok = typeof s === 'object' && s !== null && Array.isArray(s.lists) && s.lists.length > 0 && s.lists.every(isList)
    && typeof s.showing === 'string' && Number.isInteger(s.seq)
    && (s.lastReset === null || typeof s.lastReset === 'string')
    && typeof st === 'object' && st !== null && (st.align === 'left' || st.align === 'centre') && typeof st.hideTicked === 'boolean'
    && (st.morningReset === null || (typeof st.morningReset === 'string' && minutesOf(st.morningReset) !== null))
  if (!ok) throw new Error('bad checklist state')
  return { ...s, showing: listById(s, s.showing) ? s.showing : s.lists[0]!.id, lists: s.lists.map(l => settle(l, st.hideTicked)) }
}
