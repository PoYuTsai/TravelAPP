import { NextResponse } from 'next/server'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'

interface TelegramGetFileResponse {
  ok: boolean
  result?: {
    file_path?: string
  }
  description?: string
}

async function resolveTelegramFilePath(botToken: string, fileId: string): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  )

  if (!response.ok) {
    throw new Error(`Telegram getFile failed with status ${response.status}`)
  }

  const payload = (await response.json()) as TelegramGetFileResponse
  if (!payload.ok || typeof payload.result?.file_path !== 'string') {
    throw new Error(payload.description || 'Telegram getFile did not return a file path')
  }

  return payload.result.file_path
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const runtime = getLineAssistantRuntime()
  const media = await runtime.telegramMediaStore.get(params.token)

  if (!media) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is required' }, { status: 500 })
  }

  try {
    const filePath = await resolveTelegramFilePath(botToken, media.telegramFileId)
    const response = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`)

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to fetch telegram media' }, { status: 502 })
    }

    const contentType = response.headers.get('content-type') || media.contentType || 'image/jpeg'

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=300',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to proxy media' },
      { status: 502 }
    )
  }
}
