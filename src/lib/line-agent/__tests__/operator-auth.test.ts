/**
 * operator-auth.test.ts
 *
 * Tests for internal-secret validation used by the DC/operator command bridge.
 * Covers: valid secret passes, missing secret fails, wrong secret fails,
 * and timing-safe behaviour on weird/edge-case input.
 */

import { describe, it, expect } from 'vitest'
import { validateOperatorAuth } from '@/lib/line-agent/operator/operator-auth'

const VALID_SECRET = 'super-secret-for-testing-32chars!!'

describe('validateOperatorAuth', () => {
  it('returns ok:true with actor when the correct secret is supplied', () => {
    const result = validateOperatorAuth(VALID_SECRET, VALID_SECRET)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.actor).toBe('operator')
    }
  })

  it('returns ok:false with code MISSING_SECRET when the provided secret is empty', () => {
    const result = validateOperatorAuth(VALID_SECRET, '')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('MISSING_SECRET')
    }
  })

  it('returns ok:false with code MISSING_SECRET when the provided secret is null/undefined', () => {
    // Simulate a header that was not sent (null from headers.get())
    const result = validateOperatorAuth(VALID_SECRET, null as unknown as string)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('MISSING_SECRET')
    }
  })

  it('returns ok:false with code INVALID_SECRET when the wrong secret is supplied', () => {
    const result = validateOperatorAuth(VALID_SECRET, 'wrong-secret')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INVALID_SECRET')
    }
  })

  it('does not throw on empty-string expected secret (misconfiguration handled gracefully)', () => {
    // The expected secret being empty is a server misconfiguration, but should
    // never throw — it should return a typed failure.
    expect(() => validateOperatorAuth('', 'anything')).not.toThrow()
    const result = validateOperatorAuth('', 'anything')
    expect(result.ok).toBe(false)
  })

  it('does not throw on very long or binary-like provided secret (timing-safe path)', () => {
    const weird = '\x00'.repeat(1000) + '🎉'
    expect(() => validateOperatorAuth(VALID_SECRET, weird)).not.toThrow()
    const result = validateOperatorAuth(VALID_SECRET, weird)
    expect(result.ok).toBe(false)
  })

  it('does not throw when provided secret contains characters outside ASCII', () => {
    const unicodeSecret = '泰國清邁親子包車-secret-test'
    expect(() => validateOperatorAuth(VALID_SECRET, unicodeSecret)).not.toThrow()
  })
})
