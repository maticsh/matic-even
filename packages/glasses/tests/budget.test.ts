import { describe, expect, it } from 'vitest'
import { checkText, isMissingGlyph, missingGlyphs, sanitize } from '../src/domain/budget.ts'
import { GESTURE_GLYPH } from '../src/domain/glyphs.ts'

describe('glyph checks', () => {
  it('finds glyphs the font lacks', () => {
    expect(isMissingGlyph('✓')).toBe(true)
    expect(isMissingGlyph('A')).toBe(false)
    expect(isMissingGlyph('\n')).toBe(false)
    expect(missingGlyphs('done ✓ ✓')).toEqual(['✓'])
  })

  it('every gesture glyph and bar glyph exists in the font', () => {
    const used = Object.values(GESTURE_GLYPH).join('') + '━─▁▂▃▄▅▆▇█●○'
    expect(missingGlyphs(used)).toEqual([])
  })

  it('substitutes known glyphs and drops unknown ones', () => {
    expect(sanitize('ok ✓')).toEqual({ text: 'ok ●', replaced: ['✓'] })
    expect(sanitize('plain')).toEqual({ text: 'plain', replaced: [] })
  })

  it('every substitute replaces a missing glyph with a present one', () => {
    // Guards the SUBSTITUTES table against font changes.
    for (const ch of ['✓', '✔', '✗', '✘']) {
      expect(isMissingGlyph(ch)).toBe(true)
      expect(missingGlyphs(sanitize(ch).text)).toEqual([])
    }
  })
})

describe('checkText', () => {
  it('passes short text', () => {
    expect(checkText('25 min left', 'create')).toEqual([])
  })

  it('flags the 1000-char create limit and the 2000-char upgrade limit', () => {
    expect(checkText('a'.repeat(1001), 'create')[0]).toMatchObject({ kind: 'tooManyChars', limit: 1000 })
    expect(checkText('a'.repeat(1001), 'upgrade')).toEqual([])
    expect(checkText('a'.repeat(2001), 'upgrade')[0]).toMatchObject({ kind: 'tooManyChars', limit: 2000 })
  })

  it('flags the simulator byte limit for non-ASCII text on create', () => {
    const issues = checkText('━'.repeat(400), 'create') // 400 chars, 1200 bytes
    expect(issues).toContainEqual({ kind: 'tooManyBytes', limit: 999, actual: 1200 })
  })
})
