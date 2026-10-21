import { actAttrs, attrs, esc, type Act } from './html.ts'

/** ink: a filled dark pill. ghost: a light grey pill. sure: a red pill, for a remove waiting for its second tap. */
export type ButtonVariant = 'ink' | 'ghost' | 'sure'

export type ButtonProps = {
  label: string
  variant?: ButtonVariant
  act?: Act
  disabled?: boolean
  /** Spoken name, when the label alone is not enough ("Edit Passport"). */
  aria?: string
}

/** A pill button. */
export function button({ label, variant = 'ink', act, disabled, aria }: ButtonProps): string {
  const cls = variant === 'ink' ? 'pill' : `pill ${variant}`
  return `<button type="button" class="${cls}"${actAttrs(act)}${attrs(disabled && 'disabled', aria && `aria-label="${esc(aria)}"`)}>${esc(label)}</button>`
}

/** A full-width action inside a card. */
export function wide({ label, act, disabled }: Omit<ButtonProps, 'variant'>): string {
  return `<button type="button" class="wide"${actAttrs(act)}${attrs(disabled && 'disabled')}>${esc(label)}</button>`
}
