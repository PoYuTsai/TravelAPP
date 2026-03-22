import { NextResponse } from 'next/server'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { validateLineAssistantCronRequest } from '@/lib/line-assistant/cron-auth'
import { buildWeeklyReport } from '@/lib/line-assistant/jobs/weekly-report'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'

export async function POST(request: Request) {
  const config = getLineAssistantConfig(process.env)
  const authError = validateLineAssistantCronRequest(request, config.cron.secret)
  if (authError) {
    return authError
  }

  const runtime = getLineAssistantRuntime()
  const result = await buildWeeklyReport({
    draftStore: runtime.draftStore,
    auditLog: runtime.auditLog,
  })

  return NextResponse.json({ ok: true, result })
}
