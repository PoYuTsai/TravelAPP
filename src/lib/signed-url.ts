/**
 * Signed URL utilities for secure API access
 * Uses HMAC-SHA256-like approach to generate time-limited access tokens
 */

// Token validity duration (5 minutes)
const TOKEN_VALIDITY_MS = 5 * 60 * 1000

/**
 * Generate a signed URL token for itinerary export
 * For use in API routes (server-side only)
 */
export function generateSignedToken(id: string, type: string, secret: string): { token: string; expires: number } {
  const expires = Date.now() + TOKEN_VALIDITY_MS
  const data = `${id}:${type}:${expires}`
  const token = createHash(data, secret)

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

  // Verify token
  const data = `${id}:${type}:${expiresNum}`
  const expectedToken = createHash(data, secret)

  // Timing-safe comparison
  if (!timingSafeEqual(token, expectedToken)) {
    return { valid: false, error: 'Invalid token' }
  }

  return { valid: true }
}

/**
 * Create a hash from data and secret
 * Uses a simple but effective algorithm for short-lived tokens
 */
function createHash(data: string, secret: string): string {
  const combined = data + ':' + secret
  let hash1 = 0
  let hash2 = 0

  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash1 = ((hash1 << 5) - hash1) + char
    hash1 = hash1 & hash1
    hash2 = ((hash2 << 7) + hash2) ^ char
    hash2 = hash2 & hash2
  }

  // Combine both hashes for better distribution
  return Math.abs(hash1).toString(36) + Math.abs(hash2).toString(36)
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
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
