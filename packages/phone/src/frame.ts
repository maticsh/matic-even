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

export function mountFrame(root: HTMLElement, opts: FrameOptions): Frame {
  const intro = `<div class="intro"><h1>${esc(opts.title)}</h1>${opts.tag ? `<span class="tag">${esc(opts.tag)}</span>` : ''}</div>`
  root.innerHTML = `
    <div class="stage">
      <header class="pin">
        <div class="tray">
          <button class="glass" type="button" aria-label="Glasses preview"><span class="full"></span><span class="strip"></span></button>
          <div class="foot"></div>
        </div>
        <div class="caption">${intro}${opts.caption ? `<p class="note">${esc(opts.caption)}</p>` : ''}</div>
      </header>
      <main class="content">${intro}<div class="tabs-top-slot"></div><div class="panel"></div></main>
    </div>
    <nav class="tabbar" aria-label="Sections"></nav>`

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
    tabbar.innerHTML = tabBar(opts.tabs, tab, 'shell-tab')
    tabsTop.innerHTML = segmented(opts.tabs.map(t => ({ label: t.label, act: { name: 'shell-tab', arg: t.id }, on: t.id === tab })), { className: 'tabs-top', aria: 'Sections' })
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
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

  function measure() {
    if (desk()) return
    const glassW = pin.clientWidth - 2 * PAD - 24 - 3
    FULL = TOP + 24 + 3 + glassW / 2 + footH + GAP
    STRIP = TOP + 12 + 3 + STRIP_GLASS + GAP
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
    doc.style.setProperty('--p', p.toFixed(4))
    doc.style.setProperty('--a', (1 - smooth(0.3, 0.72, p)).toFixed(3))
    doc.style.setProperty('--b', smooth(0.62, 0.95, p).toFixed(3))
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
