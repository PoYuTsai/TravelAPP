import { NextRequest, NextResponse } from 'next/server'
import {
  DASHBOARD_ALLOWED_EMAILS,
  checkRateLimit,
  getClientIP,
  isDashboardEmailAllowed,
  normalizeEmail,
} from '@/lib/api-auth'
import { authLogger } from '@/lib/logger'
import { getSanityCurrentUser } from '@/lib/sanity-auth'
import { generateSessionToken } from '@/lib/session-token'
import { getSigningSecret } from '@/lib/signed-url'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function getAllowedStudioOrigins(): string[] {
  return Array.from(
    new Set(
      [
        process.env.NEXT_PUBLIC_SITE_URL,
        'https://chiangway-travel.com',
        'https://www.chiangway-travel.com',
      ]
        .filter(Boolean)
        .map((origin) => origin!.replace(/\/$/, ''))
    )
  )
}

function validateOrigin(request: NextRequest): boolean {
  if (!IS_PRODUCTION) {
    return true
  }

  const origin = request.headers.get('origin')?.replace(/\/$/, '')
  const referer = request.headers.get('referer')
  const secFetchSite = request.headers.get('sec-fetch-site')
  const allowedOrigins = getAllowedStudioOrigins()

  if (!origin || !referer || !allowedOrigins.includes(origin)) {
    return false
  }

  if (secFetchSite && secFetchSite !== 'same-origin') {
    return false
  }

  try {
    const refererUrl = new URL(referer)
    return refererUrl.origin === origin && refererUrl.pathname.startsWith('/studio')
  } catch {
    return false
  }
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  return authHeader.slice(7).trim() || null
}

async function getLegacyDevEmail(request: NextRequest): Promise<string | null> {
  if (IS_PRODUCTION) {
    return null
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    const body = await request.json()
    return normalizeEmail(body?.email?.toString())
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(`auth:${clientIP}`, 10, 60000)
  if (rateLimitError) {
    authLogger.warn('Session token rate limited', { clientIP })
    return rateLimitError
  }

  if (!validateOrigin(request)) {
    authLogger.warn('Session token request from invalid origin', {
      clientIP,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      secFetchSite: request.headers.get('sec-fetch-site'),
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const sanityToken = getBearerToken(request)

    let email = ''
    let authSource: 'sanity-token' | 'legacy-dev-email' | null = null

    if (sanityToken) {
      const user = await getSanityCurrentUser(sanityToken)
      email = normalizeEmail(user?.email)
      authSource = 'sanity-token'

      if (!email) {
        authLogger.warn('Session token request with invalid Sanity token', { clientIP })
        return NextResponse.json({ error: 'Invalid Sanity authentication' }, { status: 401 })
      }
    } else {
      const legacyEmail = await getLegacyDevEmail(request)
      if (legacyEmail) {
        email = legacyEmail
        authSource = 'legacy-dev-email'
      }
    }

    if (!email) {
      return NextResponse.json({ error: 'Missing Sanity authentication' }, { status: 401 })
    }

    if (DASHBOARD_ALLOWED_EMAILS.length === 0) {
      if (IS_PRODUCTION) {
        authLogger.error('CRITICAL: DASHBOARD_ALLOWED_EMAILS not configured in production')
        return NextResponse.json({ error: 'Dashboard access is not configured' }, { status: 500 })
      }
    } else if (!isDashboardEmailAllowed(email)) {
      authLogger.warn('Session token request from unauthorized email', { email, clientIP, authSource })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const secret = getSigningSecret()
    const { token, expiresAt } = generateSessionToken(email, secret)

    authLogger.info('Session token issued', {
      email,
      clientIP,
      authSource,
      expiresAt: new Date(expiresAt).toISOString(),
    })

    return NextResponse.json({
      token,
      expiresAt,
      email,
    })
  } catch (error) {
    authLogger.error('Session token error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
