import { describe, expect, it } from 'vitest'
import {
  ITINERARY_TEMPLATE_SKELETON,
  GOLDEN_CHIANGMAI_FAMILY_5D4N,
  GOLDEN_NORTHERN_DEEP_6D5N,
} from '../notion/itinerary-reference-template'
import { sanitizeItinerarySnippet } from '../notion/itinerary-reference-sanitizer'

// 開閘前必修 I-1 / M-3 的 drift-guard：fallback 範本常數與真案例共用同一 sanitizer
// assert，且必須維持「無航班碼 / 無 markdown 強調 / 無敬稱」。違反任一即紅，
// 防未來編輯讓 fallback 在真群上線後靜默劣化（per-task review 看不到 template 路徑）。
describe('ITINERARY_TEMPLATE_SKELETON (排行程 fallback 骨架)', () => {
  it('passes the same sanitizeItinerarySnippet assert as a real case (never fail-closed)', () => {
    const r = sanitizeItinerarySnippet(ITINERARY_TEMPLATE_SKELETON)
    expect(r.ok).toBe(true)
    expect(r.skeleton?.length ?? 0).toBeGreaterThan(0)
  })

  it('carries no concrete flight code (would contradict 不臆造航班 / be dropped on the case path)', () => {
    expect(ITINERARY_TEMPLATE_SKELETON).not.toMatch(/[A-Z]{2}\s?\d{2,4}/)
    expect(ITINERARY_TEMPLATE_SKELETON).not.toMatch(/華航|長榮|泰航|虎航|亞航/)
  })

  it('carries no markdown emphasis/heading that would trip the customer_itinerary_v1 gate', () => {
    expect(ITINERARY_TEMPLATE_SKELETON).not.toMatch(/\*\*/)
    expect(ITINERARY_TEMPLATE_SKELETON).not.toMatch(/^#/m)
  })

  it('carries no honorific surname (M-3: fallback would silently vanish if a 敬稱 is added)', () => {
    expect(ITINERARY_TEMPLATE_SKELETON).not.toMatch(/先生|小姐|太太|一家/)
  })

  it('keeps the day-by-day activity skeleton (sequential Day headers + meals + lodging)', () => {
    expect(ITINERARY_TEMPLATE_SKELETON).toMatch(/^Day 1｜/m)
    expect(ITINERARY_TEMPLATE_SKELETON).toMatch(/^Day 5｜/m)
    expect(ITINERARY_TEMPLATE_SKELETON).toMatch(/午餐：/)
    expect(ITINERARY_TEMPLATE_SKELETON).toMatch(/晚餐：/)
    expect(ITINERARY_TEMPLATE_SKELETON).toMatch(/・住宿：/)
  })
})

describe('golden itinerary skeletons', () => {
  it('清邁親子 5D4N 有 Day 1..Day 5 連續標題', () => {
    for (let d = 1; d <= 5; d++) {
      expect(GOLDEN_CHIANGMAI_FAMILY_5D4N).toContain(`Day ${d}｜`)
    }
    expect(GOLDEN_CHIANGMAI_FAMILY_5D4N).not.toContain('Day 6｜')
  })

  it('泰北深度 6D5N 有 Day 1..Day 6 連續標題', () => {
    for (let d = 1; d <= 6; d++) {
      expect(GOLDEN_NORTHERN_DEEP_6D5N).toContain(`Day ${d}｜`)
    }
    expect(GOLDEN_NORTHERN_DEEP_6D5N).not.toContain('Day 7｜')
  })

  it('兩套都標 header 占位（日期/人數）讓 LLM 套', () => {
    for (const g of [GOLDEN_CHIANGMAI_FAMILY_5D4N, GOLDEN_NORTHERN_DEEP_6D5N]) {
      expect(g).toMatch(/日期/)
      expect(g).toMatch(/人數/)
    }
  })
})
