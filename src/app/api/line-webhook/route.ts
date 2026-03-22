import { NextResponse } from 'next/server'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { verifyLineSignature } from '@/lib/line-assistant/line/signature'
import { ingestLineEvents } from '@/lib/line-assistant/process/ingest-line-events'
import { apiLogger } from '@/lib/logger'

const lineWebhookLogger = apiLogger.child('line-webhook')

export async function POST(request: Request) {
  let config

  try {
    config = getLineAssistantConfig(process.env)
  } catch (error) {
    lineWebhookLogger.error(
      'LINE assistant webhook is not configured',
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')

  if (
    !verifyLineSignature({
      rawBody,
      signature,
      channelSecret: config.line.channelSecret,
    })
  ) {
    lineWebhookLogger.warn('LINE webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const result = await ingestLineEvents(rawBody)
    return NextResponse.json({
      ok: true,
      acceptedCount: result.acceptedCount,
      ignoredCount: result.ignoredCount,
    })
  } catch (error) {
    lineWebhookLogger.error(
      'LINE webhook ingestion failed',
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}
