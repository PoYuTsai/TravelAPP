import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

function isValidSecret(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected || provided.length !== expected.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

export function validateLineAssistantCronRequest(
  request: Request,
  secret: string | null
): NextResponse | null {
  const providedSecret = request.headers.get('authorization')?.replace('Bearer ', '') ?? null

  if (!isValidSecret(providedSecret, secret)) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  return null
}
