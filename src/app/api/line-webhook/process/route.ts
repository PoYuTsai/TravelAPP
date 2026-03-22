import { NextResponse } from 'next/server'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { validateLineAssistantCronRequest } from '@/lib/line-assistant/cron-auth'
import { processPendingInboundEvents } from '@/lib/line-assistant/process/process-pending-events'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'
import { apiLogger } from '@/lib/logger'

const lineWebhookProcessLogger = apiLogger.child('line-webhook-process')

export async function POST(request: Request) {
  let config

  try {
    config = getLineAssistantConfig(process.env)
  } catch (error) {
    lineWebhookProcessLogger.error(
      'LINE assistant processor is not configured',
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authError = validateLineAssistantCronRequest(request, config.cron.secret)
  if (authError) {
    return authError
  }

  const payload = await request.json().catch(() => ({}))
  const limit = typeof payload?.limit === 'number' ? payload.limit : 20
  const runtime = getLineAssistantRuntime()

  const result = await processPendingInboundEvents({
    ...runtime,
    limit,
  })

  return NextResponse.json({
    ok: true,
    result,
  })
}
