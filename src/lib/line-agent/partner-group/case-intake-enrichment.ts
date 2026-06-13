/**
 * case-intake-enrichment.ts — 客需三分流 LLM enrichment（design 2026-06-10 §1，
 * LLM 刀）。PURE orchestration + deterministic guards；唯一非純的是注入的兩個
 * source（adapter 蓋 transport / cost cap）。
 *
 * Threat model（同 customer-itinerary-refine）：LLM 是 UNTRUSTED candidate
 * producer。兩條 enrichment 路徑，各自被 deterministic guards 重新把關：
 *
 *   insufficient → 問法潤飾：LLM 回 JSON [{field, question}]。Guards：
 *     a. coverage — field 集合必須與缺項集合完全一致（不能漏問、不能多問）；
 *     b. format  — 每句單行、長度上限、必須以問號收尾；
 *     c. leak    — scanCustomerForbiddenTerms（內部詞彙永不外流）。
 *     通過 → 只替換模板裡的問句行（骨架仍 deterministic）。
 *
 *   sufficient → 行程草稿：LLM 回 JSON {constraints, requirements}。閘鏈：
 *     schema 驗證 → composeCustomerItineraryDraft（內含 lint fail-closed）→
 *     checkCustomerItineraryRoundTrip（真 parser round-trip，design 核心保證）→
 *     leak scan。任何一關不過 → 降級 deterministic sufficient 回覆，
 *     絕不輸出貼了會壞的文字。
 *
 *   tricky → 永不 enrich（needs-Eric 路徑保持零 LLM）。
 *
 * 任何 source error / 壞 JSON / guard fail 都 fail-closed 回 deterministic
 * replyText，並帶 fixed degradedReason code（觀測用，永不含內文）。
 */

import type { CaseIntakeTriageResult } from './case-intake-triage'
import {
  CASE_INTAKE_FIELD_QUESTIONS,
  orderCaseIntakeFields,
  renderInsufficientReply,
  ERIC_BOUNDARY_LINE,
} from './case-intake-triage'
import {
  composeCustomerItineraryDraft,
  type CustomerItineraryDayPlan,
  type CustomerItineraryRequirements,
} from '../notion/customer-itinerary-composer'
import type { CustomerItineraryConstraints } from '../notion/customer-itinerary-lint'
import {
  refineCustomerItineraryDraft,
  type RefineDraftSource,
} from '../notion/customer-itinerary-refine'
import { checkCustomerItineraryRoundTrip } from '../notion/customer-itinerary-roundtrip'
import { scanCustomerForbiddenTerms } from '../notion/customer-facing-forbidden-terms'
import { buildSummaryText } from '../commands/case-triage'

// ---------------------------------------------------------------------------
// Seams — the adapter fills these; tests inject fakes
// ---------------------------------------------------------------------------

export interface CaseIntakeQuestionRequest {
  /** 客人自己的需求原文（leak 邊界內：design §1 釐清過）。 */
  requirementText: string
  /** Deterministic known-facts summary（buildSummaryText 輸出）。 */
  summary: string
  /** 要求 LLM 覆蓋的缺項（已 order、只含有模板問句的欄位）。 */
  missingFields: string[]
}

export interface CaseIntakeDraftRequest {
  requirementText: string
  summary: string
}

/** 回 raw model text（期望是 JSON，但解析與驗證都在本模組做，零信任）。 */
export type CaseIntakeQuestionSource = (req: CaseIntakeQuestionRequest) => Promise<string>
export type CaseIntakeDraftSource = (req: CaseIntakeDraftRequest) => Promise<string>

export interface CaseIntakeEnrichmentSources {
  questionSource: CaseIntakeQuestionSource
  draftSource: CaseIntakeDraftSource
  /** 行程草稿暖化器（primary，cheap）。缺席 ⇒ 不 refine，byte-identical 現況。 */
  refineSource?: RefineDraftSource
  /** rescue（stronger），primary 被 guard 打回才試。 */
  rescueRefineSource?: RefineDraftSource
}

// ---------------------------------------------------------------------------
// Result contract
// ---------------------------------------------------------------------------

export type CaseIntakeEnrichmentKind = 'llm_questions' | 'llm_draft' | 'none'

export interface CaseIntakeEnrichmentResult {
  /** 最終回覆（enriched 或 deterministic fallback）。永不為空。 */
  replyText: string
  enrichment: CaseIntakeEnrichmentKind
  /**
   * enrichment === 'none' 且非 by-design（tricky／無缺項問句）時的 fixed code：
   * source_error · empty_output · invalid_json · coverage_mismatch ·
   * question_format · question_leak · schema_invalid · compose_lint_failed ·
   * roundtrip_failed · draft_leak
   */
  degradedReason?: string
}

// ---------------------------------------------------------------------------
// JSON extraction — code-fence tolerant, otherwise strict
// ---------------------------------------------------------------------------

/** 剝 code fence 後 JSON.parse；任何失敗回 undefined（呼叫端定 reason code）。 */
export function extractJsonValue(raw: string): unknown {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) text = fence[1].trim()
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Guard 1 — polished questions（coverage / format / leak）
// ---------------------------------------------------------------------------

const QUESTION_MAX_LENGTH = 120

type QuestionValidation =
  | { ok: true; lines: string[] }
  | { ok: false; reason: 'coverage_mismatch' | 'question_format' | 'question_leak' }

/**
 * 驗證 LLM 潤飾問句。期望形狀 [{field, question}]，field 集合必須與
 * `missingFields` 完全一致；輸出依 canonical 欄位順序 render（LLM 給的順序
 * 不被信任）。
 */
export function validatePolishedQuestions(
  value: unknown,
  missingFields: string[]
): QuestionValidation {
  if (!Array.isArray(value)) return { ok: false, reason: 'question_format' }

  const byField = new Map<string, string>()
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, reason: 'question_format' }
    }
    const field = (item as { field?: unknown }).field
    const question = (item as { question?: unknown }).question
    if (typeof field !== 'string' || typeof question !== 'string') {
      return { ok: false, reason: 'question_format' }
    }
    if (byField.has(field)) return { ok: false, reason: 'coverage_mismatch' }
    byField.set(field, question.trim())
  }

  const expected = new Set(missingFields)
  if (byField.size !== expected.size) return { ok: false, reason: 'coverage_mismatch' }
  for (const field of missingFields) {
    if (!byField.has(field)) return { ok: false, reason: 'coverage_mismatch' }
  }

  const lines: string[] = []
  for (const field of orderCaseIntakeFields(missingFields)) {
    const q = byField.get(field) as string
    if (q === '' || q.length > QUESTION_MAX_LENGTH || q.includes('\n')) {
      return { ok: false, reason: 'question_format' }
    }
    if (!/[？?]$/.test(q)) return { ok: false, reason: 'question_format' }
    if (scanCustomerForbiddenTerms(q).length > 0) {
      return { ok: false, reason: 'question_leak' }
    }
    lines.push(q)
  }
  return { ok: true, lines }
}

// ---------------------------------------------------------------------------
// Guard 2 — itinerary draft plan（schema → compose/lint → round-trip → leak）
// ---------------------------------------------------------------------------

type DraftPlanValidation =
  | {
      ok: true
      constraints: CustomerItineraryConstraints
      requirements: CustomerItineraryRequirements
    }
  | { ok: false; reason: 'schema_invalid' }

const SCHEMA_INVALID = { ok: false, reason: 'schema_invalid' } as const

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || isNonEmptyString(v)
}

function isOptionalStringArray(v: unknown): v is string[] | undefined {
  return v === undefined || (Array.isArray(v) && v.every(isNonEmptyString))
}

function validateDayPlan(value: unknown, expectedDay: number): CustomerItineraryDayPlan | null {
  if (typeof value !== 'object' || value === null) return null
  const d = value as Record<string, unknown>
  if (d.day !== expectedDay) return null
  if (!isNonEmptyString(d.dateLabel) || !isNonEmptyString(d.title)) return null
  if (!isOptionalString(d.departureTime)) return null
  if (!isOptionalStringArray(d.morningActivities)) return null
  if (!isOptionalStringArray(d.afternoonActivities)) return null
  if (!isOptionalString(d.lunch) || !isOptionalString(d.dinner) || !isOptionalString(d.lodging)) {
    return null
  }
  return {
    day: expectedDay,
    dateLabel: d.dateLabel,
    title: d.title,
    ...(d.departureTime !== undefined ? { departureTime: d.departureTime } : {}),
    ...(d.morningActivities !== undefined ? { morningActivities: d.morningActivities } : {}),
    ...(d.lunch !== undefined ? { lunch: d.lunch } : {}),
    ...(d.afternoonActivities !== undefined ? { afternoonActivities: d.afternoonActivities } : {}),
    ...(d.dinner !== undefined ? { dinner: d.dinner } : {}),
    ...(d.lodging !== undefined ? { lodging: d.lodging } : {}),
  }
}

/**
 * Schema 驗證 LLM 草稿 plan。只挑已知欄位重建（pick, never spread），所以
 * LLM 多給的任何 key 都到不了 composer；customerVersion 一律強制 true。
 * Day 編號必須 1..N 連續；constraints.days/nights 必須與 days[] 一致。
 */
export function validateDraftPlan(value: unknown): DraftPlanValidation {
  if (typeof value !== 'object' || value === null) return SCHEMA_INVALID
  const root = value as Record<string, unknown>
  const c = root.constraints
  const r = root.requirements
  if (typeof c !== 'object' || c === null) return SCHEMA_INVALID
  if (typeof r !== 'object' || r === null) return SCHEMA_INVALID

  const req = r as Record<string, unknown>
  if (
    !isNonEmptyString(req.title) ||
    !isNonEmptyString(req.headerTitle) ||
    !isNonEmptyString(req.dateRange) ||
    !isNonEmptyString(req.partyDescription) ||
    !Array.isArray(req.days) ||
    req.days.length === 0
  ) {
    return SCHEMA_INVALID
  }

  const days: CustomerItineraryDayPlan[] = []
  for (let i = 0; i < req.days.length; i++) {
    const day = validateDayPlan(req.days[i], i + 1)
    if (day === null) return SCHEMA_INVALID
    days.push(day)
  }

  const con = c as Record<string, unknown>
  if (con.days !== days.length) return SCHEMA_INVALID
  if (con.nights !== days.length - 1) return SCHEMA_INVALID
  if (!isNonEmptyString(con.stayArea)) return SCHEMA_INVALID
  if (typeof con.sameLodgingAllTrip !== 'boolean') return SCHEMA_INVALID
  if (!isOptionalString(con.departureDayTransferTime)) return SCHEMA_INVALID
  if (
    con.departureDayPeriod !== undefined &&
    con.departureDayPeriod !== 'morning' &&
    con.departureDayPeriod !== 'afternoon' &&
    con.departureDayPeriod !== 'evening'
  ) {
    return SCHEMA_INVALID
  }

  return {
    ok: true,
    constraints: {
      days: days.length,
      nights: days.length - 1,
      stayArea: con.stayArea,
      sameLodgingAllTrip: con.sameLodgingAllTrip,
      ...(con.departureDayTransferTime !== undefined
        ? { departureDayTransferTime: con.departureDayTransferTime }
        : {}),
      ...(con.departureDayPeriod !== undefined
        ? { departureDayPeriod: con.departureDayPeriod }
        : {}),
      customerVersion: true,
    },
    requirements: {
      title: req.title,
      headerTitle: req.headerTitle,
      dateRange: req.dateRange,
      partyDescription: req.partyDescription,
      days,
    },
  }
}

// ---------------------------------------------------------------------------
// Reply rendering（draft 版；insufficient 版復用 triage 的模板骨架）
// ---------------------------------------------------------------------------

function renderDraftReply(summary: string, draft: string): string {
  return [
    '【客需整理】關鍵資訊已齊，以下行程草稿已通過格式閘（真 parser round-trip）。',
    `已知：${summary}`,
    '--- 行程草稿（夥伴確認內容後可直接轉傳）---',
    draft,
    ERIC_BOUNDARY_LINE,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// enrichCaseIntakeReply — the orchestration
// ---------------------------------------------------------------------------

export interface EnrichCaseIntakeInput {
  triage: CaseIntakeTriageResult
  requirementText: string
  sources: CaseIntakeEnrichmentSources
}

function fallback(
  triage: CaseIntakeTriageResult,
  degradedReason?: string
): CaseIntakeEnrichmentResult {
  return {
    replyText: triage.replyText,
    enrichment: 'none',
    ...(degradedReason !== undefined ? { degradedReason } : {}),
  }
}

async function callSource<TReq>(
  source: (req: TReq) => Promise<string>,
  req: TReq
): Promise<{ raw: string } | { error: 'source_error' | 'empty_output' }> {
  let raw: string
  try {
    raw = await source(req)
  } catch {
    return { error: 'source_error' }
  }
  if (typeof raw !== 'string' || raw.trim() === '') return { error: 'empty_output' }
  return { raw }
}

/**
 * LLM enrichment 入口。永不 throw；任何失敗回 deterministic replyText +
 * fixed degradedReason。tricky flow 連 source 都不會被呼叫。
 */
export async function enrichCaseIntakeReply(
  input: EnrichCaseIntakeInput
): Promise<CaseIntakeEnrichmentResult> {
  const { triage, requirementText, sources } = input

  // tricky → needs-Eric 路徑保持零 LLM（by design，不算 degraded）。
  if (triage.flow === 'tricky') return fallback(triage)

  if (triage.flow === 'insufficient') {
    // 只請 LLM 潤飾「有模板問句」的欄位 — 與 deterministic 模板同一張表。
    const askable = orderCaseIntakeFields(
      triage.missingFields.filter((f) => CASE_INTAKE_FIELD_QUESTIONS[f] !== undefined)
    )
    if (askable.length === 0) return fallback(triage)

    const summary = summaryOf(triage)
    const res = await callSource(sources.questionSource, {
      requirementText,
      summary,
      missingFields: askable,
    })
    if ('error' in res) return fallback(triage, res.error)

    const json = extractJsonValue(res.raw)
    if (json === undefined) return fallback(triage, 'invalid_json')

    const validated = validatePolishedQuestions(json, askable)
    if (!validated.ok) return fallback(triage, validated.reason)

    return {
      replyText: renderInsufficientReply(summary, triage.missingFields, validated.lines),
      enrichment: 'llm_questions',
    }
  }

  // sufficient → 行程草稿閘鏈。
  const summary = summaryOf(triage)
  const res = await callSource(sources.draftSource, { requirementText, summary })
  if ('error' in res) return fallback(triage, res.error)

  const json = extractJsonValue(res.raw)
  if (json === undefined) return fallback(triage, 'invalid_json')

  const plan = validateDraftPlan(json)
  if (!plan.ok) return fallback(triage, plan.reason)

  const composed = composeCustomerItineraryDraft({
    constraints: plan.constraints,
    requirements: plan.requirements,
  })
  if (!composed.ok || composed.draft === null) {
    return fallback(triage, 'compose_lint_failed')
  }

  const roundTrip = checkCustomerItineraryRoundTrip(composed.draft, {
    days: plan.constraints.days,
  })
  if (!roundTrip.ok) return fallback(triage, 'roundtrip_failed')

  if (scanCustomerForbiddenTerms(composed.draft).length > 0) {
    return fallback(triage, 'draft_leak')
  }

  // 事實逐字鎖死下的 LLM 暖化（optional）。refineSource 缺席 ⇒ 不 refine，
  // byte-identical 現況。harness 本身 fail-closed：任何 guard 打回／source
  // throw／空輸出時 refined.draft === composed.draft，故失敗自動退 deterministic。
  let finalDraft = composed.draft
  if (sources.refineSource) {
    const refined = await refineCustomerItineraryDraft({
      deterministicDraft: composed.draft,
      constraints: plan.constraints,
      source: sources.refineSource,
      rescueSource: sources.rescueRefineSource,
    })
    finalDraft = refined.draft
  }

  return {
    replyText: renderDraftReply(summary, finalDraft),
    enrichment: 'llm_draft',
  }
}

/** 與 deterministic 模板同源的 summary — 從 triage.knownFacts 重算，不抽字串。 */
function summaryOf(triage: CaseIntakeTriageResult): string {
  return buildSummaryText(triage.knownFacts)
}
