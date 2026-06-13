/**
 * responder-factory.test.ts — factory dispatch + degrade rules
 * (design 2026-06-03 §3 table / §3.2 degrade table / §3.3 step 2 / §8 test 4).
 *
 * The factory takes an already-parsed models object + an injected transport and
 * NEVER reads process.env itself.  Dispatch:
 *   - mode unset / 'stub'                        → stubPartnerGroupResponder (identity)
 *   - mode 'anthropic' + key + both model names  → AnthropicPartnerGroupResponder instance
 *   - mode 'anthropic' + empty key               → degraded stub, error=missing_anthropic_api_key
 *   - mode 'anthropic' + key but missing a model → degraded stub, error=missing_partner_responder_model
 */

import { describe, it, expect, vi } from 'vitest'
import { createPartnerGroupResponder } from '@/lib/line-agent/partner-group/responder-factory'
import { stubPartnerGroupResponder } from '@/lib/line-agent/partner-group/responder'
import { AnthropicPartnerGroupResponder } from '@/lib/line-agent/partner-group/anthropic-responder'
import type { PartnerResponderConfig } from '@/lib/line-agent/partner-group/responder-config'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'
import type { DailyCostCap } from '@/lib/line-agent/observability/daily-cost-cap'

/** Allow-all cost cap fake（P0-A 刀 2）— the factory itself never reads env. */
const allowAllCostCap: DailyCostCap = {
  async checkBudget() {
    return { outcome: 'ok', dailySpendMicroUsd: 0 }
  },
  async recordSpend() {
    return { recorded: true }
  },
}

const ANTHROPIC_MODELS: PartnerResponderConfig = {
  partnerResponderMode: 'anthropic',
  anthropicApiKey: 'sk-ant-123',
  defaultModel: 'claude-default',
  researchModel: 'claude-research',
}

// A transport that must never be invoked by the stub/degraded branches.
const neverCalledTransport = (() => {
  throw new Error('transport should not be called during factory construction')
}) as unknown as typeof fetch

function makeInput(): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '@bot 看一下',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: '@bot 看一下',
  }
}

describe('createPartnerGroupResponder', () => {
  // ── stub branches ──────────────────────────────────────────────────────────

  it('returns the stub responder identity when mode is "stub"', () => {
    const responder = createPartnerGroupResponder({
      models: { ...ANTHROPIC_MODELS, partnerResponderMode: 'stub' },
      transport: neverCalledTransport,
      costCap: allowAllCostCap,
    })
    expect(responder).toBe(stubPartnerGroupResponder)
  })

  // ── anthropic + key ────────────────────────────────────────────────────────

  it('returns an AnthropicPartnerGroupResponder instance when mode=anthropic and key present', () => {
    const responder = createPartnerGroupResponder({
      models: ANTHROPIC_MODELS,
      transport: neverCalledTransport,
      costCap: allowAllCostCap,
    })
    expect(responder).toBeInstanceOf(AnthropicPartnerGroupResponder)
  })

  // ── anthropic + missing key → degraded stub (NO throw) ─────────────────────

  it('does NOT throw and returns a degraded stub when mode=anthropic but key is empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const responder = createPartnerGroupResponder({
        models: { ...ANTHROPIC_MODELS, anthropicApiKey: '' },
        transport: neverCalledTransport,
        costCap: allowAllCostCap,
      })
      // It is NOT the plain stub identity — it is a distinct degraded responder.
      expect(responder).not.toBe(stubPartnerGroupResponder)

      const result = await responder.respond(makeInput())
      expect(result.text).toContain('收到，我先記下來') // safe stub text
      expect(result.meta?.responder).toBe('stub')
      expect(result.meta?.degraded).toBe(true)
      expect(result.meta?.error).toBe('missing_anthropic_api_key')
      expect(warn).toHaveBeenCalled() // loud, observable — not silent
    } finally {
      warn.mockRestore()
    }
  })

  // ── anthropic + key but missing model name → degraded stub (NO throw) ──────
  // The adapter must never be built with an empty model: an empty model string
  // would be POSTed to the Anthropic API, wasting billing on a guaranteed error
  // (design §3.2 — missing model name is a degrade trigger).

  it('degrades (no adapter, no transport call) when defaultModel is empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const responder = createPartnerGroupResponder({
        models: { ...ANTHROPIC_MODELS, defaultModel: '' },
        transport: neverCalledTransport,
        costCap: allowAllCostCap,
      })
      expect(responder).not.toBeInstanceOf(AnthropicPartnerGroupResponder)

      const result = await responder.respond(makeInput())
      expect(result.text).toContain('收到，我先記下來')
      expect(result.meta?.responder).toBe('stub')
      expect(result.meta?.degraded).toBe(true)
      expect(result.meta?.error).toBe('missing_partner_responder_model')
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('degrades (no adapter, no transport call) when researchModel is empty', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const responder = createPartnerGroupResponder({
        models: { ...ANTHROPIC_MODELS, researchModel: '' },
        transport: neverCalledTransport,
        costCap: allowAllCostCap,
      })
      expect(responder).not.toBeInstanceOf(AnthropicPartnerGroupResponder)

      const result = await responder.respond(makeInput())
      expect(result.meta?.degraded).toBe(true)
      expect(result.meta?.error).toBe('missing_partner_responder_model')
      expect(warn).toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  // ── factory ignores process.env (decision comes only from injected models) ──

  // ── 外部佐證刀 — webSearchEnabled passthrough ──────────────────────────────

  it('webSearchEnabled passthrough：factory 建出的 adapter 開閘掛 tools、省略不掛', async () => {
    const calls: Array<{ body: string }> = []
    const transport = (async (_url: unknown, init: any) => {
      calls.push({ body: init.body })
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      } as unknown as Response
    }) as unknown as typeof fetch
    const input = makeInput()
    await createPartnerGroupResponder({
      models: ANTHROPIC_MODELS,
      transport,
      costCap: allowAllCostCap,
      webSearchEnabled: true,
    }).respond(input)
    await createPartnerGroupResponder({
      models: ANTHROPIC_MODELS,
      transport,
      costCap: allowAllCostCap,
    }).respond(input)
    expect('tools' in JSON.parse(calls[0].body)).toBe(true)
    expect('tools' in JSON.parse(calls[1].body)).toBe(false)
  })

  it('decides from the injected models, NOT process.env', () => {
    const prev = process.env.AI_AGENT_PARTNER_RESPONDER_MODE
    process.env.AI_AGENT_PARTNER_RESPONDER_MODE = 'anthropic' // try to trick it
    try {
      const responder = createPartnerGroupResponder({
        models: { ...ANTHROPIC_MODELS, partnerResponderMode: 'stub' },
        transport: neverCalledTransport,
        costCap: allowAllCostCap,
      })
      // Env says anthropic, injected models say stub → must follow models.
      expect(responder).toBe(stubPartnerGroupResponder)
    } finally {
      if (prev === undefined) delete process.env.AI_AGENT_PARTNER_RESPONDER_MODE
      else process.env.AI_AGENT_PARTNER_RESPONDER_MODE = prev
    }
  })
})
