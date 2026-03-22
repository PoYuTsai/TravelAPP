import { beforeEach, describe, expect, it } from 'vitest'
import { POST as webhookPOST } from '@/app/api/line-webhook/route'
import { POST as processPOST } from '@/app/api/line-webhook/process/route'
import { createLineSignature } from '@/lib/line-assistant/line/signature'
import { configureLineAssistantRuntimeForTests, resetLineAssistantRuntimeForTests } from '@/lib/line-assistant/runtime'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import { createMemoryIdempotencyStore } from '@/lib/line-assistant/storage/idempotency-store'
import { createMemoryInboundEventStore } from '@/lib/line-assistant/storage/inbound-event-store'
import { createMemoryTelegramClient } from '@/lib/line-assistant/telegram/client'
import { createMemoryTopicMapper } from '@/lib/line-assistant/telegram/topic-mapper'

function createWebhookRequest(rawBody: string, signature: string): Request {
  return new Request('https://chiangway-travel.com/api/line-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-line-signature': signature,
    },
    body: rawBody,
  })
}

function createProcessorRequest(secret: string): Request {
  return new Request('https://chiangway-travel.com/api/line-webhook/process', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ limit: 10 }),
  })
}

describe('POST /api/line-webhook/process', () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.LINE_CHANNEL_SECRET = 'test-line-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token'
    process.env.TELEGRAM_GROUP_ID = '-1001234567890'
    process.env.LINE_ASSISTANT_CRON_SECRET = 'cron-secret'

    configureLineAssistantRuntimeForTests({
      conversationStore: createMemoryConversationStore(),
      draftStore: createMemoryDraftStore(),
      inboundEventStore: createMemoryInboundEventStore(),
      idempotencyStore: createMemoryIdempotencyStore(),
      topicMapper: createMemoryTopicMapper(),
      telegramClient: createMemoryTelegramClient(),
      resolveProfile: async (lineUserId: string) => ({
        userId: lineUserId,
        displayName: 'Wang Family',
      }),
    })
  })

  it('requires the cron secret', async () => {
    const response = await processPOST(createProcessorRequest('wrong-secret'))

    expect(response.status).toBe(401)
  })

  it('processes shared queued events exactly once', async () => {
    const rawBody = JSON.stringify({
      events: [
        {
          type: 'message',
          webhookEventId: 'evt-1',
          timestamp: 1711065600000,
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
      ],
    })

    const webhookResponse = await webhookPOST(
      createWebhookRequest(rawBody, createLineSignature(rawBody, 'test-line-secret'))
    )
    expect(webhookResponse.status).toBe(200)

    const first = await processPOST(createProcessorRequest('cron-secret'))
    const firstPayload = await first.json()
    expect(first.status).toBe(200)
    expect(firstPayload.result.processedCount).toBe(1)

    const second = await processPOST(createProcessorRequest('cron-secret'))
    const secondPayload = await second.json()
    expect(second.status).toBe(200)
    expect(secondPayload.result.processedCount).toBe(0)
  })

  afterEach(() => {
    resetLineAssistantRuntimeForTests()
  })
})
