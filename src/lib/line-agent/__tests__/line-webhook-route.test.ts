/**
 * line-webhook-route.test.ts
 *
 * Route-level tests for POST /api/line/webhook.
 *
 * Covers:
 *   1. Invalid signature → 401 (no routing).
 *   2. Valid signed event → the injectable handler is invoked, and it has
 *      COMPLETED before the 200 response resolves (no fire-and-forget — the
 *      handler must run before the ack).
 *   3. A handler that throws does not crash the batch or block the 200.
 *
 * The handler is injected via setEventHandler (the relocated runtime seam),
 * so these tests exercise the real POST handler + normalizer + seam wiring
 * without any LINE/LLM/network I/O.
 */

import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/line/webhook/route'
import {
  setEventHandler,
  getEventHandler,
} from '@/lib/line-agent/line/webhook-runtime'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANNEL_SECRET = 'test-channel-secret-xyz'

function signedRequest(body: string, signature?: string): NextRequest {
  const sig =
    signature ?? createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64')
  return new NextRequest('http://localhost/api/line/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-line-signature': sig,
    },
    body,
  })
}

function oaTextPayload(): string {
  return JSON.stringify({
    events: [
      {
        type: 'message',
        source: { type: 'user', userId: 'U_customer_route_001' },
        message: { type: 'text', id: 'msg_route_001', text: '請問包車' },
        timestamp: 1717200000000,
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const originalHandler = getEventHandler()

beforeEach(() => {
  process.env.LINE_CHANNEL_SECRET = CHANNEL_SECRET
  process.env.LINE_PARTNER_GROUP_ID = 'C_partner_group_route'
})

afterEach(() => {
  // Restore the default handler so other suites are unaffected.
  setEventHandler(originalHandler)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/line/webhook', () => {
  it('returns 401 on invalid signature and does not route', async () => {
    let called = false
    setEventHandler(async () => {
      called = true
    })

    const res = await POST(signedRequest(oaTextPayload(), 'bad-signature'))
    expect(res.status).toBe(401)
    expect(called).toBe(false)
  })

  it('invokes the routing handler for a normalized event before resolving 200', async () => {
    let completedBeforeResponse = false
    // The handler defers completion to a microtask; if POST did not AWAIT the
    // handler (fire-and-forget), this flag would still be false when 200 resolves.
    setEventHandler(async () => {
      await Promise.resolve()
      completedBeforeResponse = true
    })

    const res = await POST(signedRequest(oaTextPayload()))
    expect(res.status).toBe(200)
    expect(completedBeforeResponse).toBe(true)
  })

  it('passes the normalized event to the handler', async () => {
    const seen: string[] = []
    setEventHandler(async (event) => {
      seen.push(event.kind)
    })

    const res = await POST(signedRequest(oaTextPayload()))
    expect(res.status).toBe(200)
    expect(seen).toEqual(['oa_text'])
  })

  it('a throwing handler does not crash the batch or block the 200', async () => {
    setEventHandler(async () => {
      throw new Error('handler boom')
    })

    const res = await POST(signedRequest(oaTextPayload()))
    expect(res.status).toBe(200)
  })
})
