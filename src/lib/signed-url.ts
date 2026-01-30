/**
 * Signed URL utilities for secure API access
 * Uses HMAC-SHA256 for cryptographically secure tokens
 */

import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto'

// Token validity duration (5 minutes)
const TOKEN_VALIDITY_MS = 5 * 60 * 1000

/**
 * Generate a signed URL token for itinerary export
 * For use in API routes (server-side only)
 */
export function generateSignedToken(id: string, type: string, secret: string): { token: string; expires: number } {
  const expires = Date.now() + TOKEN_VALIDITY_MS
  const data = `${id}:${type}:${expires}`
  const token = createHmacHash(data, secret)

  return { token, expires }
}

/**
 * Generate full signed URL for itinerary export
 */
export function generateSignedUrl(id: string, type: 'pdf' | 'excel' | 'text', secret: string): string {
  const { token, expires } = generateSignedToken(id, type, secret)
  return `/api/itinerary/${id}/${type}?token=${token}&expires=${expires}`
}

/**
 * Verify a signed URL token
 * For use in API routes (server-side)
 */
export function verifySignedToken(
  id: string,
  type: string,
  token: string,
  expires: string | number,
  secret: string
): { valid: boolean; error?: string } {
  // Check if expired
  const expiresNum = typeof expires === 'string' ? parseInt(expires, 10) : expires
  if (isNaN(expiresNum)) {
    return { valid: false, error: 'Invalid expires format' }
  }

  if (Date.now() > expiresNum) {
    return { valid: false, error: 'Token expired' }
  }

  // Verify token using timing-safe comparison
  const data = `${id}:${type}:${expiresNum}`
  const expectedToken = createHmacHash(data, secret)

  if (!timingSafeEqual(token, expectedToken)) {
    return { valid: false, error: 'Invalid token' }
  }

  return { valid: true }
}

/**
 * Create HMAC-SHA256 hash from data and secret
 * Returns first 32 characters for shorter URLs while maintaining security
 */
function createHmacHash(data: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .slice(0, 32) // Truncate for shorter URLs, still cryptographically strong
}

/**
 * Timing-safe string comparison using Node.js crypto
 * Prevents timing attacks
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
 * Get the signing secret from environment
 * Uses REVALIDATE_SECRET which is already configured
 */
export function getSigningSecret(): string {
  const secret = process.env.REVALIDATE_SECRET || process.env.NEXT_PUBLIC_SIGNING_SECRET
  if (!secret) {
    throw new Error('REVALIDATE_SECRET environment variable is required for signed URLs')
  }
  return secret
}
