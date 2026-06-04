/**
 * Webhook runtime seams — injectable handler + store for the LINE webhook route.
 *
 * These live in the lib layer (not the route file) because a Next.js App Router
 * route file may only export HTTP-method handlers (`POST`, …) and a fixed set
 * of config keys.  Arbitrary exports like `setEventHandler` / `setStore` are
 * rejected by `next build`'s route validator, so the seam state and its
 * setters/getters are kept here and imported by the route.
 *
 * Module-singleton state with live ES-module bindings: the route reads the
 * current handler/store via the getters at request time, while a test (or a
 * future bootstrap) injects an alternative implementation via the setters.
 *
 * The default handler routes events through `routeCommand`, which durably
 * persists OA customer cases via the reducer + the bootstrapped store
 * (KvStore in production, MemoryStore locally).  No customer auto-reply.
 */

import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { CaseStore } from '@/lib/line-agent/storage/store'
import { selectStore } from '@/lib/line-agent/storage/select-store'
import { routeCommand } from '@/lib/line-agent/commands/router'
import { safeDefaultLlmClassifier } from '@/lib/line-agent/commands/intent'
import type { PartnerGroupResponder } from '@/lib/line-agent/partner-group/responder'
import { createPartnerGroupResponder } from '@/lib/line-agent/partner-group/responder-factory'
import { getPartnerResponderConfig } from '@/lib/line-agent/partner-group/responder-config'
import { shouldReplyToPartnerGroup } from '@/lib/line-agent/line/partner-reply-gate'
import { replyMessage, type LineMessage } from '@/lib/line-agent/line/message-client'

// ---------------------------------------------------------------------------
// Routing seam — injectable handler
// ---------------------------------------------------------------------------

/**
 * The normalized-event handler.
 *
 * A test (or future bootstrap) calls `setEventHandler(...)` to override the
 * default without modifying the POST handler.  The webhook AWAITS this handler
 * before returning its 200 so routing is guaranteed to run for each event.
 */
export type NormalizedEventHandler = (
  event: NormalizedLineEvent,
  store: CaseStore
) => Promise<void>

/**
 * Default handler: route the normalized event through the command router using
 * the safe default classifier (no API calls, no keys).  For OA customer events
 * the router persists the case via the reducer + store; a persistence failure
 * propagates as CasePersistenceError so the route can return 500.
 *
 * Partner-group SEND GATE (tagged-reply plan §3/§5): the router only *decides*
 * (it never sends).  Sending happens here and ONLY here, and ONLY when the pure
 * gate `shouldReplyToPartnerGroup` is satisfied — a tagged partner-group message
 * with non-empty responder text and a live reply token.  Customer OA events can
 * never satisfy the gate (condition 1 pins the source to the partner group), so
 * a customer is never auto-replied.
 *
 * A reply failure is suppressed (logged, not rethrown) so the webhook still acks
 * 200 — LINE redelivery would otherwise re-bill the model and disturb the other
 * events in the same batch.  The reply token's single-use semantics are the
 * primary duplicate-reply guard.
 */
/**
 * Cheap, event-only precondition for resolving the (possibly billed) responder:
 * the necessary conditions for a reply that do NOT depend on the routing
 * decision (source + tag + a live reply token).  It is intentionally a SUBSET of
 * `shouldReplyToPartnerGroup` — the full gate still runs post-routing before any
 * send.  Used only to avoid wasted model calls; it never authorises a send.
 */
function mayProducePartnerGroupReply(event: NormalizedLineEvent): boolean {
  return (
    event.sourceChannel === 'line_partner_group' &&
    event.mentionsBot === true &&
    typeof event.replyToken === 'string' &&
    event.replyToken.trim() !== ''
  )
}

const defaultEventHandler: NormalizedEventHandler = async (event, store) => {
  const replyCandidate = mayProducePartnerGroupReply(event)

  // Send-once secondary guard (tagged-reply plan §4).  Atomically claim the
  // right to reply to THIS partner-group message BEFORE the (possibly billed)
  // responder runs.  LINE delivers at-least-once and concurrent serverless
  // instances may pick up the same event; the first caller claims and proceeds,
  // every later caller loses the claim and returns immediately — no re-billed
  // model call, no duplicate reply.  The reply token's single-use semantics
  // remain the PRIMARY guard; this is the cross-instance backstop.
  //
  // Empty messageId is NEVER deduped (mirrors the OA rule, handlers.ts:246):
  // collapsing all id-less messages into one claim would silently drop replies.
  if (replyCandidate && event.messageId !== '') {
    const claimed = await store.claimPartnerReply(event.messageId)
    if (!claimed) return
  }

  // Resolve the REAL (possibly billed) responder ONLY when this event could
  // actually produce a LINE reply: a tagged partner-group message with a live
  // reply token.  Otherwise (OA inbound, untagged chat, missing/expired reply
  // token) the responder's text would be generated only to be discarded by the
  // send gate — wasted model calls in anthropic mode.  In those cases we pass
  // no responder and routeCommand falls back to its free stub, so routing and
  // the missing-replyToken warning below still work without burning a model.
  const decision = await routeCommand({
    event,
    store,
    llmClassifier: safeDefaultLlmClassifier,
    partnerGroupResponder: replyCandidate ? getPartnerGroupResponder() : undefined,
  })

  if (shouldReplyToPartnerGroup(event, decision)) {
    const outboundText = decision.handlerResult!.outboundText!
    try {
      await getReplyClient()(event.replyToken!, [{ type: 'text', text: outboundText }])
    } catch (err) {
      // §5: a reply failure must NOT propagate (no 500) and must NOT fall back
      // to the customer plane or push.  Log a readable (non-minified) error and
      // let the webhook ack 200.
      console.error(
        '[line-agent] partner-group reply failed; suppressed to keep webhook 200:',
        err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      )
    }
    return
  }

  // Diagnostic: a respond-worthy partner-group decision blocked ONLY by a
  // missing/expired reply token (the gate would pass with a token present).
  // We cannot reply without a token; surface it but still ack 200.
  if (
    !event.replyToken &&
    shouldReplyToPartnerGroup({ ...event, replyToken: 'probe' }, decision)
  ) {
    console.warn(
      '[line-agent] partner-group respond decision had no replyToken; skipping reply'
    )
  }
}

let _eventHandler: NormalizedEventHandler = defaultEventHandler

/**
 * Override the normalized-event handler.  Called by tests or a future startup
 * bootstrap.  The handler must be idempotent — it may be called multiple times
 * in test environments.
 */
export function setEventHandler(handler: NormalizedEventHandler): void {
  _eventHandler = handler
}

/** Read the currently-registered handler (called per request by the route). */
export function getEventHandler(): NormalizedEventHandler {
  return _eventHandler
}

// ---------------------------------------------------------------------------
// Store seam — injectable store
// ---------------------------------------------------------------------------

/**
 * The shared CaseStore instance.
 *
 * Resolved LAZILY via selectStore() on first read so that:
 *   - importing this module never throws (the fail-closed throw for a
 *     production deployment missing KV env is deferred to the first request,
 *     where it surfaces as a 500 — LINE then retries);
 *   - a test or bootstrap can still inject an override via setStore() before
 *     the first getStore() call.
 */
let _store: CaseStore | null = null

/** Override the store (called by a future bootstrap or in tests). */
export function setStore(store: CaseStore): void {
  _store = store
}

/** Read the current store (called per request by the route). */
export function getStore(): CaseStore {
  if (_store === null) {
    _store = selectStore()
  }
  return _store
}

// ---------------------------------------------------------------------------
// Partner-group responder seam — injectable text producer
// ---------------------------------------------------------------------------

/**
 * The partner-group responder (produces the TEXT the bot would say after a tag;
 * it never sends — the webhook send gate owns that, added in a later task).
 *
 * Resolved LAZILY via the factory on first read so that:
 *   - importing this module never reads env / builds an adapter;
 *   - the default honours `AI_AGENT_PARTNER_RESPONDER_MODE` (defaults to the
 *     safe stub — an Anthropic key alone never auto-enables a billed model);
 *   - a test or bootstrap can inject an override via setPartnerGroupResponder().
 */
let _partnerGroupResponder: PartnerGroupResponder | null = null

/** Override the partner-group responder (called by a bootstrap or in tests). */
export function setPartnerGroupResponder(responder: PartnerGroupResponder): void {
  _partnerGroupResponder = responder
}

/** Read the current partner-group responder (called per request by the handler). */
export function getPartnerGroupResponder(): PartnerGroupResponder {
  if (_partnerGroupResponder === null) {
    _partnerGroupResponder = createPartnerGroupResponder({
      models: getPartnerResponderConfig(),
      transport: fetch,
    })
  }
  return _partnerGroupResponder
}

// ---------------------------------------------------------------------------
// Reply client seam — the single LINE-send boundary for tagged replies
// ---------------------------------------------------------------------------

/**
 * Sends a reply to a partner-group event using its reply token.  This is the
 * ONLY place the tagged-reply path touches the LINE Messaging API; the router
 * and responder stay pure.  A test injects a recording fake via setReplyClient.
 */
export type ReplyClient = (
  replyToken: string,
  messages: LineMessage[]
) => Promise<string[]>

/**
 * The reply client.
 *
 * Resolved LAZILY so importing this module never reads env.  The default reads
 * `LINE_CHANNEL_ACCESS_TOKEN` at CALL time (not seam-build time) and delegates
 * to the real `replyMessage`; a missing token therefore surfaces as a
 * LineApiError caught by the send gate (log + 200), never an import-time throw.
 */
let _replyClient: ReplyClient | null = null

/** Override the reply client (called by a bootstrap or in tests). */
export function setReplyClient(client: ReplyClient): void {
  _replyClient = client
}

/** Read the current reply client (called by the send gate). */
export function getReplyClient(): ReplyClient {
  if (_replyClient === null) {
    _replyClient = (replyToken, messages) =>
      replyMessage(replyToken, messages, process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '')
  }
  return _replyClient
}
