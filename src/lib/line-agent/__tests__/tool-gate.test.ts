/**
 * M3-0 — External Tool / Billing Gate Contract.
 *
 * Pins the policy boundary for high-cost external tools (web search, OCR,
 * Notion RAG) BEFORE any real provider is wired. The gate is a pure,
 * synchronous function — no I/O, no LLM, no provider calls. Like permissions.ts
 * it is the LAST WORD: an LLM proposing "search the web" can never widen it.
 *
 * Three policy invariants are pinned here:
 *  1. External tools default OFF — absent env → denied, with a billing/tool-gate
 *     reason an operator can read.
 *  2. The OA customer plane (line_oa) can NEVER use an external tool, even when
 *     the env gate is enabled and the intent is web_search. This is the billing
 *     + customer-no-auto-reply double insurance.
 *  3. The partner group may use a tool ONLY when ALL of: botDirected,
 *     user explicitly requested external/realtime data, env gate enabled, and
 *     the cost cap is not exceeded. Flipping any single condition → denied.
 */

import { describe, it, expect } from 'vitest'
import { loadToolConfig } from '../tools/tool-config'
import { canUseExternalTool } from '../tools/tool-gate'
import type { ToolGateRequest } from '../tools/tool-gate'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Config with web search fully enabled and a $1.00 cost cap. */
function enabledConfig(env: Record<string, string | undefined> = {}) {
  return loadToolConfig({
    AI_AGENT_WEB_SEARCH_ENABLED: 'true',
    AI_AGENT_TOOL_COST_CAP_USD: '1.00',
    ...env,
  })
}

/** A partner-group request that satisfies ALL allow conditions. */
function passingRequest(overrides?: Partial<ToolGateRequest>): ToolGateRequest {
  return {
    tool: 'web_search',
    sourceChannel: 'line_partner_group',
    botDirected: true,
    userRequestedExternalData: true,
    costSpentUsd: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// loadToolConfig — billing defaults
// ---------------------------------------------------------------------------

describe('loadToolConfig', () => {
  it('defaults every external tool to OFF when env is empty', () => {
    const config = loadToolConfig({})
    expect(config.webSearchEnabled).toBe(false)
    expect(config.ocrEnabled).toBe(false)
    expect(config.notionRagEnabled).toBe(false)
  })

  it('enables web search only when env is explicitly "true"', () => {
    expect(loadToolConfig({ AI_AGENT_WEB_SEARCH_ENABLED: 'true' }).webSearchEnabled).toBe(true)
    expect(loadToolConfig({ AI_AGENT_WEB_SEARCH_ENABLED: '1' }).webSearchEnabled).toBe(false)
    expect(loadToolConfig({ AI_AGENT_WEB_SEARCH_ENABLED: 'yes' }).webSearchEnabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Rule 1 — default OFF
// ---------------------------------------------------------------------------

describe('canUseExternalTool — Rule 1: default OFF', () => {
  it('denies web_search when the env gate is disabled, even for a fully-addressed partner request', () => {
    const config = loadToolConfig({}) // web search disabled
    const result = canUseExternalTool(passingRequest(), config)

    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/billing|tool gate|disabled/i)
  })
})

// ---------------------------------------------------------------------------
// Rule 2 — OA customer plane is never allowed
// ---------------------------------------------------------------------------

describe('canUseExternalTool — Rule 2: OA plane never', () => {
  it('denies line_oa even when the env gate is enabled and intent is web_search', () => {
    const result = canUseExternalTool(
      passingRequest({ sourceChannel: 'line_oa' }),
      enabledConfig()
    )

    expect(result.allowed).toBe(false)
    // The reason must point at the customer plane, NOT merely billing — the two
    // defenses are independent.
    expect(result.reason).toMatch(/line_oa|customer/i)
  })
})

// ---------------------------------------------------------------------------
// Rule 3 — partner group requires ALL conditions
// ---------------------------------------------------------------------------

describe('canUseExternalTool — Rule 3: partner group AND-gate', () => {
  it('allows web_search when botDirected + userRequested + env enabled + under cost cap', () => {
    const result = canUseExternalTool(passingRequest(), enabledConfig())
    expect(result.allowed).toBe(true)
  })

  it('denies when the bot is not directly addressed', () => {
    const result = canUseExternalTool(
      passingRequest({ botDirected: false }),
      enabledConfig()
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/botDirected|addressed/i)
  })

  it('denies when the user did not explicitly request external/realtime data', () => {
    const result = canUseExternalTool(
      passingRequest({ userRequestedExternalData: false }),
      enabledConfig()
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/request|external|realtime/i)
  })

  it('denies when the cost cap is already reached', () => {
    const result = canUseExternalTool(
      passingRequest({ costSpentUsd: 1.0 }),
      enabledConfig({ AI_AGENT_TOOL_COST_CAP_USD: '1.00' })
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/cost cap|budget/i)
  })
})
