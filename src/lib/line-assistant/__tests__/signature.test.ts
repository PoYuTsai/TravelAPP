import { describe, expect, it } from 'vitest'
import {
  createLineSignature,
  verifyLineSignature,
} from '@/lib/line-assistant/line/signature'

describe('verifyLineSignature', () => {
  it('returns true for a valid line signature', () => {
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
            text: '你好',
          },
        },
      ],
    })

    const signature = createLineSignature(rawBody, 'test-line-secret')

    expect(
      verifyLineSignature({
        rawBody,
        signature,
        channelSecret: 'test-line-secret',
      })
    ).toBe(true)
  })

  it('returns false for an invalid line signature', () => {
    expect(
      verifyLineSignature({
        rawBody: '{"events":[]}',
        signature: 'invalid-signature',
        channelSecret: 'test-line-secret',
      })
    ).toBe(false)
  })
})
