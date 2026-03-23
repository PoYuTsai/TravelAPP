import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/line-webhook/route'
import {
  getIngestedLineEventRecords,
  resetIngestedLineEvents,
} from '@/lib/line-assistant/process/ingest-line-events'
import { createLineSignature } from '@/lib/line-assistant/line/signature'

function createSignedRequest(rawBody: string, signature: string): Request {
  return new Request('https://chiangway-travel.com/api/line-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-line-signature': signature,
    },
    body: rawBody,
  })
}

describe('POST /api/line-webhook', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.LINE_CHANNEL_SECRET = 'test-line-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token'
    process.env.TELEGRAM_GROUP_ID = '-1001234567890'
    process.env.LINE_ASSISTANT_CRON_SECRET = 'cron-secret'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://chiangway-travel.com'
    resetIngestedLineEvents()
  })

  it('returns 200 and stores a new message event', async () => {
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
            text: '你好，我想問四月包車',
          },
        },
      ],
    })

    const response = await POST(
      createSignedRequest(rawBody, createLineSignature(rawBody, 'test-line-secret'))
    )

    expect(response.status).toBe(200)
    expect(getIngestedLineEventRecords()).toHaveLength(1)
    expect(getIngestedLineEventRecords()[0]?.lineEventId).toBe('evt-1')
  })

  it('returns 200 even if the processor kickoff request fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('kickoff failed')
    })
    globalThis.fetch = fetchMock as typeof fetch

    const rawBody = JSON.stringify({
      events: [
        {
          type: 'message',
          webhookEventId: 'evt-2',
          timestamp: 1711065600000,
          source: {
            type: 'user',
            userId: 'line-user-2',
          },
          message: {
            id: 'msg-2',
            type: 'text',
            text: 'Need a family day trip in Chiang Mai.',
          },
        },
      ],
    })

    const response = await POST(
      createSignedRequest(rawBody, createLineSignature(rawBody, 'test-line-secret'))
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://chiangway-travel.com/api/line-webhook/process',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer cron-secret',
          'x-line-assistant-trigger': 'line-webhook',
        }),
      })
    )
  })

  it('returns 401 for an invalid signature', async () => {
    const response = await POST(
      createSignedRequest(JSON.stringify({ events: [] }), 'invalid-signature')
    )

    expect(response.status).toBe(401)
    expect(getIngestedLineEventRecords()).toHaveLength(0)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })
})
