import { beforeEach, describe, expect, it } from 'vitest'
import { handleTelegramAction } from '@/lib/line-assistant/actions/handle-telegram-action'
import { configureLineAssistantRuntimeForTests, resetLineAssistantRuntimeForTests } from '@/lib/line-assistant/runtime'
import { createMemoryAuditLog } from '@/lib/line-assistant/audit-log'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import { createMemoryIdempotencyStore } from '@/lib/line-assistant/storage/idempotency-store'
import { createMemoryLineMessageSender } from '@/lib/line-assistant/line/send-message'
import type { Conversation, ConversationDraft, CustomerInquiry } from '@/lib/line-assistant/types'

function createInquiry(overrides: Partial<CustomerInquiry> = {}): CustomerInquiry {
  return {
    id: 'inq-1',
    sourceEventId: 'evt-1',
    lineUserId: 'line-user-1',
    customerName: 'Wang Family',
    hasSeenBeforeInSystem: false,
    notionMatchConfidence: 'none',
    matchedNotionRecordIds: [],
    travelDates: '2026-04-12 to 2026-04-16',
    duration: '5 days',
    adults: 2,
    children: 2,
    childrenAges: '4,7',
    attractions: ['zoo'],
    budget: null,
    accommodation: null,
    specialNeeds: [],
    inquiryType: 'new',
    urgency: 'normal',
    conversionSignal: true,
    rawMessage: 'Need a 5 day family charter in Chiang Mai.',
    rawMessagePreview: 'Need a 5 day family charter in Chiang Mai.',
    timestamp: '2026-03-22T00:00:00.000Z',
    ...overrides,
  }
}

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    lineUserId: 'line-user-1',
    customerName: 'Wang Family',
    status: 'waiting_eric',
    lastActivityAt: '2026-03-22T00:00:00.000Z',
    lastProcessedLineEventId: 'evt-1',
    pendingDraftId: 'draft-1',
    latestInquiry: createInquiry(),
    tgTopicId: 'topic-1',
    messages: [],
    metadata: {},
    ...overrides,
  }
}

function createDraft(overrides: Partial<ConversationDraft> = {}): ConversationDraft {
  return {
    id: 'draft-1',
    conversationId: 'conv-1',
    createdAt: '2026-03-22T00:00:00.000Z',
    createdFromEventId: 'evt-1',
    status: 'pending',
    originalDraft: 'Hello from Chiangway Travel',
    ...overrides,
  }
}

describe('handleTelegramAction shared runtime defaults', () => {
  beforeEach(() => {
    configureLineAssistantRuntimeForTests({
      conversationStore: createMemoryConversationStore([createConversation()]),
      draftStore: createMemoryDraftStore([createDraft()]),
      idempotencyStore: createMemoryIdempotencyStore(),
      lineSender: createMemoryLineMessageSender(),
      auditLog: createMemoryAuditLog(),
    })
  })

  it('uses the configured shared runtime when no explicit dependencies are passed', async () => {
    const result = await handleTelegramAction({
      actionId: 'action-1',
      type: 'send',
      conversationId: 'conv-1',
      draftId: 'draft-1',
      lineUserId: 'line-user-1',
      receivedAt: '2026-03-22T00:05:00.000Z',
    })

    expect(result.status).toBe('sent')
  })

  afterEach(() => {
    resetLineAssistantRuntimeForTests()
  })
})
