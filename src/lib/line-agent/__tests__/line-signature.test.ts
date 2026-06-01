/**
 * Tests for LINE webhook signature verification.
 *
 * Self-contained: we compute the reference signature with Node crypto inside
 * each test rather than using hard-coded fixtures, so the suite stays correct
 * across any test environment and never needs external fixtures.
 */

import { createHmac } from 'crypto'
import { describe, it, expect } from 'vitest'
import { verifyLineSignature } from '../line/signature'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyLineSignature', () => {
  const secret = 'test-channel-secret-abc123'
  const body = JSON.stringify({ events: [{ type: 'message' }] })

  it('returns true for a valid signature', () => {
    const sig = makeSignature(secret, body)
    expect(verifyLineSignature(secret, body, sig)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const sig = makeSignature(secret, body)
    const tamperedBody = body + ' '
    expect(verifyLineSignature(secret, tamperedBody, sig)).toBe(false)
  })

  it('returns false for a tampered signature', () => {
    const sig = makeSignature(secret, body)
    // Flip the last character
    const badSig = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    expect(verifyLineSignature(secret, body, badSig)).toBe(false)
  })

  it('returns false for a wrong secret', () => {
    const sig = makeSignature('wrong-secret', body)
    expect(verifyLineSignature(secret, body, sig)).toBe(false)
  })

  it('returns false for an empty signature header', () => {
    expect(verifyLineSignature(secret, body, '')).toBe(false)
  })

  it('returns false for a null/undefined signature (cast test)', () => {
    // Simulate attacker sending null — TypeScript caller may pass undefined/null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(verifyLineSignature(secret, body, null as any)).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(verifyLineSignature(secret, body, undefined as any)).toBe(false)
  })

  it('returns false for a non-base64 garbage header (must not throw)', () => {
    expect(() => verifyLineSignature(secret, body, '!!!garbage!!!')).not.toThrow()
    expect(verifyLineSignature(secret, body, '!!!garbage!!!')).toBe(false)
  })

  it('returns false when the channel secret is empty', () => {
    const sig = makeSignature(secret, body)
    expect(verifyLineSignature('', body, sig)).toBe(false)
  })

  it('handles empty body correctly (signature over empty string)', () => {
    const emptyBody = ''
    const sig = makeSignature(secret, emptyBody)
    expect(verifyLineSignature(secret, emptyBody, sig)).toBe(true)
  })

  it('does not throw when lengths differ (length-guard prevents timingSafeEqual throw)', () => {
    // A base64 string of the wrong decoded length would cause timingSafeEqual
    // to throw if we did not guard on length first.
    const shortSig = Buffer.from('short').toString('base64') // 4 bytes decoded
    expect(() => verifyLineSignature(secret, body, shortSig)).not.toThrow()
    expect(verifyLineSignature(secret, body, shortSig)).toBe(false)
  })
})
