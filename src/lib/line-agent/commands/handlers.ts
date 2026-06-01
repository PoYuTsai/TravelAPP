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

export async function handleCreateOrUpdateCase(
  event: NormalizedLineEvent
): Promise<HandlerResult> {
  return {
    handler: 'handleCreateOrUpdateCase',
    status: 'stub_ok',
    meta: { kind: event.kind, sourceChannel: event.sourceChannel },
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
