/**
 * POST /api/line/webhook
 *
 * LINE Messaging API webhook handler.
 *
 * Responsibilities:
 *   1. Read the raw request body (needed for HMAC-SHA256 signature check).
 *   2. Verify the `x-line-signature` header → 401 on failure; do nothing else.
 *   3. Parse events, normalize each one via event-normalizer.
 *   4. Route each normalized event through the routing seam (awaited so routing
 *      is guaranteed to run before the response).  The default handler persists
 *      OA customer cases through the reducer + durable store.
 *   5. Respond 200 once every event is persisted.  LINE requires a fast
 *      acknowledgement, so routing must stay cheap (no LLM/Notion/quote work).
 *
 * FAIL LOUD on persistence failure (M2 Hard Rule):
 *   A case-persist failure must NOT be swallowed with a 200.  It returns 500 so
 *   LINE re-delivers the event — LINE's at-least-once retry is our durable
 *   buffer, which is why no queue is needed.  Benign, non-persistence event
 *   errors (a malformed single event, an unsupported message) are distinguished
 *   in code and still ack 200; they are not lumped into one catch-all.
 *
 * Design notes:
 * ─────────────
 * WEBHOOK IS A FUTURE-EVENT SOURCE, NOT A HISTORICAL INBOX CRAWLER.
 * The LINE Messaging API webhook delivers future events only.  The bot
 * cannot list historical OA chats or true LINE OA unread conversations.
 * "Unread" in product language means "unprocessed by the agent".
 *
 * NO mark-as-read call is made here, intentionally.  MVP does not require
 * it and calling it would falsely signal to LINE that the conversation was
 * read by the bot operator.
 *
 * NO auto-reply is sent to OA customers.  The official OA is receive-only
 * in MVP.  Only Eric or the partner group may initiate messages to customers.
 *
 * ROUTING SEAM:
 * The injectable handler and store live in `@/lib/line-agent/line/webhook-runtime`
 * (a Next.js route file may only export HTTP-method handlers, so the
 * setters/getters cannot live here).  The default handler routes each event
 * through `routeCommand`, which persists OA cases via the reducer + store; a
 * test or future bootstrap may override it via `setEventHandler(...)` /
 * `setStore(...)` without changing the call site below.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature } from '@/lib/line-agent/line/signature'
import { normalizeLineEvent } from '@/lib/line-agent/line/event-normalizer'
import { getEventHandler, getStore } from '@/lib/line-agent/line/webhook-runtime'
import { CasePersistenceError } from '@/lib/line-agent/errors'

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Read the raw body as text (required for HMAC signature verification)
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'cannot read body' }, { status: 400 })
  }

  // ── 2. Verify LINE signature
  const channelSecret = process.env.LINE_CHANNEL_SECRET ?? ''
  const signatureHeader = request.headers.get('x-line-signature') ?? ''

  if (!verifyLineSignature(channelSecret, rawBody, signatureHeader)) {
    // Do nothing on invalid signature — return 401 immediately
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  // ── 3. Parse events
  let payload: { events?: unknown[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const rawEvents: unknown[] = Array.isArray(payload.events) ? payload.events : []
  const partnerGroupId = process.env.LINE_PARTNER_GROUP_ID ?? ''
  // Bot's own LINE userId — enables structured mention detection in the partner
  // group. Empty is fine (mention falls back to text aliases). Read directly
  // from env, same pattern as partnerGroupId above.
  const botUserId = process.env.LINE_BOT_USER_ID ?? ''

  // Snapshot the seam once per request (live module bindings via getters).
  // getStore() may throw StoreBootstrapError in a misconfigured production
  // deployment (KV env missing) — that is fail-closed: do NOT ack, return 500.
  const eventHandler = getEventHandler()
  let store
  try {
    store = getStore()
  } catch {
    return NextResponse.json({ error: 'store unavailable' }, { status: 500 })
  }

  // ── 4. Normalize + route each event.  Routing is AWAITED before the response
  //       so no event is dropped if the process is torn down right after the ack
  //       (the prior fire-and-forget pattern lost events on serverless tear-
  //       down).
  //
  //       Two error classes, DISTINGUISHED in code (M2 Hard Rule):
  //        - CasePersistenceError → the case was NOT durably stored.  Stop and
  //          return 500 so LINE re-delivers the whole batch (at-least-once).
  //        - any other per-event error (malformed single event, benign no-op)
  //          → swallow and keep the 200; one bad event must not block the ack.
  let persistenceFailed = false
  for (const rawEvent of rawEvents) {
    try {
      const normalized = normalizeLineEvent(rawEvent as Record<string, any>, partnerGroupId, botUserId)
      if (normalized === null) continue // skip non-actionable / non-partner / room events

      // Route to the handler seam (default handler persists via routeCommand)
      await eventHandler(normalized, store)
    } catch (err) {
      if (err instanceof CasePersistenceError) {
        // Durable persistence failed — fail loud so LINE retries.
        persistenceFailed = true
        break
      }
      // Benign / non-persistence error — intentionally swallowed; the router
      // logs internally and the ack proceeds.
    }
  }

  // ── 5. Persistence failure → 500 (no ack, LINE retries); otherwise ack 200.
  if (persistenceFailed) {
    return NextResponse.json({ error: 'case persistence failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
