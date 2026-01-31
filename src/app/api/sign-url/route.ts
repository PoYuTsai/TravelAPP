// src/app/api/sign-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateSignedUrl, getSigningSecret } from '@/lib/signed-url'
import { checkRateLimit, getClientIP } from '@/lib/api-auth'
import { apiLogger } from '@/lib/logger'

// Valid export types
const VALID_TYPES = ['pdf', 'excel', 'text'] as const
type ExportType = typeof VALID_TYPES[number]

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 60, 60000) // 60 requests per minute
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') as ExportType | null

    // Validate parameters
    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter' },
        { status: 400 }
      )
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be one of: pdf, excel, text' },
        { status: 400 }
      )
    }

    // Validate id format (Sanity document IDs)
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      return NextResponse.json(
        { error: 'Invalid id format' },
        { status: 400 }
      )
    }

    // Generate signed URL
    const secret = getSigningSecret()
    const signedUrl = generateSignedUrl(id, type, secret)

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    apiLogger.error('Sign URL error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    )
  }
}
