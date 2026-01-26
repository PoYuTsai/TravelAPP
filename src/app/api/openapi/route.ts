import { NextResponse } from 'next/server'
import { openApiSpec } from '@/lib/openapi'

const ALLOWED_ORIGINS = [
  'https://chiangway-travel.com',
  'https://www.chiangway-travel.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
]

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || ''

  // 只有在 origin 匹配白名單時才設置 CORS 頭
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  // OpenAPI spec 是公開文檔，允許所有人讀取
  // 但跨域請求只允許白名單內的 origin
  return NextResponse.json(openApiSpec, { headers })
}
