import { describe, expect, it, vi } from 'vitest'
import { kickoffLineWebhookProcessor } from '@/lib/line-assistant/process/kickoff-processor'

describe('kickoffLineWebhookProcessor', () => {
  it('skips the kickoff when no new events were accepted', async () => {
    const fetchImpl = vi.fn()

    const result = await kickoffLineWebhookProcessor({
      acceptedCount: 0,
      requestUrl: 'https://chiangway-travel.com/api/line-webhook',
      cronSecret: 'cron-secret',
      fetchImpl,
    })

    expect(result).toEqual({
      status: 'skipped',
      reason: 'no_accepted_events',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts to the processor route with the cron secret when new events arrive', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as Response
    })

    const result = await kickoffLineWebhookProcessor({
      acceptedCount: 2,
      requestUrl: 'https://chiangway-travel.com/api/line-webhook',
      cronSecret: 'cron-secret',
      fetchImpl,
    })

    expect(result).toEqual({
      status: 'started',
      processUrl: 'https://chiangway-travel.com/api/line-webhook/process',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://chiangway-travel.com/api/line-webhook/process',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer cron-secret',
          'content-type': 'application/json',
          'x-line-assistant-trigger': 'line-webhook',
        }),
      })
    )
  })

  it('throws when the processor route rejects the kickoff request', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: false,
        status: 401,
      } as Response
    })

    await expect(
      kickoffLineWebhookProcessor({
        acceptedCount: 1,
        requestUrl: 'https://chiangway-travel.com/api/line-webhook',
        cronSecret: 'cron-secret',
        fetchImpl,
      })
    ).rejects.toThrow('LINE webhook processor kickoff failed with status 401')
  })
})
