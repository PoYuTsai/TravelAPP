import { describe, expect, it } from 'vitest'
import { processInboundEvent } from '@/lib/line-assistant/process/process-inbound-event'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import { createMemoryTopicMapper } from '@/lib/line-assistant/telegram/topic-mapper'
import { createMemoryTelegramClient } from '@/lib/line-assistant/telegram/client'
import type { InboundLineEventRecord } from '@/lib/line-assistant/types'

function createRecord(): InboundLineEventRecord {
  return {
    id: 'evt-1',
    lineEventId: 'evt-1',
    lineUserId: 'line-user-1',
    eventType: 'message',
    receivedAt: '2026-03-22T00:00:00.000Z',
    status: 'received',
    payload: {
      webhookEventId: 'evt-1',
      timestamp: 1711065600000,
      type: 'message',
      source: {
        type: 'user',
        userId: 'line-user-1',
      },
      message: {
        id: 'msg-1',
        type: 'text',
        text: '你好，我們 4/12-16 2大2小想去大象營',
      },
    },
  }
}

describe('processInboundEvent', () => {
  it('creates a topic, stores the conversation, and posts a telegram summary', async () => {
    const conversationStore = createMemoryConversationStore()
    const draftStore = createMemoryDraftStore()
    const topicMapper = createMemoryTopicMapper()
    const telegramClient = createMemoryTelegramClient()

    const result = await processInboundEvent(createRecord(), {
      conversationStore,
      draftStore,
      topicMapper,
      telegramClient,
      resolveProfile: async () => ({
        userId: 'line-user-1',
        displayName: '王先生',
      }),
    })

    const savedConversation = await conversationStore.getByLineUserId('line-user-1')
    const savedDraft = await draftStore.getById(result.draftId)
    const sentSummaries = telegramClient.getSentSummaries()

    expect(result.topicId).toBeTruthy()
    expect(result.draftId).toBeTruthy()
    expect(savedConversation?.customerName).toBe('王先生')
    expect(savedConversation?.status).toBe('waiting_eric')
    expect(savedConversation?.pendingDraftId).toBe(result.draftId)
    expect(savedConversation?.messages).toHaveLength(1)
    expect(savedDraft?.status).toBe('pending')
    expect(sentSummaries).toHaveLength(1)
    expect(sentSummaries[0]?.topicId).toBe(result.topicId)
    expect(sentSummaries[0]?.text).toContain('王先生')
  })
})
