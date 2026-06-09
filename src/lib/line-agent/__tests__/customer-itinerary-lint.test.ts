/**
 * customer-itinerary-lint.test.ts
 *
 * M3.3a — Customer itinerary lint layer (pure, deterministic, NO LLM).
 *
 * Pins the lint CONTRACT against Eric's real hand-adjusted golden case
 * (李先生一家 7D6N, limited-mobility / wheelchair-assisted, all-trip 古城 lodging).
 * The golden must PASS; each bad-case mutation must be caught. No generator, no
 * LINE live path, no Sanity, no Notion API — validator + fixture + tests only.
 *
 * Rule map (Eric 2026-06-09):
 *   1.  golden → ok, no error issues
 *   2-4. morning-transfer final day → no 午餐 / 晚餐 / 住宿
 *   5.  sameLodgingAllTrip → every 住宿 in stayArea (no 清萊/尼曼)
 *   6-7. no duplicate 午餐 / 晚餐 in one day
 *   8-9. limited mobility → no 飛索 / 帕丘峽谷 / 黏黏瀑布
 *   10. 天使瀑布 not tagged high-risk/replaceable (it's a cafe/photo stop)
 *   11. 夜間動物園 present → must note 遊園車 / 減少步行 (warn)
 *   12. knownFlight known → Day 1 must not still say 需確認航班 (error)
 *   13. day headings must be the consecutive set 1..days
 *   14. non-final full day missing a meal label (warn)
 *   15. customer version leaking internal-only notes (warn)
 */

import { describe, it, expect } from 'vitest'
import {
  lintCustomerItinerary,
  type ItineraryLintIssue,
} from '../notion/customer-itinerary-lint'
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS as C,
  LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY as GOLDEN,
  withDuplicateLunch,
  withDuplicateDinner,
  withFinalDayLunch,
  withFinalDayDinner,
  withFinalDayLodging,
  withWrongLodgingArea,
  withIntenseActivity,
  withMiscategorizedTianshi,
  withNightSafariNoTram,
  withUnknownFlightPrompt,
  withMissingDayHeading,
  withMissingMealLabel,
  withInternalNotes,
} from '../notion/__fixtures__/customer-itinerary-golden'

function codes(issues: ItineraryLintIssue[]): string[] {
  return issues.map((i) => i.code)
}
function has(issues: ItineraryLintIssue[], code: string): boolean {
  return issues.some((i) => i.code === code)
}

describe('lintCustomerItinerary — golden PASS', () => {
  it('1. Eric golden 李先生一家 7D6N passes with no error issues', () => {
    const r = lintCustomerItinerary(GOLDEN, C)
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('1b. golden is fully clean (no warns either)', () => {
    const r = lintCustomerItinerary(GOLDEN, C)
    expect(r.issues).toEqual([])
  })

  it('13b. golden produces exactly Day 1..7, no Day 8/9', () => {
    const r = lintCustomerItinerary(GOLDEN, C)
    expect(has(r.issues, 'missing_day_heading')).toBe(false)
    expect(has(r.issues, 'unexpected_day_heading')).toBe(false)
  })
})

describe('lintCustomerItinerary — final day (morning transfer) lint', () => {
  it('2. final day with 午餐 → error final_day_lunch', () => {
    const r = lintCustomerItinerary(withFinalDayLunch(), C)
    expect(has(r.issues, 'final_day_lunch')).toBe(true)
    expect(r.ok).toBe(false)
  })

  it('3. final day with 晚餐 → error final_day_dinner', () => {
    const r = lintCustomerItinerary(withFinalDayDinner(), C)
    expect(has(r.issues, 'final_day_dinner')).toBe(true)
    expect(r.ok).toBe(false)
  })

  it('4. final day with 住宿 → error final_day_lodging', () => {
    const r = lintCustomerItinerary(withFinalDayLodging(), C)
    expect(has(r.issues, 'final_day_lodging')).toBe(true)
    expect(r.ok).toBe(false)
  })
})

describe('lintCustomerItinerary — lodging consistency', () => {
  it('5. same-lodging trip with a 清萊 night → error lodging_area_inconsistent', () => {
    const r = lintCustomerItinerary(withWrongLodgingArea(), C)
    expect(has(r.issues, 'lodging_area_inconsistent')).toBe(true)
    expect(r.ok).toBe(false)
  })
})

describe('lintCustomerItinerary — duplicate meals', () => {
  it('6. two 午餐 in one day → error duplicate_lunch', () => {
    const r = lintCustomerItinerary(withDuplicateLunch(), C)
    expect(has(r.issues, 'duplicate_lunch')).toBe(true)
    expect(r.ok).toBe(false)
  })

  it('7. two 晚餐 in one day → error duplicate_dinner', () => {
    const r = lintCustomerItinerary(withDuplicateDinner(), C)
    expect(has(r.issues, 'duplicate_dinner')).toBe(true)
    expect(r.ok).toBe(false)
  })
})

describe('lintCustomerItinerary — limited-mobility unsuitable activities', () => {
  it('8. 叢林飛索 in limited-mobility case → error mobility_unsuitable_activity', () => {
    const r = lintCustomerItinerary(withIntenseActivity('叢林飛索'), C)
    expect(has(r.issues, 'mobility_unsuitable_activity')).toBe(true)
    expect(r.ok).toBe(false)
  })

  it('9a. 帕丘峽谷 in limited-mobility case → error mobility_unsuitable_activity', () => {
    const r = lintCustomerItinerary(withIntenseActivity('帕丘峽谷'), C)
    expect(has(r.issues, 'mobility_unsuitable_activity')).toBe(true)
  })

  it('9b. 黏黏瀑布 in limited-mobility case → error mobility_unsuitable_activity', () => {
    const r = lintCustomerItinerary(withIntenseActivity('黏黏瀑布'), C)
    expect(has(r.issues, 'mobility_unsuitable_activity')).toBe(true)
  })
})

describe('lintCustomerItinerary — 天使瀑布 domain correction', () => {
  it('10. 天使瀑布 tagged high-risk/replaceable → error tianshi_waterfall_miscategorized', () => {
    const r = lintCustomerItinerary(withMiscategorizedTianshi(), C)
    expect(has(r.issues, 'tianshi_waterfall_miscategorized')).toBe(true)
    expect(r.ok).toBe(false)
  })
})

describe('lintCustomerItinerary — night safari mitigation note', () => {
  it('11. 夜間動物園 without 遊園車/減少步行 → warn night_safari_missing_tram_note', () => {
    const r = lintCustomerItinerary(withNightSafariNoTram(), C)
    const issue = r.issues.find((i) => i.code === 'night_safari_missing_tram_note')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('warn')
    // warn does not flip ok
    expect(r.ok).toBe(true)
  })
})

describe('lintCustomerItinerary — redundant flight confirmation', () => {
  it('12. known flight yet Day 1 says 需確認航班 → error redundant_flight_confirm', () => {
    const r = lintCustomerItinerary(withUnknownFlightPrompt(), C)
    expect(has(r.issues, 'redundant_flight_confirm')).toBe(true)
    expect(r.ok).toBe(false)
  })
})

describe('lintCustomerItinerary — day headings', () => {
  it('13. dropped Day heading breaks 1..days → error missing_day_heading', () => {
    const r = lintCustomerItinerary(withMissingDayHeading(), C)
    expect(has(r.issues, 'missing_day_heading')).toBe(true)
    expect(r.ok).toBe(false)
  })
})

describe('lintCustomerItinerary — meal label completeness', () => {
  it('14. non-final full day missing a meal label → warn missing_meal_label', () => {
    const r = lintCustomerItinerary(withMissingMealLabel(), C)
    const issue = r.issues.find((i) => i.code === 'missing_meal_label')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('warn')
  })
})

describe('lintCustomerItinerary — internal notes in customer version', () => {
  it('15. cost/profit notes in customer version → warn internal_notes_in_customer_version', () => {
    const r = lintCustomerItinerary(withInternalNotes(), C)
    const issue = r.issues.find(
      (i) => i.code === 'internal_notes_in_customer_version'
    )
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('warn')
  })

  it('15b. each issue carries a day number when day-scoped', () => {
    const r = lintCustomerItinerary(withDuplicateLunch(), C)
    const dup = r.issues.find((i) => i.code === 'duplicate_lunch')
    expect(dup?.day).toBe(3)
  })
})
