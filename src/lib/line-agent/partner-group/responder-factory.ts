/**
 * responder-factory.ts — builds the partner-group responder from an already
 * parsed models object + an injected transport (design 2026-06-03 §3 / §3.2).
 *
 * The factory NEVER reads process.env — env parsing is owned by the narrow
 * selector (responder-config.ts).  Dispatch + degrade table:
 *
 *   mode unset / 'stub'                         → stubPartnerGroupResponder (identity)
 *   mode 'anthropic' + key + both model names   → AnthropicPartnerGroupResponder
 *   mode 'anthropic' + empty key                → degraded stub, error=missing_anthropic_api_key
 *   mode 'anthropic' + key but missing a model  → degraded stub, error=missing_partner_responder_model
 * (all degrade paths are loud + observable and NEVER throw)
 *
 * Degrading (not throwing) is deliberate: the partner-group reply is an
 * enhancement, not case persistence; a failure must not 500 the LINE webhook
 * and trigger a redelivery storm (design §6).
 */

import {
  stubPartnerGroupResponder,
  STUB_PARTNER_GROUP_REPLY,
  type PartnerGroupResponder,
} from './responder'
import { AnthropicPartnerGroupResponder } from './anthropic-responder'
import type { PartnerResponderConfig } from './responder-config'
import type { DailyCostCap } from '../observability/daily-cost-cap'
import {
  shouldUsePartnerRagDraft,
  isPartnerRagDraftEnabled,
  createRagPartnerGroupResponder,
  type PartnerRagDraftSource,
} from './rag-draft-surfacing'
import {
  shouldUseQuotedDraftCustomerReply,
  quotedDraftCustomerResponder,
} from './quoted-draft-customer-reply'
import {
  shouldUseCaseIntake,
  caseIntakeResponder,
} from './case-intake-surfacing'
import { shouldUseVisionIntake } from './vision-intake-surfacing'
import type { QaKnowledgeSource } from './qa-knowledge-source'

export interface CreatePartnerGroupResponderInput {
  /** Already-parsed model config (from getPartnerResponderConfig). */
  models: PartnerResponderConfig
  /** Injected fetch-shaped transport for the real adapter. */
  transport: typeof fetch
  /**
   * Daily LLM cost cap（P0-A 刀 2）— REQUIRED and built by the caller（the
   * factory still never reads env）. The stub paths ignore it; the real adapter
   * fails closed on anything but `ok`.
   */
  costCap: DailyCostCap
  /**
   * 沉澱 QA 知識源（檢索閉環刀）— optional：閘關時 caller 不接線，
   * adapter 行為與本刀落地前 byte-identical。
   */
  knowledgeSource?: QaKnowledgeSource
}

/**
 * A safe-default responder for the "mode=anthropic but key missing" case.
 * Returns the frozen stub text but tags meta with `degraded` + an error code so
 * the misconfiguration is traceable (NOT a silent failure).
 */
function createDegradedStubResponder(error: string): PartnerGroupResponder {
  return {
    async respond() {
      return {
        text: STUB_PARTNER_GROUP_REPLY,
        meta: { responder: 'stub', degraded: true, error },
      }
    },
  }
}

export function createPartnerGroupResponder(
  input: CreatePartnerGroupResponderInput
): PartnerGroupResponder {
  const { models, transport, costCap } = input

  if (models.partnerResponderMode !== 'anthropic') {
    return stubPartnerGroupResponder
  }

  if (!models.anthropicApiKey) {
    // Loud + observable (design §6.1) — non-minified so it can be traced.
    console.warn(
      '[partner-responder] AI_AGENT_PARTNER_RESPONDER_MODE=anthropic but ' +
        'ANTHROPIC_API_KEY is missing — degrading to safe stub.'
    )
    return createDegradedStubResponder('missing_anthropic_api_key')
  }

  // The adapter must never receive an empty model: an empty model string would
  // be POSTed to the Anthropic API, wasting billing on a guaranteed error
  // (design §3.2 — missing model name is a degrade trigger).
  if (!models.defaultModel || !models.researchModel) {
    console.warn(
      '[partner-responder] AI_AGENT_PARTNER_RESPONDER_MODE=anthropic but ' +
        'AI_AGENT_DEFAULT_MODEL / AI_AGENT_RESEARCH_MODEL is missing — degrading to safe stub.'
    )
    return createDegradedStubResponder('missing_partner_responder_model')
  }

  return new AnthropicPartnerGroupResponder({
    transport,
    apiKey: models.anthropicApiKey,
    defaultModel: models.defaultModel,
    researchModel: models.researchModel,
    costCap,
    knowledgeSource: input.knowledgeSource,
  })
}

// ---------------------------------------------------------------------------
// M3.2 — dispatching responder (per-message rag selection, gates default off)
// ---------------------------------------------------------------------------

export interface CreatePartnerGroupResponderWithRagDraftInput {
  /** The existing responder (stub / anthropic) used for every non-rag message. */
  base: PartnerGroupResponder
  /**
   * Injected rag draft producer (operator-safe body). This slice never reads
   * Notion directly — a real retrieval+composeAnswer source is a later slice.
   */
  answerSource: PartnerRagDraftSource
  /** Env record for the two gates (defaults to process.env). */
  env?: Record<string, string | undefined>
  /**
   * 客需三分流 responder（LLM 刀）— 注入＝webhook 端組好的 enriched
   * responder（createCaseIntakeResponder({ enrichment })）；省略＝
   * deterministic-only default。Surfacing 判斷（shouldUseCaseIntake）不變。
   */
  caseIntake?: PartnerGroupResponder
  /**
   * 讀圖 responder（圖片刀B）— 注入＝webhook 端組好的 vision responder
   * （createVisionIntakeResponder 蓋 content fetch + vision adapter + store）。
   * 省略 ⇒ 讀圖路徑不存在，dispatcher 行為與本刀落地前 byte-identical。
   */
  visionIntake?: PartnerGroupResponder
}

/**
 * Wraps `base` so that, PER MESSAGE, it routes to the rag responder ONLY when
 * `shouldUsePartnerRagDraft` holds (partner group + botDirected + explicit
 * intent + both gates on). Every other message — and every OA event — goes to
 * `base` and the rag `answerSource` is never invoked (no Notion read).
 *
 * The dispatcher only produces TEXT; whether it is sent stays owned by the
 * router `sendTarget` / webhook send gate. It does NOT touch the OA auto-reply
 * ban (OA simply never satisfies the rag predicate).
 */
export function createPartnerGroupResponderWithRagDraft(
  input: CreatePartnerGroupResponderWithRagDraftInput
): PartnerGroupResponder {
  const { base, answerSource, env } = input
  const ragResponder = createRagPartnerGroupResponder({ source: answerSource })
  const intakeResponder = input.caseIntake ?? caseIntakeResponder

  return {
    async respond(respondInput) {
      const botDirected =
        respondInput.botDirected ?? respondInput.event.mentionsBot === true

      // M3.6c — quote-to-bot "整理給客人" path. Checked BEFORE rag/base: when a
      // partner quotes a bot draft and asks to summarise it for a customer, this
      // deterministic, gate-free path owns the reply (template if the quoted bot
      // content is cached, else a fail-closed paste-the-draft fallback). It never
      // reads Notion and is unaffected by the rag gates; a bare tag (no quote) or
      // a rag-lookup intent never satisfies it, so the rag path is not regressed.
      if (
        shouldUseQuotedDraftCustomerReply({
          sourceChannel: respondInput.event.sourceChannel,
          botDirected,
          isQuoteEvent: respondInput.event.kind === 'group_quoted',
          text: respondInput.text,
        })
      ) {
        respondInput.log?.('route_decision', { path: 'quoted_draft' })
        return quotedDraftCustomerResponder.respond(respondInput)
      }

      // 讀圖（圖片刀B）— vision intake. Checked AFTER quoted_draft（quote-to-bot
      // 語意更明確 — 引用的是 bot 訊息就不可能是圖）、BEFORE case_intake：引用
      // 圖片＋tag 即觸發（無關鍵詞，2026-06-11 拍板），帶客需詞彙時讀圖更具體 —
      // 客需整理正是 vision 抽完文字後的下游。quotedImage 由 webhook 以 store
      // 的 image marker 判定後線進來。Surfacing 走 M3-0 ocr tool-gate
      // （AI_AGENT_OCR_ENABLED + AI_AGENT_TOOL_COST_CAP_USD 雙閘 default off）
      // ⇒ 不開閘完全不影響現行行為；responder 未注入時路徑不存在。
      if (
        input.visionIntake &&
        shouldUseVisionIntake({
          sourceChannel: respondInput.event.sourceChannel,
          botDirected,
          quotedImage: respondInput.quotedImage === true,
          env,
        })
      ) {
        return input.visionIntake.respond(respondInput)
      }

      // 客需三分流（design 2026-06-10 §1）— deterministic intake triage. Checked
      // AFTER quoted_draft（quote-to-bot 語意更明確）、BEFORE rag（intake 純函式
      // 零 I/O，且兩邊觸發詞彙刻意不重疊）. Gate default off ⇒ 完全不影響現行
      // 行為；responder 自己 log path + flow.
      if (
        shouldUseCaseIntake({
          sourceChannel: respondInput.event.sourceChannel,
          botDirected,
          text: respondInput.text,
          env,
        })
      ) {
        return intakeResponder.respond(respondInput)
      }

      const useRag = shouldUsePartnerRagDraft({
        sourceChannel: respondInput.event.sourceChannel,
        botDirected,
        text: respondInput.text,
        env,
      })
      // P0-A 刀 2 — M3.6b 觀察缺口（gate-off 靜默落回 base）在這裡補上：path +
      // gate STATE words only（enabled/disabled）— never an env var value.
      respondInput.log?.('route_decision', {
        path: useRag ? 'rag_composer' : 'base',
        ragDraftGate: isPartnerRagDraftEnabled(env) ? 'enabled' : 'disabled',
      })
      return useRag
        ? ragResponder.respond(respondInput)
        : base.respond(respondInput)
    },
  }
}
