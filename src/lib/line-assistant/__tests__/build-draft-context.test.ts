import { describe, expect, it } from 'vitest'
import { buildDraftContext } from '@/lib/line-assistant/process/build-draft-context'
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
    travelDates: '4/12-16',
    duration: null,
    adults: 2,
    children: 2,
    childrenAges: null,
    attractions: ['大象營', '夜間動物園'],
    budget: null,
    accommodation: null,
    specialNeeds: ['2張汽座'],
    inquiryType: 'new',
    urgency: 'normal',
    conversionSignal: false,
    rawMessage: '你好，我們 4/12-16 2大2小想去大象營跟夜間動物園，需要2張汽座',
    rawMessagePreview: '你好，我們 4/12-16 2大2小想去大象營跟夜間動物園，需要2張汽座',
    timestamp: '2026-03-22T00:00:00.000Z',
    ...overrides,
  }
}

function createConversation(): Conversation {
  return {
    id: 'conv-1',
    lineUserId: 'line-user-1',
    customerName: '王先生',
    status: 'waiting_eric',
    lastActivityAt: '2026-03-22T00:00:00.000Z',
    lastProcessedLineEventId: 'evt-1',
    pendingDraftId: null,
    latestInquiry: createInquiry(),
    tgTopicId: 'topic-1',
    messages: [
      {
        id: 'msg-1',
        source: 'line',
        role: 'customer',
        content: '你好，我們 4/12-16 2大2小想去大象營跟夜間動物園，需要2張汽座',
        contentType: 'text',
        timestamp: '2026-03-22T00:00:00.000Z',
        sourceEventId: 'evt-1',
      },
    ],
    metadata: {},
  }
}

describe('buildDraftContext', () => {
  it('builds a compact context summary for draft generation', () => {
    const context = buildDraftContext(createConversation())

    expect(context.customerName).toBe('王先生')
    expect(context.peopleSummary).toBe('2大2小')
    expect(context.attractionsSummary).toBe('大象營、夜間動物園')
    expect(context.recentMessages).toHaveLength(1)
  })
})
