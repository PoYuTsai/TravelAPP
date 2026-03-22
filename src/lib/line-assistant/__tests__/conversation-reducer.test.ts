import { describe, expect, it } from 'vitest'
import { reduceConversation } from '@/lib/line-assistant/domain/conversation-reducer'
import type { Conversation, CustomerInquiry } from '@/lib/line-assistant/types'

function createInquiry(overrides: Partial<CustomerInquiry> = {}): CustomerInquiry {
  return {
    id: 'inq-1',
    sourceEventId: 'evt-1',
    lineUserId: 'line-user-1',
    customerName: '王先生',
    hasSeenBeforeInSystem: false,
    notionMatchConfidence: 'none',
    matchedNotionRecordIds: [],
    travelDates: null,
    duration: null,
    adults: null,
    children: null,
    childrenAges: null,
    attractions: [],
    budget: null,
    accommodation: null,
    specialNeeds: [],
    inquiryType: 'new',
    urgency: 'normal',
    conversionSignal: false,
    rawMessage: '想問 4 月中清邁包車',
    rawMessagePreview: '想問 4 月中清邁包車',
    timestamp: '2026-03-22T00:00:00.000Z',
    ...overrides,
  }
}

function createConversation(): Conversation {
  return {
    id: 'conv-1',
    lineUserId: 'line-user-1',
    customerName: '王先生',
    status: 'waiting_customer',
    lastActivityAt: '2026-03-22T00:00:00.000Z',
    lastProcessedLineEventId: 'evt-1',
    pendingDraftId: 'draft-1',
    latestInquiry: createInquiry(),
    tgTopicId: 'topic-1',
    messages: [],
    metadata: {},
  }
}

describe('reduceConversation', () => {
  it('supersedes the old pending draft when a new customer message arrives', () => {
    const next = reduceConversation(createConversation(), {
      type: 'customer_message',
      lineEventId: 'evt-2',
      occurredAt: '2026-03-22T01:00:00.000Z',
      latestInquiry: createInquiry({
        id: 'inq-2',
        sourceEventId: 'evt-2',
        rawMessage: '我們改成 2 大 2 小',
        rawMessagePreview: '我們改成 2 大 2 小',
        adults: 2,
        children: 2,
        timestamp: '2026-03-22T01:00:00.000Z',
      }),
      message: {
        id: 'msg-1',
        source: 'line',
        role: 'customer',
        content: '我們改成 2 大 2 小',
        contentType: 'text',
        timestamp: '2026-03-22T01:00:00.000Z',
        sourceEventId: 'evt-2',
      },
    })

    expect(next.status).toBe('waiting_eric')
    expect(next.pendingDraftId).toBeNull()
    expect(next.lastProcessedLineEventId).toBe('evt-2')
    expect(next.messages).toHaveLength(1)
    expect(next.latestInquiry.adults).toBe(2)
  })
})
