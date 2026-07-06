/**
 * customer-change-operator-preview.test.ts
 *
 * M3.3e — operator preview polish. The preview must let Eric judge fast: the
 * original request, why it was declined, the alternative candidates, whether an
 * alternative was applied into the draft, and the source case. PURE, internal-
 * only output (no Notion live / LLM / LINE / gate).
 */

import { describe, it, expect } from 'vitest'
import { composeCustomerChange } from '../notion/customer-itinerary-change-composer'
import { buildOperatorRetrievalPreview } from '../notion/customer-change-operator-preview'
import { LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS as REQ } from '../notion/__fixtures__/customer-itinerary-golden'

function clone() {
  return JSON.parse(JSON.stringify(REQ))
}

const SAFE_ALT = '蘭花園景觀步道'

describe('buildOperatorRetrievalPreview — fast-judgement fields', () => {
  it('1. substituted → shows request, decline reason, applied=yes, source case', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'adventure' }] },
      retrievalCases: [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: true }],
    })
    const line = buildOperatorRetrievalPreview(r.retrievalApplications)[0]
    expect(line).toContain('叢林飛索體驗') // 原需求
    expect(line).toContain('否決原因')
    expect(line).toContain('叢林飛索') // matched unsuitable token surfaced
    expect(line).toContain('是否代入 draft')
    expect(line).toContain('替代候選')
    expect(line).toContain('來源 case')
    expect(line).toContain(SAFE_ALT)
  })

  it('2. named_only → applied=否, lists candidate, source case = none', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'adventure' }] },
      retrievalCases: [{ name: '清邁藍廟二訪', themeTag: 'culture', mobilityFriendly: true }],
    })
    const line = buildOperatorRetrievalPreview(r.retrievalApplications)[0]
    expect(line).toContain('否決原因')
    expect(line).toContain('清邁藍廟二訪')
    expect(line).toContain('是否代入 draft')
  })

  it('3. none → applied=否, candidate=無, hands back for manual fill', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'adventure' }] },
      retrievalCases: [],
    })
    const line = buildOperatorRetrievalPreview(r.retrievalApplications)[0]
    expect(line).toContain('否決原因')
    expect(line).toContain('人工')
  })
})
