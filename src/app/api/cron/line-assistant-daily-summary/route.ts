import { NextResponse } from 'next/server'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { validateLineAssistantCronRequest } from '@/lib/line-assistant/cron-auth'
import { buildDailySummary } from '@/lib/line-assistant/jobs/daily-summary'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'

export async function POST(request: Request) {
  const config = getLineAssistantConfig(process.env)
  const authError = validateLineAssistantCronRequest(request, config.cron.secret)
  if (authError) {
    return authError
  }

  const runtime = getLineAssistantRuntime()
  const result = await buildDailySummary({
    conversationStore: runtime.conversationStore,
    draftStore: runtime.draftStore,
    auditLog: runtime.auditLog,
  })

  return NextResponse.json({ ok: true, result })
}
