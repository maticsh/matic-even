/**
 * Cards and the rows that go in them. Every row is at least 44 px tall to touch, and every action
 * on a row is a visible button: no long-press, no swipe-only controls.
 */
import { button, type ButtonProps } from './buttons.ts'
import { actAttrs, attrs, esc, type Act } from './html.ts'

/** A white card. `gap` adds the space a card needs when it follows another block directly. */
export const card = (inner: string, opts: { gap?: boolean } = {}): string =>
  `<div class="card${opts.gap ? ' sh-gap' : ''}">${inner}</div>`

/** A quiet section heading above a card. */
export const heading = (text: string): string => `<h2 class="sh-h">${esc(text)}</h2>`

type Label = { title: string; sub?: string; mono?: boolean }
const label = ({ title, sub, mono = true }: Label): string =>
  `<span class="label"><b>${esc(title)}</b>${sub ? (mono ? `<small>${esc(sub)}</small>` : `<span>${esc(sub)}</span>`) : ''}</span>`

/** A row that opens something deeper: label, an optional value, a chevron. The whole row is the target. */
export function valueRow(p: Label & { value?: string; act?: Act; aria?: string }): string {
  const inner = `${label(p)}${p.value ? `<span class="value">${esc(p.value)}</span>` : ''}<span class="chev" aria-hidden="true">›</span>`
  return p.act
    ? `<div class="row"><button type="button" class="open"${actAttrs(p.act)}${attrs(p.aria && `aria-label="${esc(p.aria)}"`)}>${inner}</button></div>`
    : `<div class="row">${inner}</div>`
}

/**
 * A row with one action on one thing, and an optional way in. With `open`, the label and a chevron
 * open the thing; the button stays its own target.
 */
export function buttonRow(p: Label & { button: ButtonProps; open?: Act; openAria?: string }): string {
  const lab = p.open ? `<button type="button" class="open"${actAttrs(p.open)}>${label(p)}</button>` : label(p)
  const chev = p.open ? `<button type="button" class="chev"${actAttrs(p.open)}${attrs(p.openAria && `aria-label="${esc(p.openAria)}"`)}>›</button>` : ''
  return `<div class="row">${lab}${button(p.button)}${chev}</div>`
}

/** An on or off setting, with a plain label. */
export function toggleRow(p: Label & { on: boolean; act: Act }): string {
  return `<div class="row">${label({ ...p, mono: false })}<button type="button" class="switch" role="switch" aria-checked="${p.on}" aria-label="${esc(p.title)}"${actAttrs(p.act)}></button></div>`
}

/**
 * An item with a tick box, its name and one Edit button. `pointer` marks the item the glasses point
 * at with ▶; tapping the name points the glasses at it.
 */
export function checkRow(p: {
  text: string; ticked: boolean; pointer?: boolean
  tick: Act; pick?: Act; edit: Act
}): string {
  const cls = `row check-row${p.pointer ? ' sel' : ''}${p.ticked ? ' done' : ''}`
  const name = p.pick
    ? `<button type="button" class="pick"${actAttrs(p.pick)} aria-current="${!!p.pointer}">${esc(p.text)}</button>`
    : `<span class="pick">${esc(p.text)}</span>`
  return `<div class="${cls}">`
    + `<span class="mark" aria-hidden="true"><i class="tri"></i></span>`
    + `<button type="button" class="check"${actAttrs(p.tick)} aria-pressed="${p.ticked}" aria-label="${p.ticked ? 'Untick' : 'Tick'} ${esc(p.text)}"><i></i></button>`
    + name
    + button({ label: 'Edit', variant: 'ghost', act: p.edit, aria: `Edit ${p.text}` })
    + `</div>`
}

/**
 * The same row while editing: the name as a field, Save, and Remove. Remove needs a second tap within
 * a few seconds (`createConfirm`); `sure` shows the armed state, "Sure?".
 */
export function editRow(p: {
  id: string; value: string; maxLength: number
  save: Act; remove: Act; sure: boolean; enter?: string
}): string {
  return `<div class="row edit-row">`
    + `<input class="field" id="${esc(p.id)}" type="text" value="${esc(p.value)}" maxlength="${p.maxLength}" aria-label="Name" autocomplete="off" enterkeyhint="done"${p.enter ? ` data-enter="${esc(p.enter)}"` : ''}>`
    + button({ label: 'Save', act: p.save })
    + button({ label: p.sure ? 'Sure?' : 'Remove', variant: p.sure ? 'sure' : 'ghost', act: p.remove })
    + `</div>`
}

/** A text field with one button: add a thing. */
export function inputRow(p: {
  id: string; placeholder: string; value?: string; maxLength: number; disabled?: boolean
  button: ButtonProps; enter: string
}): string {
  return `<div class="row">`
    + `<input class="field" id="${esc(p.id)}" type="text" placeholder="${esc(p.placeholder)}" value="${esc(p.value ?? '')}" maxlength="${p.maxLength}" autocomplete="off" enterkeyhint="done" aria-label="${esc(p.placeholder)}" data-enter="${esc(p.enter)}"${attrs(p.disabled && 'disabled')}>`
    + button({ ...p.button, disabled: p.disabled || p.button.disabled })
    + `</div>`
}
