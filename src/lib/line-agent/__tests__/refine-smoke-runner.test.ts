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

const fakeKit = { refine: async () => ({}), scanPromptLeak: () => [], cases: [], resolveModel: () => 'm' }
const fakeSource = async (req) => req.deterministicDraft

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
      createSource: async () => fakeSource,
    })

    expect(rt.status).toBe('client_not_wired')
    expect(rt.reason).toBe('factory_unavailable')
    expect(rt.refineSource).toBeNull()
  })

  test('all three gates + working factories → real/wired with a non-null source + kit', async () => {
    const rt = await loadRefineLlmRuntime({
      env: realEnv(),
      importRefineKit: async () => fakeKit,
      createSource: async () => fakeSource,
    })

    expect(rt.status).toBe('real')
    expect(rt.reason).toBe('wired')
    expect(rt.refineSource).toBe(fakeSource)
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

describe('createSourceDefault — SDK-missing is graceful, construction is sanitized', () => {
  // SDK NOT INSTALLED: the dynamic import throws module-not-found, which carries
  // NO key (the key is only used at construction below). It must resolve null so
  // the loader projects factory_unavailable — never an error, never an API call.
  test('SDK import failure (not installed) → resolves null, no throw, no construction', async () => {
    let constructed = false
    const source = await createSourceDefault({
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

    expect(source).toBeNull()
    expect(constructed).toBe(false)
  })

  test('malformed SDK module (no Anthropic export) → resolves null', async () => {
    const source = await createSourceDefault({
      apiKey: SECRET_KEY,
      importSdkModule: async () => ({}),
      importAdapterModule: async () => ({ createAnthropicRefineSource: () => async () => '' }),
    })
    expect(source).toBeNull()
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

  test('SDK + adapter present → builds a working source (no network on construction)', async () => {
    const source = await createSourceDefault({
      apiKey: SECRET_KEY,
      importSdkModule: async () => ({
        Anthropic: class {
          constructor() {
            this.messages = { create: async () => ({ content: [{ type: 'text', text: 'ok' }] }) }
          }
        },
      }),
      importAdapterModule: async () => ({
        createAnthropicRefineSource: (deps) => async () => {
          return deps.callModel({ system: 's', user: 'u', model: 'm' })
        },
      }),
    })

    expect(typeof source).toBe('function')
    await expect(source({ deterministicDraft: 'd', constraints: {} })).resolves.toBe('ok')
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
      { caseId: 'd', model: 'claude-haiku-4-5', promptLeak: false, result: fallbackResult(['structural_drift']) },
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
      { caseId: 'struct', model: 'm', promptLeak: false, result: fallbackResult(['structural_drift']) },
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
