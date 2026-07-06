/**
 * quoted-draft-customer-reply.ts — M3.6c
 *
 * The deterministic "summarise a quoted bot draft for a customer" path for the
 * private LINE partner group.
 *
 * Context (M3.6c, Eric 2026-06-10): in the private test group a partner can
 * QUOTE a draft the bot previously sent and ask, without re-tagging, to "整理一段
 * 可以回客人的說法". The quote-to-bot signal already routes such a message to the
 * responder; this module is the responder path that turns it into a short,
 * conservative, customer-readable suggestion.
 *
 * HARD DESIGN DECISION (Eric): the output is a FIXED customer-safe template. It
 *  - NEVER echoes the quoted internal draft body (the draft carries internal
 *    vocabulary / cost / margin that must never reach a customer),
 *  - does NOT call an LLM,
 *  - uses the cached quoted content's PRESENCE only as the trigger,
 *  - fails closed to a fixed "請貼上草稿" reply when the cached content is missing.
 *
 * Therefore this file has NO Notion/LLM/LINE/env/gate dependency — only a type
 * import and the shared customer-facing forbidden-terms scanner (used by tests).
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import type { AgentSourceChannel } from '../types'

// ---------------------------------------------------------------------------
// Fixed phrasing (customer-safe; no internal/operator vocabulary, no promise)
// ---------------------------------------------------------------------------

/**
 * The customer-safe suggestion emitted when a quoted bot draft is cached. It
 * stays at the "direction + must-confirm" altitude: it suggests a planning
 * direction, makes NO price/availability/feasibility promise, and reminds the
 * partner to confirm the open facts (date, headcount, kids' age, flight,
 * lodging/pickup) before anything is finalised.
 */
export const QUOTED_DRAFT_CUSTOMER_REPLY =
  '您好，這類清邁親子行程可以先往親子友善、動物體驗與夜間活動的方向初步規劃。' +
  '不過實際安排仍需要確認出發日期、人數、小孩年齡/身高、航班時間，以及住宿或上車地點，' +
  '我們確認後再協助整理比較適合的行程建議。'

/**
 * Fail-closed reply when the quoted bot content cannot be retrieved (not cached
 * / expired / store error). Conservative: asks the partner to paste the draft or
 * the customer message; never guesses the quoted content, never promises a quote.
 */
export const QUOTED_DRAFT_CONTENT_MISSING_REPLY =
  '我這邊沒有抓到可用的那則草稿內容，請直接貼上草稿或客人訊息，我再幫你整理。'

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

/**
 * Secondary signals that, combined with an explicit customer mention, mark a
 * "summarise this for the customer" request. A bare customer mention is NOT
 * enough (so casual chat that names a customer does not fire).
 */
const SUMMARIZE_SECONDARY_TOKENS = ['整理', '說法', '回覆', '版本'] as const
const CUSTOMER_TOKENS = ['客人', '客戶'] as const

/** True iff `text` asks to turn something into a customer-facing reply. */
export function detectSummarizeForCustomerIntent(text: string): boolean {
  if (!text) return false
  const mentionsCustomer = CUSTOMER_TOKENS.some((t) => text.includes(t))
  if (!mentionsCustomer) return false
  return SUMMARIZE_SECONDARY_TOKENS.some((t) => text.includes(t))
}

// ---------------------------------------------------------------------------
// Context sanitisation
// ---------------------------------------------------------------------------

/**
 * Max length of quoted bot context the caller may thread into the responder.
 * The template never echoes the content, so this is a defensive bound on the
 * value carried around — it keeps an oversized prior draft from bloating the
 * input even though it is only used as a presence trigger.
 */
export const QUOTED_BOT_CONTEXT_MAX_CHARS = 1000

/** Collapse whitespace, trim, and length-cap a raw cached draft for use as context. */
export function sanitizeQuotedBotContext(
  raw: string,
  maxChars: number = QUOTED_BOT_CONTEXT_MAX_CHARS,
): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  return collapsed.length > maxChars ? collapsed.slice(0, maxChars) : collapsed
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export interface ComposeQuotedDraftCustomerReplyInput {
  /** Cached content of the quoted bot draft; undefined/empty ⇒ fail closed. */
  quotedBotContent?: string
}

export interface QuotedDraftCustomerReplyResult {
  /** true ⇒ cached content present, customer template returned; false ⇒ fallback. */
  ok: boolean
  /** The text to reply (template when ok, paste-the-draft fallback otherwise). */
  text: string
}

/**
 * Deterministic composer. Cached content present (after trim) ⇒ the fixed
 * customer template. Missing ⇒ the fail-closed paste-the-draft reply. It never
 * inspects or echoes the content beyond the presence check.
 */
export function composeQuotedDraftCustomerReply(
  input: ComposeQuotedDraftCustomerReplyInput,
): QuotedDraftCustomerReplyResult {
  const content = (input.quotedBotContent ?? '').trim()
  if (content === '') {
    return { ok: false, text: QUOTED_DRAFT_CONTENT_MISSING_REPLY }
  }
  return { ok: true, text: QUOTED_DRAFT_CUSTOMER_REPLY }
}

// ---------------------------------------------------------------------------
// Surfacing decision
// ---------------------------------------------------------------------------

export interface ShouldUseQuotedDraftCustomerReplyInput {
  sourceChannel: AgentSourceChannel
  /** mentionsBot OR quote-to-bot, resolved by the caller. */
  botDirected: boolean
  /** Whether the event is a quote (kind === 'group_quoted'). */
  isQuoteEvent: boolean
  text: string
}

/**
 * The surfacing decision for the customer-summary path. True ONLY for a
 * partner-group, bot-directed QUOTE event whose text explicitly asks to
 * summarise for a customer. A bare @-tag (no quote) never qualifies — there is
 * no quoted bot draft to carry — and the OA plane can never be bot-directed.
 */
export function shouldUseQuotedDraftCustomerReply(
  input: ShouldUseQuotedDraftCustomerReplyInput,
): boolean {
  return (
    input.sourceChannel === 'line_partner_group' &&
    input.botDirected === true &&
    input.isQuoteEvent === true &&
    detectSummarizeForCustomerIntent(input.text)
  )
}

// ---------------------------------------------------------------------------
// Responder seam
// ---------------------------------------------------------------------------

/**
 * A `PartnerGroupResponder` that emits the customer-summary template (or the
 * fail-closed fallback) from `input.quotedBotContent`. Deterministic — no model,
 * no I/O. The dispatcher routes here when `shouldUseQuotedDraftCustomerReply`
 * holds; the responder itself decides template vs fallback by content presence.
 */
export const quotedDraftCustomerResponder: PartnerGroupResponder = {
  async respond(
    input: PartnerGroupRespondInput,
  ): Promise<PartnerGroupRespondResult> {
    const quotedBotContent =
      typeof input.quotedBotContent === 'string' ? input.quotedBotContent : undefined
    const result = composeQuotedDraftCustomerReply({ quotedBotContent })
    if (result.ok) {
      return { text: result.text, meta: { responder: 'stub' } }
    }
    return {
      text: result.text,
      meta: { responder: 'stub', degraded: true, error: 'quoted_draft_content_missing' },
    }
  },
}
