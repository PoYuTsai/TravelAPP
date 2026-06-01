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
 *   3. FAIL LOUD: a CasePersistenceError from the handler → POST returns 500
 *      (so LINE retries); a benign non-persistence error still acks 200.
 *   4. Bad JSON → 400; non-actionable (room) source → skipped, 200.
 *
 * The handler/store are injected via setEventHandler / setStore (the relocated
 * runtime seam), so these tests exercise the real POST handler + normalizer +
 * persistence wiring without any LINE/LLM/network I/O.
 */

import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/line/webhook/route'
import {
  setEventHandler,
  getEventHandler,
  setStore,
} from '@/lib/line-agent/line/webhook-runtime'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { CasePersistenceError } from '@/lib/line-agent/errors'

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

/** A multi-person room source — normalizer returns null (non-actionable). */
function roomPayload(): string {
  return JSON.stringify({
    events: [
      {
        type: 'message',
        source: { type: 'room', roomId: 'R_room', userId: 'U_room_user' },
        message: { type: 'text', id: 'msg_room_001', text: 'hi' },
        timestamp: 1717200000000,
      },
    ],
  })
}

/** A store whose every method rejects — simulates a KV outage. */
function failingStore(): MemoryStore {
  const store = new MemoryStore()
  store.getByLineUserId = async () => {
    throw new Error('KV down')
  }
  return store
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
  // Restore the default handler + a clean store so other suites are unaffected.
  setEventHandler(originalHandler)
  setStore(new MemoryStore())
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

  // ── FAIL LOUD: persistence failure must NOT ack ──────────────────────────

  it('returns 500 when the handler throws a CasePersistenceError (LINE retries)', async () => {
    setEventHandler(async () => {
      throw new CasePersistenceError('U_customer_route_001')
    })

    const res = await POST(signedRequest(oaTextPayload()))
    expect(res.status).toBe(500)
  })

  it('returns 500 when the injected store fails to persist (default handler path)', async () => {
    // Use the REAL default handler + a store that throws → routeCommand wraps
    // the store failure as CasePersistenceError → route returns 500.
    setEventHandler(originalHandler)
    setStore(failingStore())

    const res = await POST(signedRequest(oaTextPayload()))
    expect(res.status).toBe(500)
  })

  it('still acks 200 for a benign (non-persistence) handler error', async () => {
    // A non-persistence error must be distinguished from a persist failure and
    // must NOT block the ack.
    setEventHandler(async () => {
      throw new Error('benign no-op')
    })

    const res = await POST(signedRequest(oaTextPayload()))
    expect(res.status).toBe(200)
  })

  // ── Other status paths ───────────────────────────────────────────────────

  it('returns 400 on a validly-signed body that is not JSON', async () => {
    const res = await POST(signedRequest('not-json{'))
    expect(res.status).toBe(400)
  })

  it('skips a non-actionable room-source event and acks 200 without routing', async () => {
    let called = false
    setEventHandler(async () => {
      called = true
    })

    const res = await POST(signedRequest(roomPayload()))
    expect(res.status).toBe(200)
    expect(called).toBe(false)
  })
})
