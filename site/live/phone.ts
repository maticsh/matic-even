/**
 * The phone parts on the page, live: @maticsh/phone's own functions draw them, and its own stylesheet styles
 * them. Each part renders into a shadow root, so the shell's CSS and the page's CSS never touch. The parts share
 * one small state, so the rows, the toggle and the segmented control drive the preview and the strip.
 */
import {
  button, buttonRow, card, centreRows, checkRow, createConfirm, delegate, empty, glassSvg, note, segmented,
  showSliderValue, slider, sliderCard, stripHtml, tabBar, toggleRow, valueRow, wide,
  type ButtonProps, type GlassScreen, type Handlers, type Tab,
} from '@maticsh/phone'
import shell from '@maticsh/phone/shell.css?inline'
import host from './phone-host.css?inline'
import { PARTS, type PartId } from './catalog.ts'

// The shell styles :host beside :root, html and body, so it works as written inside a shadow root.
const sheet = new CSSStyleSheet()
sheet.replaceSync(shell + host)

// state

const ITEMS = ['Passport', 'Charger', 'Glasses case', 'Toothbrush', 'Book']
const TABS: readonly Tab[] = [
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'items', label: 'Items', icon: 'check' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
]
const LISTS = [{ id: 'packing', name: 'Packing', sub: '5 items' }, { id: 'groceries', name: 'Groceries', sub: '4 items' }]
const RESET = { min: 5 * 60, max: 11 * 60, step: 15 }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const state = {
  items: ITEMS.map((text, i) => ({ text, ticked: i < 2 })),
  pointer: 2,
  align: 'left' as 'left' | 'centre',
  hide: false,
  tab: 'items',
  showing: 'packing',
  reset: 7 * 60,
  armed: false,
  removed: false,
}

function screen(): GlassScreen {
  const pointed = state.items[state.pointer]
  const rows = state.items
    .map((it, i) => ({ text: it.text.toLowerCase(), ticked: it.ticked, selected: i === state.pointer }))
    .filter(r => !(state.hide && r.ticked))
  return {
    title: 'packing',
    mood: rows.length ? null : 'all ticked',
    rows,
    bar: [
      ...(pointed && !(state.hide && pointed.ticked) ? [{ label: pointed.ticked ? 'untick' : 'tick', gesture: 'tap' as const }] : []),
      ...(rows.length > 1 ? [{ label: 'move', gesture: 'swipe' as const }] : []),
    ],
    align: state.align,
  }
}
const tickedCount = () => state.items.filter(i => i.ticked).length

// the parts

const confirm = createConfirm({ onExpire: () => { state.armed = false; render('confirm') } })

const showButton = (id: string): ButtonProps => id === state.showing
  ? { label: 'On glasses', variant: 'ghost', disabled: true }
  : { label: 'Show on glasses', act: { name: 'show', arg: id } }

const RENDER: Record<PartId, () => string> = {
  preview: () => `<div class="tray"><div class="glass"><span class="full">${glassSvg(screen())}</span></div></div>`,
  strip: () => `<div class="tray"><div class="glass thin"><span class="strip">${stripHtml(screen(), `${tickedCount()}/${state.items.length}`)}</span></div></div>`,
  check: () => card(state.items.map((it, i) => checkRow({
    text: it.text, ticked: it.ticked, pointer: i === state.pointer,
    tick: { name: 'tick', arg: String(i) }, pick: { name: 'pick', arg: String(i) }, edit: { name: 'said', arg: `Edit ${it.text}` },
  })).join('')),
  segmented: () => segmented([
    { label: 'Text left', act: { name: 'align', arg: 'left' }, on: state.align === 'left' },
    { label: 'Text centred', act: { name: 'align', arg: 'centre' }, on: state.align === 'centre' },
  ]),
  toggle: () => card(toggleRow({ title: 'Hide ticked items', sub: 'The glasses show what is left.', on: state.hide, act: { name: 'hide' } })),
  tabs: () => `<nav class="tabbar" aria-label="Sections">${tabBar(TABS, state.tab, 'tab')}</nav>`,
  buttonRow: () => card(LISTS.map(l => buttonRow({
    title: l.name, sub: l.sub, button: showButton(l.id), open: { name: 'said', arg: `Open ${l.name}` }, openAria: `Items in ${l.name}`,
  })).join('')),
  value: () => card(valueRow({ title: 'Untick every morning', value: hhmm(state.reset), act: { name: 'said', arg: 'Open the morning reset' } })),
  slider: () => sliderCard(slider({
    label: 'At', value: state.reset, ...RESET, format: hhmm, input: 'slide', change: 'slide',
  })),
  buttons: () => card(`<div class="row btns">${button({ label: 'Show on glasses', act: { name: 'said', arg: 'Show on glasses' } })}`
    + `${button({ label: 'Edit', variant: 'ghost', act: { name: 'said', arg: 'Edit' } })}${button({ label: 'Add', disabled: true })}</div>`)
    + card(wide({ label: 'Untick everything', act: { name: 'said', arg: 'Untick everything' } }) + wide({ label: 'On glasses', disabled: true })),
  confirm: () => card(`<div class="row btns">${button({
    label: state.armed ? 'Sure?' : 'Remove', variant: state.armed ? 'sure' : 'ghost', act: { name: 'remove' },
  })}<span class="value">${state.removed ? 'removed' : state.armed ? 'tap again within 3 s' : ''}</span></div>`),
  empty: () => card(empty('Nothing here yet', 'Add one below, and it shows on the glasses.')),
  note: () => card('<div class="row"><span class="label"><b>Packing</b></span></div>') + note('Lists stay on this phone. No account, no network calls.'),
}

/** Which parts draw from which state, so a change redraws only what it touches. */
const GLASS: PartId[] = ['preview', 'strip', 'check']

// mounting

const boxes = new Map<PartId, HTMLElement>()

function render(...ids: PartId[]) {
  for (const id of ids) {
    const box = boxes.get(id)
    if (!box) continue
    // Keep keyboard focus on the same control across the redraw.
    const active = (box.getRootNode() as ShadowRoot).activeElement as HTMLElement | null
    const key = active?.dataset.act ? `[data-act="${active.dataset.act}"]${active.dataset.arg ? `[data-arg="${CSS.escape(active.dataset.arg)}"]` : ''}` : null
    box.innerHTML = RENDER[id]()
    if (id === 'preview') centreRows(box)
    if (key) box.querySelector<HTMLElement>(key)?.focus()
  }
}

function said(id: PartId, text: string) {
  const out = document.querySelector(`[data-said="${id}"]`)
  if (out) out.textContent = text
}

function handlers(id: PartId): Handlers {
  return {
    said: arg => said(id, `tapped: ${arg}`),
    tick: arg => {
      const it = state.items[Number(arg)]!
      it.ticked = !it.ticked
      said(id, `${it.ticked ? 'ticked' : 'unticked'}: ${it.text}`)
      render(...GLASS)
    },
    pick: arg => { state.pointer = Number(arg); said(id, `pointer: ${state.items[state.pointer]!.text}`); render(...GLASS) },
    align: arg => { state.align = arg === 'centre' ? 'centre' : 'left'; said(id, `text ${arg === 'centre' ? 'centred' : 'left'} on the preview`); render('segmented', 'preview') },
    hide: () => { state.hide = !state.hide; said(id, state.hide ? 'ticked items hidden on the preview' : 'ticked items shown'); render('toggle', 'preview', 'strip') },
    tab: arg => { state.tab = arg; said(id, `tab: ${TABS.find(t => t.id === arg)?.label ?? arg}`); render('tabs') },
    show: arg => { state.showing = arg; said(id, `on glasses: ${LISTS.find(l => l.id === arg)?.name ?? arg}`); render('buttonRow') },
    slide: (arg, el) => {
      state.reset = Number(arg)
      showSliderValue(el as HTMLInputElement, hhmm(state.reset))
      said(id, `at ${hhmm(state.reset)}`)
      render('value')
    },
    remove: () => {
      const r = confirm.press('demo')
      state.armed = r === 'armed'
      state.removed = r === 'confirmed'
      render('confirm')
    },
  }
}

for (const el of document.querySelectorAll<HTMLElement>('.ph[data-part]')) {
  const id = el.dataset.part as PartId
  if (!PARTS.some(p => p.id === id) || el.shadowRoot) continue
  const root = el.attachShadow({ mode: 'open' })
  root.adoptedStyleSheets = [sheet]
  const box = document.createElement('div')
  box.className = 'ph-root'
  root.append(box)
  boxes.set(id, box)
  delegate(box, handlers(id))
}
render(...boxes.keys())
document.documentElement.classList.add('phone-live')
