import { NextResponse } from 'next/server'
import { openApiSpec } from '@/lib/openapi'

const ALLOWED_ORIGINS = [
  'https://chiangway-travel.com',
  'https://www.chiangway-travel.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
]

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin,
    },
  })
}
