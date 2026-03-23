// src/lib/api-auth.ts
// API authentication utilities

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { authLogger } from './logger'
import { parseSessionAuth } from './session-token'
import { getSigningSecret } from './signed-url'

const API_KEY = process.env.INTERNAL_API_KEY
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() || ''
}

const DEFAULT_DASHBOARD_ALLOWED_EMAILS = ['eric19921204@gmail.com']

export const DASHBOARD_ALLOWED_EMAILS = Array.from(
  new Set(
    [...DEFAULT_DASHBOARD_ALLOWED_EMAILS, ...(process.env.DASHBOARD_ALLOWED_EMAILS || '').split(',')]
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  )
)

export function isDashboardEmailAllowed(email: string): boolean {
  return DASHBOARD_ALLOWED_EMAILS.includes(normalizeEmail(email))
}

/**
 * Validate API key from request headers.
 * Returns an error response if invalid, null if valid.
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  if (!API_KEY) {
    if (IS_PRODUCTION) {
      authLogger.error('CRITICAL: INTERNAL_API_KEY not configured in production')
      return NextResponse.json(
        { error: 'Server authentication is not configured', code: 'SERVER_CONFIG_ERROR' },
        { status: 500 }
      )
    }

    authLogger.warn('INTERNAL_API_KEY not configured, API validation disabled in development')
    return null
  }

  const authHeader = request.headers.get('authorization')
  const apiKey = request.headers.get('x-api-key')
  const providedKey = authHeader?.replace('Bearer ', '') || apiKey

  if (!providedKey) {
    return NextResponse.json(
      { error: 'Missing API key', code: 'MISSING_API_KEY' },
      { status: 401 }
    )
  }

  try {
    const keyBuffer = Buffer.from(API_KEY)
    const providedBuffer = Buffer.from(providedKey)

    if (keyBuffer.length !== providedBuffer.length || !timingSafeEqual(keyBuffer, providedBuffer)) {
      return NextResponse.json(
        { error: 'Invalid API key', code: 'INVALID_API_KEY' },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid API key', code: 'INVALID_API_KEY' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Validate dashboard access using a signed session token.
 * Legacy x-user-email auth is allowed in development only.
 */
export function validateDashboardAccess(request: Request): NextResponse | null {
  if (DASHBOARD_ALLOWED_EMAILS.length === 0) {
    if (IS_PRODUCTION) {
      authLogger.error('CRITICAL: DASHBOARD_ALLOWED_EMAILS not configured in production')
      return NextResponse.json(
        { error: 'Dashboard access is not configured', code: 'SERVER_CONFIG_ERROR' },
        { status: 500 }
      )
    }

    return null
  }

  const authHeader = request.headers.get('authorization')
  const legacyEmailHeader = request.headers.get('x-user-email')

  let secret: string
  try {
    secret = getSigningSecret()
  } catch {
    authLogger.error('CRITICAL: Signing secret not configured')
    return NextResponse.json(
      { error: 'Session signing is not configured', code: 'SERVER_CONFIG_ERROR' },
      { status: 500 }
    )
  }

  const authResult = parseSessionAuth(authHeader, legacyEmailHeader, secret, !IS_PRODUCTION)

  if (!authResult.valid) {
    authLogger.debug('Dashboard auth failed', { error: authResult.error })
    return NextResponse.json(
      { error: 'Authentication failed', code: 'AUTH_FAILED' },
      { status: 401 }
    )
  }

  const normalizedEmail = normalizeEmail(authResult.email)

  if (authResult.isLegacy) {
    authLogger.debug('Using legacy email auth', { email: normalizedEmail })
  }

  if (!isDashboardEmailAllowed(normalizedEmail)) {
    authLogger.warn('Dashboard access denied', { email: normalizedEmail })
    return NextResponse.json(
      { error: 'This email is not allowed to access the dashboard', code: 'UNAUTHORIZED_EMAIL' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Rate limiting state (simple in-memory implementation).
 * For production, use Redis or similar.
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_RATE_LIMIT_ENTRIES = 1000
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60000

function cleanupRateLimitMap(): void {
  const now = Date.now()

  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const entries = Array.from(rateLimitMap.entries())
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }

  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    const entriesToRemove = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES
    const keys = Array.from(rateLimitMap.keys())
    for (let i = 0; i < entriesToRemove; i++) {
      rateLimitMap.delete(keys[i])
    }
  }
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): NextResponse | null {
  const now = Date.now()

  cleanupRateLimitMap()

  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return null
  }

  if (record.count >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
      { status: 429 }
    )
  }

  record.count++
  return null
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown'
}
