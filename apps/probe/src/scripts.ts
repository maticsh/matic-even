import { missingGlyphs } from '@maticsh/glasses'

/**
 * The scripts page: can the glasses show Hindi, and how many pixels does a script need? (H23)
 * Left: one row per test in the firmware font. Each row starts with a Latin letter, so a row whose
 * script is missing still shows its letter. Right: the same text shaped by the phone and sent as images,
 * at several sizes.
 */
export const ROWS = [
  { name: 'rowA', text: 'A abc 中文 量', checks: 'control: Latin and Chinese' },
  { name: 'rowB', text: 'B क ख ग', checks: 'plain consonants' },
  { name: 'rowC', text: 'C कि की', checks: 'reordering: ि must sit left of क' },
  { name: 'rowD', text: 'D क्ष त्र ज्ञ', checks: 'conjuncts: each should be one shape' },
  { name: 'rowE', text: 'E हिन्दी', checks: 'a whole word' },
  { name: 'rowF', text: 'F र्म स्त', checks: 'reph (hook above म) and a half form' },
] as const

export const HINDI_SAMPLE = 'हिन्दी कि क्ष र्म'
export const HINDI_SIZES = [14, 18, 22, 28] as const
export const CJK_SAMPLE = '中文 量 書 讓'
export const CJK_SIZES = [12, 16, 20, 24] as const

/** The phone's own rendering of every test, the reference to compare the glasses against. */
export function scriptsMirror(writes: Record<string, string>): string {
  const missing = missingGlyphs(ROWS.map(r => r.text).join(''))
  return [
    'Compare the glasses with this page.',
    '',
    'Left, the firmware font:',
    ...ROWS.map(r => `${r.text}    ${r.checks} · ${writes[r.name] ?? 'not sent'}`),
    '',
    `Right top, shaped by the phone, ${HINDI_SIZES.join(' / ')} px: ${HINDI_SAMPLE}`,
    `Right bottom, ${CJK_SIZES.join(' / ')} px: ${CJK_SAMPLE}`,
    '',
    `pretext says the firmware font lacks: ${missing.join(' ') || 'nothing'}`,
  ].join('\n')
}
