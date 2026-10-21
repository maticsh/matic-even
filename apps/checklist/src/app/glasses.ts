/**
 * Checklist's glasses side: a tap ticks the item under `▶`, a swipe moves `▶`, and a double tap
 * asks to leave.
 *
 * All state changes, from the glasses or the phone, go through `apply`, which saves, redraws the glass
 * through the renderer, and tells the phone. Leaving never resets; the morning untick runs off the
 * clock on start and at every checkpoint.
 */
import {
  createGate, createLifecycle, createRenderer, createStore, resolve, toIntent,
  type GlassesBridge, type Grid, type Intent, type Keymap,
} from '@maticsh/glasses'
import * as lists from '../domain/lists.ts'
import type { Align, State } from '../domain/lists.ts'
import { copy } from './copy.ts'
import { barImage, barText, glassText, pageFor } from './layout.ts'
import { screenOf, type BarAction, type Screen } from './screen.ts'

export type Env = {
  now: () => number
  /** Grid to PNG bytes. Canvas in the browser, a stub in tests. */
  encode: (g: Grid) => Promise<Uint8Array>
  /** Called after every change, for the phone page. */
  onChange?: (view: View) => void
  /** Storage key prefix. Previews and demos use their own. */
  namespace?: string
}

/** What the phone page needs: the state, and the screen the glass shows for it. */
export type View = { state: State; screen: Screen }

/** One long swipe can arrive as several scroll events (docs/findings/input.md#h12). */
export const SWIPE_GATE_MS = 700

type Keys = Keymap<(i: Intent) => void>

export async function run(bridge: GlassesBridge, env: Env) {
  const ui = createRenderer(bridge, { onError: e => console.warn('[checklist]', e.op, e.name, e.error) })
  const store = createStore(bridge)
  const lc = createLifecycle(bridge)
  const swipeGate = createGate(SWIPE_GATE_MS)
  const saved = store.key<State>(`${env.namespace ?? 'checklist'}.state`, {
    version: 1, fallback: lists.seed(), codec: { parse: lists.parseState },
  })

  // The morning reset runs on start too: a day the app was closed is caught up when it opens.
  const loaded = await saved.get()
  let state = lists.morningReset(loaded, env.now())
  if (state !== loaded) saved.set(state)
  let mounted: Align | null = null
  let barSent = ''

  // drawing
  /** Redraw the glass and the phone from the state. The renderer skips text that hasn't changed. */
  function paint() {
    const screen = screenOf(state)
    const text = glassText(screen)
    env.onChange?.({ state, screen })
    if (mounted !== screen.align) {
      // Alignment moves the bar's box, so it takes a rebuild. The page carries its text already.
      mounted = screen.align
      barSent = ''
      void ui.mount(pageFor(screen.align, text))
    } else {
      ui.text('title', text.title)
      ui.text('mood', text.mood)
      ui.text('rows', text.rows)
    }
    sendBar(barText(keysFor(screen).filter(k => k.gesture !== 'doubleTap')), screen.align)
  }

  /** Encodes can finish out of order; only the latest bar reaches the queue. */
  function sendBar(text: string, to: Align) {
    const key = `${to}|${text}`
    if (key === barSent) return
    barSent = key
    void env.encode(barImage(text, to)).then(bytes => { if (barSent === key) ui.image('bar', bytes) })
  }

  function apply(next: State): boolean {
    if (next === state) return false
    state = next
    saved.set(state)
    paint()
    return true
  }

  // gestures: one table, so the bar can't drift from what they do
  const actions: Record<BarAction['id'], (i: Intent) => void> = {
    toggle: () => void apply(lists.tickSelected(state)),
    move: i => void apply(lists.move(state, i.kind === 'scrollTop' ? -1 : 1)),
  }
  /** A double tap asks the OS for its exit dialog. The bar leaves it out. */
  const exit = { gesture: 'doubleTap' as const, label: copy.exit, action: () => void lc.requestExit() }
  const keysFor = (screen: Screen): Keys => [
    ...screen.bar.map(b => ({ gesture: b.gesture, label: b.label, action: actions[b.id] })),
    exit,
  ]

  bridge.onEvenHubEvent(e => {
    const intent = toIntent(e)
    if (!intent || lc.handle(intent)) return
    const isSwipe = intent.kind === 'scrollTop' || intent.kind === 'scrollBottom'
    if (isSwipe && !swipeGate(env.now())) return
    resolve(keysFor(screenOf(state)), intent)?.action(intent)
  })

  // Every foreground event: catch up the morning reset, then save.
  lc.onCheckpoint(async () => {
    apply(lists.morningReset(state, env.now()))
    await store.flush()
  })
  // Checklist turns on no sensors, so exit only saves.
  lc.onExit(() => store.flush())

  paint()

  // the phone's controls
  return {
    get state() { return state },
    view: (): View => ({ state, screen: screenOf(state) }),
    show: (listId: string) => apply(lists.show(state, listId)),
    toggle: (listId: string, itemId: string) => apply(lists.toggle(state, listId, itemId)),
    select: (listId: string, itemId: string) => apply(lists.select(state, listId, itemId)),
    add: (listId: string, text: string) => apply(lists.add(state, listId, text)),
    rename: (listId: string, itemId: string, text: string) => apply(lists.rename(state, listId, itemId, text)),
    remove: (listId: string, itemId: string) => apply(lists.remove(state, listId, itemId)),
    setAlign: (to: Align) => apply(lists.setAlign(state, to)),
    setHideTicked: (on: boolean) => apply(lists.setHideTicked(state, on)),
    setMorningReset: (time: string | null) => apply(lists.setMorningReset(state, time, env.now())),
    /** Save now and let every glasses write settle. */
    flush: async () => { await store.flush(); await ui.flush() },
  }
}

export type App = Awaited<ReturnType<typeof run>>
/** The controls the phone page calls. */
export type Controls = Omit<App, 'state' | 'view' | 'flush'>
