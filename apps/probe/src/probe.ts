import type { ImuReportPace } from '@evenrealities/even_hub_sdk'
import {
  actionBar, buildPage, createLifecycle, createRenderer, createStore, resolve, strip, toIntent,
  type GlassesBridge, type Keymap,
} from '@maticsh/glasses'
import { BEAT_MS, beat, body, duration, eventLog, fresh, isBeats, type Beats, type ProbeState } from './stats.ts'
import { FRAME_MS, freshSense, nextPace, senseBody, toCsv, type Pace, type Row } from './sense.ts'
import { ROWS, scriptsMirror } from './scripts.ts'

/** Everything the probe needs from the outside world, so tests can swap it. */
export type Env = {
  now: () => number
  every: (ms: number, fn: () => void) => void
  /** `n` counts sends, so every image differs from the last one. */
  makeImage: (n: number) => Promise<Uint8Array>
  /** A small 48 x 48 corner sprite, or a blank frame when `on` is false. */
  makeSprite: (on: boolean) => Promise<Uint8Array>
  /** Sample text in a script, drawn by the phone at several sizes, for the scripts page. */
  makeScript: (script: 'hindi' | 'cjk') => Promise<Uint8Array>
  /** Mirror of the glasses text for the phone screen. */
  mirror: (text: string) => void
  /** Send CSV rows to the dev server's log. Resolves false when the send failed. */
  ship?: (csv: string) => Promise<boolean>
}

const MENU = { reset: 1, blink: 2, image: 3, levels: 4, sense: 5, scripts: 6 } as const
const menu = [
  { id: MENU.reset, label: 'Reset stats' },
  { id: MENU.blink, label: 'Blink' },
  { id: MENU.image, label: 'Send image' },
  { id: MENU.levels, label: 'Text levels' },
  { id: MENU.sense, label: 'Sense' },
  { id: MENU.scripts, label: 'Scripts' },
]

/**
 * Blink styles, compared on glass. Each tap runs the next one.
 * Two styles were dropped after the first run (H1): `soft` (4↔1) reads like ambient flicker, and a
 * full-width `█` bar feels aggressive.
 */
export const BLINKS = ['hard', 'blank', 'edge'] as const
export type BlinkStyle = (typeof BLINKS)[number]

/** Unsent log rows kept in memory if the dev server is unreachable. */
const MAX_PENDING = 20_000
/** How often log rows go to the dev server. */
const SHIP_MS = 5_000

const mainPage = buildPage({
  containers: [
    { kind: 'text', name: 'head', box: { x: 0, y: 0, width: 416, height: 32 }, content: 'PROBE', textColor: 4 },
    { kind: 'text', name: 'body', box: { x: 0, y: 34, width: 416, height: 216 }, content: 'starting...', textColor: 3, capture: true },
    { kind: 'image', name: 'img', box: { x: 424, y: 8, width: 144, height: 144 } },
    { kind: 'image', name: 'edge', box: { x: 520, y: 196, width: 48, height: 48 } },
    { kind: 'text', name: 'bar', box: strip(34, 'bottom'), content: ' ', textColor: 2 },
  ],
  menu,
})

/** One row per text brightness, to see which levels are distinguishable on glass (H2). */
const levelsPage = buildPage({
  containers: [
    ...[0, 1, 2, 3, 4].map(n => ({
      kind: 'text' as const, name: `level${n}`, box: { x: 0, y: n * 44, width: 576, height: 40 },
      content: `level ${n}    ━━━━━━━━━━    Focus 25 min`, textColor: n, capture: n === 4,
    })),
    { kind: 'text', name: 'bar', box: strip(34, 'bottom'), content: 'back ▲   exit ●●', textColor: 4 },
  ],
  menu,
})

/** The sense page: live IMU, long presses and battery, with a slowly breathing corner sprite. */
const sensePage = buildPage({
  containers: [
    { kind: 'text', name: 'head', box: { x: 0, y: 0, width: 516, height: 32 }, content: 'PROBE · SENSE', textColor: 4 },
    { kind: 'text', name: 'body', box: { x: 0, y: 34, width: 516, height: 216 }, content: 'starting...', textColor: 3, capture: true },
    { kind: 'image', name: 'edge', box: { x: 520, y: 196, width: 48, height: 48 } },
    { kind: 'text', name: 'bar', box: strip(34, 'bottom'), content: ' ', textColor: 2 },
  ],
  menu,
})

/**
 * The scripts page (H23): Hindi in the firmware font on the left, phone-drawn images on the right.
 * Rows mount with only their letter, because `buildPage` refuses glyphs the font lacks. The real text
 * goes out as upgrades, so the glasses get the Hindi and we see what they do with it.
 */
const scriptsPage = buildPage({
  containers: [
    ...ROWS.map((r, i) => ({
      kind: 'text' as const, name: r.name, box: { x: 0, y: i * 42, width: 284, height: 40 }, content: r.text[0]!,
    })),
    { kind: 'image', name: 'hindi', box: { x: 288, y: 0, width: 288, height: 144 } },
    { kind: 'image', name: 'cjk', box: { x: 288, y: 144, width: 288, height: 106 } },
    { kind: 'text', name: 'bar', box: strip(34, 'bottom'), content: 'back ▲   exit ●●', capture: true },
  ],
  menu,
})

type View = 'main' | 'levels' | 'sense' | 'scripts'
const PAGES = { main: mainPage, levels: levelsPage, sense: sensePage, scripts: scriptsPage }

/**
 * Hardware probe. Main page:
 *  1. visual alert   each tap runs the next blink style (hard, blank, edge)            H1
 *  2. wearing sensor shows wearing state and when it changed                           H6, H17
 *  3. long session   5 s heartbeats; gaps over 15 s mean suspension; the last run
 *                    survives relaunch                                                 H10, H15
 *  4. image path     swipe down sends a 144 x 144 PNG and times it                     H3, H4, H5
 *  5. OS events      logs raw foreground enter and exit events, before the lifecycle
 *                    module filters them                                               H7
 * Sense page (swipe up):
 *  6. IMU            live x, y, z, sample rate per pace, and a still or moving guess   H13, H14
 *  7. cost           battery change since the page opened, with IMU on and a sprite
 *                    frame every 5 s                                                   P10
 *  8. long press     counts presses and times them; each press also marks the log      H16
 * Text levels (H2) and Scripts (H23) are in the menu (tap, then hold).
 */
export async function run(bridge: GlassesBridge, env: Env) {
  let imageError: unknown = null
  const sense = freshSense(env.now())
  const ui = createRenderer(bridge, {
    onError: e => {
      if (e.op === 'image') imageError = e.error
      if (e.op === 'text' && e.name && e.name in writes) writes[e.name] = `refused: ${String(e.error)}`
      if (e.op === 'image' && e.name === 'edge' && view === 'sense') {
        sense.frames.failed++
        log({ t: env.now(), kind: 'frameFail' })
      }
      console.warn('[probe] render', e.op, e.name, e.error)
    },
  })
  /** What happened to each scripts-page row write, for the phone mirror. */
  const writes: Record<string, string> = {}
  const store = createStore(bridge)
  const lc = createLifecycle(bridge)
  const beatsKey = store.key<Beats>('probe.beats', {
    version: 1, fallback: fresh(0),
    codec: { parse: raw => { if (!isBeats(raw)) throw new Error('bad beats'); return raw } },
  })

  const stored = await beatsKey.get()
  const state: ProbeState = {
    run: fresh(env.now()),
    prev: stored.launchedAt ? stored : null,
    wearing: null, wearingChangedAt: null, battery: null,
    events: [], image: 'swipe down to send',
  }
  let view: View = 'main'
  let blinking = false
  let nextBlink = 0
  let sends = 0
  let frameOn = true
  let lastFrame = 0
  let lastShip = env.now()
  let shipping = false
  const pending: Row[] = []

  const exit = { gesture: 'doubleTap', label: 'exit', action: () => void lc.requestExit() } as const
  const keys: Keymap<() => void> = [
    { gesture: 'tap', label: 'blink', action: () => void blink() },
    { gesture: 'swipeDown', label: 'image', action: () => void sendImage() },
    { gesture: 'swipeUp', label: 'sense', action: () => void show('sense') },
    exit,
  ]
  const levelKeys: Keymap<() => void> = [
    { gesture: 'swipeUp', label: 'back', action: () => void show('main') },
    exit,
  ]
  const scriptKeys: Keymap<() => void> = [
    { gesture: 'swipeUp', label: 'back', action: () => void show('main') },
    exit,
  ]
  const senseKeys: Keymap<() => void> = [
    { gesture: 'tap', label: 'imu', action: () => void setImu(!sense.imuOn) },
    { gesture: 'swipeDown', label: 'pace', action: () => void setImu(true, nextPace(sense.pace)) },
    { gesture: 'swipeUp', label: 'back', action: () => void show('main') },
    exit,
  ]

  const headline = () => `PROBE · up ${duration(env.now() - state.run.launchedAt)}`

  function log(row: Row) {
    pending.push(row)
    sense.log.rows++
    if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING)
  }

  async function ship() {
    if (!env.ship || shipping || pending.length === 0) return
    shipping = true
    const batch = pending.splice(0, pending.length)
    const ok = await env.ship(toCsv(batch)).catch(() => false)
    if (ok) sense.log.sent += batch.length
    else {
      sense.log.failed++
      pending.unshift(...batch.slice(-(MAX_PENDING - pending.length)))
    }
    shipping = false
  }

  function render() {
    const now = env.now()
    if (view === 'sense') {
      const text = senseBody(sense, state.battery, now)
      env.mirror(`${text}\n\nlog: ${sense.log.sent} of ${sense.log.rows} rows on the dev server, ${sense.log.failed} failed sends`)
      ui.text('body', text)
      ui.text('head', `PROBE · SENSE · up ${duration(now - state.run.launchedAt)}`)
      ui.text('bar', actionBar(senseKeys, { widthPx: 576, max: 4 }))
      return
    }
    if (view === 'scripts') return env.mirror(scriptsMirror(writes))
    const text = body(state, now)
    env.mirror(`${text}\n\nraw events:\n${eventLog(state.events) || '(none)'}`)
    if (view !== 'main') return
    ui.text('body', text)
    if (blinking) return
    ui.text('head', headline())
    ui.text('bar', actionBar(keys, { widthPx: 576, max: 4 }))
  }

  async function blink(style: BlinkStyle = BLINKS[nextBlink++ % BLINKS.length]!) {
    if (blinking || view !== 'main') return
    blinking = true
    const label = `PROBE · BLINK ${style}`
    // Images take ~250 ms on glass (H4), so the edge sprite blinks at a slower 500 ms.
    const frameMs = style === 'edge' ? 500 : 400
    for (let i = 0; i < 12; i++) {
      const on = i % 2 === 1
      if (style === 'hard') ui.text('head', label, on ? 4 : 0)
      if (style === 'blank') ui.text('head', on ? label : ' ', 4)
      if (style === 'edge') { ui.text('head', label, 4); ui.image('edge', await env.makeSprite(on)) }
      await new Promise(r => setTimeout(r, frameMs))
    }
    ui.text('head', headline(), 4)
    if (style === 'edge') ui.image('edge', await env.makeSprite(true))
    blinking = false
    render()
  }

  async function sendImage() {
    if (view !== 'main') return
    state.image = 'sending...'
    render()
    const t0 = env.now()
    imageError = null
    try {
      ui.image('img', await env.makeImage(++sends))
      await ui.flush()
    } catch (e) {
      imageError = e
    }
    state.image = imageError ? `failed: ${String(imageError)}` : `${env.now() - t0} ms (#${sends})`
    render()
  }

  /** IMU reporting on at a pace, or off. Needs a mounted page (the SDK refuses it before one exists). */
  async function setImu(on: boolean, pace: Pace = sense.pace) {
    const ok = await bridge.imuControl(on, pace as ImuReportPace).catch(() => false)
    sense.imuOn = on && ok
    sense.pace = pace
    sense.samples = []
    log({ t: env.now(), kind: on ? 'pace' : 'imuOff', value: on ? (ok ? pace : `${pace} refused`) : '' })
    render()
  }

  async function show(next: View) {
    if (blinking || next === view) return
    if (view === 'sense' && sense.imuOn) await setImu(false)
    view = next
    await ui.mount(PAGES[next])
    if (next === 'main' || next === 'sense') ui.image('edge', await env.makeSprite(true))
    if (next === 'scripts') await sendScripts()
    if (next === 'sense') {
      sense.battery = { start: state.battery, startAt: env.now() }
      lastFrame = env.now()
      await setImu(true)
    }
    render()
  }

  /** Every row as an upgrade, then both images. A row the glasses refuse is marked refused. */
  async function sendScripts() {
    for (const r of ROWS) {
      writes[r.name] = 'sent'
      ui.text(r.name, r.text)
    }
    ui.image('hindi', await env.makeScript('hindi'))
    ui.image('cjk', await env.makeScript('cjk'))
    render()
    await ui.flush()
    for (const r of ROWS) if (writes[r.name] === 'sent') writes[r.name] = 'accepted'
    render()
  }

  /** The sense page's slow corner breath: one sprite frame every FRAME_MS, for the P10 cost. */
  async function breathe() {
    frameOn = !frameOn
    sense.frames.sent++
    log({ t: env.now(), kind: 'frame', value: frameOn ? 1 : 0 })
    ui.image('edge', await env.makeSprite(frameOn))
  }

  bridge.onEvenHubEvent(e => {
    const intent = toIntent(e)
    if (!intent) return
    const now = env.now()
    if (intent.kind === 'imu') {
      const s = { t: now, x: intent.x, y: intent.y, z: intent.z }
      sense.last = s
      sense.samples.push(s)
      while (sense.samples.length && now - sense.samples[0]!.t > 5_000) sense.samples.shift()
      log({ ...s, kind: 'imu' })
      return
    }
    if (intent.kind === 'longPress') {
      sense.holds = { ...sense.holds, count: sense.holds.count + 1, pressedAt: now, source: intent.source }
      log({ t: now, kind: 'hold', value: intent.source })
      return render()
    }
    if (intent.kind === 'longPressRelease') {
      const ms = sense.holds.pressedAt === null ? null : now - sense.holds.pressedAt
      sense.holds = { ...sense.holds, pressedAt: null, lastMs: ms }
      log({ t: now, kind: 'release', value: ms ?? '' })
      return render()
    }
    // Log raw events before the lifecycle module, which ignores an enter while already active.
    const raw = intent.kind === 'foregroundEnter' ? 'enter' : intent.kind === 'foregroundExit' ? 'exit'
      : intent.kind === 'exit' ? 'sysExit' : null
    if (raw) {
      state.events = [...state.events.slice(-19), { kind: raw, at: now }]
      render()
    }
    if (lc.handle(intent)) return
    if (intent.kind === 'menu') {
      if (intent.itemID === MENU.reset) { state.run = fresh(now); state.prev = null; beatsKey.set(state.run) }
      if (intent.itemID === MENU.blink) void blink()
      if (intent.itemID === MENU.image) void sendImage()
      if (intent.itemID === MENU.levels) void show(view === 'levels' ? 'main' : 'levels')
      if (intent.itemID === MENU.sense) void show(view === 'sense' ? 'main' : 'sense')
      if (intent.itemID === MENU.scripts) void show(view === 'scripts' ? 'main' : 'scripts')
      return render()
    }
    const keymap = { main: keys, sense: senseKeys, levels: levelKeys, scripts: scriptKeys }[view]
    resolve(keymap, intent)?.action()
  })

  bridge.onDeviceStatusChanged(s => {
    const now = env.now()
    if (s.isWearing !== undefined && s.isWearing !== state.wearing) {
      state.wearing = s.isWearing
      state.wearingChangedAt = now
      log({ t: now, kind: 'wearing', value: s.isWearing ? 1 : 0 })
    }
    if (s.batteryLevel !== undefined && s.batteryLevel !== state.battery) {
      state.battery = s.batteryLevel
      log({ t: now, kind: 'battery', value: s.batteryLevel })
    }
    render()
  })

  lc.onCheckpoint(() => store.flush())
  // Sensors off on the exit events, never on the exit dialog: the user can cancel the dialog.
  // Store review rejects an app that leaves the IMU on (review/sensors.md).
  lc.onExit(async () => { await bridge.imuControl(false).catch(() => false); await store.flush() })

  await ui.mount(mainPage)
  ui.image('edge', await env.makeSprite(true))
  beatsKey.set(state.run)
  render()

  env.every(BEAT_MS, () => {
    state.run = beat(state.run, env.now())
    beatsKey.set(state.run)
    render()
  })

  env.every(1_000, () => {
    const now = env.now()
    if (view === 'sense') {
      if (now - lastFrame >= FRAME_MS) { lastFrame = now; void breathe() }
      render()
    }
    if (now - lastShip >= SHIP_MS) { lastShip = now; void ship() }
  })

  return {
    state, sense, blink, show,
    flush: async () => { await ship(); await store.flush(); await ui.flush() },
  }
}
