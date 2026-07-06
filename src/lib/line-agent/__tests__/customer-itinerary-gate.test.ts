import { describe, it, expect } from 'vitest'
import { gateCustomerItineraryDraft } from '../notion/customer-itinerary-gate'
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY,
  withIntenseActivity,
} from '../notion/__fixtures__/customer-itinerary-golden'

describe('gateCustomerItineraryDraft', () => {
  it('golden 李家 7D6N → ok', () => {
    const r = gateCustomerItineraryDraft(LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
  })

  it('自由 markdown 散文 → fail（推不出 Day 或 parser 不乾淨）', () => {
    const prose = '幫你排個 5 天行程：\n第一天去古城逛逛，第二天上山看大象，很棒喔！'
    const r = gateCustomerItineraryDraft(prose)
    expect(r.ok).toBe(false)
    expect(r.problems.length).toBeGreaterThan(0)
  })

  it('缺一天（Day 3 不見）→ fail', () => {
    const broken = LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(/Day 3｜[^\n]*/, '')
    const r = gateCustomerItineraryDraft(broken)
    expect(r.ok).toBe(false)
  })

  // ── Task 5：本案 profile 餵 per-case lint 規則 ──────────────────────────────
  it('帶 limited mobility profile ＋草稿含叢林飛索 → fail（per-case 規則生效）', () => {
    const draft = withIntenseActivity('叢林飛索')
    const r = gateCustomerItineraryDraft(draft, {
      mobility: { type: 'limited_mobility_wheelchair_assisted' },
      stayArea: 'chiangmai_old_city',
      sameLodgingAllTrip: true,
    })
    expect(r.ok).toBe(false)
    expect(r.problems.some((p) => p.includes('叢林飛索'))).toBe(true)
  })

  it('無 profile ＋同一份含叢林飛索草稿 → ok（缺省中性，per-case 規則不觸發）', () => {
    // PRIME DIRECTIVE：無 profile 時行為與現行 byte-identical（mobility 規則不開）。
    const draft = withIntenseActivity('叢林飛索')
    const r = gateCustomerItineraryDraft(draft)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
  })

  it('無 profile ＋ golden 結構合法草稿 → ok（缺省中性回歸）', () => {
    const r = gateCustomerItineraryDraft(LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
  })
})
