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
 */
const defaultEventHandler: NormalizedEventHandler = async (event, store) => {
  await routeCommand({
    event,
    store,
    llmClassifier: safeDefaultLlmClassifier,
    partnerGroupResponder: getPartnerGroupResponder(),
  })
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
