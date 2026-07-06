/**
 * customer-change-explanation.test.ts
 *
 * M3.3e — customerExplanation tone snapshot + forbidden-terms regression.
 *
 * The customer version must read like a natural travel-agent explanation: it
 * must NEVER leak internal / retrieval / system wording, and its phrasing is
 * pinned with a snapshot so future edits can't quietly turn it mechanical or
 * leaky. PURE, fixture-only — no Notion live / LLM / LINE / gate.
 */

import { describe, it, expect } from 'vitest'
import { composeCustomerChange } from '../notion/customer-itinerary-change-composer'
import { ALL_CHANGE_SCENARIOS } from '../notion/__fixtures__/customer-change-scenarios'
import {
  FORBIDDEN_CUSTOMER_TERMS as FORBIDDEN_TERMS,
  FORBIDDEN_CUSTOMER_CJK as FORBIDDEN_CJK,
} from '../notion/customer-facing-forbidden-terms'

describe('customerExplanation — forbidden-terms regression', () => {
  for (const scenario of ALL_CHANGE_SCENARIOS) {
    it(`「${scenario.name}」explanation carries no internal wording`, () => {
      const r = composeCustomerChange(scenario.build())
      const lower = r.customerExplanation.toLowerCase()
      for (const term of FORBIDDEN_TERMS) {
        expect(lower).not.toContain(term)
      }
      for (const term of FORBIDDEN_CJK) {
        expect(r.customerExplanation).not.toContain(term)
      }
      expect(r.customerExplanation.trim().length).toBeGreaterThan(0)
    })
  }
})

describe('customerExplanation — natural-tone snapshot', () => {
  it('all scenarios read like a travel-agent explanation', () => {
    const snapshot: Record<string, string> = {}
    for (const scenario of ALL_CHANGE_SCENARIOS) {
      snapshot[scenario.name] = composeCustomerChange(scenario.build()).customerExplanation
    }
    expect(snapshot).toMatchSnapshot()
  })
})
