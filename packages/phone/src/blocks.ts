import { esc } from './html.ts'

/** One or two plain lines under a card: a limit, a fact, the privacy line. */
export const note = (text: string): string => `<p class="note">${esc(text)}</p>`

/** A card with nothing in it yet: what is missing, and where to add it. */
export const empty = (title: string, body: string): string =>
  `<div class="empty"><b>${esc(title)}</b>${esc(body)}</div>`

export type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  /** Handler for the live value while dragging (`data-input`) and the settled one (`data-change`). */
  input?: string
  change: string
}

/**
 * A number or a time picked from a range, its value in monospace. Draw it inside a `card`, with
 * the class `slider` on the card (`sliderCard`).
 */
export function slider(p: SliderProps): string {
  return `<div class="row"><span class="label">${esc(p.label)}</span><b data-slider-value>${esc(p.format(p.value))}</b></div>`
    + `<input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}" aria-label="${esc(p.label)}"`
    + `${p.input ? ` data-input="${esc(p.input)}"` : ''} data-change="${esc(p.change)}">`
    + `<div class="ends"><span>${esc(p.format(p.min))}</span><span>${esc(p.format(p.max))}</span></div>`
}

/** A card holding rows and then a slider, styled for the slider's padding. */
export const sliderCard = (inner: string): string => `<div class="card slider">${inner}</div>`

/** Show a slider's new value while it drags, without a re-render that would drop the thumb. */
export function showSliderValue(input: HTMLInputElement, text: string): void {
  const out = input.closest('.slider')?.querySelector('[data-slider-value]')
  if (out) out.textContent = text
}
