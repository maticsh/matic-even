/**
 * One set of listeners per page, routing the shell's data attributes to the page's handlers:
 * - a click on `[data-act]` calls `handlers[act](arg)`;
 * - Enter in an input with `data-enter` calls `handlers[enter](value)`;
 * - a range or field with `data-input` calls `handlers[input](value)` as it changes, and `data-change`
 *   once it settles.
 */
export type Handler = (arg: string, el: HTMLElement) => void
export type Handlers = Record<string, Handler>

export function delegate(root: HTMLElement, handlers: Handlers): () => void {
  const call = (name: string | undefined, arg: string, el: HTMLElement) => {
    if (!name) return
    const h = handlers[name]
    if (h) h(arg, el)
    else console.warn('[shell] no handler for', name)
  }
  const onClick = (e: Event) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-act]')
    if (!el || !root.contains(el) || (el as HTMLButtonElement).disabled) return
    call(el.dataset.act, el.dataset.arg ?? '', el)
  }
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLInputElement
    if (e.key !== 'Enter' || !el.dataset?.enter) return
    e.preventDefault()
    call(el.dataset.enter, el.value, el)
  }
  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement
    if (el.dataset?.input) call(el.dataset.input, el.value, el)
  }
  const onChange = (e: Event) => {
    const el = e.target as HTMLInputElement
    if (el.dataset?.change) call(el.dataset.change, el.value, el)
  }
  root.addEventListener('click', onClick)
  root.addEventListener('keydown', onKey)
  root.addEventListener('input', onInput)
  root.addEventListener('change', onChange)
  return () => {
    root.removeEventListener('click', onClick)
    root.removeEventListener('keydown', onKey)
    root.removeEventListener('input', onInput)
    root.removeEventListener('change', onChange)
  }
}
