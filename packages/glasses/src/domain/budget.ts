import { getAdvW } from '@evenrealities/pretext'
import { utf8ByteLength } from '@evenrealities/even_hub_sdk'

/** Hard limits from the SDK, firmware and simulator. The simulator counts bytes where the docs count chars. */
export const LIMITS = {
  createChars: 1000,
  upgradeChars: 2000,
  simulatorBytes: 999,
  listItems: 20,
  listItemChars: 64,
  listItemBytes: 63,
  containerNameBytes: 16,
  menuItems: 10,
  menuItemBytes: 32,
  containers: 12,
  textAndList: 8,
  images: 4,
} as const

// Shown when a glyph is missing from the font. Keys must be missing glyphs, values must exist.
const SUBSTITUTES: Record<string, string> = { '✓': '●', '✔': '●', '✗': '○', '✘': '○' }

/** True when the firmware font chain has no glyph for this character, so it would drop silently. */
export function isMissingGlyph(ch: string): boolean {
  if (ch === '\n') return false
  return getAdvW(ch.codePointAt(0)!) === 0
}

export function missingGlyphs(text: string): string[] {
  return [...new Set([...text].filter(isMissingGlyph))]
}

/** Swap or drop glyphs the font lacks. Returns what was replaced so callers can log it. */
export function sanitize(text: string): { text: string; replaced: string[] } {
  const replaced = missingGlyphs(text)
  if (replaced.length === 0) return { text, replaced }
  const out = [...text].map(ch => (isMissingGlyph(ch) ? (SUBSTITUTES[ch] ?? '') : ch)).join('')
  return { text: out, replaced }
}

export type TextIssue =
  | { kind: 'tooManyChars'; limit: number; actual: number }
  | { kind: 'tooManyBytes'; limit: number; actual: number }
  | { kind: 'missingGlyphs'; glyphs: string[] }

/** Check text before it goes to a container on create or rebuild ('create') or via textContainerUpgrade ('upgrade'). */
export function checkText(text: string, mode: 'create' | 'upgrade'): TextIssue[] {
  const issues: TextIssue[] = []
  const chars = [...text].length
  const charLimit = mode === 'create' ? LIMITS.createChars : LIMITS.upgradeChars
  if (chars > charLimit) issues.push({ kind: 'tooManyChars', limit: charLimit, actual: chars })
  const bytes = utf8ByteLength(text)
  if (mode === 'create' && bytes > LIMITS.simulatorBytes) {
    issues.push({ kind: 'tooManyBytes', limit: LIMITS.simulatorBytes, actual: bytes })
  }
  const glyphs = missingGlyphs(text)
  if (glyphs.length) issues.push({ kind: 'missingGlyphs', glyphs })
  return issues
}
