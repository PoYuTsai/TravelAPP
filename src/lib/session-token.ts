/**
 * Session Token utilities for Sanity Studio authentication
 * Uses HMAC-SHA256 for secure user session verification
 *
 * This replaces the forgeable x-user-email header with a signed token system.
 */

import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto'

// Session token validity duration (1 hour)
const SESSION_TOKEN_VALIDITY_MS = 60 * 60 * 1000

// Token format version (for future migrations)
const TOKEN_VERSION = 'v1'

interface SessionTokenPayload {
  version: string
  email: string
  issuedAt: number
  expiresAt: number
}

/**
 * Generate a signed session token for a user
 * For use in API routes (server-side only)
 */
export function generateSessionToken(email: string, secret: string): { token: string; expiresAt: number } {
  const issuedAt = Date.now()
  const expiresAt = issuedAt + SESSION_TOKEN_VALIDITY_MS

  // Create payload string
  const payload = `${TOKEN_VERSION}:${email.toLowerCase().trim()}:${issuedAt}:${expiresAt}`
  const signature = createHmacHash(payload, secret)

  // Token format: base64(payload):signature
  const encodedPayload = Buffer.from(payload).toString('base64url')
  const token = `${encodedPayload}.${signature}`

  return { token, expiresAt }
}

/**
 * Verify a session token and extract the email
 * Returns the email if valid, null if invalid
 */
export function verifySessionToken(
  token: string,
  secret: string
): { valid: true; email: string } | { valid: false; error: string } {
  // Parse token
  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token format' }
  }

  const [encodedPayload, signature] = parts

  // Decode payload
  let payload: string
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString()
  } catch {
    return { valid: false, error: 'Invalid token encoding' }
  }

  // Parse payload
  const payloadParts = payload.split(':')
  if (payloadParts.length !== 4) {
    return { valid: false, error: 'Invalid payload format' }
  }

  const [version, email, issuedAtStr, expiresAtStr] = payloadParts
  const issuedAt = parseInt(issuedAtStr, 10)
  const expiresAt = parseInt(expiresAtStr, 10)

  // Version check
  if (version !== TOKEN_VERSION) {
    return { valid: false, error: 'Unsupported token version' }
  }

  // Time validation
  if (isNaN(issuedAt) || isNaN(expiresAt)) {
    return { valid: false, error: 'Invalid timestamp format' }
  }

  const now = Date.now()
  if (now > expiresAt) {
    return { valid: false, error: 'Token expired' }
  }

  // Sanity check: issued in the future?
  if (issuedAt > now + 60000) {
    // Allow 1 minute clock skew
    return { valid: false, error: 'Token issued in the future' }
  }

  // Verify signature
  const expectedSignature = createHmacHash(payload, secret)
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'Invalid signature' }
  }

  return { valid: true, email }
}

/**
 * Create HMAC-SHA256 hash
 * Returns full 64 character hex string (256 bits) for session tokens
 */
function createHmacHash(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex')
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  try {
    return cryptoTimingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/**
 * Parse session token from request header
 * Supports both new token format and legacy x-user-email
 */
export function parseSessionAuth(
  authHeader: string | null,
  legacyEmailHeader: string | null,
  secret: string,
  allowLegacy: boolean = false
): { valid: true; email: string; isLegacy: boolean } | { valid: false; error: string } {
  // Try new Bearer token first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const result = verifySessionToken(token, secret)
    if (result.valid) {
      return { valid: true, email: result.email, isLegacy: false }
    }
    return result
  }

  // Fall back to legacy x-user-email (only in development or if explicitly allowed)
  if (allowLegacy && legacyEmailHeader) {
    return { valid: true, email: legacyEmailHeader.toLowerCase().trim(), isLegacy: true }
  }

  return { valid: false, error: 'Missing authentication' }
}
