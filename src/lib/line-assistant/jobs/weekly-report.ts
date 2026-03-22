import type { AuditLog } from '../audit-log'
import type { DraftStore } from '../storage/draft-store'

export interface WeeklyReportResult {
  generatedAt: string
  sentCount: number
  dismissedCount: number
  failedCount: number
  duplicateCount: number
  feedbackTagCounts: Record<'ok' | 'too_long' | 'too_formal' | 'too_cold', number>
  recommendations: string[]
}

const FEEDBACK_TAGS = ['ok', 'too_long', 'too_formal', 'too_cold'] as const

export async function buildWeeklyReport(options: {
  draftStore: DraftStore
  auditLog: AuditLog
  now?: string
}): Promise<WeeklyReportResult> {
  const generatedAt = options.now ?? new Date().toISOString()
  const [drafts, auditEntries] = await Promise.all([
    options.draftStore.list(),
    options.auditLog.list(),
  ])

  const feedbackTagCounts = FEEDBACK_TAGS.reduce<Record<(typeof FEEDBACK_TAGS)[number], number>>(
    (acc, tag) => {
      acc[tag] = drafts.filter((draft) => draft.feedbackTags?.includes(tag)).length
      return acc
    },
    {
      ok: 0,
      too_long: 0,
      too_formal: 0,
      too_cold: 0,
    }
  )

  const sentCount = auditEntries.filter((entry) => entry.outcome === 'sent').length
  const dismissedCount = auditEntries.filter((entry) => entry.outcome === 'dismissed').length
  const failedCount = auditEntries.filter((entry) => entry.outcome === 'failed').length
  const duplicateCount = auditEntries.filter((entry) => entry.outcome === 'duplicate').length

  const recommendations: string[] = []
  if (feedbackTagCounts.too_long > 0) {
    recommendations.push('Shorten default replies and move itinerary detail behind a follow-up prompt.')
  }
  if (feedbackTagCounts.too_formal > 0) {
    recommendations.push('Reduce formal phrasing and keep the tone closer to Eric speaking in LINE.')
  }
  if (feedbackTagCounts.too_cold > 0) {
    recommendations.push('Add more empathy and family-travel context to the opening sentence.')
  }
  if (failedCount > 0) {
    recommendations.push('Review failed LINE sends and add retry or operator alerting before rollout.')
  }
  if (duplicateCount > 0) {
    recommendations.push('Keep monitoring duplicate callback volume to confirm idempotency is working in production.')
  }

  return {
    generatedAt,
    sentCount,
    dismissedCount,
    failedCount,
    duplicateCount,
    feedbackTagCounts,
    recommendations,
  }
}
