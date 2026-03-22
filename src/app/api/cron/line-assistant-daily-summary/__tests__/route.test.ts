import { beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/cron/line-assistant-daily-summary/route'
import { createMemoryAuditLog } from '@/lib/line-assistant/audit-log'
import { configureLineAssistantRuntimeForTests, resetLineAssistantRuntimeForTests } from '@/lib/line-assistant/runtime'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
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

function createRequest(secret: string): Request {
  return new Request('https://chiangway-travel.com/api/cron/line-assistant-daily-summary', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
    },
  })
}

describe('POST /api/cron/line-assistant-daily-summary', () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.LINE_CHANNEL_SECRET = 'line-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token'
    process.env.TELEGRAM_GROUP_ID = '-1001234567890'
    process.env.LINE_ASSISTANT_CRON_SECRET = 'cron-secret'

    configureLineAssistantRuntimeForTests({
      conversationStore: createMemoryConversationStore([
        createConversation({
          id: 'conv-1',
          lineUserId: 'line-user-1',
          status: 'waiting_eric',
        }),
        createConversation({
          id: 'conv-2',
          lineUserId: 'line-user-2',
          status: 'waiting_customer',
        }),
      ]),
      draftStore: createMemoryDraftStore([
        createDraft({
          id: 'draft-1',
          conversationId: 'conv-1',
          status: 'pending',
        }),
      ]),
      auditLog: createMemoryAuditLog([
        {
          id: 'audit-1',
          actionId: 'action-1',
          conversationId: 'conv-2',
          draftId: 'draft-2',
          lineUserId: 'line-user-2',
          outcome: 'sent',
          createdAt: '2026-03-22T00:05:00.000Z',
        },
      ]),
    })
  })

  it('reads counts from the configured shared runtime stores', async () => {
    const response = await POST(createRequest('cron-secret'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.result.waitingEricCount).toBe(1)
    expect(payload.result.waitingCustomerCount).toBe(1)
    expect(payload.result.pendingDraftCount).toBe(1)
    expect(payload.result.sentTodayCount).toBe(1)
  })

  afterEach(() => {
    resetLineAssistantRuntimeForTests()
  })
})
