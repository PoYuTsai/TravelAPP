import { describe, expect, it } from 'vitest'
import { createMemoryAuditLog } from '@/lib/line-assistant/audit-log'
import { buildWeeklyReport } from '@/lib/line-assistant/jobs/weekly-report'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import type { ConversationDraft } from '@/lib/line-assistant/types'

function createDraft(overrides: Partial<ConversationDraft> = {}): ConversationDraft {
  return {
    id: 'draft-1',
    conversationId: 'conv-1',
    createdAt: '2026-03-22T00:00:00.000Z',
    createdFromEventId: 'evt-1',
    status: 'sent',
    originalDraft: 'Hello from Chiangway Travel',
    feedbackTags: ['ok'],
    ...overrides,
  }
}

describe('buildWeeklyReport', () => {
  it('aggregates feedback signals and recommends prompt improvements', async () => {
    const draftStore = createMemoryDraftStore([
      createDraft({
        id: 'draft-1',
        feedbackTags: ['too_long'],
      }),
      createDraft({
        id: 'draft-2',
        feedbackTags: ['too_cold'],
      }),
      createDraft({
        id: 'draft-3',
        feedbackTags: ['ok'],
      }),
    ])
    const auditLog = createMemoryAuditLog([
      {
        id: 'audit-1',
        actionId: 'action-1',
        conversationId: 'conv-1',
        draftId: 'draft-1',
        lineUserId: 'line-user-1',
        outcome: 'sent',
        createdAt: '2026-03-22T00:00:00.000Z',
      },
      {
        id: 'audit-2',
        actionId: 'action-2',
        conversationId: 'conv-2',
        draftId: 'draft-2',
        lineUserId: 'line-user-2',
        outcome: 'failed',
        createdAt: '2026-03-22T00:10:00.000Z',
      },
      {
        id: 'audit-3',
        actionId: 'action-3',
        conversationId: 'conv-2',
        draftId: 'draft-2',
        lineUserId: 'line-user-2',
        outcome: 'duplicate',
        createdAt: '2026-03-22T00:15:00.000Z',
      },
    ])

    const result = await buildWeeklyReport({
      draftStore,
      auditLog,
      now: '2026-03-22T12:00:00.000Z',
    })

    expect(result.sentCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(result.duplicateCount).toBe(1)
    expect(result.feedbackTagCounts.too_long).toBe(1)
    expect(result.feedbackTagCounts.too_cold).toBe(1)
    expect(result.recommendations).toContain(
      'Shorten default replies and move itinerary detail behind a follow-up prompt.'
    )
    expect(result.recommendations).toContain(
      'Add more empathy and family-travel context to the opening sentence.'
    )
    expect(result.recommendations).toContain(
      'Review failed LINE sends and add retry or operator alerting before rollout.'
    )
  })
})
