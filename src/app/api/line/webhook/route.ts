/**
 * POST /api/line/webhook
 *
 * LINE Messaging API webhook handler.
 *
 * Responsibilities:
 *   1. Read the raw request body (needed for HMAC-SHA256 signature check).
 *   2. Verify the `x-line-signature` header → 401 on failure; do nothing else.
 *   3. Parse events, normalize each one via event-normalizer.
 *   4. Persist normalized events in the CaseStore.
 *   5. Hand off to the routing seam (see `handleNormalizedEvent` below).
 *   6. Respond 200 immediately.  LINE requires a fast acknowledgement.
 *      Heavy LLM/Notion/API work MUST NOT block this 200 response.
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
 * Task 6 will implement the full command/event router.  Until then,
 * `handleNormalizedEvent` is a stub exported from this file.  Task 6 MUST
 * replace it by injecting or importing the real router without changing the
 * call site in the POST handler.  Use the `setEventHandler` setter to wire
 * the router without requiring a direct import of a not-yet-existing module.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyLineSignature } from '@/lib/line-agent/line/signature'
import { normalizeLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import type { CaseStore } from '@/lib/line-agent/storage/store'

// ---------------------------------------------------------------------------
// Routing seam — injectable handler for Task 6
// ---------------------------------------------------------------------------

/**
 * The normalized-event handler.  Default is a no-op stub.
 *
 * Task 6 calls `setEventHandler(myRouter)` to wire the real command router
 * without modifying the POST handler below.
 *
 * The handler is intentionally fire-and-forget (not awaited before 200)
 * to keep the LINE acknowledgement fast.
 */
type NormalizedEventHandler = (
  event: NormalizedLineEvent,
  store: CaseStore
) => Promise<void>

let _eventHandler: NormalizedEventHandler = async () => {
  // Stub: Task 6 will replace this via setEventHandler()
}

/**
 * Register the real command router.  Called once at application startup by
 * Task 6.  The handler must be idempotent — it may be called multiple times
 * in test environments.
 */
export function setEventHandler(handler: NormalizedEventHandler): void {
  _eventHandler = handler
}

// ---------------------------------------------------------------------------
// Store seam — injectable store for tests
// ---------------------------------------------------------------------------

/**
 * The shared CaseStore instance.  Defaults to MemoryStore (safe for tests
 * and local dev).  Production wires a KvStore via `setStore()`.
 */
let _store: CaseStore = new MemoryStore()

/**
 * Override the store (called by production bootstrap or in tests).
 */
export function setStore(store: CaseStore): void {
  _store = store
}

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

  // ── 4 & 5. Normalize + hand off to router (fire-and-forget — must not
  //           delay the 200 response to LINE)
  const processEvents = async (): Promise<void> => {
    for (const rawEvent of rawEvents) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalized = normalizeLineEvent(rawEvent as Record<string, any>, partnerGroupId)
        if (normalized === null) continue // skip non-message events

        // Route to the handler seam (Task 6 wires the real router)
        await _eventHandler(normalized, _store)
      } catch {
        // Individual event errors must not crash the handler or block 200
        // Errors are intentionally swallowed here; the router should log internally
      }
    }
  }

  // Kick off processing without awaiting — LINE needs the 200 fast
  processEvents().catch(() => {
    // Background errors must not surface to the response
  })

  // ── 6. Respond 200 fast
  return NextResponse.json({ ok: true }, { status: 200 })
}
