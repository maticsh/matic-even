/**
 * Checklist's phone page, composed only from the parts in @maticsh/phone. Three tabs: Lists picks
 * what the glasses show, Items edits a list, Settings holds the glass's text, hiding and the morning
 * reset. The page keeps only what it is in the middle of (the tab, an edit, a half-typed name); the
 * lists themselves live in the app and come back through `update`.
 */
import {
  buttonRow, card, checkRow, createConfirm, delegate, editRow, empty, heading, inputRow, mountFrame, note,
  segmented, showSliderValue, slider, sliderCard, toggleRow, wide, type ButtonProps, type Frame, type Tab,
} from '@maticsh/phone'
import { MAX_ITEMS, MAX_TEXT, listById, minutesOf, tickedCount, visibleIndexes, type List, type State } from '../domain/lists.ts'
import type { Controls, View } from '../app/glasses.ts'

type TabId = 'lists' | 'items' | 'settings'
const TABS: readonly (Tab & { id: TabId })[] = [
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'items', label: 'Items', icon: 'check' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
]

/** The morning reset's range: 05:00 to 11:00, in quarter hours. */
const RESET = { min: 5 * 60, max: 11 * 60, step: 15, initial: '07:00' }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const PRIVACY = 'Lists stay on this phone. No account, no network calls.'

const countLine = (l: List) => `${l.items.length} ${l.items.length === 1 ? 'item' : 'items'} · ${tickedCount(l)} ticked`

export function mountPhone(root: HTMLElement, app: () => Controls): { update(view: View): void; frame: Frame } {
  let view: View | null = null
  const ui = {
    tab: 'lists' as TabId,
    /** The list open on the Items tab. Null follows the list on the glasses. */
    list: null as string | null,
    /** The item being edited, and its name as typed. */
    editing: null as string | null,
    draft: '',
    /** The Add field, as typed. */
    adding: '',
  }
  const confirm = createConfirm({ onExpire: () => render() })

  const frame = mountFrame(root, {
    title: 'Checklist',
    caption: 'What the glasses show right now. Tap an item to point the glasses at it.',
    tabs: TABS,
    tab: ui.tab,
    onTab: id => setTab(id as TabId),
  })

  const openList = (s: State): List => listById(s, ui.list ?? s.showing) ?? listById(s, s.showing)!

  function setTab(t: TabId) {
    ui.tab = t
    ui.editing = null
    confirm.reset()
    frame.setTab(t)
    render()
    frame.settleScroll()
  }

  // the tabs
  /** The one call to action. On the list already showing, the same spot reads "On glasses", disabled. */
  const showButton = (s: State, l: List): ButtonProps => l.id === s.showing
    ? { label: 'On glasses', variant: 'ghost', disabled: true }
    : { label: 'Show on glasses', act: { name: 'show', arg: l.id } }

  function listsTab(s: State): string {
    return heading('Your lists')
      + card(s.lists.map(l => buttonRow({
        title: l.name, sub: countLine(l), button: showButton(s, l),
        open: { name: 'open', arg: l.id }, openAria: `Items in ${l.name}`,
      })).join(''))
      + note('The glasses show one list at a time. Open a list to add, rename or remove its items.')
  }

  function itemsTab(s: State): string {
    const l = openList(s)
    const visible = visibleIndexes(l, s.settings.hideTicked)
    const full = l.items.length >= MAX_ITEMS
    const rows = l.items.map((it, i) => ui.editing === it.id
      ? editRow({
        id: 'rename', value: ui.draft, maxLength: MAX_TEXT, enter: 'save',
        save: { name: 'save', arg: it.id }, remove: { name: 'remove', arg: it.id }, sure: confirm.isArmed(it.id),
      })
      : checkRow({
        text: it.text, ticked: it.ticked, pointer: i === l.selected && visible.includes(i),
        tick: { name: 'tick', arg: it.id }, pick: { name: 'pick', arg: it.id }, edit: { name: 'edit', arg: it.id },
      })).join('')
    return heading('List')
      + segmented(s.lists.map(x => ({ label: x.name, act: { name: 'open-here', arg: x.id }, on: x.id === l.id })), { aria: 'List' })
      + card(l.id === s.showing ? wide({ label: 'On glasses', disabled: true }) : wide({ label: 'Show on glasses', act: { name: 'show', arg: l.id } }), { gap: true })
      + heading('Items')
      + card(rows || empty('No items yet', 'Add one below, and it shows on the glasses.'))
      + card(inputRow({
        id: 'add', placeholder: full ? 'The list is full' : 'Add an item', value: full ? '' : ui.adding, maxLength: MAX_TEXT,
        disabled: full, enter: 'add', button: { label: 'Add', act: { name: 'add' } },
      }), { gap: true })
      + note(full ? 'The glasses fit five items. Remove one to add another.' : 'Tap a name to point the glasses at it. The glasses fit five items.')
  }

  function settingsTab(s: State): string {
    const st = s.settings
    const on = st.morningReset !== null
    const resetRow = toggleRow({ title: 'Untick every list', on, act: { name: 'reset-toggle' } })
    const at = minutesOf(st.morningReset ?? RESET.initial)!
    return heading('Text on the glass')
      + segmented([
        { label: 'Left', act: { name: 'align', arg: 'left' }, on: st.align === 'left' },
        { label: 'Centre', act: { name: 'align', arg: 'centre' }, on: st.align === 'centre' },
      ], { aria: 'Text on the glass' })
      + card(toggleRow({ title: 'Hide ticked items', sub: 'Only open items show on the glasses.', on: st.hideTicked, act: { name: 'hide' } }), { gap: true })
      + heading('Each morning')
      + (on
        ? sliderCard(resetRow + slider({ label: 'At', value: at, min: RESET.min, max: RESET.max, step: RESET.step, format: hhmm, input: 'reset-drag', change: 'reset-at' }))
        : card(resetRow))
      + note(on ? 'Every list starts fresh at this time.' : 'Off. Lists stay as you left them.')
      + heading('On the glasses')
      + note('Swipe to move the pointer. Tap to tick or untick. Double tap to leave.')
      + note(PRIVACY)
  }

  // rendering
  function render() {
    if (!view) return
    const s = view.state
    // Keep the caret where it was: a change from the glasses re-renders while someone types.
    const active = document.activeElement as HTMLInputElement | null
    const focusId = active && frame.panel.contains(active) && active.id ? active.id : null
    const caret = focusId ? active!.selectionStart : null

    frame.panel.innerHTML = ui.tab === 'lists' ? listsTab(s) : ui.tab === 'items' ? itemsTab(s) : settingsTab(s)

    const field = focusId ? frame.panel.querySelector<HTMLInputElement>(`#${focusId}`) : ui.editing ? frame.panel.querySelector<HTMLInputElement>('#rename') : null
    if (field && !field.disabled) {
      field.focus()
      const at = caret ?? field.value.length
      field.setSelectionRange(at, at)
    }
  }

  function paint() {
    if (!view) return
    const l = listById(view.state, view.state.showing)!
    frame.preview(view.screen, `${tickedCount(l)}/${l.items.length}`)
    render()
  }

  // what the controls do
  const listId = () => openList(view!.state).id
  delegate(frame.panel, {
    show: id => app().show(id),
    open: id => { ui.list = id; setTab('items') },
    'open-here': id => { ui.list = id; ui.editing = null; confirm.reset(); render() },
    tick: id => app().toggle(listId(), id),
    pick: id => app().select(listId(), id),
    edit: id => {
      const it = openList(view!.state).items.find(i => i.id === id)
      if (!it) return
      ui.editing = id
      ui.draft = it.text
      confirm.reset()
      render()
    },
    save: id => {
      // Enter in the field passes the text; the Save button passes the item id.
      const itemId = ui.editing ?? id
      app().rename(listId(), itemId, ui.draft)
      ui.editing = null
      confirm.reset()
      render()
    },
    remove: id => {
      if (confirm.press(id) === 'armed') return render()
      ui.editing = null
      app().remove(listId(), id)
      render()
    },
    add: () => {
      if (app().add(listId(), ui.adding)) ui.adding = ''
      render()
    },
    align: to => app().setAlign(to === 'centre' ? 'centre' : 'left'),
    hide: () => app().setHideTicked(!view!.state.settings.hideTicked),
    'reset-toggle': () => app().setMorningReset(view!.state.settings.morningReset === null ? RESET.initial : null),
    'reset-drag': (v, el) => showSliderValue(el as HTMLInputElement, hhmm(Number(v))),
    'reset-at': v => app().setMorningReset(hhmm(Number(v))),
  })
  // Drafts live outside the DOM, so a re-render never loses what was typed.
  frame.panel.addEventListener('input', e => {
    const el = e.target as HTMLInputElement
    if (el.id === 'add') ui.adding = el.value
    if (el.id === 'rename') ui.draft = el.value
  })
  frame.panel.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ui.editing) { ui.editing = null; confirm.reset(); render() }
  })

  return {
    frame,
    update(next) {
      view = next
      paint()
    },
  }
}
