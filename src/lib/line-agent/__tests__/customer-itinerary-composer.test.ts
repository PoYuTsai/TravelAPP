/**
 * customer-itinerary-composer.test.ts
 *
 * M3.3b — Deterministic customer itinerary draft composer (skeleton).
 *
 * Renders structured requirements into customer_itinerary_v1 text, then runs
 * the M3.3a lint as a quality gate. PURE, NO LLM, NO RAG live, NO CLI. Does NOT
 * touch LINE / Sanity / gate / live path.
 *
 * Contract pinned here:
 *   - golden-like structured input → ok, draft passes lintCustomerItinerary
 *   - any rule-violating input → fail-closed: ok=false, draft=null, issues报告
 *   - warns alone do NOT fail-closed (lint.ok stays true)
 *   - the李family golden case is the first regression benchmark
 */

import { describe, it, expect } from 'vitest'
import { composeCustomerItineraryDraft } from '../notion/customer-itinerary-composer'
import { lintCustomerItinerary } from '../notion/customer-itinerary-lint'
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS as REQ,
  LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS as C,
  requirementsWithFinalDayDinner,
  requirementsWithWrongLodging,
  requirementsWithIntenseActivity,
  requirementsWithRedundantFlight,
} from '../notion/__fixtures__/customer-itinerary-golden'

describe('composeCustomerItineraryDraft — golden benchmark', () => {
  it('1. 李family golden requirements → ok, draft is non-null', () => {
    const r = composeCustomerItineraryDraft(REQ)
    expect(r.ok).toBe(true)
    expect(r.draft).not.toBeNull()
  })

  it('2. produced draft passes the M3.3a lint with zero issues', () => {
    const r = composeCustomerItineraryDraft(REQ)
    const lint = lintCustomerItinerary(r.draft as string, C)
    expect(lint.issues).toEqual([])
    expect(lint.ok).toBe(true)
  })

  it('3. draft is customer_itinerary_v1 shaped: header + Day 1..7, no Day 8', () => {
    const draft = composeCustomerItineraryDraft(REQ).draft as string
    expect(draft).toContain('<李先生一家套餐訂製>')
    expect(draft).toContain('📅 日期：2025/08/04～2025/08/10')
    expect(draft).toContain('👨‍👩‍👧‍👦 人數：')
    const headings = draft.match(/^Day \d+｜/gm) ?? []
    expect(headings.length).toBe(7)
    expect(draft).not.toMatch(/^Day 8｜/m)
    expect(draft).toContain('午餐：')
    expect(draft).toContain('・住宿：')
  })

  it('4. final morning-transfer day renders no lunch/dinner/lodging', () => {
    const draft = composeCustomerItineraryDraft(REQ).draft as string
    const day7 = draft.slice(draft.indexOf('Day 7｜'))
    expect(day7).not.toContain('午餐：')
    expect(day7).not.toContain('晚餐：')
    expect(day7).not.toContain('住宿：')
    expect(day7).toContain('9:30 送機')
  })
})

describe('composeCustomerItineraryDraft — fail-closed on rule violations', () => {
  it('5. final-day dinner → fail-closed, draft null, issue final_day_dinner', () => {
    const r = composeCustomerItineraryDraft(requirementsWithFinalDayDinner())
    expect(r.ok).toBe(false)
    expect(r.draft).toBeNull()
    expect(r.issues.some((i) => i.code === 'final_day_dinner')).toBe(true)
  })

  it('6. wrong lodging city → fail-closed, draft null, issue lodging_area_inconsistent', () => {
    const r = composeCustomerItineraryDraft(requirementsWithWrongLodging())
    expect(r.ok).toBe(false)
    expect(r.draft).toBeNull()
    expect(r.issues.some((i) => i.code === 'lodging_area_inconsistent')).toBe(true)
  })

  it('7. intense activity (叢林飛索) in limited-mobility case → fail-closed', () => {
    const r = composeCustomerItineraryDraft(requirementsWithIntenseActivity('叢林飛索'))
    expect(r.ok).toBe(false)
    expect(r.draft).toBeNull()
    expect(r.issues.some((i) => i.code === 'mobility_unsuitable_activity')).toBe(true)
  })

  it('8. redundant flight prompt on Day 1 → fail-closed', () => {
    const r = composeCustomerItineraryDraft(requirementsWithRedundantFlight())
    expect(r.ok).toBe(false)
    expect(r.draft).toBeNull()
    expect(r.issues.some((i) => i.code === 'redundant_flight_confirm')).toBe(true)
  })

  it('9. fail-closed never hands back a usable-looking draft', () => {
    const r = composeCustomerItineraryDraft(requirementsWithWrongLodging())
    // draft is strictly null — not the rendered-but-broken text.
    expect(r.draft).toBeNull()
  })
})
