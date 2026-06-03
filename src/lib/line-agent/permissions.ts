/**
 * permissions.ts
 *
 * Deterministic pure permission functions — the source of truth for the 5
 * channel/action policy boundaries of the LINE OA agent.
 *
 * IMPORTANT design rules:
 * - Every function is a pure, synchronous TypeScript function.
 * - No LLM / model calls.  No async.  No side effects.
 * - The LLM fallback seam in commands/intent.ts is advisory only; all final
 *   decisions are gated here.
 * - LLM suggestions CANNOT widen permissions — the permission functions here
 *   are the last word.
 *
 * The 5 boundaries encoded:
 *  B1  canRespondToPartnerGroupTag     — tagged partner-group → allow respond
 *  B2  shouldIgnoreCasualPartnerGroupChat — casual chat → ignore
 *  B3  canAutoReplyToOaCustomer        — OA customer → always DENY auto-reply
 *  B4  canPostToPartnerGroupFromDC     — DC → partner group only with sendTarget
 *  B5  canPartnerGroupTriggerDevAction — partner group → DENY dev actions
 */

import type { NormalizedLineEvent, NormalizedLineEventKind } from './line/event-normalizer'
import type { OperatorCommand } from './operator/operator-command'
import type { CommandIntent, IntentAction } from './commands/intent'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface PermissionResult {
  allowed: boolean
  /** Present when allowed is false — human-readable denial reason. */
  reason?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the event text contains a bot mention (@bot or @cc).
 * Simple heuristic — deterministic, no model required.
 */
function hasBotMention(text: string | undefined): boolean {
  if (!text) return false
  return /@bot\b|@cc\b/i.test(text)
}

/**
 * The set of dev actions that are NEVER allowed from the LINE partner group.
 */
const DENIED_FROM_PARTNER_GROUP: ReadonlySet<IntentAction> = new Set<IntentAction>([
  'code_edit',
  'deploy',
  'parser_change',
  'schema_change',
  // Building a quote (even dry-run) is a write-plane action — the partner group
  // may surface inputs but must never trigger the quote build itself.
  'create_quote',
  // Listing raw OA customer inquiry text is an operator/private read action.
  'list_cases',
])

/**
 * The set of NormalizedLineEventKind values that represent an active partner-group
 * request (tagged / quoted — the bot is being addressed).
 */
const ACTIVE_PARTNER_GROUP_KINDS: ReadonlySet<NormalizedLineEventKind> = new Set<NormalizedLineEventKind>([
  'group_quoted',
])

// ---------------------------------------------------------------------------
// B1: canRespondToPartnerGroupTag
//
// A normalized partner-group event where the bot is tagged → permission allows
// responding.  All other sources → denied (wrong channel).
// ---------------------------------------------------------------------------

/**
 * B1 — Tagged partner-group messages MUST get a response.
 *
 * Returns allowed:true when:
 *  - the event source is line_partner_group, AND
 *  - the event is a group_quoted kind (explicit reply/tag), OR the text
 *    contains a @bot / @cc mention.
 */
export function canRespondToPartnerGroupTag(event: NormalizedLineEvent): PermissionResult {
  if (event.sourceChannel !== 'line_partner_group') {
    return {
      allowed: false,
      reason: `canRespondToPartnerGroupTag: source is ${event.sourceChannel}, not line_partner_group`,
    }
  }

  const isTagged =
    ACTIVE_PARTNER_GROUP_KINDS.has(event.kind) || hasBotMention(event.text)

  if (isTagged) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: 'canRespondToPartnerGroupTag: event is not tagged / not a quoted reply',
  }
}

// ---------------------------------------------------------------------------
// B2: shouldIgnoreCasualPartnerGroupChat
//
// Returns true (ignore) for casual / unaddressed partner-group messages.
// Returns false (do NOT ignore) when the bot is tagged or the event is a
// quoted reply.
// ---------------------------------------------------------------------------

/**
 * B2 — Casual partner-group chat is IGNORED.
 *
 * Returns true when the event should be silently ignored (no bot mention, not
 * a quoted reply, or an unknown_group kind).
 *
 * Returns false when the event should be processed (bot is tagged or it is a
 * quoted reply).
 */
export function shouldIgnoreCasualPartnerGroupChat(event: NormalizedLineEvent): boolean {
  if (event.sourceChannel !== 'line_partner_group') {
    // Only partner-group messages are checked here; other sources are not "casual chat"
    return false
  }

  // Quoted replies are never casual — the bot is being directly addressed
  if (ACTIVE_PARTNER_GROUP_KINDS.has(event.kind)) return false

  // unknown_group kinds (stickers, etc.) should always be ignored
  if (event.kind === 'unknown_group') return true

  // For group_text, ignore unless the bot is mentioned
  if (hasBotMention(event.text)) return false

  return true
}

// ---------------------------------------------------------------------------
// B3: canAutoReplyToOaCustomer
//
// Any line_oa source → ALWAYS deny auto-reply to customer.
// An optional intent parameter is accepted but IGNORED — the LLM suggesting
// "respond" cannot override this policy.
// ---------------------------------------------------------------------------

/**
 * B3 — OA customers NEVER receive automatic replies.
 *
 * Returns allowed:false for any line_oa source, regardless of intent.
 * Returns allowed:true for non-OA sources (this gate does not apply there).
 *
 * @param intent  Optional — ignored for OA events.  Present only so callers can
 *                pass an LLM-proposed intent and verify it is still denied.
 */
export function canAutoReplyToOaCustomer(
  event: NormalizedLineEvent,
  _intent?: IntentAction
): PermissionResult {
  if (event.sourceChannel === 'line_oa') {
    return {
      allowed: false,
      reason:
        'canAutoReplyToOaCustomer: auto-reply to LINE OA customers is ALWAYS denied in MVP. ' +
        'The agent may create an internal case event but must never send a customer-facing reply.',
    }
  }
  // Not an OA event — this particular gate does not apply
  return { allowed: true }
}

// ---------------------------------------------------------------------------
// B4: canPostToPartnerGroupFromDC
//
// DC operator command → posting to line_partner_group requires an explicit
// sendTarget.  Absence of sendTarget = draft/prepare mode only.
// ---------------------------------------------------------------------------

/** Valid operator source channels that may post to LINE. */
const VALID_OPERATOR_SOURCES = new Set<string>(['discord_private', 'internal_worker'])

/**
 * B4 — DC can post to partner group ONLY with explicit send intent.
 *
 * Returns allowed:false when:
 *  - sendTarget is absent (no send intent → draft only), OR
 *  - the source is not a valid operator channel.
 *
 * Returns allowed:true when:
 *  - source is a valid operator channel, AND
 *  - sendTarget.channel is 'line_partner_group'.
 */
export function canPostToPartnerGroupFromDC(command: OperatorCommand): PermissionResult {
  if (!VALID_OPERATOR_SOURCES.has(command.sourceChannel)) {
    return {
      allowed: false,
      reason: `canPostToPartnerGroupFromDC: source "${command.sourceChannel}" is not a valid operator channel`,
    }
  }

  if (!command.sendTarget) {
    return {
      allowed: false,
      reason:
        'canPostToPartnerGroupFromDC: sendTarget is absent — this is draft/prepare mode only. ' +
        'Add an explicit sendTarget to authorize posting to line_partner_group.',
    }
  }

  if (command.sendTarget.channel !== 'line_partner_group') {
    return {
      allowed: false,
      reason: `canPostToPartnerGroupFromDC: sendTarget.channel "${command.sendTarget.channel}" is not line_partner_group`,
    }
  }

  return { allowed: true }
}

// ---------------------------------------------------------------------------
// B5: canPartnerGroupTriggerDevAction
//
// A partner-group event with a dev intent (code_edit, deploy, parser_change,
// schema_change) → ALWAYS denied, regardless of intent source (deterministic
// OR LLM).  This is the hard gate that ensures the LLM cannot widen
// permissions.
// ---------------------------------------------------------------------------

/**
 * B5 (+ B6 LLM-widening prevention) — LINE partner group cannot trigger dev
 * actions.
 *
 * Returns allowed:false when the event is from line_partner_group AND the
 * intent action is in the DENIED_FROM_PARTNER_GROUP set.
 *
 * Returns allowed:true for operational actions (analyze, ocr, web_search,
 * parse, draft, bug_packet) from the partner group.
 *
 * NOTE: This function is called AFTER LLM classification.  If the LLM returns
 * a dev action for a partner-group message, this function will still DENY it.
 * That is by design — the LLM cannot widen permissions.
 */
export function canPartnerGroupTriggerDevAction(
  event: NormalizedLineEvent,
  intent: CommandIntent
): PermissionResult {
  if (event.sourceChannel !== 'line_partner_group') {
    // Dev actions are gated differently for non-partner-group sources
    return { allowed: true }
  }

  if (DENIED_FROM_PARTNER_GROUP.has(intent.action)) {
    return {
      allowed: false,
      reason:
        `canPartnerGroupTriggerDevAction: action "${intent.action}" is a dev-plane action and ` +
        'is NEVER allowed from line_partner_group. ' +
        'Dev actions (code_edit, deploy, parser_change, schema_change) belong to the ' +
        'Eric/DC operator plane only. Allowed partner-group actions: analyze, ocr, web_search, ' +
        'parse, draft, bug_packet.',
    }
  }

  return { allowed: true }
}
