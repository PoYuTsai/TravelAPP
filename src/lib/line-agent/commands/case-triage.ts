/**
 * Deterministic case triage helpers for operator-only inbox views.
 *
 * This is deliberately NOT an LLM summary. It extracts a small set of obvious
 * travel facts from recent OA customer messages so Eric/partners can quickly
 * see what is known and what still needs follow-up.
 */

import type { AgentCase } from '../cases/case-state'

export interface CaseTriageKnownFacts {
  travelDate?: string
  adults?: number
  children?: number
  /** Bare head-count（「2人」「4位」）— only set when no 大/小 split was given. */
  partySize?: number
  childAges?: number[]
  charterDays?: number
  interests?: string[]
  questions?: string[]
}

export interface CaseTriageSummary {
  summaryText: string
  knownFacts: CaseTriageKnownFacts
  missingFields: string[]
}

const INTEREST_KEYWORDS = [
  '大象',
  '夜間動物園',
  '茵他儂',
  '清萊',
  '南邦',
  '湄林',
  '湄康蓬',
  '黏黏瀑布',
  '泰服',
  '清邁古城',
  '藝術村',
]

export function buildCaseTriage(agentCase: AgentCase): CaseTriageSummary {
  const text = (agentCase.customerMessages ?? [])
    .map((message) => message.text)
    .filter(Boolean)
    .join('\n')

  const knownFacts = extractKnownFacts(text)
  const missingFields = deriveMissingFields(agentCase.missingFields, text, knownFacts)

  return {
    summaryText: buildSummaryText(knownFacts),
    knownFacts,
    missingFields,
  }
}

/**
 * Text-based extraction core — exported so the partner-group case-intake flow
 * (design 2026-06-10 §1) can triage a RAW requirement text without an AgentCase.
 */
export function extractKnownFacts(text: string): CaseTriageKnownFacts {
  const knownFacts: CaseTriageKnownFacts = {}

  const travelDate = chooseTravelDate(text)
  if (travelDate) knownFacts.travelDate = travelDate

  const partySplit = text.match(/(\d+)\s*大\s*(\d+)\s*小/)
  if (partySplit) {
    knownFacts.adults = Number(partySplit[1])
    knownFacts.children = Number(partySplit[2])
  } else {
    // 無大小拆分的裸人數（「2人」「4位」）。前面不可緊貼數字/區間符號
    // （「10-15人」不取），後面不可是「座」（「10人座」是車型容量不是人數）。
    const bareCount = text.match(/(?<![\d/.\-])(\d+)\s*(?:個人|个人|人|位)(?!座)/)
    if (bareCount) knownFacts.partySize = Number(bareCount[1])
  }

  const childAges = uniqueNumbers(
    Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(?:歲|岁|y|Y)/g)).map((match) =>
      Number(match[1])
    )
  )
  if (childAges.length > 0) knownFacts.childAges = childAges

  const charterDays = text.match(/包車\s*(\d+)\s*天/)
  if (charterDays) knownFacts.charterDays = Number(charterDays[1])

  const interests = INTEREST_KEYWORDS.filter((keyword) => text.includes(keyword))
  if (interests.length > 0) knownFacts.interests = interests

  const questions = extractQuestions(text)
  if (questions.length > 0) knownFacts.questions = questions

  return knownFacts
}

/** Exported for the same text-based reuse as extractKnownFacts. */
export function deriveMissingFields(
  existingMissingFields: string[],
  text: string,
  knownFacts: CaseTriageKnownFacts
): string[] {
  const missing = [...existingMissingFields]

  if (!knownFacts.travelDate) missing.push('travelDates')
  if (
    knownFacts.adults === undefined &&
    knownFacts.children === undefined &&
    knownFacts.partySize === undefined
  ) {
    missing.push('partySize')
  }
  if ((knownFacts.children ?? 0) > 0 && !knownFacts.childAges?.length) {
    missing.push('childAges')
  }
  if ((knownFacts.children ?? 0) > 0 && !hasExplicitChildSeatDecision(text)) {
    missing.push('childSeatNeeds')
  }
  if (!/(航班|班機|機場|机场|接機|接机|送機|送机|火車|火车|車站|车站)/i.test(text)) {
    missing.push('flightOrPickupInfo')
  }
  if (!hasHotelInfo(text)) {
    missing.push('hotelOrPickupLocation')
  }

  return uniqueStrings(missing)
}

/**
 * 「M/D」「M-D」「20xx-M-D」要像個真日期：月 1–12、日 1–31。
 * 「30-50」（時長/預算區間）月份不可能 → 不是日期。
 */
function isPlausibleMonthDay(value: string): boolean {
  const parts = value.split(/[/.-]/).map(Number)
  const [month, day] = parts.length === 3 ? [parts[1], parts[2]] : [parts[0], parts[1]]
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/** 後面緊跟著數量/時長單位的「M-D」是區間不是日期（「5-10分鐘」「3-5天」）。 */
const TRAILING_UNIT_PATTERN =
  /^\s*(?:分鐘|分钟|分|個?小時|个?小时|天|晚|公里|公尺|米|km|歲|岁|人|位|次|元|塊|块|銖|铢|百|千|萬|万)/i

function chooseTravelDate(text: string): string | undefined {
  const candidates = Array.from(text.matchAll(/\b(?:20\d{2}[/.-])?\d{1,2}[/.-]\d{1,2}\b/g))
    .filter((match) => {
      if (!isPlausibleMonthDay(match[0])) return false
      const after = text.slice((match.index ?? 0) + match[0].length)
      return !TRAILING_UNIT_PATTERN.test(after)
    })
    .map((match) => {
      const index = match.index ?? 0
      const context = text.slice(Math.max(0, index - 12), index + match[0].length + 12)
      let score = 0
      if (/(到清邁|到清迈|抵達|抵达|出發|出发|日期|旅遊|旅游|包車|包车)/.test(context)) {
        score += 3
      }
      if (/(測試|测试|webhook|正式站|smoke)/i.test(context)) {
        score -= 5
      }
      return { value: match[0], score, index }
    })

  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => b.score - a.score || b.index - a.index)
  return candidates[0].value
}

const HOTEL_KEYWORD_PATTERN = /(住宿|飯店|酒店|旅館|民宿|hotel)/i
const HOTEL_NEGATION_PATTERN =
  /(還沒|还没|尚未|未訂|未订|沒訂|没订|沒有訂|没有订|還在(找|看|選|选)|再決定|再决定|推薦|推荐|建議|建议)/

/**
 * 住宿地點「已知」必須有一個句子是肯定句式地給出住宿——只是提到「住宿」、
 * 問「住宿推薦嗎」、或說「還沒訂住宿」都不算（bug 3）。逐句判斷：任一句
 * 含住宿關鍵詞且既非問句也非未定/求推薦 → 已知。
 */
function hasHotelInfo(text: string): boolean {
  return text
    .split(/[\n。；;]/)
    .some(
      (segment) =>
        HOTEL_KEYWORD_PATTERN.test(segment) &&
        !/(嗎|吗|\?|？)/.test(segment) &&
        !HOTEL_NEGATION_PATTERN.test(segment)
    )
}

function hasExplicitChildSeatDecision(text: string): boolean {
  if (!/(兒童座椅|儿童座椅|安全座椅)/.test(text)) return false
  if (/(嗎|吗|\?|\？)/.test(text)) return false
  return /(需要|要|不用|不需要)/.test(text)
}

/** Exported for the same text-based reuse as extractKnownFacts. */
export function buildSummaryText(knownFacts: CaseTriageKnownFacts): string {
  const parts: string[] = []

  if (knownFacts.travelDate) parts.push(`日期：${knownFacts.travelDate}`)
  if (knownFacts.adults !== undefined || knownFacts.children !== undefined) {
    parts.push(`人數：${knownFacts.adults ?? '?'}大${knownFacts.children ?? '?'}小`)
  } else if (knownFacts.partySize !== undefined) {
    parts.push(`人數：${knownFacts.partySize}人`)
  }
  if (knownFacts.childAges?.length) {
    parts.push(`小孩年齡：${knownFacts.childAges.map((age) => `${age}歲`).join('、')}`)
  }
  if (knownFacts.charterDays) parts.push(`包車${knownFacts.charterDays}天`)
  if (knownFacts.interests?.length) parts.push(`想去：${knownFacts.interests.join('、')}`)
  if (knownFacts.questions?.length) {
    parts.push(`客人提問：${knownFacts.questions.join('；')}`)
  }

  return parts.length > 0 ? parts.join('；') : '尚未取得可整理的客需重點'
}

function extractQuestions(text: string): string[] {
  return uniqueStrings(
    text
      .split(/[\n。；;]/)
      .map((part) => part.trim())
      .filter((part) => /(嗎|吗|\?|\？)/.test(part))
      .slice(0, 3)
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))))
}
