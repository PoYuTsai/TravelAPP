/**
 * parse-review.ts
 *
 * Task 9 — Itinerary + Quote Review Harness.
 *
 * WRAPS the existing parser functions — does NOT reimplement them.
 * All itinerary/quotation parsing is delegated to:
 *   @/lib/itinerary/parser  → parseItineraryText, parseBasicInfoText, parseQuotationText
 *
 * This module:
 *  1. Calls the real parsers.
 *  2. Maps their outputs into two structured review shapes.
 *  3. Surfaces harness-level warnings (family pacing, night-activity cutoffs)
 *     using rules from docs/ai-agent-knowledge/rules/.
 *
 * PARSER BUGS FOUND (report only — NOT fixed here per task constraint):
 *  - parseBasicInfoText does not recognise the "客戶姓名：" prefix, only
 *    "客戶：" / "客人：" / "姓名：". The fixture uses "客戶姓名：" and the
 *    pattern /^(客戶姓名|客戶|客人|姓名)[：:\s]/ DOES include "客戶姓名",
 *    so it actually works — no bug here.
 *  - parseItineraryText does not parse an inline basic-info header block at
 *    the top of a combined itinerary file; callers must split the header and
 *    body manually. We handle this by passing the full text to
 *    parseBasicInfoText (which ignores Day/bullet lines) and parseItineraryText
 *    separately.
 */

import {
  parseItineraryText,
  parseBasicInfoText,
  parseQuotationText,
} from '@/lib/itinerary/parser'
import type {
  ParseResult,
  ParsedBasicInfo,
  ParsedQuotation,
  ParsedQuotationItem,
  ParsedDay,
} from '@/lib/itinerary/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ItineraryDaySummary {
  dayNumber: number
  date: string
  title: string
  lunch?: string
  dinner?: string
  accommodation?: string
  activityCount: number
}

export interface ItineraryReview {
  /** Raw result from the real parseItineraryText call */
  parseResult: ParseResult
  /** Parsed basic info (client name, dates, people) */
  basicInfo: ParsedBasicInfo
  /** Per-day summaries mapped from ParseResult.days */
  days: ItineraryDaySummary[]
  /** Harness-level warnings (family pacing, night activities, missing fields) */
  reviewWarnings: string[]
}

export interface QuotationReview {
  /** Raw result from the real parseQuotationText call */
  parsedQuotation: ParsedQuotation
  /** Day-by-day vehicle fee items (have a date field) */
  dayVehicleItems: ParsedQuotationItem[]
  /** Guide fee item (contains 導遊) */
  guideFeeItem?: ParsedQuotationItem
  /** Insurance item (contains 保險) */
  insuranceItem?: ParsedQuotationItem
  /** Ticket items (contains 門票 / 票 / safari / elephant keywords) */
  ticketItems: ParsedQuotationItem[]
  /** Parsed included items from the text block */
  includedItems: string[]
  /** Parsed excluded items from the text block */
  excludedItems: string[]
  /** True if any amount uses `元` without a currency qualifier */
  currencyAmbiguous: boolean
}

// ---------------------------------------------------------------------------
// reviewItinerary
// ---------------------------------------------------------------------------

/**
 * Review an itinerary text by wrapping the real parser functions.
 * Extracts per-day summaries + surfaces pacing/safety warnings.
 */
export function reviewItinerary(text: string, year?: number): ItineraryReview {
  // Call the REAL parsers
  const parseResult = parseItineraryText(text, year)
  const basicInfo = parseBasicInfoText(text)

  // Map days to summaries
  const days: ItineraryDaySummary[] = parseResult.days.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    lunch: day.lunch,
    dinner: day.dinner,
    accommodation: day.accommodation,
    activityCount: day.activities.length,
  }))

  // Harness-level review warnings
  const reviewWarnings = generateItineraryWarnings(parseResult.days, basicInfo)

  return { parseResult, basicInfo, days, reviewWarnings }
}

// ---------------------------------------------------------------------------
// reviewQuotation
// ---------------------------------------------------------------------------

/**
 * Review a quotation text by wrapping the real parseQuotationText function.
 * Classifies items and parses included/excluded blocks.
 */
export function reviewQuotation(text: string, year?: number): QuotationReview {
  // Call the REAL parser
  const parsedQuotation = parseQuotationText(text, year)

  const items = parsedQuotation.items

  // Day vehicle items: have a date field
  const dayVehicleItems = items.filter(item => Boolean(item.date))

  // Guide fee: description contains 導遊
  const guideFeeItem = items.find(item =>
    item.description.includes('導遊')
  )

  // Insurance: description contains 保險
  const insuranceItem = items.find(item =>
    item.description.includes('保險')
  )

  // Ticket items: contains ticket-related keywords
  const TICKET_KEYWORDS = ['門票', '票券', 'safari', 'Safari', '大象', '夜間動物園', '流水樂園']
  const ticketItems = items.filter(item =>
    TICKET_KEYWORDS.some(kw => item.description.includes(kw))
  )

  // Parse included / excluded blocks from raw text
  const includedItems = parseListBlock(text, '包含')
  const excludedItems = parseListBlock(text, '不包含')

  // Currency ambiguity: raw text contains 元 without THB/泰銖/NT qualifier
  const currencyAmbiguous = detectCurrencyAmbiguity(text)

  return {
    parsedQuotation,
    dayVehicleItems,
    guideFeeItem,
    insuranceItem,
    ticketItems,
    includedItems,
    excludedItems,
    currencyAmbiguous,
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Parse a bullet-list block that follows a heading like "包含：" or "不包含：".
 * Returns the trimmed content of each bullet line.
 */
function parseListBlock(text: string, heading: string): string[] {
  const lines = text.split('\n')
  const result: string[] = []
  let inBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (inBlock) inBlock = false
      continue
    }

    // Detect heading line
    if (trimmed.startsWith(heading) && (trimmed.includes('：') || trimmed.includes(':'))) {
      inBlock = true
      continue
    }

    // A new heading-level line ends the block
    if (inBlock && /^[^・\-•·]/.test(trimmed) && !trimmed.match(/^[・\-•·]/)) {
      // Check if this looks like a new section header (not a bullet)
      if (trimmed.includes('：') || trimmed.includes(':')) {
        inBlock = false
        continue
      }
    }

    if (inBlock && /^[・\-•·]/.test(trimmed)) {
      result.push(trimmed.replace(/^[・\-•·]\s*/, ''))
    }
  }

  return result
}

/**
 * Detect currency ambiguity: text contains `元` not preceded by 泰銖/THB/NT$/NTD/TWD.
 * Per quote-included-excluded.md: flag `元` without a qualifier.
 */
function detectCurrencyAmbiguity(text: string): boolean {
  // Check for 元 that is NOT qualified as 泰銖 or NTD
  const lines = text.split('\n')
  for (const line of lines) {
    if (/\d+\s*元/.test(line)) {
      // If the line also contains 泰銖, THB, NT$, NTD, TWD it's OK
      const qualified = /泰銖|THB|NT\$|NTD|TWD/.test(line)
      if (!qualified) return true
    }
  }
  return false
}

/**
 * Generate pacing/safety warnings from parsed days + basic info.
 * Sources: docs/ai-agent-knowledge/rules/family-pacing.md
 */
function generateItineraryWarnings(days: ParsedDay[], basicInfo: ParsedBasicInfo): string[] {
  const warnings: string[] = []

  const hasToddler = detectToddler(basicInfo)

  for (const day of days) {
    const allText = [
      day.title,
      day.morning,
      day.afternoon,
      day.evening,
      ...day.activities.map(a => a.content),
    ].join(' ')

    const hasNightSafari =
      allText.includes('夜間動物園') ||
      allText.toLowerCase().includes('night safari')

    const hasWaterPark =
      allText.includes('流水樂園') ||
      allText.toLowerCase().includes('water park') ||
      allText.toLowerCase().includes('waterpark')

    // Family pacing rule: Night Safari + toddler/infant → warn
    if (hasNightSafari && hasToddler) {
      warnings.push(
        `Day ${day.dayNumber}：有 3 歲以下小孩時，夜間動物園（Night Safari）通常到 22:00，` +
        `建議與家長確認是否安排。`
      )
    }

    // Water park + Night Safari same day → HIGH RISK for children under 7
    if (hasWaterPark && hasNightSafari) {
      warnings.push(
        `Day ${day.dayNumber}：流水樂園 + 夜間動物園同天，7 歲以下小孩體力風險高，` +
        `需與家長確認。`
      )
    }

    // More than 5 stops in a day
    if (day.activities.length > 5) {
      warnings.push(
        `Day ${day.dayNumber}：活動數量 ${day.activities.length} 個，超過建議上限（5），` +
        `建議精簡行程。`
      )
    }
  }

  // Missing child ages warning
  if (basicInfo.children && basicInfo.children > 0 && !basicInfo.childrenAges) {
    // Check if any day has risky activities
    const allDayText = days.map(d => [d.title, d.morning, d.afternoon, d.evening].join(' ')).join(' ')
    if (
      allDayText.includes('大象') ||
      allDayText.includes('流水樂園') ||
      allDayText.includes('夜間動物園')
    ) {
      warnings.push(
        '行程含大象/水樂園/夜間動物園，但基本資訊未填小孩年齡，建議先確認。'
      )
    }
  }

  return warnings
}

/**
 * Detect if the group has a toddler/infant (age < 6).
 * We check childrenAges string for numbers ≤ 5.
 */
function detectToddler(basicInfo: ParsedBasicInfo): boolean {
  if (!basicInfo.childrenAges) return false
  const ages = basicInfo.childrenAges.match(/\d+/g)
  if (!ages) return false
  return ages.some(a => parseInt(a, 10) <= 5)
}
