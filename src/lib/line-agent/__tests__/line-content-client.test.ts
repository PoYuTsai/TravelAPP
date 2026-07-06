/**
 * line-content-client.test.ts — LINE content API fetcher（圖片刀B）.
 *
 * Locks the contract:
 *  - GET https://api-data.line.me/v2/bot/message/{id}/content（content 專用
 *    host 是 api-data.line.me，NOT api.line.me — 打錯 host 是已知地雷）
 *  - Bearer auth；fetch 注入（測試零網路）
 *  - 成功 → { base64, mediaType }；只接受 Anthropic vision 支援的圖型
 *  - 失敗一律 LineContentError with FIXED code（永不帶 token / 內文）
 *  - 大小上限：超過 MAX_IMAGE_CONTENT_BYTES 直接拒收（Anthropic 5MB 上限的
 *    base64 安全餘裕），絕不把超大圖塞進 vision prompt
 */

import { describe, it, expect } from 'vitest'
import {
  fetchLineImageContent,
  LineContentError,
  MAX_IMAGE_CONTENT_BYTES,
} from '@/lib/line-agent/line/content-client'

function makeFetch(
  response: Partial<{
    status: number
    contentType: string
    bytes: Uint8Array
  }>,
  calls: Array<{ url: string; init: RequestInit | undefined }> = []
): typeof fetch {
  return (async (url: any, init?: any) => {
    calls.push({ url: String(url), init })
    const bytes = response.bytes ?? new Uint8Array([1, 2, 3])
    return {
      ok: (response.status ?? 200) >= 200 && (response.status ?? 200) < 300,
      status: response.status ?? 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? (response.contentType ?? 'image/jpeg') : null,
      },
      arrayBuffer: async () => bytes.buffer,
      text: async () => 'err-body',
    } as unknown as Response
  }) as typeof fetch
}

describe('fetchLineImageContent', () => {
  it('GETs the api-data.line.me content endpoint with Bearer auth', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    await fetchLineImageContent('M123', 'tok-abc', makeFetch({}, calls))

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api-data.line.me/v2/bot/message/M123/content')
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok-abc'
    )
  })

  it('returns base64 + mediaType for a supported image', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    const result = await fetchLineImageContent(
      'M1',
      'tok',
      makeFetch({ contentType: 'image/png', bytes })
    )
    expect(result.mediaType).toBe('image/png')
    expect(result.base64).toBe(Buffer.from(bytes).toString('base64'))
  })

  it('strips content-type parameters (image/jpeg; charset=binary)', async () => {
    const result = await fetchLineImageContent(
      'M1',
      'tok',
      makeFetch({ contentType: 'image/jpeg; charset=binary' })
    )
    expect(result.mediaType).toBe('image/jpeg')
  })

  it('throws fixed-code empty_message_id without any network call', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    await expect(
      fetchLineImageContent('', 'tok', makeFetch({}, calls))
    ).rejects.toMatchObject({ name: 'LineContentError', code: 'empty_message_id' })
    expect(calls).toHaveLength(0)
  })

  it('throws fixed-code content_not_found on 404 (quoted a text message / expired)', async () => {
    await expect(
      fetchLineImageContent('M404', 'tok', makeFetch({ status: 404 }))
    ).rejects.toMatchObject({ name: 'LineContentError', code: 'content_not_found', status: 404 })
  })

  it('throws fixed-code content_fetch_failed on other non-2xx', async () => {
    await expect(
      fetchLineImageContent('M1', 'tok', makeFetch({ status: 500 }))
    ).rejects.toMatchObject({ name: 'LineContentError', code: 'content_fetch_failed', status: 500 })
  })

  it('throws fixed-code network_error when the transport rejects (no raw error text)', async () => {
    const failingFetch = (async () => {
      throw new Error('socket hang up with secret token tok-abc')
    }) as unknown as typeof fetch

    const err = await fetchLineImageContent('M1', 'tok-abc', failingFetch).then(
      () => null,
      (e) => e as LineContentError
    )
    expect(err?.name).toBe('LineContentError')
    expect(err?.code).toBe('network_error')
    // Secret-free: the raw transport error (which can echo urls/tokens) must
    // not leak into the thrown message.
    expect(err?.message).not.toContain('tok-abc')
    expect(err?.message).not.toContain('socket hang up')
  })

  it('rejects unsupported media types with fixed code (video/sticker never reach vision)', async () => {
    await expect(
      fetchLineImageContent('M1', 'tok', makeFetch({ contentType: 'video/mp4' }))
    ).rejects.toMatchObject({ name: 'LineContentError', code: 'unsupported_media_type' })
  })

  it('rejects oversized content with fixed code content_too_large', async () => {
    const big = new Uint8Array(MAX_IMAGE_CONTENT_BYTES + 1)
    await expect(
      fetchLineImageContent('M1', 'tok', makeFetch({ bytes: big }))
    ).rejects.toMatchObject({ name: 'LineContentError', code: 'content_too_large' })
  })
})
