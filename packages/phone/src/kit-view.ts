/**
 * DEV ONLY. The Kit view: every shell part once, in each variant, with what it is for and where it
 * lives. Import it from `@maticsh/phone/dev` in a dev-only page, so it never reaches the production build.
 */
import './kit-view.css'
import { button, wide } from './buttons.ts'
import { empty, note, slider, sliderCard } from './blocks.ts'
import { createConfirm } from './confirm.ts'
import { centreRows, glassSvg, stripHtml, type GlassScreen } from './glass.ts'
import { esc } from './html.ts'
import { remoteButtons, remoteHtml } from './remote.ts'
import { buttonRow, card, checkRow, editRow, inputRow, toggleRow, valueRow } from './rows.ts'
import { segmented, tabBar } from './tabs.ts'

type Part = { name: string; use: string; path: string; variants: [string, string][] }

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** `screen` is any real screen from the app, so the preview shows true content. */
export function mountKitView(root: HTMLElement, screen: GlassScreen): void {
  const centred: GlassScreen = { ...screen, align: 'centre' }
  const left: GlassScreen = { ...screen, align: 'left' }
  const tray = (inner: string, cls = '') => `<div class="tray"><div class="glass ${cls}">${inner}</div></div>`
  const tabs = [
    { id: 'a', label: 'Lists', icon: 'list' as const },
    { id: 'b', label: 'Items', icon: 'check' as const },
    { id: 'c', label: 'Settings', icon: 'sliders' as const },
  ]
  const parts: Part[] = [
    { name: 'Preview', use: 'what the glasses show, at their real 576 × 288 shape, live.', path: 'src/glass.ts · frame.ts', variants: [
      ['full · text left', tray(`<span class="full">${glassSvg(left)}</span>`)],
      ['full · text centred', tray(`<span class="full">${glassSvg(centred)}</span>`)],
      ['strip · pinned once the page scrolls', tray(`<span class="strip">${stripHtml(screen, '2/5')}</span>`, 'thin')],
    ] },
    { name: 'Tray', use: 'framing anything drawn for the glasses: a grey well, a thin grey frame, white glass.', path: 'src/shell.css', variants: [
      ['empty', tray('576 × 288', 'blank')],
    ] },
    { name: 'Tab control', use: 'moving between the page\'s sections, or a choice between two or three settings.', path: 'src/tabs.ts', variants: [
      ['bottom bar · phone', `<nav class="tabbar">${tabBar(tabs, 'a', 'kit')}</nav>`],
      ['segmented · 900 px and up, and settings', segmented(tabs.map((t, i) => ({ label: t.label, act: { name: 'kit' }, on: i === 0 })))],
    ] },
    { name: 'Row · value and chevron', use: 'a row that opens something deeper.', path: 'src/rows.ts valueRow', variants: [
      ['', card(valueRow({ title: 'Label', sub: 'detail in monospace', value: 'Value', act: { name: 'kit' } }))],
    ] },
    { name: 'Row · button', use: 'one action on one thing, with an optional way in.', path: 'src/rows.ts buttonRow', variants: [
      ['ink · the main action', card(buttonRow({ title: 'Label', sub: '4 things · 1 done', button: { label: 'Show on glasses', act: { name: 'kit' } }, open: { name: 'kit' } }))],
      ['done · the same spot, disabled', card(buttonRow({ title: 'Label', sub: '5 things · 2 done', button: { label: 'On glasses', variant: 'ghost', disabled: true }, open: { name: 'kit' } }))],
    ] },
    { name: 'Row · check', use: 'a thing with a tick box, its name and one Edit button. Remove lives inside Edit.', path: 'src/rows.ts checkRow · editRow', variants: [
      ['open · pointed at', card(checkRow({ text: 'An open thing', ticked: false, pointer: true, tick: { name: 'kit' }, pick: { name: 'kit' }, edit: { name: 'kit' } }))],
      ['ticked', card(checkRow({ text: 'A ticked thing', ticked: true, tick: { name: 'kit' }, pick: { name: 'kit' }, edit: { name: 'kit' } }))],
      ['editing', card(editRow({ id: 'kit-edit-1', value: 'A thing', maxLength: 32, save: { name: 'kit' }, remove: { name: 'kit' }, sure: false }))],
      ['editing · Remove after one tap', card(editRow({ id: 'kit-edit-2', value: 'A thing', maxLength: 32, save: { name: 'kit' }, remove: { name: 'kit' }, sure: true }))],
    ] },
    { name: 'Row · toggle', use: 'an on or off setting, with a plain label.', path: 'src/rows.ts toggleRow', variants: [
      ['off', card(toggleRow({ title: 'A setting', sub: 'One plain line on what it does.', on: false, act: { name: 'kit' } }))],
      ['on', card(toggleRow({ title: 'A setting', on: true, act: { name: 'kit' } }))],
    ] },
    { name: 'Row · field', use: 'adding a thing by name.', path: 'src/rows.ts inputRow', variants: [
      ['ready', card(inputRow({ id: 'kit-add-1', placeholder: 'Add a thing', maxLength: 32, enter: 'kit', button: { label: 'Add', act: { name: 'kit' } } }))],
      ['full', card(inputRow({ id: 'kit-add-2', placeholder: 'The list is full', maxLength: 32, enter: 'kit', disabled: true, button: { label: 'Add' } }))],
    ] },
    { name: 'Slider', use: 'a number or a time picked from a range, with its value in monospace.', path: 'src/blocks.ts slider', variants: [
      ['', sliderCard(slider({ label: 'At', value: 420, min: 300, max: 660, step: 15, format: hhmm, change: 'kit' }))],
    ] },
    { name: 'Ink and ghost buttons', use: 'the main action on a row or card (ink), and the other actions (ghost).', path: 'src/buttons.ts button', variants: [
      ['ink · ghost · sure · disabled', card(`<div class="row btns">${button({ label: 'Show on glasses' })}${button({ label: 'Edit', variant: 'ghost' })}${button({ label: 'Sure?', variant: 'sure' })}${button({ label: 'Add', disabled: true })}</div>`)],
    ] },
    { name: 'Wide button', use: 'a full-width action inside a card.', path: 'src/buttons.ts wide', variants: [
      ['ready', card(wide({ label: 'Show on glasses' }))],
      ['done', card(wide({ label: 'On glasses', disabled: true }))],
    ] },
    { name: 'Two-tap confirm', use: 'removing anything: the first tap turns "Remove" to "Sure?", a second within 3 s removes.', path: 'src/confirm.ts createConfirm', variants: [
      ['try it', card(`<div class="row btns" id="kit-confirm">${button({ label: 'Remove', variant: 'ghost', act: { name: 'kit-confirm' } })}<span class="value" id="kit-confirm-out"></span></div>`)],
    ] },
    { name: 'Empty state', use: 'a card with nothing in it yet: what is missing, and where to add it.', path: 'src/blocks.ts empty', variants: [
      ['', card(empty('Nothing here yet', 'Add one below, and it shows on the glasses.'))],
    ] },
    { name: 'Note', use: 'one or two plain lines under a card: a limit, a fact, the privacy line.', path: 'src/blocks.ts note', variants: [
      ['', card('<div class="row"><span class="label">A card</span></div>') + note('Stays on this phone. No account, no network calls.')],
    ] },
    { name: 'Remote · dev only', use: 'driving the glasses from the dev preview. It never ships.', path: 'src/remote.ts', variants: [
      ['', `<div class="tray">${remoteHtml(remoteButtons(screen.bar))}</div>`],
    ] },
  ]

  root.innerHTML = `<section class="kit">
    <h2>Kit · the parts this page is built from</h2>
    <p>Each shared part once, in each variant. Dev only.</p>
    <div class="kit-grid">${parts.map(p => `<div class="part"><h3>${esc(p.name)}</h3><p class="use">Use it for ${esc(p.use)}</p><p class="path">${esc(p.path)}</p>`
      + p.variants.map(([v, html]) => `${v ? `<p class="v">${esc(v)}</p>` : ''}${html}`).join('') + `</div>`).join('')}</div>
  </section>`
  centreRows(root)

  // The confirm, live.
  const out = root.querySelector('#kit-confirm-out')!
  const btn = root.querySelector<HTMLButtonElement>('#kit-confirm button')!
  const confirm = createConfirm({ onExpire: () => { btn.textContent = 'Remove'; btn.className = 'pill ghost' } })
  btn.addEventListener('click', () => {
    const r = confirm.press('kit')
    btn.textContent = r === 'armed' ? 'Sure?' : 'Remove'
    btn.className = r === 'armed' ? 'pill sure' : 'pill ghost'
    out.textContent = r === 'confirmed' ? 'removed' : ''
  })
}
