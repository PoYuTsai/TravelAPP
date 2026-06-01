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
 * M1 scope: the default handler normalizes and ROUTES events through
 * `routeCommand`.  Handlers remain stubs — case persistence / durable queue /
 * KvStore production wiring is a Task 7/9 follow-up.  No customer auto-reply.
 */

import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import type { CaseStore } from '@/lib/line-agent/storage/store'
import { routeCommand } from '@/lib/line-agent/commands/router'
import { safeDefaultLlmClassifier } from '@/lib/line-agent/commands/intent'

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
 * the safe default classifier (no API calls, no keys).  Handlers invoked by
 * the router stay stubs in M1 — this only proves the event reaches routing.
 */
const defaultEventHandler: NormalizedEventHandler = async (event) => {
  await routeCommand({ event, llmClassifier: safeDefaultLlmClassifier })
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
 * The shared CaseStore instance.  Defaults to MemoryStore (safe for tests and
 * local dev).  Durable KvStore production wiring is a Task 7/9 follow-up.
 */
let _store: CaseStore = new MemoryStore()

/** Override the store (called by a future bootstrap or in tests). */
export function setStore(store: CaseStore): void {
  _store = store
}

/** Read the current store (called per request by the route). */
export function getStore(): CaseStore {
  return _store
}
