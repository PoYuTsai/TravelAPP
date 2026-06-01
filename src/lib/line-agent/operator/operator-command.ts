/**
 * operator-command.ts
 *
 * Parse and validate a raw operator command payload into a typed OperatorCommand.
 *
 * SAFETY INVARIANT (enforced by type + test):
 *   A command that does NOT carry an explicit sendTarget has sendTarget === undefined.
 *   This means the bridge will ONLY prepare/draft — it must NEVER be interpreted as
 *   authorization to post to LINE.  Actual posting permission is enforced by the
 *   Task 6 permission layer; this module guarantees the absence of send intent is
 *   never silently upgraded to a posting decision.
 *
 * Valid operator source channels: 'discord_private' | 'internal_worker'
 * (line_oa and line_partner_group are NOT valid operator sources)
 *
 * Valid sendTarget channels: 'line_partner_group'
 * (Posting to LINE OA customers is not allowed in MVP — Task 6 enforces this too)
 */

import type { AgentSourceChannel } from '@/lib/line-agent/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Source channels that are allowed to issue operator commands. */
export type OperatorSourceChannel = Extract<
  AgentSourceChannel,
  'discord_private' | 'internal_worker'
>

/**
 * Explicit send intent — where (and how) the bridge should post after processing.
 *
 * - `channel`: the destination LINE channel.
 * - `confirm`: when true, the operator must confirm the draft before it is sent.
 *
 * When this field is ABSENT from an OperatorCommand, the bridge must only
 * prepare / draft a response.  It may NEVER default-send to any LINE channel.
 */
export interface SendTarget {
  channel: 'line_partner_group'
  confirm: boolean
}

/**
 * A validated, fully-typed operator command.
 *
 * `sendTarget` is intentionally optional (not defaulted) so that the type
 * system and runtime both reflect the absence of send authorization.
 */
export interface OperatorCommand {
  /** Who issued the command (e.g. 'eric'). */
  actor: string
  /** Where the command came from. */
  sourceChannel: OperatorSourceChannel
  /** Raw command text from the operator. */
  commandText: string
  /** Optional: the case this command is associated with. */
  caseId?: string
  /**
   * Optional explicit send intent.
   *
   * CRITICAL: When undefined, the bridge MUST treat this as draft/prepare mode
   * and MUST NOT post to any LINE channel.
   */
  sendTarget?: SendTarget
}

/** Raw input shape accepted by parseOperatorCommand (pre-validation). */
export interface OperatorCommandInput {
  actor: string
  sourceChannel: string
  commandText: string
  caseId?: string
  sendTarget?: {
    channel: string
    confirm: boolean
  }
}

// ---------------------------------------------------------------------------
// Parse result types
// ---------------------------------------------------------------------------

export type ParseCommandSuccess = {
  ok: true
  command: OperatorCommand
}

export type ParseCommandFailure = {
  ok: false
  code: 'INVALID_COMMAND'
  message: string
}

export type ParseCommandResult = ParseCommandSuccess | ParseCommandFailure

// ---------------------------------------------------------------------------
// Valid value sets
// ---------------------------------------------------------------------------

const VALID_OPERATOR_SOURCE_CHANNELS: ReadonlySet<string> = new Set<OperatorSourceChannel>([
  'discord_private',
  'internal_worker',
])

const VALID_SEND_TARGET_CHANNELS: ReadonlySet<string> = new Set<SendTarget['channel']>([
  'line_partner_group',
])

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw operator command input.
 *
 * @returns ParseCommandResult — never throws.
 */
export function parseOperatorCommand(input: OperatorCommandInput): ParseCommandResult {
  // Guard against null / non-object input
  if (input === null || input === undefined || typeof input !== 'object') {
    return {
      ok: false,
      code: 'INVALID_COMMAND',
      message: 'Command input must be a non-null object.',
    }
  }

  // Validate actor
  if (!input.actor || typeof input.actor !== 'string' || input.actor.trim() === '') {
    return {
      ok: false,
      code: 'INVALID_COMMAND',
      message: 'actor is required and must be a non-empty string.',
    }
  }

  // Validate sourceChannel — only operator channels are allowed
  if (!input.sourceChannel || !VALID_OPERATOR_SOURCE_CHANNELS.has(input.sourceChannel)) {
    return {
      ok: false,
      code: 'INVALID_COMMAND',
      message: `sourceChannel must be one of: ${[...VALID_OPERATOR_SOURCE_CHANNELS].join(', ')}. Got: ${input.sourceChannel ?? '(missing)'}`,
    }
  }

  // Validate commandText
  if (
    !input.commandText ||
    typeof input.commandText !== 'string' ||
    input.commandText.trim() === ''
  ) {
    return {
      ok: false,
      code: 'INVALID_COMMAND',
      message: 'commandText is required and must be a non-empty string.',
    }
  }

  // Validate optional sendTarget
  let sendTarget: SendTarget | undefined = undefined

  if (input.sendTarget !== undefined && input.sendTarget !== null) {
    const { channel, confirm } = input.sendTarget

    if (!VALID_SEND_TARGET_CHANNELS.has(channel)) {
      return {
        ok: false,
        code: 'INVALID_COMMAND',
        message: `sendTarget.channel must be one of: ${[...VALID_SEND_TARGET_CHANNELS].join(', ')}. Got: ${channel ?? '(missing)'}`,
      }
    }

    if (typeof confirm !== 'boolean') {
      return {
        ok: false,
        code: 'INVALID_COMMAND',
        message: 'sendTarget.confirm must be a boolean.',
      }
    }

    sendTarget = { channel: channel as SendTarget['channel'], confirm }
  }

  // Build the validated command.
  // sendTarget is deliberately NOT defaulted — absent means draft/prepare only.
  const command: OperatorCommand = {
    actor: input.actor.trim(),
    sourceChannel: input.sourceChannel as OperatorSourceChannel,
    commandText: input.commandText.trim(),
    ...(input.caseId !== undefined && input.caseId !== null && { caseId: input.caseId }),
    ...(sendTarget !== undefined && { sendTarget }),
  }

  return { ok: true, command }
}
