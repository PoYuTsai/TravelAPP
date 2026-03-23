import { describe, expect, it, vi } from 'vitest'
import { processPendingInboundEvents } from '@/lib/line-assistant/process/process-pending-events'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import { createMemoryIdempotencyStore } from '@/lib/line-assistant/storage/idempotency-store'
import { createMemoryInboundEventStore } from '@/lib/line-assistant/storage/inbound-event-store'
import { createMemoryTelegramClient } from '@/lib/line-assistant/telegram/client'
import { createMemoryTopicMapper } from '@/lib/line-assistant/telegram/topic-mapper'
import type { InboundLineEventRecord } from '@/lib/line-assistant/types'

function createRecord(overrides: Partial<InboundLineEventRecord> = {}): InboundLineEventRecord {
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
        text: 'Need a 5 day family charter in Chiang Mai with a 4 year old child seat.',
      },
    },
    ...overrides,
  }
}

describe('processPendingInboundEvents', () => {
  it('processes each pending event once and creates downstream records', async () => {
    const inboundEventStore = createMemoryInboundEventStore([createRecord()])
    const conversationStore = createMemoryConversationStore()
    const draftStore = createMemoryDraftStore()
    const idempotencyStore = createMemoryIdempotencyStore()
    const topicMapper = createMemoryTopicMapper()
    const telegramClient = createMemoryTelegramClient()

    const first = await processPendingInboundEvents({
      inboundEventStore,
      conversationStore,
      draftStore,
      idempotencyStore,
      topicMapper,
      telegramClient,
      resolveProfile: async () => ({
        userId: 'line-user-1',
        displayName: 'Wang Family',
      }),
    })

    const savedEvent = await inboundEventStore.getByLineEventId('evt-1')
    const savedConversation = await conversationStore.getByLineUserId('line-user-1')
    const drafts = await draftStore.list()

    expect(first.processedCount).toBe(1)
    expect(first.failedCount).toBe(0)
    expect(savedEvent?.status).toBe('processed')
    expect(savedConversation?.customerName).toBe('Wang Family')
    expect(savedConversation?.pendingDraftId).toBeTruthy()
    expect(drafts).toHaveLength(1)
    expect(telegramClient.getSentSummaries()).toHaveLength(1)

    const second = await processPendingInboundEvents({
      inboundEventStore,
      conversationStore,
      draftStore,
      idempotencyStore,
      topicMapper,
      telegramClient,
      resolveProfile: async () => ({
        userId: 'line-user-1',
        displayName: 'Wang Family',
      }),
    })

    expect(second.processedCount).toBe(0)
    expect(second.failedCount).toBe(0)
    expect(telegramClient.getSentSummaries()).toHaveLength(1)
  })

  it('passes the runtime draft text generator through to draft creation', async () => {
    const inboundEventStore = createMemoryInboundEventStore([createRecord()])
    const conversationStore = createMemoryConversationStore()
    const draftStore = createMemoryDraftStore()
    const idempotencyStore = createMemoryIdempotencyStore()
    const topicMapper = createMemoryTopicMapper()
    const telegramClient = createMemoryTelegramClient()
    const draftTextGenerator = vi.fn().mockResolvedValue('Anthropic generated draft')

    const result = await processPendingInboundEvents({
      inboundEventStore,
      conversationStore,
      draftStore,
      idempotencyStore,
      topicMapper,
      telegramClient,
      draftTextGenerator,
      resolveProfile: async () => ({
        userId: 'line-user-1',
        displayName: 'Wang Family',
      }),
    })

    const drafts = await draftStore.list()

    expect(result.processedCount).toBe(1)
    expect(drafts[0]?.originalDraft).toBe('Anthropic generated draft')
    expect(draftTextGenerator).toHaveBeenCalledTimes(1)
  })
})
