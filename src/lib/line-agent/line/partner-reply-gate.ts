/**
 * partner-reply-gate.ts — the single authority for "may the bot reply to this
 * partner-group message?" (tagged-reply plan §3).
 *
 * Pure predicate: no I/O, no env, no side effects. The webhook send gate calls
 * this and ONLY sends (via the reply client seam) when it returns true. Keeping
 * the decision pure makes the send boundary exhaustively testable without LINE.
 *
 * ALL SEVEN conditions must hold; any single false → no reply:
 *   1. event.sourceChannel === 'line_partner_group'
 *   2. decision.source === 'line_partner_group'
 *   3. botDirected === true (tag OR quote-to-bot)
 *   4. decision.action === 'respond'
 *   5. decision.denied !== true
 *   6. decision.handlerResult.outboundText is a non-empty (trimmed) string
 *   7. event.replyToken is a non-empty string
 *
 * Conditions 1 + 2 BOTH pin the source to the partner group — defense in depth.
 * This pure gate is the last line of defense before send, so it does NOT trust
 * the normalizer alone: even if an upstream bug let an OA event arrive with
 * mentionsBot:true, condition 1 keeps the gate closed so a customer can never be
 * auto-replied. (Normally the normalizer also forces mentionsBot:false on
 * line_oa — that is the first line of defense, not the only one.)
 */

import type { NormalizedLineEvent } from './event-normalizer'
import type { RouterDecision } from '../commands/router'

export function shouldReplyToPartnerGroup(
  event: NormalizedLineEvent,
  decision: RouterDecision,
  botDirected: boolean
): boolean {
  const outboundText = decision.handlerResult?.outboundText
  return (
    event.sourceChannel === 'line_partner_group' &&
    decision.source === 'line_partner_group' &&
    botDirected === true && // ← was event.mentionsBot === true
    decision.action === 'respond' &&
    decision.denied !== true &&
    typeof outboundText === 'string' &&
    outboundText.trim() !== '' &&
    typeof event.replyToken === 'string' &&
    event.replyToken.trim() !== ''
  )
}
