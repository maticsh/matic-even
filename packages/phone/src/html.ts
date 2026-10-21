/**
 * The shell's parts are plain functions that return HTML strings, so they render the same in a page,
 * on the Kit view and in a test with no DOM. Controls carry what they do as data attributes, and one
 * listener per page (`delegate`) routes them to the page's handlers.
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Escape text for HTML content and attribute values. */
export const esc = (s: string | number): string => String(s).replace(/[&<>"']/g, c => ESC[c]!)

/**
 * What a control does: a handler name and an optional argument, written as `data-act` / `data-arg`.
 * The page's handler for `name` receives `arg`.
 */
export type Act = { name: string; arg?: string }

export const actAttrs = (act?: Act): string =>
  act ? ` data-act="${esc(act.name)}"${act.arg !== undefined ? ` data-arg="${esc(act.arg)}"` : ''}` : ''

/** Join attribute fragments, dropping the empty ones. */
export const attrs = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).map(p => ` ${p}`).join('')
