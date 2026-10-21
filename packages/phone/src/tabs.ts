/**
 * The tab control. On the phone it is a bottom bar the thumb can reach; at 900 px and up it becomes a
 * segmented control above the content. Both render from the same tab list.
 */
import { actAttrs, esc, type Act } from './html.ts'

/** Line icons drawn for the shell, 24 x 24, stroked in the current colour. */
export const ICONS = {
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.3 12.4l2.6 2.6 4.9-5.4"/>',
  sliders: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><circle cx="15" cy="7.5" r="2"/><circle cx="9" cy="16.5" r="2"/>',
} as const

export type Tab = { id: string; label: string; icon: keyof typeof ICONS }

/** The phone's bottom bar. Each button carries `act` with the tab id as its argument. */
export function tabBar(tabs: readonly Tab[], current: string, act: string): string {
  return tabs.map(t => `<button type="button"${actAttrs({ name: act, arg: t.id })}${t.id === current ? ' aria-current="page"' : ''}>`
    + `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t.icon]}</svg>${esc(t.label)}</button>`).join('')
}

export type Segment = { label: string; act: Act; on: boolean }

/** A choice between two to four things, on a grey track with a white selected pill. */
export function segmented(segments: readonly Segment[], opts: { className?: string; aria?: string } = {}): string {
  return `<div class="seg${opts.className ? ` ${opts.className}` : ''}" role="group"${opts.aria ? ` aria-label="${esc(opts.aria)}"` : ''}>`
    + segments.map(s => `<button type="button"${actAttrs(s.act)} aria-pressed="${s.on}">${esc(s.label)}</button>`).join('')
    + `</div>`
}
