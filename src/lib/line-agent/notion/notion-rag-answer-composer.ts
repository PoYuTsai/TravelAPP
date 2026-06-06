/**
 * notion-rag-answer-composer.ts
 *
 * M3.1 — RAG-assisted answer composer. PURE & DETERMINISTIC.
 *
 * Turns an already-operator-safe `NotionRagSearchResult` into a concise,
 * Eric-style **partner-group draft** that an operator reviews and (later,
 * separately) sends. This slice locks the answer CONTRACT only:
 *
 *   - No LLM. A `refineHook` seam exists but is NEVER invoked here (refine
 *     defaults off and is typed `false`).
 *   - No CLI, no LINE live path, no partner-group send, no OA auto-reply.
 *   - No Sanity write, no formal quote, no Notion API, no scheduler/cache.
 *
 * Safety is inherited structurally: the input is a whitelist projection
 * (`OperatorSafeCaseSummary`, `itinerarySnippetPreview: never`), so customer
 * name / cost / revenue / profit / Notion url / db id cannot enter. The
 * composer's only privacy duty is to NOT fabricate such strings itself — it
 * cites only safe structured facts (area / theme / days / partySize /
 * vehicleType) and frames everything as "internal tendency" vs "needs
 * confirmation", never price or availability.
 */

import type { NotionRagSearchResult } from './notion-rag-search'

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface TransportationAssessmentInput {
  partySize?: number
  adults?: number
  children?: number
  /** vehicleType values pulled from retrieved cases — direction signal only. */
  vehicleTypeFromCases?: string[]
  luggageCount?: number
  airportTransfer?: boolean
  childSeatSignal?: boolean
}

export interface TransportationAssessment {
  /** A vehicle DIRECTION, never a commitment. Absent when data is insufficient. */
  vehicleHint?: string
  mustConfirm: string[]
  safetyNotes: string[]
}

export interface ComposeAnswerOptions {
  /** LLM refine hook. Out of scope this slice — typed `false`, never enabled. */
  refine?: false
  /**
   * Injectable refine seam for tests/future wiring. The composer NEVER calls it
   * while `refine` is off (the default), so partner drafts stay deterministic.
   */
  refineHook?: (draft: string) => string
}

export interface ComposeAnswerInput {
  userQuestion: string
  search: NotionRagSearchResult
  transportation?: TransportationAssessmentInput
  options?: ComposeAnswerOptions
}

export interface ComposedAnswer {
  /** The partner-group draft text. */
  text: string
  confidence: 'high' | 'medium' | 'low'
  usedInternalReferences: boolean
  mustConfirm: string[]
  safetyNotes?: string[]
}

// ---------------------------------------------------------------------------
// Fixed phrasing (the only allowed framing)
// ---------------------------------------------------------------------------

const DRAFT_MARKER = '【夥伴群草稿】'
const INTERNAL_TENDENCY = '內部過往案例傾向'
const NO_STRONG_REFERENCE = '目前沒有強內部參考案例，建議先確認以下項目再評估'

/** Base confirmation items every draft must surface (contract 6). */
const BASE_MUST_CONFIRM = [
  '出發日期',
  '人數',
  '小孩年齡/身高',
  '航班',
  '住宿/上車地點',
] as const

const BIG_VAN_DIRECTION = '建議往 Toyota Commuter 10 人座 Van 或多車配置方向評估'

// ---------------------------------------------------------------------------
// transportationAssessment — party / luggage / airport → direction (never promise)
// ---------------------------------------------------------------------------

/**
 * Party size is only a STARTING POINT; real dispatch also depends on luggage,
 * vehicle count, guide, and the actual arrangement. So this returns a direction
 * plus what still needs confirming — never a final vehicle/count/price, and
 * never treats `partySize > 1` as a family.
 */
export function transportationAssessment(
  input: TransportationAssessmentInput
): TransportationAssessment {
  const mustConfirm: string[] = []
  const safetyNotes: string[] = []
  const hints: string[] = []

  const fromCases = input.vehicleTypeFromCases?.filter(Boolean) ?? []
  if (fromCases.length > 0) {
    hints.push(`內部相似案例多以 ${fromCases.join('、')} 方向評估，實際派車仍以現場安排為準`)
  }

  const partySize = input.partySize
  if (partySize !== undefined && partySize >= 6) {
    hints.push(BIG_VAN_DIRECTION)
    mustConfirm.push('行李件數與尺寸', '是否需要兒童座椅', '是否需要導遊', '上車地點/住宿')
  }

  if (input.airportTransfer && (input.luggageCount ?? 0) >= 6) {
    mustConfirm.push('行李件數與尺寸')
    safetyNotes.push('行李較多，可能需要安排行李車或第二台車')
  }

  // Insufficient data → only ask to confirm headcount & luggage first (rule 7).
  if (hints.length === 0 && partySize === undefined) {
    mustConfirm.push('需再確認人數與行李後評估車型')
  }

  return {
    vehicleHint: hints.length > 0 ? hints.join('；') : undefined,
    mustConfirm: dedupe(mustConfirm),
    safetyNotes,
  }
}

// ---------------------------------------------------------------------------
// composeAnswer
// ---------------------------------------------------------------------------

export function composeAnswer(input: ComposeAnswerInput): ComposedAnswer {
  const { userQuestion: _userQuestion, search, transportation } = input

  const usedInternalReferences =
    search.status === 'ok' && search.results.length > 0
  const confidence = resolveConfidence(search, usedInternalReferences)

  const mustConfirm: string[] = [...BASE_MUST_CONFIRM]
  const safetyNotes: string[] = []
  let vehicleHint: string | undefined

  if (transportation) {
    const ta = transportationAssessment(transportation)
    vehicleHint = ta.vehicleHint
    mustConfirm.push(...ta.mustConfirm)
    safetyNotes.push(...ta.safetyNotes)
  }

  const dedupedMustConfirm = dedupe(mustConfirm)

  const lines: string[] = [DRAFT_MARKER]
  if (usedInternalReferences) {
    lines.push(`${INTERNAL_TENDENCY}：${summarizeSafeFacts(search)}`)
    lines.push('可以先往這個方向抓，實際仍需逐項確認後再評估。')
  } else {
    lines.push(NO_STRONG_REFERENCE)
  }
  if (vehicleHint) {
    lines.push(`車型方向：${vehicleHint}（方向評估，未承諾車型/台數/價格）`)
  }
  lines.push(`需要再確認：${dedupedMustConfirm.join('、')}`)
  if (safetyNotes.length > 0) {
    lines.push(`提醒：${safetyNotes.join('；')}`)
  }

  // refineHook is intentionally NOT called: refine is off this slice.

  return {
    text: lines.join('\n'),
    confidence,
    usedInternalReferences,
    mustConfirm: dedupedMustConfirm,
    safetyNotes: safetyNotes.length > 0 ? safetyNotes : undefined,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveConfidence(
  search: NotionRagSearchResult,
  used: boolean
): ComposedAnswer['confidence'] {
  if (!used) return 'low'
  const hasStrongSignal =
    search.parsedQuery.areas.length > 0 || search.parsedQuery.themes.length > 0
  return hasStrongSignal ? 'high' : 'medium'
}

/** Cite only safe structured facts from the top 1–3 summaries. */
function summarizeSafeFacts(search: NotionRagSearchResult): string {
  const seg: string[] = []
  const { areas, themes } = search.parsedQuery
  if (areas.length > 0) seg.push(`區域 ${areas.join('、')}`)
  if (themes.length > 0) seg.push(`主題 ${themes.join('、')}`)

  const top = search.results[0]
  if (top) {
    if (top.days !== undefined) seg.push(`約 ${top.days} 天`)
    if (top.partySize !== undefined) seg.push(`約 ${top.partySize} 人`)
    if (top.vehicleType !== undefined) seg.push(`曾用車型參考 ${top.vehicleType}`)
  }

  return seg.length > 0 ? seg.join('、') : '相似結構案例'
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items))
}
