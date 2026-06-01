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
 *      is guaranteed to run before the 200).
 *   5. Respond 200 after routing completes.  LINE requires a fast
 *      acknowledgement, so routing must stay cheap in M1.
 *
 * M1 scope: this endpoint only NORMALIZES and ROUTES events.  Case persistence
 * / durable queue / KvStore production wiring is a Task 7/9 follow-up — nothing
 * is persisted here yet.
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
 * through `routeCommand`; a test or future bootstrap may override it via
 * `setEventHandler(...)` without changing the call site below.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature } from '@/lib/line-agent/line/signature'
import { normalizeLineEvent } from '@/lib/line-agent/line/event-normalizer'
import { getEventHandler, getStore } from '@/lib/line-agent/line/webhook-runtime'

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

  // Snapshot the seam once per request (live module bindings via getters)
  const eventHandler = getEventHandler()
  const store = getStore()

  // ── 4. Normalize + route each event.  Routing is AWAITED before the 200 so
  //       no event is dropped if the process is torn down right after the ack
  //       (the prior fire-and-forget pattern lost events on serverless tear-
  //       down).  Per-event try/catch keeps one bad event from crashing the
  //       batch or blocking the 200.  Routing must stay cheap so the ack is fast.
  const processEvents = async (): Promise<void> => {
    for (const rawEvent of rawEvents) {
      try {
        const normalized = normalizeLineEvent(rawEvent as Record<string, any>, partnerGroupId)
        if (normalized === null) continue // skip non-actionable / non-partner events

        // Route to the handler seam (default handler calls routeCommand)
        await eventHandler(normalized, store)
      } catch {
        // Individual event errors must not crash the handler or block 200
        // Errors are intentionally swallowed here; the router should log internally
      }
    }
  }

  await processEvents()

  // ── 5. Respond 200 after routing completes
  return NextResponse.json({ ok: true }, { status: 200 })
}
