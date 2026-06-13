/**
 * case-intake-llm-adapter.ts — 客需三分流 enrichment 的真 Anthropic adapter
 * （design 2026-06-10 §1 LLM 刀）。
 *
 * 角色分工（mirror llm-refine-adapter ↔ customer-itinerary-refine）：
 *   - 本模組只負責「把 request 變成 prompt、把 prompt 變成 raw model text」；
 *     JSON 解析與所有 guards 都在 case-intake-enrichment.ts（純函式、零信任）。
 *   - transport 注入（fetch-shaped，同 anthropic-responder）— 不 import SDK，
 *     測試注入 fake，webhook/CLI 注入真 fetch。
 *   - COST CAP（P0-A 刀 2 紀律）：每次呼叫前 checkBudget，非 `ok` 一律不打、
 *     throw fixed-code error（enrichment 端收斂成 source_error 降級）；呼叫後
 *     recordSpend，記帳失敗永不丟掉已付費的回覆。
 *
 * Prompt 安全邊界：進 prompt 的只有「該客人自己的需求原文＋deterministic
 * summary＋缺項模板問句」— 不含 Notion 案例、內部價、operator notes（design §1
 * leak 邊界）。錯誤一律 fixed code，永不帶 key / prompt / 回應內文。
 */

import type {
  CaseIntakeQuestionRequest,
  CaseIntakeDraftRequest,
  CaseIntakeEnrichmentSources,
} from './case-intake-enrichment'
import { CASE_INTAKE_FIELD_QUESTIONS, CASE_INTAKE_FIELD_LABELS } from './case-intake-triage'
import { type DailyCostCap } from '../observability/daily-cost-cap'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'
import { callAnthropicMessages } from '../observability/anthropic-call'

/** 問句潤飾輸出小；草稿 JSON（7 天行程）要寬一點。 */
const QUESTION_MAX_TOKENS = 1024
const DRAFT_MAX_TOKENS = 2048

// ---------------------------------------------------------------------------
// Model resolution（mirror resolveRefineModel：explicit > env > default）
// ---------------------------------------------------------------------------

export const CASE_INTAKE_LLM_MODEL_DEFAULT = 'claude-haiku-4-5'

export function resolveCaseIntakeLlmModel(opts?: {
  model?: string
  env?: Record<string, string | undefined>
}): string {
  const explicit = opts?.model?.trim()
  if (explicit) return explicit
  const fromEnv = opts?.env?.AI_AGENT_CASE_INTAKE_LLM_MODEL?.trim()
  if (fromEnv) return fromEnv
  return CASE_INTAKE_LLM_MODEL_DEFAULT
}

// ---------------------------------------------------------------------------
// Prompt builders（pure, exported for tests）
// ---------------------------------------------------------------------------

export interface CaseIntakePrompt {
  system: string
  user: string
}

const QUESTION_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的客服助手。夥伴要轉問客人一些缺少的關鍵資訊。',
  '下面提供：客人需求原文、已知資訊摘要、缺項清單（每項附基準問法）。',
  '把每一項的問法潤飾得更自然貼心，可參考客人原文的語境，但：',
  '- 每一個缺項都必須各有一句，不能合併、不能遺漏、不能多問清單外的事',
  '- 每句單行、80 字以內、以問號收尾',
  '- 不得提到價格、折扣、其他客人案例，不得做任何承諾',
  '只回 JSON 陣列，格式：[{"field":"<欄位代碼>","question":"<問句>"}]。',
  '不要任何前綴、後綴、說明或 code fence。',
].join('\n')

export function buildQuestionPolishPrompt(req: CaseIntakeQuestionRequest): CaseIntakePrompt {
  const fieldLines = req.missingFields.map((f) => {
    const label = CASE_INTAKE_FIELD_LABELS[f] ?? f
    const baseline = CASE_INTAKE_FIELD_QUESTIONS[f] ?? ''
    return `- ${f}（${label}）基準問法：${baseline}`
  })
  const user = [
    '【客人需求原文】',
    req.requirementText,
    '',
    `【已知摘要】${req.summary}`,
    '',
    '【缺項清單】',
    ...fieldLines,
  ].join('\n')
  return { system: QUESTION_SYSTEM_INSTRUCTION, user }
}

const DRAFT_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的行程規劃助手。根據客人需求原文與已知摘要，產出一份行程草稿的結構化 JSON。',
  '只回一個 JSON 物件，格式：',
  '{"constraints":{"days":N,"nights":N-1,"stayArea":"<區域代碼，清邁古城用 chiangmai_old_city>","sameLodgingAllTrip":true|false,"departureDayPeriod":"morning"|"afternoon"|"evening"},',
  ' "requirements":{"title":"<客人稱呼，例：王先生一家>","headerTitle":"<行程標題>","dateRange":"YYYY/MM/DD～YYYY/MM/DD","partyDescription":"<例：4大2小（小孩5歲、8歲）>",',
  '  "days":[{"day":1,"dateLabel":"M/D (週X)","title":"<當日主題>","departureTime":"H:MM","morningActivities":["…"],"lunch":"…","afternoonActivities":["…"],"dinner":"…","lodging":"…"}]}}',
  '硬規則：',
  '- day 必須從 1 連續編到最後一天；constraints.days 必須等於 days 長度',
  '- dateRange 的起迄日必須與第一天、最後一天的 dateLabel 日期一致',
  '- 最後一天若是早上送機：不得有 lunch / dinner / lodging，departureDayPeriod 用 "morning"',
  '- 只能使用客人自己提到的資訊與公開景點知識；不得提到價格、其他客人案例',
  '- 不要任何前綴、後綴、說明或 code fence',
].join('\n')

export function buildItineraryDraftPrompt(req: CaseIntakeDraftRequest): CaseIntakePrompt {
  const user = ['【客人需求原文】', req.requirementText, '', `【已知摘要】${req.summary}`].join('\n')
  return { system: DRAFT_SYSTEM_INSTRUCTION, user }
}

// ---------------------------------------------------------------------------
// Sources factory — transport + cost cap；錯誤一律 fixed code
// ---------------------------------------------------------------------------

export interface AnthropicCaseIntakeSourcesDeps {
  /** fetch-shaped transport（tests 注入 fake；prod 注入 fetch）。 */
  transport: typeof fetch
  apiKey: string
  /** REQUIRED — 忘了接 cap 永遠不能等於無上限燒錢。 */
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AgentLogger
}

/** Fixed-code、secret-free 的 adapter 錯誤（enrichment 收斂成 source_error）。 */
export class CaseIntakeLlmError extends Error {
  constructor(code: string) {
    super(`case-intake llm call failed: ${code}`)
    this.name = 'CaseIntakeLlmError'
  }
}

export function createAnthropicCaseIntakeSources(
  deps: AnthropicCaseIntakeSourcesDeps
): CaseIntakeEnrichmentSources {
  const model = resolveCaseIntakeLlmModel({ model: deps.model, env: deps.env })
  const log = deps.log ?? createAgentLogger({ requestId: '-' })

  async function callModel(prompt: CaseIntakePrompt, maxTokens: number): Promise<string> {
    // transport / cost cap / parse / record 全在共用 callAnthropicMessages；
    // case-intake 既有行為不檢查截斷（truncation='ignore'），fixed code 映射成
    // CaseIntakeLlmError（enrichment 端收斂成 source_error）。
    const { text } = await callAnthropicMessages(
      {
        model,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        maxTokens,
        fallbackInputTokens: Math.ceil((prompt.system.length + prompt.user.length) / 4),
        truncation: 'ignore',
      },
      {
        transport: deps.transport,
        apiKey: deps.apiKey,
        costCap: deps.costCap,
        log,
        makeError: (code) => new CaseIntakeLlmError(code),
      },
    )
    return text
  }

  return {
    questionSource: (req) => callModel(buildQuestionPolishPrompt(req), QUESTION_MAX_TOKENS),
    draftSource: (req) => callModel(buildItineraryDraftPrompt(req), DRAFT_MAX_TOKENS),
  }
}
