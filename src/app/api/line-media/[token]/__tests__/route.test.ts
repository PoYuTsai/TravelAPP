import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/line-media/[token]/route'
import {
  configureLineAssistantRuntimeForTests,
  resetLineAssistantRuntimeForTests,
} from '@/lib/line-assistant/runtime'
import { createMemoryTelegramMediaStore } from '@/lib/line-assistant/storage/telegram-media-store'

describe('GET /api/line-media/[token]', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token'

    configureLineAssistantRuntimeForTests({
      telegramMediaStore: createMemoryTelegramMediaStore([
        {
          token: 'media-1',
          telegramFileId: 'tg-file-1',
          telegramFileUniqueId: 'tg-unique-1',
          contentType: 'image/jpeg',
          fileSize: 204800,
          caption: 'car photo',
          createdAt: '2026-03-23T00:00:00.000Z',
        },
      ]),
    })
  })

  it('returns the stored telegram image through the public proxy route', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.includes('/getFile?file_id=tg-file-1')) {
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              file_path: 'photos/file-1.jpg',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      if (url.includes('/file/bottg-token/photos/file-1.jpg')) {
        return new Response(new Uint8Array([255, 216, 255, 217]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })
      }

      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const response = await GET(new Request('https://chiangway-travel.com/api/line-media/media-1'), {
      params: { token: 'media-1' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([255, 216, 255, 217]))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    resetLineAssistantRuntimeForTests()
  })
})
