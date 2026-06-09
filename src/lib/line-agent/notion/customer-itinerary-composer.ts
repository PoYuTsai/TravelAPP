/**
 * customer-itinerary-composer.ts
 *
 * M3.3b — Deterministic customer itinerary draft composer (skeleton). PURE, NO
 * LLM, NO RAG live, NO CLI. Does NOT touch LINE / Sanity / gate / live path.
 *
 * Pipeline: structured requirements → render customer_itinerary_v1 text →
 * lint (M3.3a) as a QUALITY GATE → fail-closed on any error issue.
 *
 *   - This v1 renders FAITHFULLY from the structured plan; it does not silently
 *     "fix" bad input. The composer's value-add is format rendering + lint
 *     enforcement, so a rule-violating plan surfaces as a fail-closed result
 *     (draft = null) instead of a usable-looking-but-broken itinerary.
 *   - `ok` mirrors `lint.ok` (true iff no error issues). Warn-only drafts still
 *     return the draft — warns advise, they don't fail-closed.
 *   - The李family golden case is the first regression benchmark: its structured
 *     requirements must render to a draft that passes lint with zero issues.
 *
 * Future (M3.3c+): retrieval-case-driven suggestion, auto-suppression of
 * final-day meals, LLM refine — all behind this same lint gate.
 */

import {
  lintCustomerItinerary,
  type CustomerItineraryConstraints,
  type ItineraryLintIssue,
} from './customer-itinerary-lint'

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface CustomerItineraryDayPlan {
  day: number
  /** e.g. '8/4 (二)' — printed above the Day heading. */
  dateLabel: string
  title: string
  /** e.g. '9:00' → renders '9:00 出發'. Omit for an arrival/departure day. */
  departureTime?: string
  morningActivities?: string[]
  lunch?: string
  afternoonActivities?: string[]
  dinner?: string
  /** Lodging name, e.g. '清邁古城民宿' → renders '・住宿：清邁古城民宿'. */
  lodging?: string
}

export interface CustomerItineraryRequirements {
  /** Package owner, e.g. '李先生一家' → renders '<李先生一家套餐訂製>'. */
  title: string
  headerTitle: string
  dateRange: string
  /** Free text after '👨‍👩‍👧‍👦 人數：'. */
  partyDescription: string
  days: CustomerItineraryDayPlan[]
}

export interface ComposeCustomerItineraryInput {
  constraints: CustomerItineraryConstraints
  requirements: CustomerItineraryRequirements
  /** Reserved: retrieval cases as a future direction signal. Unused in v1. */
  retrievalCases?: unknown[]
}

export interface ComposeCustomerItineraryResult {
  /** true iff the rendered draft passed lint with no error issues. */
  ok: boolean
  /** The customer_itinerary_v1 draft when ok; strictly null when fail-closed. */
  draft: string | null
  /** Lint issues found (errors when fail-closed; warns are advisory). */
  issues: ItineraryLintIssue[]
}

// ---------------------------------------------------------------------------
// Rendering — structured plan → customer_itinerary_v1 text
// ---------------------------------------------------------------------------

function renderDay(day: CustomerItineraryDayPlan): string[] {
  const lines: string[] = [day.dateLabel, `Day ${day.day}｜${day.title}`]
  if (day.departureTime) lines.push(`${day.departureTime} 出發`)
  for (const a of day.morningActivities ?? []) lines.push(`・${a}`)
  if (day.lunch) lines.push(`午餐：${day.lunch}`)
  for (const a of day.afternoonActivities ?? []) lines.push(`・${a}`)
  if (day.dinner) lines.push(`晚餐：${day.dinner}`)
  if (day.lodging) lines.push(`・住宿：${day.lodging}`)
  return lines
}

export function renderCustomerItinerary(req: CustomerItineraryRequirements): string {
  const lines: string[] = [
    `<${req.title}套餐訂製> ${req.headerTitle}`,
    `📅 日期：${req.dateRange}`,
    `👨‍👩‍👧‍👦 人數：${req.partyDescription}`,
  ]
  req.days.forEach((day, i) => {
    if (i > 0) lines.push('') // blank separator between days
    lines.push(...renderDay(day))
  })
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// composeCustomerItineraryDraft — render → lint gate → fail-closed
// ---------------------------------------------------------------------------

export function composeCustomerItineraryDraft(
  input: ComposeCustomerItineraryInput
): ComposeCustomerItineraryResult {
  const text = renderCustomerItinerary(input.requirements)
  const lint = lintCustomerItinerary(text, input.constraints)

  if (!lint.ok) {
    // Fail-closed: never hand back a usable-looking draft that breaks a rule.
    return { ok: false, draft: null, issues: lint.issues }
  }

  return { ok: true, draft: text, issues: lint.issues }
}
