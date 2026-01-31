// src/lib/api-auth.ts
// API Authentication utilities

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { authLogger } from './logger'

// API Key for internal services (itinerary export, etc.)
const API_KEY = process.env.INTERNAL_API_KEY
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Dashboard allowed emails (trim spaces from each email)
const DASHBOARD_ALLOWED_EMAILS = (process.env.DASHBOARD_ALLOWED_EMAILS || '')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean)

/**
 * Validate API key from request headers
 * Returns error response if invalid, null if valid
 *
 * Note: Currently reserved for future use with external API integrations.
 * Internal APIs use validateDashboardAccess or signed URLs instead.
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  // In production, API key is mandatory
  if (!API_KEY) {
    if (IS_PRODUCTION) {
      authLogger.error('CRITICAL: INTERNAL_API_KEY not configured in production')
      return NextResponse.json(
        { error: '伺服器設定錯誤', code: 'SERVER_CONFIG_ERROR' },
        { status: 500 }
      )
    }
    // Development mode only - warn but allow
    authLogger.warn('INTERNAL_API_KEY not configured, API validation disabled in development')
    return null
  }

  const authHeader = request.headers.get('authorization')
  const apiKey = request.headers.get('x-api-key')

  // Check Authorization: Bearer <key> or X-API-Key header
  const providedKey = authHeader?.replace('Bearer ', '') || apiKey

  if (!providedKey) {
    return NextResponse.json(
      { error: '需要 API 金鑰', code: 'MISSING_API_KEY' },
      { status: 401 }
    )
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const keyBuffer = Buffer.from(API_KEY)
    const providedBuffer = Buffer.from(providedKey)
    if (keyBuffer.length !== providedBuffer.length || !timingSafeEqual(keyBuffer, providedBuffer)) {
      return NextResponse.json(
        { error: 'API 金鑰無效', code: 'INVALID_API_KEY' },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'API 金鑰無效', code: 'INVALID_API_KEY' },
      { status: 403 }
    )
  }

  return null // Valid
}

/**
 * Validate dashboard access by email
 * Returns error response if invalid, null if valid
 */
export function validateDashboardAccess(request: Request): NextResponse | null {
  // Check if whitelist is configured
  if (DASHBOARD_ALLOWED_EMAILS.length === 0) {
    if (IS_PRODUCTION) {
      authLogger.error('CRITICAL: DASHBOARD_ALLOWED_EMAILS not configured in production')
      return NextResponse.json(
        { error: '伺服器設定錯誤', code: 'SERVER_CONFIG_ERROR' },
        { status: 500 }
      )
    }
    // Development mode - allow without email check
    return null
  }

  const userEmail = request.headers.get('x-user-email')

  if (!userEmail) {
    return NextResponse.json(
      { error: '需要使用者驗證', code: 'MISSING_USER_EMAIL' },
      { status: 401 }
    )
  }

  if (!DASHBOARD_ALLOWED_EMAILS.includes(userEmail.toLowerCase().trim())) {
    return NextResponse.json(
      { error: '無權限存取 Dashboard', code: 'UNAUTHORIZED_EMAIL' },
      { status: 403 }
    )
  }

  return null // Valid
}

/**
 * Rate limiting state (simple in-memory implementation)
 * For production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_RATE_LIMIT_ENTRIES = 1000 // Prevent memory leak
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60000 // Clean every minute

/**
 * Clean up expired rate limit entries to prevent memory leak
 */
function cleanupRateLimitMap(): void {
  const now = Date.now()

  // Only cleanup periodically
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  // Remove expired entries
  const entries = Array.from(rateLimitMap.entries())
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }

  // If still too many entries, remove oldest ones (LRU-like)
  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const entriesToRemove = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES
    const keys = Array.from(rateLimitMap.keys())
    for (let i = 0; i < entriesToRemove; i++) {
      rateLimitMap.delete(keys[i])
    }
  }
}

/**
 * Simple rate limiting
 * @param identifier - IP address or user ID
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): NextResponse | null {
  const now = Date.now()

  // Periodically cleanup expired entries
  cleanupRateLimitMap()

  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    // New window - also delete old record if expired
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return null
  }

  if (record.count >= maxRequests) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試', code: 'RATE_LIMITED' },
      { status: 429 }
    )
  }

  record.count++
  return null
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown'
}
