/**
 * The phone parts on the page, in order: what each one is called, the call that draws it, and what it is for.
 * Pure data, so the Node build reads it for the labels and the browser bundle reads it for the parts.
 */
export type PartId =
  | 'preview' | 'strip' | 'tabs' | 'segmented' | 'value' | 'buttonRow' | 'toggle' | 'check'
  | 'buttons' | 'slider' | 'confirm' | 'empty' | 'note'

export type PartInfo = { id: PartId; name: string; call: string; use: string; live: boolean }

export const PARTS: readonly PartInfo[] = [
  { id: 'preview', name: 'Preview', call: 'glassSvg(screen)', live: true,
    use: 'what the glasses show, drawn at their 576 × 288 shape on the phone page.' },
  { id: 'strip', name: 'Strip', call: 'stripHtml(screen, meta)', live: true,
    use: 'the preview in one line: the title, the row the glasses point at, and a count.' },
  { id: 'check', name: 'Check rows', call: 'checkRow({ text, ticked, pointer, tick, pick, edit })', live: true,
    use: 'an item with a tick box, its name and an Edit button. Tap a name to move the pointer.' },
  { id: 'segmented', name: 'Segmented control', call: 'segmented(segments)', live: true,
    use: 'a choice between two to four things.' },
  { id: 'toggle', name: 'Toggle row', call: 'toggleRow({ title, sub, on, act })', live: true,
    use: 'an on or off setting, with a plain label.' },
  { id: 'tabs', name: 'Tab bar', call: 'tabBar(tabs, current, act)', live: true,
    use: 'moving between the sections of a phone page.' },
  { id: 'buttonRow', name: 'Button row', call: 'buttonRow({ title, sub, button, open })', live: true,
    use: 'one action on one thing, with an optional way in.' },
  { id: 'value', name: 'Value row', call: 'valueRow({ title, value, act })', live: true,
    use: 'a row that opens something deeper.' },
  { id: 'slider', name: 'Slider', call: 'slider({ label, value, min, max, step, format, change })', live: true,
    use: 'a number or a time picked from a range, its value in monospace.' },
  { id: 'buttons', name: 'Buttons', call: "button({ label, variant })  wide({ label })", live: true,
    use: 'ink, ghost and disabled pills, and a full-width button inside a card.' },
  { id: 'confirm', name: '"Sure?"', call: 'createConfirm()', live: true,
    use: 'a remove that needs a second tap within 3 s. Browser dialogs inside the Even app are untested.' },
  { id: 'empty', name: 'Empty state', call: 'empty(title, body)', live: false,
    use: 'a card with nothing in it yet: what is missing, and where to add it.' },
  { id: 'note', name: 'Note', call: 'note(text)', live: false,
    use: 'one or two plain lines under a card: a limit, a fact, the privacy line.' },
]
