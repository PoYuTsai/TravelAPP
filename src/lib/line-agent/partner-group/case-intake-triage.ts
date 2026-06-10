/**
 * case-intake-triage.ts — 客需三分流 deterministic core（design 2026-06-10 §1）.
 *
 * Partner pastes a customer requirement（@bot in the partner group）→ classify:
 *   - tricky       → needs-Eric markers（medical/safety, refund/legal, price
 *                    pressure）— precedence over everything; never promise.
 *   - insufficient → a CRITICAL field is missing → list what's missing + a
 *                    forwardable question block the partner can paste to the
 *                    customer as-is.
 *   - sufficient   → all critical fields present → known-facts summary（the
 *                    itinerary DRAFT generation is a later, gated LLM slice）.
 *
 * HARD BOUNDARIES（mirror responder.ts）:
 *   - PURE: text in → structured result out. No LLM, no I/O, no env read.
 *   - The reply only restates THIS customer's own requirement + fixed
 *     templates — it never cites other cases or internal prices（leak 邊界,
 *     design §1）.
 *   - Gate-closed degrade path（design: 閘關退 deterministic 缺項檢查）IS this
 *     module — the LLM slice layers on top, it never replaces it.
 */

import {
  extractKnownFacts,
  deriveMissingFields,
  buildSummaryText,
  type CaseTriageKnownFacts,
} from '../commands/case-triage'

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export type CaseIntakeFlow = 'insufficient' | 'sufficient' | 'tricky'

export interface CaseIntakeTriageResult {
  flow: CaseIntakeFlow
  knownFacts: CaseTriageKnownFacts
  /** Field keys（case-triage vocabulary）still missing from the text. */
  missingFields: string[]
  /** Human-readable needs-Eric reasons — non-empty iff flow === 'tricky'. */
  trickyReasons: string[]
  /** The deterministic partner-group reply for this flow. */
  replyText: string
}

/**
 * The fields that BLOCK the sufficient flow（design 北極星: 日期／人數／小孩
 * 年齡／航班／住宿地點）. childSeatNeeds stays advisory: it is asked in the
 * question block when relevant but never blocks sufficiency.
 */
export const CASE_INTAKE_CRITICAL_FIELDS = [
  'travelDates',
  'partySize',
  'childAges',
  'flightOrPickupInfo',
  'hotelOrPickupLocation',
] as const

// ---------------------------------------------------------------------------
// Needs-Eric（tricky）markers — keyword categories, deterministic
// ---------------------------------------------------------------------------

interface TrickyCategory {
  label: string
  pattern: RegExp
}

/**
 * Conservative first batch（同 handlers.ts ESCALATION_PATTERN 的精神，分類別
 * 給出可讀原因）. 寬鬆誤標的代價只是多請 Eric 看一眼 — fail-safe 方向正確.
 */
const TRICKY_CATEGORIES: TrickyCategory[] = [
  {
    label: '醫療／安全',
    pattern:
      /過敏|过敏|生病|發燒|发烧|受傷|受伤|急診|急诊|醫院|医院|住院|懷孕|怀孕|骨折|身障|輪椅租借/,
  },
  {
    label: '退費／取消／糾紛',
    pattern: /退款|退費|退费|賠償|赔偿|取消行程|取消預訂|投訴|投诉|客訴|客诉/,
  },
  {
    label: '比價／折扣壓力',
    pattern:
      /比價|比价|別家|别家|其他家|更便宜|便宜|折扣|降價|降价|殺價|杀价|優惠|kkday|klook/i,
  },
]

function detectTrickyReasons(text: string): string[] {
  const reasons: string[] = []
  for (const { label, pattern } of TRICKY_CATEGORIES) {
    const match = text.match(pattern)
    if (match) reasons.push(`${label}（${match[0]}）`)
  }
  return reasons
}

// ---------------------------------------------------------------------------
// Field labels + forwardable questions（fixed templates, deterministic）
// ---------------------------------------------------------------------------

/** Exported：enrichment（LLM 問法潤飾）的 coverage guard 要對照同一張表。 */
export const CASE_INTAKE_FIELD_LABELS: Record<string, string> = {
  travelDates: '日期',
  partySize: '人數',
  childAges: '小孩年齡',
  childSeatNeeds: '兒童座椅',
  flightOrPickupInfo: '航班／接送資訊',
  hotelOrPickupLocation: '住宿地點',
}
const FIELD_LABELS = CASE_INTAKE_FIELD_LABELS

/** Exported：deterministic 基準問法，也是 LLM 潤飾 prompt 的素材。 */
export const CASE_INTAKE_FIELD_QUESTIONS: Record<string, string> = {
  travelDates: '請問預計的出發與回程日期是？（還沒確定的話，大概的月份也可以）',
  partySize: '請問同行人數？大人幾位、小孩幾位？',
  childAges: '請問小孩的年齡分別是幾歲？（方便安排行程節奏與座椅）',
  childSeatNeeds: '請問需要兒童安全座椅嗎？',
  flightOrPickupInfo: '請問航班資訊（航空公司、航班號與抵達時間）方便提供嗎？',
  hotelOrPickupLocation: '請問住宿地點（飯店名稱或區域）確定了嗎？',
}
const FIELD_QUESTIONS = CASE_INTAKE_FIELD_QUESTIONS

/** Stable question order = template order above. */
const FIELD_ORDER = Object.keys(FIELD_QUESTIONS)

/** Exported：enrichment 用同一順序 render 潤飾後問句，順序永遠 deterministic。 */
export function orderCaseIntakeFields(fields: string[]): string[] {
  return orderFields(fields)
}

function orderFields(fields: string[]): string[] {
  return [...fields].sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b))
}

// ---------------------------------------------------------------------------
// Reply rendering — one fixed template per flow
// ---------------------------------------------------------------------------

/** Exported：每一種 case-intake 回覆（含 enrichment 草稿）都必須以這行收尾。 */
export const ERIC_BOUNDARY_LINE = '正式報價、特殊承諾或例外狀況仍需 Eric 最終確認。'

function renderQuestionBlock(missing: string[]): string {
  const known = missing.filter((f) => FIELD_QUESTIONS[f] !== undefined)
  const lines = known.map((f, i) => `${i + 1}. ${FIELD_QUESTIONS[f]}`)
  return lines.join('\n')
}

/**
 * Insufficient 回覆 renderer。`questionLines` 注入＝LLM 潤飾後的問句（enrichment
 * 已通過 coverage / leak guard）；省略＝deterministic 模板。模板骨架（標題行、
 * 已知行、boundary line）兩種情況都固定 — LLM 永遠只能換問句，不能換骨架。
 */
export function renderInsufficientReply(
  summary: string,
  missing: string[],
  questionLines?: string[]
): string {
  const labeled = missing
    .filter((f) => FIELD_LABELS[f] !== undefined)
    .map((f) => FIELD_LABELS[f])
  const questionBlock = questionLines
    ? questionLines.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : renderQuestionBlock(missing)
  return [
    `【客需整理】目前資訊還不足，缺少：${labeled.join('、')}`,
    `已知：${summary}`,
    '建議可以這樣問客人（以下可直接轉傳）：',
    questionBlock,
    ERIC_BOUNDARY_LINE,
  ].join('\n')
}

function renderSufficientReply(summary: string): string {
  return [
    '【客需整理】關鍵資訊已齊。',
    summary,
    `夥伴可先依此整理行程方向；${ERIC_BOUNDARY_LINE}`,
  ].join('\n')
}

function renderTrickyReply(
  summary: string,
  reasons: string[],
  missing: string[]
): string {
  const lines = [
    `【客需整理】這個需求有需要 Eric 先確認的事項：${reasons.join('；')}`,
    '請先不要直接對客人承諾或報價。',
    `已知：${summary}`,
  ]
  const labeled = missing
    .filter((f) => FIELD_LABELS[f] !== undefined)
    .map((f) => FIELD_LABELS[f])
  if (labeled.length > 0) lines.push(`另外還缺：${labeled.join('、')}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// triageCaseIntake — the deterministic 三分流 entry point
// ---------------------------------------------------------------------------

export function triageCaseIntake(text: string): CaseIntakeTriageResult {
  const knownFacts = extractKnownFacts(text)
  // Raw requirement text has no prior case state → existing missing list is [].
  const missingFields = deriveMissingFields([], text, knownFacts)
  const summary = buildSummaryText(knownFacts)
  const trickyReasons = detectTrickyReasons(text)

  const orderedMissing = orderFields(missingFields)
  const criticalMissing = orderedMissing.filter((f) =>
    (CASE_INTAKE_CRITICAL_FIELDS as readonly string[]).includes(f)
  )

  if (trickyReasons.length > 0) {
    return {
      flow: 'tricky',
      knownFacts,
      missingFields: orderedMissing,
      trickyReasons,
      replyText: renderTrickyReply(summary, trickyReasons, orderedMissing),
    }
  }

  if (criticalMissing.length > 0) {
    return {
      flow: 'insufficient',
      knownFacts,
      missingFields: orderedMissing,
      trickyReasons: [],
      replyText: renderInsufficientReply(summary, orderedMissing),
    }
  }

  return {
    flow: 'sufficient',
    knownFacts,
    missingFields: orderedMissing,
    trickyReasons: [],
    replyText: renderSufficientReply(summary),
  }
}
