/**
 * LINE webhook signature verification using Node's built-in crypto.
 *
 * LINE signs webhook payloads with HMAC-SHA256 over the raw request body,
 * base64-encoded, and sends the result in the `x-line-signature` header.
 *
 * Security design:
 * - Uses `crypto.timingSafeEqual` to prevent timing-oracle attacks.
 * - Guards on buffer length BEFORE calling `timingSafeEqual` because that
 *   function throws if the two buffers have different byte lengths.
 * - Catches all exceptions so attacker-controlled input (truncated base64,
 *   garbage strings, null) never causes an unhandled throw.
 * - Returns `false` (not throws) on any malformed or mismatched input.
 */

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify that a LINE webhook request has a valid signature.
 *
 * @param channelSecret   - The LINE channel secret from the provider console.
 * @param rawBody         - The raw (UTF-8) request body as a string.
 * @param signatureHeader - The value of the `x-line-signature` HTTP header.
 * @returns `true` iff the signature is valid; `false` for any failure/mismatch.
 */
export function verifyLineSignature(
  channelSecret: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  try {
    // Guard: reject empty secret or falsy header immediately
    if (!channelSecret || !signatureHeader) return false

    // Compute expected HMAC-SHA256 of the raw body, base64-encoded
    const expected = createHmac('sha256', channelSecret)
      .update(rawBody)
      .digest('base64')

    // Decode both sides to Buffer for timingSafeEqual
    const expectedBuf = Buffer.from(expected, 'base64')
    const actualBuf = Buffer.from(signatureHeader, 'base64')

    // Length guard: timingSafeEqual throws if lengths differ
    if (expectedBuf.length !== actualBuf.length) return false

    return timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    // Never propagate exceptions on attacker-controlled input
    return false
  }
}
