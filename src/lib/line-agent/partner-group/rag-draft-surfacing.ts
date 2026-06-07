/**
 * rag-draft-surfacing.ts — M3.2 runtime seam for surfacing a RAG-assisted
 * partner-group draft (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md).
 *
 * This module owns the SURFACING DECISION + the rag responder seam. It does NOT:
 *  - read Notion / call an LLM / touch the LINE client (the `source` is injected),
 *  - decide whether the text is actually sent (router `sendTarget` owns that),
 *  - change the OA auto-reply ban (router B3) — OA simply never reaches the rag path.
 *
 * Surfacing requires ALL of (Option C, the minimal-safe option):
 *   sourceChannel === 'line_partner_group'
 *   && botDirected (mentionsBot OR quote-to-bot, resolved upstream)
 *   && detectPartnerRagIntent(text)         // explicit intent, pure string check
 *   && isPartnerRagDraftEnabled(env)        // BOTH env gates exactly "true"
 * Any missing precondition ⇒ existing responder runs, Notion is never read.
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import type { AgentSourceChannel } from '../types'

// ---------------------------------------------------------------------------
// Fixed phrasing
// ---------------------------------------------------------------------------

/**
 * The surfacing-time safety banner. Distinct from the composer's
 * `【夥伴群草稿】` body marker — this is the line that makes the message read as
 * an internal draft that must not be forwarded to a customer as-is.
 */
export const PARTNER_RAG_DRAFT_BANNER =
  '【夥伴內部草稿】這不是正式報價；未經 Eric／夥伴確認前請勿直接轉貼給客人。'

/** Fail-closed reply when the rag source errors/times out (design §5). */
export const PARTNER_RAG_UNAVAILABLE_REPLY =
  '目前內部案例查詢暫時不可用，稍後再試或請 Eric 確認。'

/**
 * Explicit-intent lexicon (design §2). A bare tag is necessary but not
 * sufficient — the partner must deliberately ask to consult internal cases /
 * produce a draft before any Notion read happens.
 */
const PARTNER_RAG_INTENT_TOKENS = [
  '查內部案例',
  '幫我草稿',
  '參考過往',
  '內部參考',
  'RAG',
] as const

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** True iff `text` carries explicit intent to consult internal cases / draft. */
export function detectPartnerRagIntent(text: string): boolean {
  if (!text) return false
  const upper = text.toUpperCase()
  return PARTNER_RAG_INTENT_TOKENS.some((token) =>
    token === 'RAG' ? upper.includes('RAG') : text.includes(token),
  )
}

/**
 * Two gates in series (defense in depth, design §3). BOTH must be exactly the
 * string "true" — matching the established `AI_AGENT_NOTION_RAG_ENABLED`
 * disabled-gate convention. Default off: any missing / non-"true" value ⇒ false.
 */
export function isPartnerRagDraftEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const notionRagEnabled = (env.AI_AGENT_NOTION_RAG_ENABLED ?? '').trim() === 'true'
  const partnerDraftEnabled =
    (env.AI_AGENT_PARTNER_RAG_DRAFT_ENABLED ?? '').trim() === 'true'
  return notionRagEnabled && partnerDraftEnabled
}

export interface ShouldUsePartnerRagDraftInput {
  sourceChannel: AgentSourceChannel
  /** mentionsBot OR quote-to-bot, resolved by the caller (router `botDirected`). */
  botDirected: boolean
  text: string
  env?: Record<string, string | undefined>
}

/**
 * The surfacing decision. Returns true ONLY when every precondition holds; the
 * caller must not read Notion or invoke the rag source otherwise.
 */
export function shouldUsePartnerRagDraft(input: ShouldUsePartnerRagDraftInput): boolean {
  return (
    input.sourceChannel === 'line_partner_group' &&
    input.botDirected === true &&
    detectPartnerRagIntent(input.text) &&
    isPartnerRagDraftEnabled(input.env)
  )
}

// ---------------------------------------------------------------------------
// Rag responder seam
// ---------------------------------------------------------------------------

/**
 * Injected draft producer. In the runtime slice this wraps operator-safe
 * retrieval + the existing `composeAnswer`; here it is injected so this seam has
 * no Notion/LLM dependency. Returns the draft BODY text (already operator-safe).
 */
export type PartnerRagDraftSource = (
  input: PartnerGroupRespondInput,
) => Promise<{ text: string }>

export interface CreateRagPartnerGroupResponderInput {
  source: PartnerRagDraftSource
}

/**
 * Builds a `PartnerGroupResponder` that prepends the surfacing banner to the
 * draft body. On any source error it fails closed (design §5): a fixed
 * unavailable reply, `degraded`+`error` meta, and NEVER a fabricated draft.
 */
export function createRagPartnerGroupResponder(
  input: CreateRagPartnerGroupResponderInput,
): PartnerGroupResponder {
  const { source } = input
  return {
    async respond(
      respondInput: PartnerGroupRespondInput,
    ): Promise<PartnerGroupRespondResult> {
      try {
        const draft = await source(respondInput)
        return {
          text: `${PARTNER_RAG_DRAFT_BANNER}\n${draft.text}`,
          meta: { responder: 'rag' },
        }
      } catch (error) {
        // Loud + observable (design §5) — non-minified so it can be traced.
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
          '[partner-rag-draft] internal case lookup failed — failing closed to ' +
            `unavailable reply (no RAG draft produced): ${message}`,
        )
        return {
          text: PARTNER_RAG_UNAVAILABLE_REPLY,
          meta: { responder: 'rag', degraded: true, error: 'partner_rag_source_failed' },
        }
      }
    },
  }
}
