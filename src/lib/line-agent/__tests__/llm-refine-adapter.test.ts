/**
 * llm-refine-adapter.test.ts
 *
 * M3.4c — real LLM adapter for the M3.4b RefineDraftSource seam. PURE /
 * fixture-only: a fake `callModel` is injected; no real Anthropic SDK, no LINE,
 * no Sanity, no gate flip. These tests lock the corrections from the design doc:
 *   - model default centralised + configurable (resolveRefineModel)
 *   - prompt builder takes ONLY the draft string — operatorNotes /
 *     retrievalApplications / provenance / themeTag can never reach the prompt
 *   - prompt-leak tripwire shares the customer-facing forbidden-terms list
 */

import { describe, it, expect } from 'vitest'
import {
  REFINE_MODEL_DEFAULT,
  resolveRefineModel,
  buildRefinePrompt,
  scanRefinePromptLeak,
  createAnthropicRefineSource,
} from '../notion/llm-refine-adapter'
import {
  DETERMINISTIC_DRAFT,
  REFINE_CONSTRAINTS,
} from '../notion/__fixtures__/customer-refine-scenarios'

// ---------------------------------------------------------------------------
// resolveRefineModel — correction 5: centralised default, configurable
// ---------------------------------------------------------------------------

describe('resolveRefineModel', () => {
  it('defaults to the centralised Haiku constant', () => {
    expect(REFINE_MODEL_DEFAULT).toBe('claude-haiku-4-5')
    expect(resolveRefineModel()).toBe('claude-haiku-4-5')
  })

  it('prefers an explicit model over env and default', () => {
    expect(
      resolveRefineModel({ model: 'claude-sonnet-4-6', env: { AI_AGENT_REFINE_LLM_MODEL: 'x' } })
    ).toBe('claude-sonnet-4-6')
  })

  it('falls back to env when no explicit model is given', () => {
    expect(resolveRefineModel({ env: { AI_AGENT_REFINE_LLM_MODEL: 'claude-sonnet-4-6' } })).toBe(
      'claude-sonnet-4-6'
    )
  })
})

// ---------------------------------------------------------------------------
// buildRefinePrompt — correction 3: structured internal fields can't leak in
// ---------------------------------------------------------------------------

describe('buildRefinePrompt', () => {
  it('puts only the deterministic draft in the user message', () => {
    const { system, user } = buildRefinePrompt(DETERMINISTIC_DRAFT)
    expect(user).toBe(DETERMINISTIC_DRAFT)
    expect(system.length).toBeGreaterThan(0)
  })

  it('freezes itinerary facts in the system instruction', () => {
    const { system } = buildRefinePrompt(DETERMINISTIC_DRAFT)
    // The freeze contract must mention not changing facts and returning only the draft.
    expect(system).toMatch(/逐字|凍結|不得|不要/)
  })

  it('never surfaces internal field vocabulary in the assembled prompt', () => {
    const { system, user } = buildRefinePrompt(DETERMINISTIC_DRAFT)
    const assembled = `${system}\n${user}`.toLowerCase()
    for (const banned of ['operatornotes', 'retrievalapplications', 'provenance', 'themetag']) {
      expect(assembled).not.toContain(banned)
    }
  })
})

// ---------------------------------------------------------------------------
// scanRefinePromptLeak — correction 2: shared forbidden-terms list
// ---------------------------------------------------------------------------

describe('scanRefinePromptLeak', () => {
  it('passes a clean customer draft', () => {
    expect(scanRefinePromptLeak(DETERMINISTIC_DRAFT)).toEqual([])
  })

  it('flags a draft carrying internal vocabulary', () => {
    const dirty = `${DETERMINISTIC_DRAFT}\n（internal operator 備註：themeTag=cafe）`
    const hits = scanRefinePromptLeak(dirty)
    expect(hits).toContain('internal')
    expect(hits).toContain('operator')
  })
})

// ---------------------------------------------------------------------------
// createAnthropicRefineSource — verbatim passthrough via injected callModel
// ---------------------------------------------------------------------------

describe('createAnthropicRefineSource', () => {
  it('returns the model output verbatim for the harness to re-gate', async () => {
    const source = createAnthropicRefineSource({
      apiKey: 'unused-in-test',
      callModel: async ({ user }) => `${user}`,
    })
    const out = await source({ deterministicDraft: DETERMINISTIC_DRAFT, constraints: REFINE_CONSTRAINTS })
    expect(out).toBe(DETERMINISTIC_DRAFT)
  })

  it('throws RefinePromptLeakError before calling the model on a dirty draft', async () => {
    let called = false
    const source = createAnthropicRefineSource({
      apiKey: 'unused-in-test',
      callModel: async () => {
        called = true
        return 'should not run'
      },
    })
    await expect(
      source({
        deterministicDraft: `${DETERMINISTIC_DRAFT}\noperator internal note`,
        constraints: REFINE_CONSTRAINTS,
      })
    ).rejects.toThrow(/leak/i)
    expect(called).toBe(false)
  })

  it('passes the resolved model into callModel', async () => {
    let seenModel = ''
    const source = createAnthropicRefineSource({
      apiKey: 'unused-in-test',
      model: 'claude-sonnet-4-6',
      callModel: async ({ model }) => {
        seenModel = model
        return DETERMINISTIC_DRAFT
      },
    })
    await source({ deterministicDraft: DETERMINISTIC_DRAFT, constraints: REFINE_CONSTRAINTS })
    expect(seenModel).toBe('claude-sonnet-4-6')
  })
})
