/**
 * @maticsh/phone: parts for the phone page of an Even Realities G2 app. A glasses preview that
 * pins to the top and shrinks to a strip, tabs, cards, rows, buttons, a slider, a two-tap confirm.
 * Nothing in here knows about any one app.
 *
 * Dev only, and so not exported here: the remote (gesture buttons under the preview) and the Kit view
 * (every part in each variant). Import them from `@maticsh/phone/dev`, in a dev-only page, so they
 * stay out of the production build.
 */
import './shell.css'

export { esc, actAttrs, attrs, type Act } from './html.ts'
export { button, wide, type ButtonProps, type ButtonVariant } from './buttons.ts'
export { card, heading, valueRow, buttonRow, toggleRow, checkRow, editRow, inputRow } from './rows.ts'
export { note, empty, slider, sliderCard, showSliderValue, type SliderProps } from './blocks.ts'
export { ICONS, tabBar, segmented, type Tab, type Segment } from './tabs.ts'
export { CONFIRM_MS, createConfirm, type Confirm } from './confirm.ts'
export { GLASS, barLine, centreRows, glassSvg, gridPath, stripHtml, type GlassRow, type GlassScreen } from './glass.ts'
export { delegate, type Handler, type Handlers } from './delegate.ts'
export { mountFrame, type Frame, type FrameOptions } from './frame.ts'
