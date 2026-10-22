/**
 * The phone page recipes on the page, live: @maticsh/phone's recipes draw each screen into a shadow root, in a box
 * the size of a phone. Each box scrolls on its own, and drives the pinned preview's shrink with the package's own
 * `pinHeights` and `pinVars`, as `mountFrame` does with the window.
 */
import {
  centreRows, delegate, firstRunScreen, listScreen, pinHeights, pinVars, settingsScreen, showSliderValue,
  type GlassScreen, type Handlers, type Tab,
} from '@maticsh/phone'
import shell from '@maticsh/phone/shell.css?inline'
import host from './screens-host.css?inline'
import { SCREENS, type ScreenId } from './catalog.ts'

// The shell's wide layout starts at a window width of 900 px. Each screen here is a phone at any window width, so
// that layout never starts.
// The bundler minifies the stylesheet, so the match allows for its spacing.
const WIDE = /@media\s*\(min-width:\s*900px\)/g
if (!WIDE.test(shell)) throw new Error('shell.css no longer has its 900 px media query')
const sheet = new CSSStyleSheet()
sheet.replaceSync(shell.replace(WIDE, '@media (min-width: 100000px)') + host)

// state

const TABS: readonly Tab[] = [
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'items', label: 'Items', icon: 'check' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
]
const MAX_ITEMS = 8
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const state = {
  items: ['Passport', 'Charger', 'Glasses case', 'Toothbrush', 'Book', 'Socks'].map((text, i) => ({ id: `i${i}`, text, ticked: i < 2 })),
  pointer: 2,
  hide: false,
  align: 'left' as 'left' | 'centre',
  reset: 7 * 60,
  tab: 'items',
  next: 6,
}

function glass(): GlassScreen {
  const rows = state.items
    .map((it, i) => ({ text: it.text.toLowerCase(), ticked: it.ticked, selected: i === state.pointer }))
    .filter(r => !(state.hide && r.ticked))
  return {
    title: 'packing',
    mood: rows.length ? null : 'all ticked',
    rows,
    bar: [{ label: 'tick', gesture: 'tap' }, ...(rows.length > 1 ? [{ label: 'move', gesture: 'swipe' as const }] : [])],
    align: state.align,
  }
}
const meta = () => `${state.items.filter(i => i.ticked).length}/${state.items.length}`

const RENDER: Record<ScreenId, () => string> = {
  settings: () => settingsScreen({
    title: 'Settings', screen: glass(), meta: meta(),
    toggle: { title: 'Hide ticked items', sub: 'The glasses show what is left.', on: state.hide, act: { name: 'hide' } },
    value: { title: 'Untick every morning', value: hhmm(state.reset), act: { name: 'said', arg: 'Open the morning reset' } },
    choice: { aria: 'Text on the glasses', segments: [
      { label: 'Text left', act: { name: 'align', arg: 'left' }, on: state.align === 'left' },
      { label: 'Text centred', act: { name: 'align', arg: 'centre' }, on: state.align === 'centre' },
    ] },
    slider: { label: 'At', value: state.reset, min: 5 * 60, max: 11 * 60, step: 15, format: hhmm, input: 'sliding', change: 'slide' },
    note: 'Settings stay on this phone.',
  }),
  list: () => listScreen({
    title: 'Packing', screen: glass(), meta: meta(), tabs: TABS, tab: state.tab, tabAct: 'tab',
    items: state.items.map((it, i) => ({ ...it, pointer: i === state.pointer })),
    acts: { tick: 'tick', pick: 'pick', edit: 'edit' },
    add: { id: 'add-item', placeholder: state.items.length < MAX_ITEMS ? 'Add an item' : 'The list is full', maxLength: 32, act: 'add', disabled: state.items.length >= MAX_ITEMS },
  }),
  'first-run': () => firstRunScreen({
    title: 'Packing',
    empty: { title: 'No lists yet', body: 'Make one, and it shows on the glasses.' },
    action: { label: 'Make a list', act: { name: 'said', arg: 'Make a list' } },
    note: 'Lists stay on this phone. No account, no network calls.',
  }),
}

// mounting

const views = new Map<ScreenId, HTMLElement>()

function render(...ids: ScreenId[]) {
  for (const id of ids) {
    const vp = views.get(id)
    if (!vp) continue
    // Keep keyboard focus on the same control across the redraw.
    const active = (vp.getRootNode() as ShadowRoot).activeElement as HTMLElement | null
    const key = active?.dataset.act ? `[data-act="${active.dataset.act}"]${active.dataset.arg ? `[data-arg="${CSS.escape(active.dataset.arg)}"]` : ''}`
      : active?.id ? `#${CSS.escape(active.id)}` : null
    vp.innerHTML = RENDER[id]()
    centreRows(vp)
    if (key) vp.querySelector<HTMLElement>(key)?.focus()
  }
}
const glassViews = (): ScreenId[] => ['settings', 'list']

function said(id: ScreenId, text: string) {
  const out = document.querySelector(`[data-said="screens-${id}"]`)
  if (out) out.textContent = text
}

function handlers(id: ScreenId): Handlers {
  const field = () => views.get(id)?.querySelector<HTMLInputElement>('#add-item')
  return {
    said: arg => said(id, `tapped: ${arg}`),
    hide: () => { state.hide = !state.hide; said(id, state.hide ? 'ticked items hidden on the preview' : 'ticked items shown'); render(...glassViews()) },
    align: arg => { state.align = arg === 'centre' ? 'centre' : 'left'; said(id, `text ${arg === 'centre' ? 'centred' : 'left'} on the preview`); render(...glassViews()) },
    // While the thumb moves, only its value changes, so the drag never drops. Once it settles, the screen redraws.
    sliding: (arg, el) => showSliderValue(el as HTMLInputElement, hhmm(Number(arg))),
    slide: arg => {
      state.reset = Number(arg)
      said(id, `at ${hhmm(state.reset)}`)
      render(id)
    },
    tick: arg => {
      const it = state.items.find(i => i.id === arg)
      if (!it) return
      it.ticked = !it.ticked
      said(id, `${it.ticked ? 'ticked' : 'unticked'}: ${it.text}`)
      render(...glassViews())
    },
    pick: arg => {
      state.pointer = Math.max(0, state.items.findIndex(i => i.id === arg))
      said(id, `pointer: ${state.items[state.pointer]!.text}`)
      render(...glassViews())
    },
    edit: arg => said(id, `tapped: Edit ${state.items.find(i => i.id === arg)?.text ?? ''}`),
    add: () => {
      const text = field()?.value.trim()
      if (!text || state.items.length >= MAX_ITEMS) return
      state.items.push({ id: `i${state.next++}`, text, ticked: false })
      said(id, `added: ${text}`)
      render(...glassViews())
      field()?.focus()
    },
    tab: arg => { state.tab = arg; said(id, `tab: ${TABS.find(t => t.id === arg)?.label ?? arg}`); render('list') },
  }
}

/** The pin, driven by the box's own scroll instead of the window's. */
function pin(vp: HTMLElement) {
  let heights = pinHeights(vp.clientWidth)
  const set = (k: string, v: string) => vp.style.setProperty(k, v)
  const measure = () => {
    heights = pinHeights(vp.clientWidth)
    set('--full-h', `${heights.full}px`)
    set('--strip-h', `${heights.strip}px`)
    set('--vp-h', `${vp.clientHeight}px`)
  }
  const progress = () => Math.min(1, Math.max(0, vp.scrollTop) / (heights.full - heights.strip))
  const onScroll = () => { for (const [k, v] of Object.entries(pinVars(progress()))) set(k, v) }
  measure()
  onScroll()
  vp.addEventListener('scroll', onScroll, { passive: true })
  new ResizeObserver(() => { measure(); onScroll(); centreRows(vp) }).observe(vp)
  // A tap on the strip scrolls back up to the full preview.
  vp.addEventListener('click', e => {
    if ((e.target as Element).closest('.glass') && progress() > 0.5) vp.scrollTo({ top: 0 })
  })
}

for (const el of document.querySelectorAll<HTMLElement>('.phv[data-screen]')) {
  const id = el.dataset.screen as ScreenId
  if (!SCREENS.some(s => s.id === id) || el.shadowRoot) continue
  const root = el.attachShadow({ mode: 'open' })
  root.adoptedStyleSheets = [sheet]
  const vp = document.createElement('div')
  vp.className = 'vp'
  root.append(vp)
  views.set(id, vp)
  delegate(vp, handlers(id))
}
render(...views.keys())
for (const vp of views.values()) pin(vp)
