import { describe, expect, it, vi } from 'vitest'
import { createAnthropicDraftTextGenerator } from '@/lib/line-assistant/ai/anthropic'

describe('createAnthropicDraftTextGenerator', () => {
  it('calls the Anthropic messages API and returns the generated text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '這是一段 AI 草稿回覆',
          },
        ],
      }),
    })

    const generator = createAnthropicDraftTextGenerator({
      apiKey: 'test-key',
      fetchImpl,
    })

    const result = await generator({
      customerName: 'Wang Family',
      travelDates: '2026-04-12 to 2026-04-16',
      peopleSummary: '2 adults, 1 child',
      attractionsSummary: 'Elephant camp, old city',
      specialNeedsSummary: 'child seat',
      recentMessages: [
        {
          role: 'customer',
          content: 'Need a family charter in Chiang Mai.',
          timestamp: '2026-03-22T00:00:00.000Z',
        },
      ],
    })

    expect(result).toBe('這是一段 AI 草稿回覆')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    )
  })
})
