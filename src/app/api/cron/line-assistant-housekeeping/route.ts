import { NextResponse } from 'next/server'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { validateLineAssistantCronRequest } from '@/lib/line-assistant/cron-auth'
import { runHousekeeping } from '@/lib/line-assistant/jobs/housekeeping'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'

export async function POST(request: Request) {
  const config = getLineAssistantConfig(process.env)
  const authError = validateLineAssistantCronRequest(request, config.cron.secret)
  if (authError) {
    return authError
  }

  const result = await runHousekeeping({
    conversationStore: getLineAssistantRuntime().conversationStore,
  })

  return NextResponse.json({ ok: true, result })
}
