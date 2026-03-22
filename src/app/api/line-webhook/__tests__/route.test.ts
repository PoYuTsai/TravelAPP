import { beforeEach, describe, expect, it } from 'vitest'
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
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
    process.env.LINE_CHANNEL_SECRET = 'test-line-secret'
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token'
    process.env.TELEGRAM_GROUP_ID = '-1001234567890'
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

  it('returns 401 for an invalid signature', async () => {
    const response = await POST(
      createSignedRequest(JSON.stringify({ events: [] }), 'invalid-signature')
    )

    expect(response.status).toBe(401)
    expect(getIngestedLineEventRecords()).toHaveLength(0)
  })
})
