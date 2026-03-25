import { describe, expect, it } from 'vitest'
import { formatFamilyCountLabel } from '@/lib/family-count'

describe('formatFamilyCountLabel', () => {
  it('formats the live family count with a trailing plus sign', () => {
    expect(formatFamilyCountLabel(114)).toBe('114+')
    expect(formatFamilyCountLabel(128)).toBe('128+')
  })

  it('falls back to the default count when the source value is invalid', () => {
    expect(formatFamilyCountLabel(0)).toBe('114+')
    expect(formatFamilyCountLabel(undefined)).toBe('114+')
  })
})
