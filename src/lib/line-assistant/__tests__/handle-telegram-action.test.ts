import { describe, expect, it } from 'vitest'
import { handleTelegramAction } from '@/lib/line-assistant/actions/handle-telegram-action'
import { createMemoryAuditLog } from '@/lib/line-assistant/audit-log'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import { createMemoryIdempotencyStore } from '@/lib/line-assistant/storage/idempotency-store'
import { createMemoryLineMessageSender } from '@/lib/line-assistant/line/send-message'
import type { Conversation, ConversationDraft, CustomerInquiry, TelegramAction } from '@/lib/line-assistant/types'

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
    attractions: ['zoo', 'elephant sanctuary'],
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
    originalDraft: 'Thanks for reaching out. I can help you plan a family-friendly 5 day charter.',
    ...overrides,
  }
}

function createAction(overrides: Partial<TelegramAction> = {}): TelegramAction {
  return {
    actionId: 'action-1',
    type: 'send',
    conversationId: 'conv-1',
    draftId: 'draft-1',
    lineUserId: 'line-user-1',
    receivedAt: '2026-03-22T00:05:00.000Z',
    telegramUserId: 'tg-user-1',
    telegramMessageId: 'tg-msg-1',
    ...overrides,
  }
}

describe('handleTelegramAction', () => {
  it('sends a draft exactly once even if the callback is retried', async () => {
    const conversationStore = createMemoryConversationStore([createConversation()])
    const draftStore = createMemoryDraftStore([createDraft()])
    const idempotencyStore = createMemoryIdempotencyStore()
    const lineSender = createMemoryLineMessageSender()
    const auditLog = createMemoryAuditLog()
    const action = createAction()

    const first = await handleTelegramAction(action, {
      conversationStore,
      draftStore,
      idempotencyStore,
      lineSender,
      auditLog,
    })
    const second = await handleTelegramAction(action, {
      conversationStore,
      draftStore,
      idempotencyStore,
      lineSender,
      auditLog,
    })

    const savedConversation = await conversationStore.getByLineUserId('line-user-1')
    const savedDraft = await draftStore.getById('draft-1')

    expect(first.status).toBe('sent')
    expect(second.status).toBe('duplicate')
    expect(lineSender.getSentMessages()).toHaveLength(1)
    expect(savedDraft?.status).toBe('sent')
    expect(savedDraft?.actionId).toBe('action-1')
    expect(savedConversation?.pendingDraftId).toBeNull()
    expect(savedConversation?.status).toBe('waiting_customer')
    expect(savedConversation?.messages).toHaveLength(1)
    expect(auditLog.listSync()).toHaveLength(2)
    expect(auditLog.listSync().map((entry) => entry.outcome)).toEqual(['sent', 'duplicate'])
  })

  it('marks a draft dismissed without sending a line message', async () => {
    const conversationStore = createMemoryConversationStore([createConversation()])
    const draftStore = createMemoryDraftStore([createDraft()])
    const idempotencyStore = createMemoryIdempotencyStore()
    const lineSender = createMemoryLineMessageSender()
    const auditLog = createMemoryAuditLog()

    const result = await handleTelegramAction(
      createAction({
        actionId: 'action-dismiss-1',
        type: 'dismiss',
      }),
      {
        conversationStore,
        draftStore,
        idempotencyStore,
        lineSender,
        auditLog,
      }
    )

    const savedConversation = await conversationStore.getByLineUserId('line-user-1')
    const savedDraft = await draftStore.getById('draft-1')

    expect(result.status).toBe('dismissed')
    expect(lineSender.getSentMessages()).toHaveLength(0)
    expect(savedDraft?.status).toBe('dismissed')
    expect(savedConversation?.status).toBe('waiting_eric')
    expect(savedConversation?.pendingDraftId).toBeNull()
    expect(auditLog.listSync()).toHaveLength(1)
    expect(auditLog.listSync()[0]?.outcome).toBe('dismissed')
  })
})
