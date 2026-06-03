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

function extractKnownFacts(text: string): CaseTriageKnownFacts {
  const knownFacts: CaseTriageKnownFacts = {}

  const travelDate = chooseTravelDate(text)
  if (travelDate) knownFacts.travelDate = travelDate

  const partySize = text.match(/(\d+)\s*大\s*(\d+)\s*小/)
  if (partySize) {
    knownFacts.adults = Number(partySize[1])
    knownFacts.children = Number(partySize[2])
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

function deriveMissingFields(
  existingMissingFields: string[],
  text: string,
  knownFacts: CaseTriageKnownFacts
): string[] {
  const missing = [...existingMissingFields]

  if (!knownFacts.travelDate) missing.push('travelDates')
  if (knownFacts.adults === undefined && knownFacts.children === undefined) {
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
  if (!/(住宿|飯店|酒店|旅館|民宿|hotel)/i.test(text)) {
    missing.push('hotelOrPickupLocation')
  }

  return uniqueStrings(missing)
}

function chooseTravelDate(text: string): string | undefined {
  const candidates = Array.from(text.matchAll(/\b(?:20\d{2}[/.-])?\d{1,2}[/.-]\d{1,2}\b/g))
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

function hasExplicitChildSeatDecision(text: string): boolean {
  if (!/(兒童座椅|儿童座椅|安全座椅)/.test(text)) return false
  if (/(嗎|吗|\?|\？)/.test(text)) return false
  return /(需要|要|不用|不需要)/.test(text)
}

function buildSummaryText(knownFacts: CaseTriageKnownFacts): string {
  const parts: string[] = []

  if (knownFacts.travelDate) parts.push(`日期：${knownFacts.travelDate}`)
  if (knownFacts.adults !== undefined || knownFacts.children !== undefined) {
    parts.push(`人數：${knownFacts.adults ?? '?'}大${knownFacts.children ?? '?'}小`)
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
