import { describe, expect, it } from 'vitest'
import { createLineAssistantRuntime } from '@/lib/line-assistant/runtime'
import type {
  Conversation,
  ConversationDraft,
  InboundLineEventRecord,
  LineAssistantConfig,
  CustomerInquiry,
} from '@/lib/line-assistant/types'

function createConfig(): LineAssistantConfig {
  return {
    siteUrl: 'https://chiangway-travel.com',
    line: {
      channelAccessToken: 'line-token',
      channelSecret: 'line-secret',
    },
    telegram: {
      botToken: 'tg-token',
      groupId: '-1001234567890',
      webhookSecret: 'tg-secret',
    },
    anthropic: {
      apiKey: null,
    },
    openai: {
      apiKey: null,
    },
    notion: {
      token: null,
      customerDatabaseIds: {},
    },
    storage: {
      mode: 'kv',
      kvRestApiUrl: 'https://kv.example.test',
      kvRestApiToken: 'kv-token',
    },
    cron: {
      secret: 'cron-secret',
    },
  }
}

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
        text: 'Need a 5 day family charter in Chiang Mai.',
      },
    },
    ...overrides,
  }
}

function createMockKvFetch() {
  const store = new Map<string, string>()
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> | null }> = []

  const mockFetch = async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? new URL(input) : new URL(input.toString())

    if (url.hostname === 'api.telegram.org') {
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null
      telegramCalls.push({ url: url.toString(), body })

      if (url.pathname.endsWith('/createForumTopic')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: {
              message_thread_id: 3001,
            },
          }),
        } as Response
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: true,
        }),
      } as Response
    }

    const path = url.pathname.replace(/^\/+/, '')
    const segments = path.split('/').map((segment) => decodeURIComponent(segment))
    const command = segments[0]?.toUpperCase()

    const json = (result: unknown) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ result }),
      } as Response)

    if (command === 'SET') {
      const key = segments[1]
      const pathValue = segments[2]
      const bodyValue = typeof init?.body === 'string' ? init.body : null
      const existing = store.get(key)
      const nx = segments.includes('NX')
      if (nx && existing) {
        return json(null)
      }
      store.set(key, bodyValue ?? pathValue ?? '')
      return json('OK')
    }

    if (command === 'GET') {
      return json(store.get(segments[1]) ?? null)
    }

    if (command === 'DEL') {
      const deleted = store.delete(segments[1]) ? 1 : 0
      return json(deleted)
    }

    if (command === 'MGET') {
      return json(segments.slice(1).map((key) => store.get(key) ?? null))
    }

    if (command === 'SCAN') {
      const matchIndex = segments.findIndex((segment) => segment === 'MATCH')
      const pattern = matchIndex >= 0 ? segments[matchIndex + 1] : '*'
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern
      const keys = Array.from(store.keys()).filter((key) => key.startsWith(prefix))
      return json(['0', keys])
    }

    throw new Error(`Unsupported KV command: ${path}`)
  }

  return {
    fetchImpl: mockFetch,
    getTelegramCalls() {
      return telegramCalls
    },
  }
}

describe('createLineAssistantRuntime (kv)', () => {
  it('persists assistant state through the kv-backed stores', async () => {
    const mock = createMockKvFetch()
    const runtime = createLineAssistantRuntime({
      config: createConfig(),
      fetchImpl: mock.fetchImpl,
    })

    expect(await runtime.idempotencyStore.claim('idempotency:test', 60)).toBe(true)
    expect(await runtime.idempotencyStore.claim('idempotency:test', 60)).toBe(false)

    await runtime.inboundEventStore.upsert(createRecord())
    expect(await runtime.inboundEventStore.listPending()).toHaveLength(1)

    await runtime.conversationStore.upsert(createConversation())
    expect((await runtime.conversationStore.getByLineUserId('line-user-1'))?.id).toBe('conv-1')

    await runtime.draftStore.upsert(createDraft())
    expect((await runtime.draftStore.getPendingByConversationId('conv-1'))?.id).toBe('draft-1')

    await runtime.auditLog.append({
      id: 'audit-1',
      actionId: 'action-1',
      conversationId: 'conv-1',
      draftId: 'draft-1',
      lineUserId: 'line-user-1',
      outcome: 'sent',
      createdAt: '2026-03-22T00:05:00.000Z',
    })

    expect(await runtime.auditLog.list()).toHaveLength(1)
  })

  it('creates and reuses a durable telegram topic for the same line user', async () => {
    const mock = createMockKvFetch()
    const runtime = createLineAssistantRuntime({
      config: createConfig(),
      fetchImpl: mock.fetchImpl,
    })

    const first = await runtime.topicMapper.ensureTopicForLineUser('line-user-1', 'Wang Family')
    const second = await runtime.topicMapper.ensureTopicForLineUser('line-user-1', 'Wang Family')

    expect(first).toBe('3001')
    expect(second).toBe('3001')
    expect(mock.getTelegramCalls()).toHaveLength(1)
    expect(mock.getTelegramCalls()[0]?.url).toContain('/bottg-token/createForumTopic')
  })
})
