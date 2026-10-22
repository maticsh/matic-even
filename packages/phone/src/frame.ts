/**
 * The page frame: the pinned glasses preview, the page title, the tab control and the panel the page
 * fills. On the phone the preview is pinned to the top and shrinks to a strip as the page scrolls,
 * settling to the nearer end like a native header. At 900 px and up it sits in a sticky left column.
 */
import { centreRows, glassSvg, stripHtml, type GlassScreen } from './glass.ts'
import { esc } from './html.ts'
import { segmented, tabBar, type Tab } from './tabs.ts'

export type FrameOptions = {
  title: string
  /** A small label beside the title, such as "Example". */
  tag?: string
  /** A plain line under the preview on wide screens. */
  caption?: string
  tabs: readonly Tab[]
  tab: string
  onTab: (id: string) => void
}

export type Frame = {
  /** The element the page renders its current tab into. */
  panel: HTMLElement
  /** Redraw the preview and the strip. `meta` is a short count for the strip, such as "2/5". */
  preview(screen: GlassScreen, meta?: string): void
  setTab(id: string): void
  /** Put a row under the glass, inside the tray. It folds away with the shrink. */
  setFoot(html: string, heightPx: number): HTMLElement
  /** Scroll back to the top on the phone, keeping the panel's place otherwise. */
  settleScroll(): void
}

const TOP = 8, GAP = 8, PAD = 16, STRIP_GLASS = 44

/** What the frame's markup holds. With `screen`, the preview and the strip are drawn in; with `panel`, the panel is filled. */
export type FrameMarkup = Omit<FrameOptions, 'onTab' | 'tabs' | 'tab'> & {
  /** Leave out for a page with no tabs. */
  tabs?: readonly Tab[]
  tab?: string
  /** The handler name the tab buttons carry. mountFrame routes 'shell-tab' itself. */
  tabAct?: string
  screen?: GlassScreen
  /** A short count for the strip, such as "2/5". */
  meta?: string
  panel?: string
}

/** The page title, and an optional tag beside it. */
export const introHtml = (title: string, tag?: string): string =>
  `<div class="intro"><h1>${esc(title)}</h1>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</div>`

/** The tab bar's buttons and the segmented control that replaces it at 900 px and up. */
function tabsHtml(tabs: readonly Tab[], tab: string, act: string): { bar: string; top: string } {
  return {
    bar: tabBar(tabs, tab, act),
    top: segmented(tabs.map(t => ({ label: t.label, act: { name: act, arg: t.id }, on: t.id === tab })), { className: 'tabs-top', aria: 'Sections' }),
  }
}

/**
 * The frame as an HTML string: the pinned preview, the title, the panel and the tabs. Pure, so a page can render a
 * whole screen in a test or on a server. `mountFrame` writes the same markup and then runs the pin.
 */
export function frameHtml(o: FrameMarkup): string {
  const intro = introHtml(o.title, o.tag)
  const tabs = o.tabs ? tabsHtml(o.tabs, o.tab ?? o.tabs[0]?.id ?? '', o.tabAct ?? 'shell-tab') : null
  return `
    <div class="stage">
      <header class="pin">
        <div class="tray">
          <button class="glass" type="button" aria-label="Glasses preview"><span class="full">${o.screen ? glassSvg(o.screen) : ''}</span><span class="strip">${o.screen ? stripHtml(o.screen, o.meta) : ''}</span></button>
          <div class="foot"></div>
        </div>
        <div class="caption">${intro}${o.caption ? `<p class="note">${esc(o.caption)}</p>` : ''}</div>
      </header>
      <main class="content">${intro}${tabs ? `<div class="tabs-top-slot">${tabs.top}</div>` : ''}<div class="panel">${o.panel ?? ''}</div></main>
    </div>${tabs ? `
    <nav class="tabbar" aria-label="Sections">${tabs.bar}</nav>` : ''}`
}

/** The pin's two heights on the phone, for a pin `width` px wide: the full preview, and the strip it shrinks to. */
export function pinHeights(width: number, footHeight = 0): { full: number; strip: number } {
  const glassW = width - 2 * PAD - 24 - 3
  return { full: TOP + 24 + 3 + glassW / 2 + footHeight + GAP, strip: TOP + 12 + 3 + STRIP_GLASS + GAP }
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/**
 * The stylesheet's variables for a shrink `p` from 0 (full preview) to 1 (strip): `--p`, and the opacity of the
 * full layer (`--a`) and the strip (`--b`). Set them on the element that holds the frame.
 */
export function pinVars(p: number): Record<'--p' | '--a' | '--b', string> {
  return { '--p': p.toFixed(4), '--a': (1 - smooth(0.3, 0.72, p)).toFixed(3), '--b': smooth(0.62, 0.95, p).toFixed(3) }
}


export function mountFrame(root: HTMLElement, opts: FrameOptions): Frame {
  root.innerHTML = frameHtml(opts)

  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const pin = $('.pin')
  const glass = $<HTMLButtonElement>('.glass')
  const full = $('.glass .full')
  const strip = $('.glass .strip')
  const foot = $('.foot')
  const panel = $('.panel')
  const tabbar = $('nav.tabbar')
  const tabsTop = $('.tabs-top-slot')
  const doc = document.documentElement

  let tab = opts.tab
  function renderTabs() {
    const html = tabsHtml(opts.tabs, tab, 'shell-tab')
    tabbar.innerHTML = html.bar
    tabsTop.innerHTML = html.top
  }
  root.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-act="shell-tab"]')
    if (b?.dataset.arg) opts.onTab(b.dataset.arg)
  })

  // the pin
  const desk = () => matchMedia('(min-width: 900px)').matches
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  let footH = 0
  let FULL = 220, STRIP = 74, scrollP = 0
  const range = () => FULL - STRIP

  function measure() {
    if (desk()) return
    const h = pinHeights(pin.clientWidth, footH)
    FULL = h.full
    STRIP = h.strip
    doc.style.setProperty('--full-h', `${FULL}px`)
    doc.style.setProperty('--strip-h', `${STRIP}px`)
    doc.style.setProperty('--foot-h', `${footH}px`)
  }
  function onScroll() {
    ticking = false
    let p = 0
    if (!desk()) {
      const y = Math.max(0, window.scrollY)
      p = reduced() ? (y >= range() - 1 ? 1 : 0) : Math.min(1, y / range())
    }
    scrollP = p
    for (const [k, v] of Object.entries(pinVars(p))) doc.style.setProperty(k, v)
    glass.setAttribute('aria-label', p > 0.5 ? 'Glasses preview, collapsed. Tap to show it in full.' : 'Glasses preview')
  }
  /** When the finger lifts halfway through the shrink, settle to the nearer end. */
  function settle() {
    if (desk() || reduced() || scrollP <= 0 || scrollP >= 1) return
    window.scrollTo({ top: scrollP < 0.5 ? 0 : range(), behavior: 'smooth' })
  }
  let ticking = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll) }
    clearTimeout(settleTimer)
    settleTimer = setTimeout(settle, 180)
  }, { passive: true })
  window.addEventListener('resize', () => { measure(); onScroll(); centreRows(full) })
  glass.addEventListener('click', () => {
    if (!desk() && scrollP > 0.5) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' })
  })

  renderTabs()
  measure()
  onScroll()

  return {
    panel,
    preview(screen, meta) {
      full.innerHTML = glassSvg(screen)
      centreRows(full)
      strip.innerHTML = stripHtml(screen, meta)
    },
    setTab(id) {
      tab = id
      renderTabs()
    },
    setFoot(html, heightPx) {
      foot.innerHTML = html
      footH = html ? heightPx : 0
      measure()
      onScroll()
      return foot
    },
    settleScroll() {
      if (!desk()) window.scrollTo(0, Math.min(window.scrollY, range()))
    },
  }
}
