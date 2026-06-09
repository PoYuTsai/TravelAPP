/**
 * refine-smoke-runner.test.ts
 *
 * RED-first spec for the M3.4c Cut 2 refine smoke runtime
 * (scripts/refine-smoke-runner.mjs):
 *   - loadRefineLlmRuntime — the THREE-gate loader (ENABLED → RUNTIME=real →
 *     ANTHROPIC_API_KEY) with fine-grained reason codes and a sanitized wiring
 *     error. Off-gate / missing-key short-circuit BEFORE any factory runs; the
 *     only place the real @anthropic-ai/sdk is ever imported is the createSource
 *     factory, never this lib.
 *   - summarizeRefineSmoke — pure aggregation over per-case outcomes, with the
 *     harness rejection-reason → report-reason mapping (incl. the runner-only
 *     prompt_leak pre-check path).
 *   - formatRefineSmokeReport — masked operator report: no draft / prompt / cost /
 *     PII, only guard COUNTS and rates.
 *
 * PURE / fixture-only: no real LLM, no LINE, no Sanity, no gate.
 */

import { describe, expect, test } from 'vitest'
import {
  loadRefineLlmRuntime,
  createSourceDefault,
  summarizeRefineSmoke,
  formatRefineSmokeReport,
} from '../../../../scripts/refine-smoke-runner.mjs'

const SECRET_KEY = 'sk-ant-DEADBEEF-secret'

/** Three-gate-satisfying env: feature on, runtime real, key present. */
function realEnv(overrides = {}) {
  return {
    AI_AGENT_REFINE_LLM_ENABLED: 'true',
    AI_AGENT_REFINE_LLM_RUNTIME: 'real',
    ANTHROPIC_API_KEY: SECRET_KEY,
    ...overrides,
  }
}

/** Spy factory recording its calls and returning a fixed value as-is. */
function spyFactory(value) {
  const calls = []
  return {
    calls,
    fn: async (ctx) => {
      calls.push(ctx)
      return value
    },
  }
}

const fakeKit = {
  refine: async () => ({}),
  scanPromptLeak: () => [],
  cases: [],
  resolveModel: () => 'm',
  resolveRescueModel: () => 'r',
}
const fakeSource = async (req) => req.deterministicDraft
const fakeRescueSource = async (req) => req.deterministicDraft
/** createSource now yields BOTH tiers (M3.4d). */
const fakeSourcePair = { primarySource: fakeSource, rescueSource: fakeRescueSource }

describe('loadRefineLlmRuntime — three gates short-circuit before any factory', () => {
  test('feature disabled → skipped/disabled, factories never called', async () => {
    const importRefineKit = spyFactory(fakeKit)
    const createSource = spyFactory(fakeSource)

    const rt = await loadRefineLlmRuntime({
      env: { AI_AGENT_REFINE_LLM_ENABLED: 'false' },
      importRefineKit: importRefineKit.fn,
      createSource: createSource.fn,
    })

    expect(rt.status).toBe('skipped')
    expect(rt.reason).toBe('disabled')
    expect(rt.refineSource).toBeNull()
    expect(importRefineKit.calls).toHaveLength(0)
    expect(createSource.calls).toHaveLength(0)
  })

  test('enabled but runtime not real → skipped/runtime_not_real, factories never called', async () => {
    const importRefineKit = spyFactory(fakeKit)
    const createSource = spyFactory(fakeSource)

    const rt = await loadRefineLlmRuntime({
      env: { AI_AGENT_REFINE_LLM_ENABLED: 'true', AI_AGENT_REFINE_LLM_RUNTIME: 'mock' },
      importRefineKit: importRefineKit.fn,
      createSource: createSource.fn,
    })

    expect(rt.status).toBe('skipped')
    expect(rt.reason).toBe('runtime_not_real')
    expect(createSource.calls).toHaveLength(0)
  })

  test('three gates but key missing → client_not_wired/missing_key, source factory never called', async () => {
    const createSource = spyFactory(fakeSource)

    const rt = await loadRefineLlmRuntime({
      env: realEnv({ ANTHROPIC_API_KEY: undefined }),
      importRefineKit: async () => fakeKit,
      createSource: createSource.fn,
    })

    expect(rt.status).toBe('client_not_wired')
    expect(rt.reason).toBe('missing_key')
    expect(rt.refineSource).toBeNull()
    expect(createSource.calls).toHaveLength(0)
  })
})

describe('loadRefineLlmRuntime — wiring under all three gates', () => {
  test('kit factory unavailable (plain node) → client_not_wired/factory_unavailable', async () => {
    const rt = await loadRefineLlmRuntime({
      env: realEnv(),
      importRefineKit: async () => null, // mirrors a swallowed .ts import under plain node
      createSource: async () => fakeSourcePair,
    })

    expect(rt.status).toBe('client_not_wired')
    expect(rt.reason).toBe('factory_unavailable')
    expect(rt.refineSource).toBeNull()
  })

  test('all three gates + working factories → real/wired with non-null primary + rescue + kit', async () => {
    const rt = await loadRefineLlmRuntime({
      env: realEnv(),
      importRefineKit: async () => fakeKit,
      createSource: async () => fakeSourcePair,
    })

    expect(rt.status).toBe('real')
    expect(rt.reason).toBe('wired')
    expect(rt.refineSource).toBe(fakeSource)
    expect(rt.rescueSource).toBe(fakeRescueSource)
    expect(rt.kit).toBe(fakeKit)
  })

  test('three gates + source factory returns null (SDK missing) → client_not_wired/factory_unavailable', async () => {
    const rt = await loadRefineLlmRuntime({
      env: realEnv(),
      importRefineKit: async () => fakeKit,
      createSource: async () => null, // SDK not installed → graceful not-wired, NOT a throw
    })

    expect(rt.status).toBe('client_not_wired')
    expect(rt.reason).toBe('factory_unavailable')
    expect(rt.refineSource).toBeNull()
  })

  test('source factory throw → sanitized RefineLlmWiringError, no API key leaked', async () => {
    const boom = await loadRefineLlmRuntime({
      env: realEnv(),
      importRefineKit: async () => fakeKit,
      createSource: async () => {
        throw new Error(`anthropic init failed with key ${SECRET_KEY}`)
      },
    }).then(
      () => null,
      (err) => err
    )

    expect(boom).not.toBeNull()
    expect(boom.name).toBe('RefineLlmWiringError')
    expect(boom.message).not.toContain(SECRET_KEY)
    expect(String(boom.stack ?? '')).not.toContain(SECRET_KEY)
  })
})

describe('createSourceDefault — dual-tier source, SDK-missing graceful, construction sanitized', () => {
  // SDK NOT INSTALLED: the dynamic import throws module-not-found, which carries
  // NO key (the key is only used at construction below). It must resolve null so
  // the loader projects factory_unavailable — never an error, never an API call.
  test('SDK import failure (not installed) → resolves null, no throw, no construction', async () => {
    let constructed = false
    const pair = await createSourceDefault({
      apiKey: SECRET_KEY,
      importSdkModule: async () => {
        throw new Error("Cannot find module '@anthropic-ai/sdk'")
      },
      importAdapterModule: async () => ({
        createAnthropicRefineSource: () => {
          constructed = true
          return async () => ''
        },
      }),
    })

    expect(pair).toBeNull()
    expect(constructed).toBe(false)
  })

  test('malformed SDK module (no Anthropic export) → resolves null', async () => {
    const pair = await createSourceDefault({
      apiKey: SECRET_KEY,
      importSdkModule: async () => ({}),
      importAdapterModule: async () => ({ createAnthropicRefineSource: () => async () => '' }),
    })
    expect(pair).toBeNull()
  })

  test('SDK present but construction throws with the key → sanitized RefineLlmWiringError', async () => {
    const boom = await createSourceDefault({
      apiKey: SECRET_KEY,
      importSdkModule: async () => ({
        Anthropic: class {
          constructor() {
            throw new Error(`bad client for key ${SECRET_KEY}`)
          }
        },
      }),
      importAdapterModule: async () => ({ createAnthropicRefineSource: () => async () => '' }),
    }).then(
      () => null,
      (err) => err
    )

    expect(boom).not.toBeNull()
    expect(boom.name).toBe('RefineLlmWiringError')
    expect(boom.message).not.toContain(SECRET_KEY)
  })

  test('SDK + adapter present → builds a primary + rescue source pair, each with its own model', async () => {
    const pair = await createSourceDefault({
      apiKey: SECRET_KEY,
      importSdkModule: async () => ({
        Anthropic: class {
          constructor() {
            // Echo the requested model so we can prove the two tiers differ.
            this.messages = { create: async ({ model }) => ({ content: [{ type: 'text', text: model }] }) }
          }
        },
      }),
      importAdapterModule: async () => ({
        // deps.model wins when present (rescue); absent → 'haiku-default' (primary).
        createAnthropicRefineSource: (deps) => async () =>
          deps.callModel({ system: 's', user: 'u', model: deps.model ?? 'haiku-default' }),
        resolveRescueRefineModel: () => 'claude-sonnet-4-6',
      }),
    })

    expect(typeof pair.primarySource).toBe('function')
    expect(typeof pair.rescueSource).toBe('function')
    await expect(pair.primarySource({ deterministicDraft: 'd', constraints: {} })).resolves.toBe(
      'haiku-default'
    )
    await expect(pair.rescueSource({ deterministicDraft: 'd', constraints: {} })).resolves.toBe(
      'claude-sonnet-4-6'
    )
  })
})

// ---------------------------------------------------------------------------
// summarizeRefineSmoke — pure aggregation + reason mapping
// ---------------------------------------------------------------------------

/** Minimal RefineResult-shaped object for a refined (adopted) case. */
function refinedResult() {
  return {
    used: 'refined',
    rejectionReasons: [],
    structuralIssues: [],
    lintIssues: [],
    leakHits: [],
  }
}

/** Minimal RefineResult-shaped object for a fallback with the given harness reasons. */
function fallbackResult(rejectionReasons, extra = {}) {
  return {
    used: 'deterministic',
    rejectionReasons,
    structuralIssues: [],
    lintIssues: [],
    leakHits: [],
    ...extra,
  }
}

describe('summarizeRefineSmoke', () => {
  test('counts accepted vs fallback and computes rates', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'a', model: 'claude-haiku-4-5', promptLeak: false, result: refinedResult() },
      { caseId: 'b', model: 'claude-haiku-4-5', promptLeak: false, result: refinedResult() },
      { caseId: 'c', model: 'claude-haiku-4-5', promptLeak: false, result: fallbackResult(['lint_error']) },
      { caseId: 'd', model: 'claude-haiku-4-5', promptLeak: false, result: fallbackResult(['structural_diff']) },
    ])

    expect(summary.total).toBe(4)
    expect(summary.accepted).toBe(2)
    expect(summary.rejected).toBe(2)
    expect(summary.fallback).toBe(2)
    expect(summary.acceptRate).toBeCloseTo(0.5)
    expect(summary.fallbackRate).toBeCloseTo(0.5)
  })

  test('maps harness reasons to report reasons, including the runner-only prompt_leak', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'lint', model: 'm', promptLeak: false, result: fallbackResult(['lint_error']) },
      { caseId: 'struct', model: 'm', promptLeak: false, result: fallbackResult(['structural_diff']) },
      { caseId: 'leak', model: 'm', promptLeak: false, result: fallbackResult(['internal_leak']) },
      { caseId: 'srcerr', model: 'm', promptLeak: false, result: fallbackResult(['source_error']) },
      { caseId: 'empty', model: 'm', promptLeak: false, result: fallbackResult(['empty_output']) },
      { caseId: 'preleak', model: 'm', promptLeak: true, result: null },
    ])

    expect(summary.byReason).toEqual({
      lint: 1,
      structural_diff: 1,
      forbidden_terms: 1,
      source_error: 1,
      empty_output: 1,
      prompt_leak: 1,
    })
    // prompt_leak case never carries a RefineResult yet is still a fallback row.
    const preleakRow = summary.rows.find((r) => r.caseId === 'preleak')
    expect(preleakRow.isFallback).toBe(true)
    expect(preleakRow.reason).toBe('prompt_leak')
  })

  test('refined rows carry status refined, no reason, masked guard counts', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'a', model: 'claude-haiku-4-5', promptLeak: false, result: refinedResult() },
    ])
    const row = summary.rows[0]
    expect(row.status).toBe('refined')
    expect(row.isFallback).toBe(false)
    expect(row.reason).toBeNull()
    expect(row.model).toBe('claude-haiku-4-5')
  })
})

// ---------------------------------------------------------------------------
// structural_diff sub-reason breakdown (M3.4c follow-up diagnostics)
// ---------------------------------------------------------------------------

/** A structural_diff fallback carrying the given guard issue codes. */
function structFallback(codes) {
  return fallbackResult(['structural_diff'], {
    structuralIssues: codes.map((code) => ({ code, message: 'masked' })),
  })
}

describe('summarizeRefineSmoke — structural sub-reason breakdown', () => {
  test('a structural row expands its struct count into masked sub-reason counts', () => {
    const summary = summarizeRefineSmoke([
      {
        caseId: 'c',
        model: 'm',
        promptLeak: false,
        result: structFallback(['activity_line_changed', 'day_title_fact_changed']),
      },
    ])
    expect(summary.rows[0].guardSummary).toContain(
      'struct=2(activity_line_changed=1, day_title_fact_changed=1)'
    )
  })

  test('repeated sub-reasons are counted, not duplicated', () => {
    const summary = summarizeRefineSmoke([
      {
        caseId: 'c',
        model: 'm',
        promptLeak: false,
        result: structFallback(['activity_line_changed', 'activity_line_changed', 'lunch_changed']),
      },
    ])
    expect(summary.rows[0].guardSummary).toContain(
      'struct=3(activity_line_changed=2, lunch_changed=1)'
    )
  })

  test('a refined (no-drift) row stays struct=0 with no sub-reason parens', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'a', model: 'm', promptLeak: false, result: refinedResult() },
    ])
    expect(summary.rows[0].guardSummary).toBe('struct=0 leak=0 lint=0')
  })

  test('aggregates sub-reason counts across every fallback row', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'a', model: 'm', promptLeak: false, result: structFallback(['activity_line_changed']) },
      {
        caseId: 'b',
        model: 'm',
        promptLeak: false,
        result: structFallback(['activity_line_changed', 'lunch_changed']),
      },
      { caseId: 'c', model: 'm', promptLeak: false, result: refinedResult() },
    ])
    expect(summary.structuralBreakdown).toEqual({ activity_line_changed: 2, lunch_changed: 1 })
  })
})

// ---------------------------------------------------------------------------
// M3.4d — primary→rescue tier accounting
// ---------------------------------------------------------------------------

/** A refined RefineResult adopted at the given tier. */
function refinedAt(tier) {
  return { ...refinedResult(), tier, attempts: [{ tier: 'primary' }, { tier: 'rescue' }].slice(0, tier === 'rescue' ? 2 : 1) }
}

/** A both-tiers-failed RefineResult (primary + rescue attempts, top-level = rescue). */
function bothTiersFailed(reasons) {
  return fallbackResult(reasons, { tier: null, attempts: [{ tier: 'primary' }, { tier: 'rescue' }] })
}

describe('summarizeRefineSmoke — primary→rescue tier', () => {
  test('byTier counts primary-accepted, rescue-accepted, and fallback', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'p', model: 'h', rescueModel: 's', promptLeak: false, result: refinedAt('primary') },
      { caseId: 'r', model: 'h', rescueModel: 's', promptLeak: false, result: refinedAt('rescue') },
      { caseId: 'f', model: 'h', rescueModel: 's', promptLeak: false, result: bothTiersFailed(['lint_error']) },
    ])
    expect(summary.byTier).toEqual({ primary: 1, rescue: 1, deterministic: 1 })
  })

  test('a rescue-adopted row shows the rescue model, a primary-adopted row shows the primary model', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'p', model: 'claude-haiku-4-5', rescueModel: 'claude-sonnet-4-6', promptLeak: false, result: refinedAt('primary') },
      { caseId: 'r', model: 'claude-haiku-4-5', rescueModel: 'claude-sonnet-4-6', promptLeak: false, result: refinedAt('rescue') },
    ])
    expect(summary.rows.find((x) => x.caseId === 'p').model).toBe('claude-haiku-4-5')
    expect(summary.rows.find((x) => x.caseId === 'r').model).toBe('claude-sonnet-4-6')
  })

  test('a both-tiers fallback row shows the primary→rescue escalation in its model label', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'f', model: 'claude-haiku-4-5', rescueModel: 'claude-sonnet-4-6', promptLeak: false, result: bothTiersFailed(['structural_diff']) },
    ])
    expect(summary.rows[0].model).toBe('claude-haiku-4-5→claude-sonnet-4-6')
  })
})

describe('formatRefineSmokeReport — tier distribution section', () => {
  test('ok report surfaces the adoption-tier rollup, masked', () => {
    const summary = summarizeRefineSmoke([
      { caseId: 'p', model: 'claude-haiku-4-5', rescueModel: 'claude-sonnet-4-6', promptLeak: false, result: refinedAt('primary') },
      { caseId: 'r', model: 'claude-haiku-4-5', rescueModel: 'claude-sonnet-4-6', promptLeak: false, result: refinedAt('rescue') },
      { caseId: 'f', model: 'claude-haiku-4-5', rescueModel: 'claude-sonnet-4-6', promptLeak: false, result: bothTiersFailed(['lint_error']) },
    ])
    const out = formatRefineSmokeReport({ status: 'ok', summary })
    expect(out).toContain('採用層分佈')
    expect(out).toContain('primary')
    expect(out).toContain('rescue')
  })
})

describe('formatRefineSmokeReport — structural breakdown stays masked', () => {
  test('report surfaces the aggregate sub-reasons but never a draft body', () => {
    const DRAFT_LINE = '📅 日期：2026/8/4 - 8/10'
    const summary = summarizeRefineSmoke([
      { caseId: 'golden', model: 'm', promptLeak: false, result: refinedResult() },
      {
        caseId: 'drift',
        model: 'm',
        promptLeak: false,
        result: structFallback(['activity_line_changed', 'day_title_fact_changed']),
      },
    ])

    const out = formatRefineSmokeReport({ status: 'ok', summary })

    expect(out).toContain('activity_line_changed')
    expect(out).toContain('day_title_fact_changed')
    // Masking holds: a sub-reason is a fact category, never a draft body.
    expect(out).not.toContain(DRAFT_LINE)
  })
})

// ---------------------------------------------------------------------------
// formatRefineSmokeReport — masked operator output
// ---------------------------------------------------------------------------

describe('formatRefineSmokeReport', () => {
  test('skipped projection names the gate reason, no LLM call implied', () => {
    const out = formatRefineSmokeReport({ status: 'skipped', reason: 'disabled' })
    expect(out).toContain('略過')
    expect(out).toContain('AI_AGENT_REFINE_LLM_ENABLED')
  })

  test('client_not_wired projection surfaces the fine-grained reason', () => {
    const out = formatRefineSmokeReport({ status: 'client_not_wired', reason: 'missing_key' })
    expect(out).toContain('missing_key')
  })

  test('factory_unavailable projection clearly names SDK missing (not a key)', () => {
    const out = formatRefineSmokeReport({ status: 'client_not_wired', reason: 'factory_unavailable' })
    expect(out).toContain('factory_unavailable')
    expect(out).toMatch(/SDK/i)
    expect(out).not.toContain('sk-ant')
  })

  test('error projection is sanitized (no detail beyond a wiring code)', () => {
    const out = formatRefineSmokeReport({ status: 'error' })
    expect(out).toContain('失敗')
    expect(out).toMatch(/wiring/i)
  })

  test('ok report shows rates + by-reason but NEVER the draft / prompt / a leaked note', () => {
    const DRAFT_LINE = '📅 日期：2026/8/4 - 8/10'
    const LEAKED_NOTE = '（內部備註：這家成本較高，分潤另計）'
    const summary = summarizeRefineSmoke([
      { caseId: 'golden', model: 'claude-haiku-4-5', promptLeak: false, result: refinedResult() },
      {
        caseId: 'leaky',
        model: 'claude-haiku-4-5',
        promptLeak: false,
        result: fallbackResult(['internal_leak'], { leakHits: ['內部'] }),
      },
    ])

    const out = formatRefineSmokeReport({ status: 'ok', summary })

    expect(out).toContain('完成')
    expect(out).toContain('forbidden_terms')
    expect(out).toContain('golden')
    // Masking: the report carries no draft body, no raw leaked note text.
    expect(out).not.toContain(DRAFT_LINE)
    expect(out).not.toContain(LEAKED_NOTE)
    expect(out).not.toContain('內部備註')
  })
})
