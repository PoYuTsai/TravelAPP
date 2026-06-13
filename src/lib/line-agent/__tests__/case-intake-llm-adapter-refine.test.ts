/**
 * case-intake-llm-adapter-refine.test.ts — refine 暖化子閘 + adapter factory
 * 組 refine sources（Task 2，design 2026-06-12 customer itinerary refine
 * production wiring）.
 *
 * 鎖住：
 *   - gate off（default）⇒ factory 不組 refineSource / rescueRefineSource
 *     （與 Task 1 後 byte-identical）。
 *   - gate on ⇒ factory 組出兩個 RefineDraftSource（Haiku 主 + Sonnet 救援），
 *     兩者都吃同一條 cost-cap 內建的 callAnthropicMessages transport。
 */

import { describe, it, expect } from 'vitest'
import { createAnthropicCaseIntakeSources } from '../partner-group/case-intake-llm-adapter'
import { isCaseIntakeRefineEnabled } from '../partner-group/case-intake-surfacing'
import { createDailyCostCap } from '../observability/daily-cost-cap'
import type { AnthropicCaseIntakeSourcesDeps } from '../partner-group/case-intake-llm-adapter'

function deps(env: Record<string, string | undefined>): AnthropicCaseIntakeSourcesDeps {
  return {
    transport: (async () => new Response('{}')) as unknown as typeof fetch,
    apiKey: 'sk-test',
    costCap: createDailyCostCap({ env, kv: null }),
    env,
  }
}

describe('refine gate + factory', () => {
  it('gate off（預設）⇒ 不組 refineSource', () => {
    expect(isCaseIntakeRefineEnabled({})).toBe(false)
    const s = createAnthropicCaseIntakeSources(deps({}))
    expect(s.refineSource).toBeUndefined()
    expect(s.rescueRefineSource).toBeUndefined()
  })

  it('gate on ⇒ 組出 refineSource + rescueRefineSource', () => {
    const env = { AI_AGENT_CASE_INTAKE_REFINE_ENABLED: 'true' }
    expect(isCaseIntakeRefineEnabled(env)).toBe(true)
    const s = createAnthropicCaseIntakeSources(deps(env))
    expect(typeof s.refineSource).toBe('function')
    expect(typeof s.rescueRefineSource).toBe('function')
  })
})
