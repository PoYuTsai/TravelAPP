/**
 * responder.ts — PartnerGroupResponder seam (design 2026-06-03 §B)
 *
 * The seam that produces the TEXT the bot would say in the partner group after
 * it is mentioned.  This is the single injection point where a real LLM will be
 * wired later; M2 ships a deterministic safe stub.
 *
 * HARD BOUNDARIES (doc-level, must never be violated by any impl):
 *  - The responder ONLY produces text.
 *  - It MUST NOT import a LINE client / message-client.
 *  - It MUST NOT read any token / model env key.
 *  - It does NOT decide whether to send.  Whether the text actually reaches the
 *    group is owned by the router + permission layer (B4 sendTarget).
 *
 * Therefore this file intentionally has NO imports beyond a type — no network,
 * no env, no side effects.  Swapping in GPT later = a new object implementing
 * `PartnerGroupResponder`; the handler/router/permission boundaries do not move.
 */

import type { CommandIntent } from '../commands/intent'
import type { NormalizedLineEvent } from '../line/event-normalizer'

export interface PartnerGroupRespondInput {
  /** The normalized partner-group event that mentioned the bot. */
  event: NormalizedLineEvent
  /** The resolved intent (repo's existing type — there is no `Intent` type). */
  intent: CommandIntent
  /** The message text being responded to. */
  text: string
  /** Optional actor info (who mentioned the bot). */
  actor?: { lineUserId?: string }
  /** Future group-quoted case linkage — unused in this batch. */
  caseId?: string
  /** Reserved — NOT wired to Notion/Google in this batch. */
  context?: unknown
}

export interface PartnerGroupRespondResult {
  /** The text the bot would say (the router decides whether to actually send). */
  text: string
  /**
   * Provenance for audit/debug. `model` is only set by a real LLM impl.
   *
   * `degraded` + `error` mark a SAFE-DEFAULT fallback (design §6): a real-model
   * path that hit a missing key / API failure / parse failure and fell back to
   * stub text WITHOUT throwing.  This is observable, not silent — the error code
   * plus a non-minified log let the failure be traced.
   */
  meta?: {
    responder: 'stub' | 'llm' | 'rag'
    model?: string
    confidence?: string
    degraded?: boolean
    error?: string
  }
}

export interface PartnerGroupResponder {
  respond(input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult>
}

/**
 * The frozen safe stub text (design §B 文字定稿).  No emoji; deliberately does
 * NOT say "tag Eric" so it never reads like a system/test message.
 */
export const STUB_PARTNER_GROUP_REPLY =
  '收到，我先記下來。這批我目前先跑安全版助理流程，會先協助整理與判斷；需要正式結論或外部確認時，請 Eric 再拍板。'

/**
 * Deterministic safe-default responder.  Returns a fixed reassurance line and
 * tags itself `responder: 'stub'`.  No model, no I/O, no env.
 */
export const stubPartnerGroupResponder: PartnerGroupResponder = {
  async respond(_input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult> {
    return {
      text: STUB_PARTNER_GROUP_REPLY,
      meta: { responder: 'stub' },
    }
  },
}
