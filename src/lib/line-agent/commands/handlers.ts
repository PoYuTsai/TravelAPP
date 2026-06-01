/**
 * handlers.ts
 *
 * Handler stubs dispatched to by the command router.
 *
 * Each handler accepts a typed context and returns a structured placeholder
 * result.  Full implementation is planned for later Tasks (7, 8, 9+).  The
 * goal here is to wire the routing + permission system; stubs keep the
 * TypeScript types sound and allow tests to confirm the right handler is
 * reached without executing real logic.
 */

import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { OperatorCommand } from '../operator/operator-command'
import type { CommandIntent } from './intent'
import type { CaseStore } from '../storage/store'
import type { AgentCase } from '../cases/case-state'
import { createInitialCase } from '../cases/case-state'
import { caseReducer } from '../cases/case-reducer'
import { CasePersistenceError } from '../errors'

// ---------------------------------------------------------------------------
// Handler result type
// ---------------------------------------------------------------------------

export interface HandlerResult {
  /** The handler that was called. */
  handler: string
  /** Placeholder status — real handlers will return richer structs. */
  status: 'stub_ok' | 'stub_skipped' | 'error'
  /** Optional diagnostic data for testing or audit. */
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Respond handler — reply in the partner group after a tagged message
// ---------------------------------------------------------------------------

export async function handleRespondToPartnerGroup(
  event: NormalizedLineEvent,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleRespondToPartnerGroup',
    status: 'stub_ok',
    meta: { kind: event.kind, action: intent.action },
  }
}

// ---------------------------------------------------------------------------
// Case creation handler — when an OA customer message arrives
// ---------------------------------------------------------------------------

/**
 * Injectable seams for the case handler.  Defaults keep production
 * collision-safe and deterministic while letting tests pin exact values.
 */
export interface CaseHandlerDeps {
  /**
   * Deterministic caseId generator.  Default is messageId-based — unique per
   * LINE message and collision-safe, and only ever called on case CREATION
   * (the first message), so the id stays stable for the case's lifetime.
   * MUST NOT use listAll().length + 1 (races under concurrent invocations).
   */
  generateCaseId?: (event: NormalizedLineEvent) => string
  /**
   * Resolve the customer display name.  Default is a fallback derived from the
   * lineUserId — we deliberately do NOT call the LINE profile API on the
   * webhook path (a profile fetch must never block or fail the webhook).
   * Enriching displayName via a profile fetch is a later follow-up.
   */
  resolveDisplayName?: (event: NormalizedLineEvent) => string
}

function defaultCaseId(event: NormalizedLineEvent): string {
  return `CW-${event.messageId}`
}

function defaultDisplayName(event: NormalizedLineEvent): string {
  // Fallback only — no profile API call. Short, stable, non-empty.
  return `LINE-${event.lineUserId.slice(0, 8)}`
}

/**
 * Load-or-create the case for an OA customer message, apply the reducer for the
 * incoming message, persist the new state, and append the audit entry.
 *
 * This NEVER replies to the customer — the official OA is receive-only.  The
 * result is purely internal case state.
 */
export async function handleCreateOrUpdateCase(
  event: NormalizedLineEvent,
  store: CaseStore,
  deps: CaseHandlerDeps = {}
): Promise<HandlerResult> {
  const now = new Date(event.timestamp).toISOString()

  // Wrap ONLY store I/O so a persistence failure surfaces as a typed
  // CasePersistenceError → webhook returns 500 → LINE retries.  The pure
  // reducer below is intentionally NOT wrapped: a logic guard must not be
  // misclassified as a transient persistence failure (it would retry forever).
  const persist = async <T>(op: () => Promise<T>): Promise<T> => {
    try {
      return await op()
    } catch (err) {
      if (err instanceof CasePersistenceError) throw err
      throw new CasePersistenceError(event.lineUserId, { cause: err })
    }
  }

  const existing = await persist(() => store.getByLineUserId(event.lineUserId))
  const created = existing === null

  const current =
    existing ??
    createInitialCase({
      caseId: (deps.generateCaseId ?? defaultCaseId)(event),
      lineUserId: event.lineUserId,
      customerDisplayName: (deps.resolveDisplayName ?? defaultDisplayName)(event),
      now,
    })

  // ── Idempotency gate (LINE at-least-once delivery) ───────────────────────
  // LINE may redeliver the SAME event (e.g. after a 500 retry).  If this
  // messageId was already folded into the case, skip the reducer/persist
  // entirely so we never grow a duplicate audit entry or re-bump timestamps.
  // Empty messageId (a message that arrived without an id) is NEVER deduped —
  // collapsing all id-less messages into one would silently drop real ones.
  const messageId = event.messageId
  const seen = current.processedMessageIds ?? []
  if (messageId !== '' && seen.includes(messageId)) {
    return {
      handler: 'handleCreateOrUpdateCase',
      status: 'stub_skipped',
      meta: {
        caseId: current.caseId,
        created: false,
        deduped: true,
        status: current.status,
        kind: event.kind,
        sourceChannel: event.sourceChannel,
      },
    }
  }

  const prevAudit = created ? [] : await persist(() => store.getAudit(current.caseId))

  // Reuse the canonical reducer — do not reimplement transitions here.
  const { case: nextCase, audit } = caseReducer(
    current,
    { type: 'line_oa_message', lineUserId: event.lineUserId, text: event.text ?? '', now },
    prevAudit
  )

  // Record the messageId so a later redelivery is recognised as a duplicate.
  // Only non-empty ids participate in the idempotency set (see gate above).
  // The set is bounded in practice by case lifetime (a case reaches a terminal
  // status after at most a few dozen customer messages); a hard retention cap
  // is a deliberate follow-up if that ever proves insufficient.
  const caseToPersist: AgentCase =
    messageId === ''
      ? nextCase
      : { ...nextCase, processedMessageIds: [...seen, messageId] }

  await persist(() => store.put(caseToPersist))
  await persist(() => store.appendAudit(caseToPersist.caseId, audit[audit.length - 1]))

  return {
    handler: 'handleCreateOrUpdateCase',
    status: 'stub_ok',
    meta: {
      caseId: caseToPersist.caseId,
      created,
      status: caseToPersist.status,
      kind: event.kind,
      sourceChannel: event.sourceChannel,
    },
  }
}

// ---------------------------------------------------------------------------
// Draft handler — prepare a message but do NOT send to LINE
// ---------------------------------------------------------------------------

export async function handleDraft(
  command: OperatorCommand,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleDraft',
    status: 'stub_ok',
    meta: { action: intent.action, actor: command.actor },
  }
}

// ---------------------------------------------------------------------------
// Post-to-partner-group handler — send a prepared message to the LINE group
// ---------------------------------------------------------------------------

export async function handlePostToPartnerGroup(
  command: OperatorCommand,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handlePostToPartnerGroup',
    status: 'stub_ok',
    meta: {
      action: intent.action,
      actor: command.actor,
      sendTarget: command.sendTarget,
    },
  }
}

// ---------------------------------------------------------------------------
// Triage handler — analyse an incoming case (stub)
// ---------------------------------------------------------------------------

export async function handleTriage(
  event: NormalizedLineEvent,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleTriage',
    status: 'stub_ok',
    meta: { action: intent.action, kind: event.kind },
  }
}

// ---------------------------------------------------------------------------
// Parse-review handler — run itinerary/quote parse dry-run (stub)
// ---------------------------------------------------------------------------

export async function handleParseReview(
  event: NormalizedLineEvent
): Promise<HandlerResult> {
  return {
    handler: 'handleParseReview',
    status: 'stub_ok',
    meta: { kind: event.kind },
  }
}

// ---------------------------------------------------------------------------
// Bug-packet handler — create a structured bug report (stub)
// ---------------------------------------------------------------------------

export async function handleBugPacket(
  event: NormalizedLineEvent,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleBugPacket',
    status: 'stub_ok',
    meta: { action: intent.action, kind: event.kind },
  }
}

// ---------------------------------------------------------------------------
// Silent / no-op handler — used for casual chat that should be ignored
// ---------------------------------------------------------------------------

export function handleSilent(): HandlerResult {
  return {
    handler: 'handleSilent',
    status: 'stub_skipped',
  }
}
