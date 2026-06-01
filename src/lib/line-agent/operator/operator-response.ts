/**
 * operator-response.ts
 *
 * Builds the structured response that the Discord bot prints back to the operator
 * after processing a command.
 *
 * Pure functions only — no I/O, no side effects.
 * The caller (route.ts) formats and delivers the response; this module only
 * assembles the data shape.
 */

import type { OperatorCommand } from './operator-command'

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export type OperatorResponseStatus = 'acknowledged' | 'draft_ready' | 'error' | 'pending'

export interface OperatorResponse {
  /** Overall status of command processing. */
  status: OperatorResponseStatus
  /** Human-readable message for the Discord operator to read. */
  message: string
  /**
   * Optional draft text to be reviewed before any downstream action.
   * Present when the command produced output that needs operator confirmation.
   */
  draftPreview?: string
  /** The case ID this response is associated with, if any. */
  caseId?: string
  /** Non-fatal warnings the operator should be aware of. */
  warnings?: string[]
  /** ISO timestamp of when this response was built. */
  timestamp: string
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build an acknowledgement response for a command that has been accepted but
 * not yet executed (i.e. no sendTarget — the bridge is in draft/prepare mode).
 */
export function buildAcknowledgement(command: OperatorCommand): OperatorResponse {
  const hasSendTarget = command.sendTarget !== undefined

  const message = hasSendTarget
    ? `Command acknowledged. Processing with explicit send intent to ${command.sendTarget!.channel}${command.sendTarget!.confirm ? ' (confirmation required)' : ''}.`
    : 'Command acknowledged. Preparing draft — no LINE post will be made until you provide an explicit send target.'

  return {
    status: hasSendTarget ? 'pending' : 'acknowledged',
    message,
    ...(command.caseId !== undefined && { caseId: command.caseId }),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Build a draft-ready response — used when the command has produced a draft
 * that the operator must review before it is sent anywhere.
 */
export function buildDraftResponse(
  command: OperatorCommand,
  draftText: string,
  warnings?: string[]
): OperatorResponse {
  return {
    status: 'draft_ready',
    message: 'Draft ready for review. Reply with an explicit send command to forward to LINE.',
    draftPreview: draftText,
    ...(command.caseId !== undefined && { caseId: command.caseId }),
    ...(warnings && warnings.length > 0 && { warnings }),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Build an error response for the operator.
 */
export function buildErrorResponse(message: string, caseId?: string): OperatorResponse {
  return {
    status: 'error',
    message,
    ...(caseId !== undefined && { caseId }),
    timestamp: new Date().toISOString(),
  }
}
