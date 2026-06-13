/**
 * case-intake-surfacing.ts — 客需三分流 surfacing decision + responder
 * （design 2026-06-10 §1；pattern 照 rag-draft-surfacing 的 Option C）.
 *
 * This module owns the SURFACING DECISION + the deterministic intake responder.
 * It does NOT:
 *  - call an LLM / read Notion / touch the LINE client（三分流核心是純函式）,
 *  - decide whether the text is actually sent（router sendTarget owns that）,
 *  - touch the OA auto-reply ban（OA never satisfies the predicate）.
 *
 * Surfacing requires ALL of:
 *   sourceChannel === 'line_partner_group'
 *   && botDirected（mentionsBot OR quote-to-bot, resolved upstream）
 *   && detectCaseIntakeIntent(text)   // explicit token, pure string check
 *   && isCaseIntakeEnabled(env)       // env gate exactly "true", default OFF
 * Any missing precondition ⇒ the existing responder runs, intake never fires.
 *
 * LLM enrichment（問法潤飾／行程草稿 JSON → composer → lint → round-trip 閘）
 * layers ON TOP via `createCaseIntakeResponder({ enrichment })`：每次 respond
 * 先跑 deterministic triage，再（且僅在 `AI_AGENT_CASE_INTAKE_LLM_ENABLED`
 * gate 開、sources 有接時）嘗試 enrich；enrich 任何失敗都退回 deterministic
 * replyText — 閘關退 deterministic 缺項檢查，per design。
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import type { AgentSourceChannel } from '../types'
import { triageCaseIntake } from './case-intake-triage'
import {
  enrichCaseIntakeReply,
  type CaseIntakeEnrichmentSources,
} from './case-intake-enrichment'

// ---------------------------------------------------------------------------
// Fixed phrasing
// ---------------------------------------------------------------------------

/** Fail-closed reply when the triage core itself errors（should never happen —
 * it is pure regex — but a webhook reply path must never throw）. */
export const CASE_INTAKE_UNAVAILABLE_REPLY =
  '客需整理暫時不可用，請先人工整理，稍後再試或請 Eric 確認。'

/**
 * Explicit-intent lexicon. A bare tag is necessary but not sufficient — the
 * partner must deliberately ask for a 客需整理 before the intake flow fires.
 * Tokens deliberately do NOT overlap the rag lexicon（查內部案例／幫我草稿／
 * 參考過往／內部參考／RAG）so the two paths stay independently triggerable.
 */
const CASE_INTAKE_INTENT_TOKENS = ['客需', '客人需求', '整理需求', '需求整理'] as const

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** True iff `text` carries explicit intent to triage a customer requirement. */
export function detectCaseIntakeIntent(text: string): boolean {
  if (!text) return false
  return CASE_INTAKE_INTENT_TOKENS.some((token) => text.includes(token))
}

/**
 * Env gate — exactly the string "true"（matching the established
 * AI_AGENT_NOTION_RAG_ENABLED convention）. Default off: any missing /
 * non-"true" value ⇒ false.
 */
export function isCaseIntakeEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (env.AI_AGENT_CASE_INTAKE_ENABLED ?? '').trim() === 'true'
}

/**
 * LLM enrichment gate — 疊在 surfacing gate 之上的第二道閘（同 convention，
 * default off）。閘關 ⇒ responder 連 enrichment source 都不呼叫，行為與
 * deterministic 刀完全相同。
 */
export function isCaseIntakeLlmEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (env.AI_AGENT_CASE_INTAKE_LLM_ENABLED ?? '').trim() === 'true'
}

/**
 * refine 暖化子閘（疊在 LLM enrichment 之上的第三道閘，同 convention，
 * exactly "true"，default off）。閘關 ⇒ adapter factory 不組 refine sources，
 * enrichment 行為與 refine 落地前 byte-identical。
 */
export function isCaseIntakeRefineEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (env.AI_AGENT_CASE_INTAKE_REFINE_ENABLED ?? '').trim() === 'true'
}

export interface ShouldUseCaseIntakeInput {
  sourceChannel: AgentSourceChannel
  /** mentionsBot OR quote-to-bot, resolved by the caller（router botDirected）. */
  botDirected: boolean
  text: string
  env?: Record<string, string | undefined>
}

/**
 * The surfacing decision. Returns true ONLY when every precondition holds; the
 * caller must route to the existing responder otherwise.
 */
export function shouldUseCaseIntake(input: ShouldUseCaseIntakeInput): boolean {
  return (
    input.sourceChannel === 'line_partner_group' &&
    input.botDirected === true &&
    detectCaseIntakeIntent(input.text) &&
    isCaseIntakeEnabled(input.env)
  )
}

// ---------------------------------------------------------------------------
// Intake responder — deterministic, text-only
// ---------------------------------------------------------------------------

export interface CreateCaseIntakeResponderInput {
  /**
   * LLM enrichment sources（adapter 蓋 transport + cost cap）。Absent ⇒
   * deterministic-only（與 LLM 刀落地前行為 byte-identical）。
   */
  enrichment?: CaseIntakeEnrichmentSources
  /** Env record for the LLM gate（defaults to process.env, read PER respond）. */
  env?: Record<string, string | undefined>
}

/**
 * 三分流 responder factory. Only produces text; whether it is sent stays
 * owned by the router / webhook send gate. On any internal error it fails
 * closed with a fixed reply（degraded + error meta, NEVER a half-built draft）.
 *
 * Enrichment 失敗永遠不會讓 deterministic 回覆消失：enrichCaseIntakeReply
 * 本身 fail-closed；外層 try/catch 再兜一層（哪怕 enrichment 模組炸了，
 * deterministic triage 結果照樣回）。
 */
export function createCaseIntakeResponder(
  opts: CreateCaseIntakeResponderInput = {}
): PartnerGroupResponder {
  const { enrichment } = opts
  return {
    async respond(
      input: PartnerGroupRespondInput
    ): Promise<PartnerGroupRespondResult> {
      let triage: ReturnType<typeof triageCaseIntake>
      try {
        triage = triageCaseIntake(input.text)
      } catch {
        // Loud + observable; code-only so no raw content reaches the log.
        input.log?.('route_decision', {
          path: 'case_intake',
          reason: 'case_intake_triage_failed',
        })
        return {
          text: CASE_INTAKE_UNAVAILABLE_REPLY,
          meta: { responder: 'intake', degraded: true, error: 'case_intake_triage_failed' },
        }
      }

      // LLM enrichment — gate 每次 respond 重讀；閘關／無 sources ⇒ 純 deterministic。
      if (enrichment && isCaseIntakeLlmEnabled(opts.env)) {
        try {
          const enriched = await enrichCaseIntakeReply({
            triage,
            requirementText: input.text,
            sources: enrichment,
          })
          input.log?.('route_decision', {
            path: 'case_intake',
            flow: triage.flow,
            enrichment: enriched.enrichment,
            ...(enriched.degradedReason !== undefined
              ? { degradedReason: enriched.degradedReason }
              : {}),
          })
          return {
            text: enriched.replyText,
            meta: {
              responder: 'intake',
              confidence: triage.flow,
              enrichment: enriched.enrichment,
            },
          }
        } catch {
          // enrichCaseIntakeReply 設計上不 throw — 這層只是最後保險。
          input.log?.('route_decision', {
            path: 'case_intake',
            flow: triage.flow,
            enrichment: 'none',
            degradedReason: 'enrichment_crashed',
          })
          return {
            text: triage.replyText,
            meta: { responder: 'intake', confidence: triage.flow, enrichment: 'none' },
          }
        }
      }

      input.log?.('route_decision', { path: 'case_intake', flow: triage.flow })
      return {
        text: triage.replyText,
        meta: { responder: 'intake', confidence: triage.flow },
      }
    },
  }
}

/** Deterministic-only default（LLM 刀前的既有 export，行為不變）。 */
export const caseIntakeResponder: PartnerGroupResponder = createCaseIntakeResponder()
