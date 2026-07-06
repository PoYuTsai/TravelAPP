/**
 * message-client.test.ts
 *
 * replyMessage now returns the bot-authored message ids parsed from the LINE
 * reply response `sentMessages[].id` (quote-to-bot plan §4 / Task 2).  A parse
 * miss is NOT an error — the reply already succeeded; failing to track it only
 * means a future quote to it would need a re-tag.  Non-2xx still throws
 * LineApiError (unchanged failure semantics).
 *
 * Zero network: a fake fetch is injected, so nothing hits the real LINE API.
 */

import { describe, it, expect } from 'vitest'
import { replyMessage, LineApiError } from '../line/message-client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('replyMessage', () => {
  it('returns sentMessages[].id on success', async () => {
    const fakeFetch = async () =>
      jsonResponse({ sentMessages: [{ id: '461230966842064897', quoteToken: 'q' }] })
    const ids = await replyMessage(
      'rt',
      [{ type: 'text', text: 'hi' }],
      'tok',
      fakeFetch as unknown as typeof fetch
    )
    expect(ids).toEqual(['461230966842064897'])
  })

  it('returns [] when response lacks sentMessages (does not throw)', async () => {
    const fakeFetch = async () => jsonResponse({})
    const ids = await replyMessage(
      'rt',
      [{ type: 'text', text: 'hi' }],
      'tok',
      fakeFetch as unknown as typeof fetch
    )
    expect(ids).toEqual([])
  })

  it('returns [] when body is unparseable JSON (does not throw)', async () => {
    const fakeFetch = async () => new Response('not-json', { status: 200 })
    const ids = await replyMessage(
      'rt',
      [{ type: 'text', text: 'hi' }],
      'tok',
      fakeFetch as unknown as typeof fetch
    )
    expect(ids).toEqual([])
  })

  it('still throws LineApiError on non-2xx (unchanged failure semantics)', async () => {
    const fakeFetch = async () => new Response('bad token', { status: 401 })
    await expect(
      replyMessage(
        'rt',
        [{ type: 'text', text: 'hi' }],
        'tok',
        fakeFetch as unknown as typeof fetch
      )
    ).rejects.toBeInstanceOf(LineApiError)
  })
})
