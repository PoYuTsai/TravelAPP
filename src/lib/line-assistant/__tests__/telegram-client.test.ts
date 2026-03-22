import { describe, expect, it } from 'vitest'
import { createTelegramBotClient } from '@/lib/line-assistant/telegram/client'

function createMockTelegramFetch() {
  const calls: Array<{ url: string; body: Record<string, unknown> | null }> = []

  const fetchImpl = async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null

    calls.push({ url, body })

    if (url.endsWith('/createForumTopic')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            message_thread_id: 4321,
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

  return {
    fetchImpl,
    getCalls() {
      return calls
    },
  }
}

describe('createTelegramBotClient', () => {
  it('creates a forum topic and returns the created message thread id', async () => {
    const mock = createMockTelegramFetch()
    const client = createTelegramBotClient({
      botToken: 'tg-token',
      groupId: '-1001234567890',
      fetchImpl: mock.fetchImpl,
    })

    const topicId = await client.createForumTopic('Wang Family')

    expect(topicId).toBe('4321')
    expect(mock.getCalls()).toHaveLength(1)
    expect(mock.getCalls()[0]?.url).toContain('/bottg-token/createForumTopic')
    expect(mock.getCalls()[0]?.body).toMatchObject({
      chat_id: '-1001234567890',
      name: 'Wang Family',
    })
  })

  it('sends topic summaries to the configured telegram forum thread', async () => {
    const mock = createMockTelegramFetch()
    const client = createTelegramBotClient({
      botToken: 'tg-token',
      groupId: '-1001234567890',
      fetchImpl: mock.fetchImpl,
    })

    await client.sendTopicSummary('4321', 'New customer inquiry')

    expect(mock.getCalls()).toHaveLength(1)
    expect(mock.getCalls()[0]?.url).toContain('/bottg-token/sendMessage')
    expect(mock.getCalls()[0]?.body).toMatchObject({
      chat_id: '-1001234567890',
      message_thread_id: 4321,
      text: 'New customer inquiry',
    })
  })

  it('answers telegram callback queries after a button action is processed', async () => {
    const mock = createMockTelegramFetch()
    const client = createTelegramBotClient({
      botToken: 'tg-token',
      groupId: '-1001234567890',
      fetchImpl: mock.fetchImpl,
    })

    await client.answerCallbackQuery('callback-1', 'Sent to LINE')

    expect(mock.getCalls()).toHaveLength(1)
    expect(mock.getCalls()[0]?.url).toContain('/bottg-token/answerCallbackQuery')
    expect(mock.getCalls()[0]?.body).toMatchObject({
      callback_query_id: 'callback-1',
      text: 'Sent to LINE',
    })
  })
})
