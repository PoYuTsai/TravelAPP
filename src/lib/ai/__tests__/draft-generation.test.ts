import { describe, expect, it, vi } from 'vitest'
import { generateDraftForConversation } from '@/lib/line-assistant/ai/generate-draft'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import type { Conversation, CustomerInquiry, ConversationDraft } from '@/lib/line-assistant/types'

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
    attractions: ['大象營'],
    budget: null,
    accommodation: null,
    specialNeeds: ['2張汽座'],
    inquiryType: 'new',
    urgency: 'normal',
    conversionSignal: false,
    rawMessage: '你好，我們 4/12-16 2大2小想去大象營，需要2張汽座',
    rawMessagePreview: '你好，我們 4/12-16 2大2小想去大象營，需要2張汽座',
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
    pendingDraftId: 'draft-old',
    latestInquiry: createInquiry(),
    tgTopicId: 'topic-1',
    messages: [
      {
        id: 'msg-1',
        source: 'line',
        role: 'customer',
        content: '你好，我們 4/12-16 2大2小想去大象營，需要2張汽座',
        contentType: 'text',
        timestamp: '2026-03-22T00:00:00.000Z',
        sourceEventId: 'evt-1',
      },
    ],
    metadata: {},
  }
}

describe('generateDraftForConversation', () => {
  it('supersedes the previous pending draft and creates a fresh pending draft', async () => {
    const previousDraft: ConversationDraft = {
      id: 'draft-old',
      conversationId: 'conv-1',
      createdAt: '2026-03-22T00:00:00.000Z',
      createdFromEventId: 'evt-0',
      status: 'pending',
      originalDraft: '舊草稿',
    }

    const draftStore = createMemoryDraftStore([previousDraft])

    const result = await generateDraftForConversation(createConversation(), {
      draftStore,
      now: '2026-03-22T01:00:00.000Z',
      draftIdFactory: () => 'draft-new',
    })

    const latestDraft = await draftStore.getById('draft-new')
    const oldDraft = await draftStore.getById('draft-old')

    expect(result.id).toBe('draft-new')
    expect(result.status).toBe('pending')
    expect(result.originalDraft).toContain('王先生')
    expect(oldDraft?.status).toBe('superseded')
    expect(latestDraft?.status).toBe('pending')
  })

  it('uses the injected draft text generator when available', async () => {
    const draftStore = createMemoryDraftStore()
    const draftTextGenerator = vi.fn().mockResolvedValue('Anthropic generated draft')

    const result = await generateDraftForConversation(createConversation(), {
      draftStore,
      draftTextGenerator,
      now: '2026-03-22T01:00:00.000Z',
      draftIdFactory: () => 'draft-anthropic',
    })

    expect(result.originalDraft).toBe('Anthropic generated draft')
    expect(draftTextGenerator).toHaveBeenCalledTimes(1)
    expect(draftTextGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: expect.any(String),
        recentMessages: expect.any(Array),
      })
    )
  })
})
