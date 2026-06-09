/**
 * agent-command-refine-smoke.test.ts
 *
 * RED-first spec for the `refine-smoke` operator command
 * (scripts/agent-command.mjs → runRefineSmokeCommand). The command resolves the
 * three-gate runtime, then for each fixture draft:
 *   1. pre-checks scanRefinePromptLeak — a hit is a first-class `prompt_leak`
 *      fallback and the LLM is NOT called;
 *   2. otherwise runs the REAL M3.4b harness (refineCustomerItineraryDraft) with
 *      the injected source, whose three deterministic guards decide adoption.
 * The end report is masked.
 *
 * This suite injects a FAKE source over the REAL harness + REAL fixtures, so it
 * proves the whole chain offline with zero real LLM, LINE, Sanity, or gate flip.
 */

import { describe, expect, test } from 'vitest'
import { runRefineSmokeCommand } from '../../../../scripts/agent-command.mjs'
import { refineCustomerItineraryDraft } from '../notion/customer-itinerary-refine'
import {
  scanRefinePromptLeak,
  resolveRefineModel,
  resolveRescueRefineModel,
} from '../notion/llm-refine-adapter'
import { REFINE_SMOKE_CASES } from '../notion/__fixtures__/refine-smoke-cases'

/** Kit assembled from the REAL harness + adapter + fixtures (what the loader returns under tsx). */
function realKit(overrides = {}) {
  return {
    refine: refineCustomerItineraryDraft,
    scanPromptLeak: scanRefinePromptLeak,
    cases: REFINE_SMOKE_CASES,
    resolveModel: resolveRefineModel,
    resolveRescueModel: resolveRescueRefineModel,
    ...overrides,
  }
}

/** Identity source: returns the draft byte-identical → all three guards pass. */
const identitySource = async (req) => req.deterministicDraft

/** Leak source: appends an internal note → only the leak guard rejects. */
const leakySource = async (req) =>
  req.deterministicDraft + '\n\n（內部備註：這家成本較高，分潤另計）'

/** Structural-break source: mutates the always-present date line → structural_diff
 * rejection on EVERY fixture, so the primary tier always fails. */
const structBreakSource = async (req) =>
  req.deterministicDraft.replace('📅 日期：', '📅 日期：（已調整）')

describe('runRefineSmokeCommand — gate projections (no source)', () => {
  test('loader returns skipped → skipped report, harness never reached', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      loadRuntime: async () => ({ status: 'skipped', reason: 'disabled', refineSource: null, kit: null }),
    })
    expect(out).toContain('略過')
    expect(out).toContain('AI_AGENT_REFINE_LLM_ENABLED')
  })

  test('loader returns client_not_wired/missing_key → not-wired report', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      loadRuntime: async () => ({
        status: 'client_not_wired',
        reason: 'missing_key',
        refineSource: null,
        kit: null,
      }),
    })
    expect(out).toContain('missing_key')
  })

  test('loader throw (sanitized wiring error) → error report', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      loadRuntime: async () => {
        throw new Error('wiring failed')
      },
    })
    expect(out).toContain('失敗')
  })
})

describe('runRefineSmokeCommand — full chain over real fixtures', () => {
  test('identity source → every fixture draft is adopted (refined), 0% fallback', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      refineSource: identitySource,
      kit: realKit(),
    })

    const total = REFINE_SMOKE_CASES.length
    expect(out).toContain('完成')
    expect(out).toContain(`採用 refined：${total}`)
    expect(out).toContain('fallback 率：0%')
    // Masking: no draft body leaks into the report.
    expect(out).not.toContain('📅 日期')
  })

  test('leaky source → every draft falls back via forbidden_terms, note never printed', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      refineSource: leakySource,
      kit: realKit(),
    })

    const total = REFINE_SMOKE_CASES.length
    expect(out).toContain('採用 refined：0')
    expect(out).toContain(`forbidden_terms：${total}`)
    // The leaked internal note must never reach the operator report.
    expect(out).not.toContain('內部備註')
    expect(out).not.toContain('分潤另計')
  })

  test('prompt_leak pre-check short-circuits the LLM (refine never called)', async () => {
    let refineCalls = 0
    const dirtyKit = {
      refine: async (...args) => {
        refineCalls += 1
        return refineCustomerItineraryDraft(...args)
      },
      scanPromptLeak: (draft) => (draft.includes('internal') ? ['internal'] : []),
      cases: [
        { caseId: 'dirty', deterministicDraft: 'internal note draft', constraints: { days: 1 } },
      ],
      resolveModel: () => 'claude-haiku-4-5',
    }

    const out = await runRefineSmokeCommand({
      env: {},
      refineSource: identitySource,
      kit: dirtyKit,
    })

    expect(refineCalls).toBe(0)
    expect(out).toContain('prompt_leak：1')
    expect(out).toContain('採用 refined：0')
  })
})

describe('runRefineSmokeCommand — primary→rescue tier (M3.4d)', () => {
  test('primary always breaks, rescue is identity → every draft is rescued (refined)', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      refineSource: structBreakSource,
      rescueSource: identitySource,
      kit: realKit(),
    })

    const total = REFINE_SMOKE_CASES.length
    expect(out).toContain('完成')
    expect(out).toContain(`採用 refined：${total}`)
    expect(out).toContain('採用層分佈')
    expect(out).toContain(`rescue：${total}`)
    expect(out).toContain('fallback 率：0%')
    // Masking holds even on the mutated draft.
    expect(out).not.toContain('已調整')
  })

  test('primary breaks, rescue leaks → every draft falls back via forbidden_terms', async () => {
    const out = await runRefineSmokeCommand({
      env: {},
      refineSource: structBreakSource,
      rescueSource: leakySource,
      kit: realKit(),
    })

    const total = REFINE_SMOKE_CASES.length
    expect(out).toContain('採用 refined：0')
    expect(out).toContain(`forbidden_terms：${total}`)
    expect(out).toContain(`仍 fallback（deterministic）：${total}`)
    expect(out).not.toContain('內部備註')
  })

  test('primary passes → rescue is never invoked', async () => {
    let rescueCalls = 0
    const spyRescue = async (req) => {
      rescueCalls += 1
      return req.deterministicDraft
    }
    const out = await runRefineSmokeCommand({
      env: {},
      refineSource: identitySource,
      rescueSource: spyRescue,
      kit: realKit(),
    })

    const total = REFINE_SMOKE_CASES.length
    expect(rescueCalls).toBe(0)
    expect(out).toContain(`採用 refined：${total}`)
    expect(out).toContain(`primary：${total}`)
  })
})
