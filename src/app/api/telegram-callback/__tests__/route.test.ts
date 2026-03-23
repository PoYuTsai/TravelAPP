import { beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/telegram-callback/route'
import {
  configureTelegramActionRuntimeForTests,
  resetTelegramActionRuntimeForTests,
} from '@/lib/line-assistant/actions/handle-telegram-action'
import { createMemoryAuditLog } from '@/lib/line-assistant/audit-log'
import {
  configureLineAssistantRuntimeForTests,
  resetLineAssistantRuntimeForTests,
} from '@/lib/line-assistant/runtime'
import { createMemoryConversationStore } from '@/lib/line-assistant/storage/conversation-store'
import { createMemoryDraftStore } from '@/lib/line-assistant/storage/draft-store'
import { createMemoryIdempotencyStore } from '@/lib/line-assistant/storage/idempotency-store'
import { createMemoryTelegramActionStore } from '@/lib/line-assistant/storage/telegram-action-store'
import { createMemoryLineMessageSender } from '@/lib/line-assistant/line/send-message'
import { createMemoryTelegramClient } from '@/lib/line-assistant/telegram/client'
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
    originalDraft: 'Thanks for reaching out. I can help you plan a family-friendly 5 day charter.',
    ...overrides,
  }
}

function createRequest(body: unknown, secret = 'tg-secret'): Request {
  return new Request('https://chiangway-travel.com/api/telegram-callback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/telegram-callback', () => {
  let telegramClient: ReturnType<typeof createMemoryTelegramClient>

  beforeEach(() => {
    telegramClient = createMemoryTelegramClient()
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.LINE_CHANNEL_SECRET = 'line-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token'
    process.env.TELEGRAM_GROUP_ID = '-1001234567890'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'tg-secret'

    configureTelegramActionRuntimeForTests({
      conversationStore: createMemoryConversationStore([createConversation()]),
      draftStore: createMemoryDraftStore([createDraft()]),
      idempotencyStore: createMemoryIdempotencyStore(),
      lineSender: createMemoryLineMessageSender(),
      auditLog: createMemoryAuditLog(),
    })

    configureLineAssistantRuntimeForTests({
      telegramClient,
    })
  })

  it('accepts a valid callback and sends the draft', async () => {
    const telegramActionStore = createMemoryTelegramActionStore([
      {
        token: 'token-send',
        action: {
          actionId: 'action-1',
          type: 'send',
          conversationId: 'conv-1',
          draftId: 'draft-1',
          lineUserId: 'line-user-1',
          receivedAt: '2026-03-22T00:05:00.000Z',
        },
        createdAt: '2026-03-22T00:05:00.000Z',
      },
    ])

    configureLineAssistantRuntimeForTests({
      telegramClient,
      telegramActionStore,
    })

    const response = await POST(
      createRequest({
        callback_query: {
          id: 'callback-1',
          from: { id: 999, username: 'eric' },
          message: { message_id: 1001, message_thread_id: 2002 },
          data: 'la:token-send',
        },
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.result.status).toBe('sent')
    expect(telegramClient.getAnsweredCallbackQueries()).toEqual([
      { callbackQueryId: 'callback-1', text: 'LINE reply sent' },
    ])
  })

  it('rejects a callback with an invalid secret token', async () => {
    const response = await POST(createRequest({ callback_query: { id: 'callback-1' } }, 'wrong-secret'))

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid callback payloads', async () => {
    const response = await POST(
      createRequest({
        callback_query: {
          id: 'callback-1',
          data: 'not-json',
        },
      })
    )

    expect(response.status).toBe(400)
  })

  afterEach(() => {
    resetTelegramActionRuntimeForTests()
    resetLineAssistantRuntimeForTests()
  })
})
