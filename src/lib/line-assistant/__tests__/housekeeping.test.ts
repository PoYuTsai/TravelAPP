import { describe, expect, it } from 'vitest'
import { runHousekeeping } from '@/lib/line-assistant/jobs/housekeeping'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import type { Conversation, CustomerInquiry } from '@/lib/line-assistant/types'

function createInquiry(overrides: Partial<CustomerInquiry> = {}): CustomerInquiry {
  return {
    id: 'inq-1',
    sourceEventId: 'evt-1',
    lineUserId: 'line-user-1',
    customerName: 'Wang Family',
    hasSeenBeforeInSystem: false,
    notionMatchConfidence: 'none',
    matchedNotionRecordIds: [],
    travelDates: null,
    duration: null,
    adults: 2,
    children: 0,
    childrenAges: null,
    attractions: [],
    budget: null,
    accommodation: null,
    specialNeeds: [],
    inquiryType: 'new',
    urgency: 'normal',
    conversionSignal: false,
    rawMessage: 'hello',
    rawMessagePreview: 'hello',
    timestamp: '2026-03-22T00:00:00.000Z',
    ...overrides,
  }
}

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    lineUserId: 'line-user-1',
    customerName: 'Wang Family',
    status: 'waiting_customer',
    lastActivityAt: '2026-03-20T00:00:00.000Z',
    lastProcessedLineEventId: 'evt-1',
    pendingDraftId: null,
    latestInquiry: createInquiry(),
    tgTopicId: 'topic-1',
    messages: [
      {
        id: 'msg-1',
        source: 'line',
        role: 'customer',
        content: 'hello',
        contentType: 'text',
        timestamp: '2026-03-20T00:00:00.000Z',
      },
    ],
    metadata: {},
    ...overrides,
  }
}

describe('runHousekeeping', () => {
  it('archives conversations after 7 days and prunes raw content after 30 days', async () => {
    const conversationStore = createMemoryConversationStore([
      createConversation({
        id: 'conv-cold',
        lineUserId: 'line-user-cold',
        lastActivityAt: '2026-03-20T00:00:00.000Z',
      }),
      createConversation({
        id: 'conv-archive',
        lineUserId: 'line-user-archive',
        lastActivityAt: '2026-03-10T00:00:00.000Z',
      }),
      createConversation({
        id: 'conv-prune',
        lineUserId: 'line-user-prune',
        status: 'archived',
        lastActivityAt: '2026-02-15T00:00:00.000Z',
      }),
    ])

    const result = await runHousekeeping({
      conversationStore,
      now: '2026-03-22T00:00:00.000Z',
    })

    const coldConversation = await conversationStore.getByLineUserId('line-user-cold')
    const archivedConversation = await conversationStore.getByLineUserId('line-user-archive')
    const prunedConversation = await conversationStore.getByLineUserId('line-user-prune')

    expect(result.coldCount).toBe(1)
    expect(result.archivedCount).toBe(1)
    expect(result.prunedCount).toBe(1)
    expect(coldConversation?.status).toBe('cold')
    expect(archivedConversation?.status).toBe('archived')
    expect(prunedConversation?.messages[0]?.content).toBe('[pruned]')
  })

  it('hard deletes conversations that stayed deleted for more than 24 hours', async () => {
    const conversationStore = createMemoryConversationStore([
      createConversation({
        id: 'conv-deleted',
        lineUserId: 'line-user-deleted',
        status: 'deleted',
        lastActivityAt: '2026-03-20T00:00:00.000Z',
        metadata: {
          deletedAt: '2026-03-20T00:00:00.000Z',
          cleanupReason: 'manual_delete',
        },
      }),
    ])

    const result = await runHousekeeping({
      conversationStore,
      now: '2026-03-22T00:00:00.000Z',
    })

    expect(result.deletedCount).toBe(1)
    expect(await conversationStore.getByLineUserId('line-user-deleted')).toBeNull()
  })
})
