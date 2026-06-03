/**
 * partner-reply-gate.ts — the single authority for "may the bot reply to this
 * partner-group message?" (tagged-reply plan §3).
 *
 * Pure predicate: no I/O, no env, no side effects. The webhook send gate calls
 * this and ONLY sends (via the reply client seam) when it returns true. Keeping
 * the decision pure makes the send boundary exhaustively testable without LINE.
 *
 * ALL SIX conditions must hold; any single false → no reply:
 *   1. decision.source === 'line_partner_group'
 *   2. event.mentionsBot === true            (this cut: tag only; quote-to-bot later)
 *   3. decision.action === 'respond'
 *   4. decision.denied !== true
 *   5. decision.handlerResult.outboundText is a non-empty (trimmed) string
 *   6. event.replyToken is a non-empty string
 *
 * Condition 2 is why an OA customer can never trigger a reply: the normalizer
 * forces mentionsBot:false on line_oa, so the gate is closed regardless of text.
 */

import type { NormalizedLineEvent } from './event-normalizer'
import type { RouterDecision } from '../commands/router'

export function shouldReplyToPartnerGroup(
  event: NormalizedLineEvent,
  decision: RouterDecision
): boolean {
  const outboundText = decision.handlerResult?.outboundText
  return (
    decision.source === 'line_partner_group' &&
    event.mentionsBot === true &&
    decision.action === 'respond' &&
    decision.denied !== true &&
    typeof outboundText === 'string' &&
    outboundText.trim() !== '' &&
    typeof event.replyToken === 'string' &&
    event.replyToken.trim() !== ''
  )
}
