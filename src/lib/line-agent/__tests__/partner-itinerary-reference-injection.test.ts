/**
 * partner-itinerary-reference-injection.test.ts — Task 4: OPTIONALLY inject an
 * itinerary reference skeleton (Tasks 1-3 output) into the persona prompt when
 * producing a customer_itinerary_v1 draft.
 *
 * PRIME DIRECTIVE (mirrors the knowledgeSource / web_search pattern): when no
 * reference source is provided/injected, behavior is BYTE-IDENTICAL to current
 * (optional + fail-open). The reference is fetched ONLY for draft intent. The
 * responder NEVER reads env and NEVER imports a Notion client — the source is
 * injected by the (separate) composition root.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildPartnerGroupSystemPrompt,
  PARTNER_GROUP_SYSTEM_PROMPT,
} from '@/lib/line-agent/partner-group/system-prompt'
import { AnthropicPartnerGroupResponder } from '@/lib/line-agent/partner-group/anthropic-responder'
import { createAgentLogger } from '@/lib/line-agent/observability/structured-log'
import type {
  DailyCostCap,
  CostCapCheckOutcome,
} from '@/lib/line-agent/observability/daily-cost-cap'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'
import type { IntentAction } from '@/lib/line-agent/commands/intent'
import { LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY } from '@/lib/line-agent/notion/__fixtures__/customer-itinerary-golden'

const REFERENCE_MARKER = '【排行程參考骨架】'
const SKELETON = '<家庭套餐訂製> 清邁親子骨架\nDay 1｜古城慢遊\n・參觀寺廟'

// ── system-prompt unit ─────────────────────────────────────────────────────
function makeSystemInput(): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '@bot 看一下這團',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: '@bot 看一下這團',
  }
}

describe('buildPartnerGroupSystemPrompt — 排行程 reference 骨架（Task 4）', () => {
  it('提供 itineraryReference ⇒ 注入參考骨架區塊（含骨架原文）', () => {
    const prompt = buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
      itineraryReference: SKELETON,
    })
    expect(prompt.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
    expect(prompt).toContain(REFERENCE_MARKER)
    expect(prompt).toContain(SKELETON)
    expect(prompt).toContain('customer_itinerary_v1')
    expect(prompt).toContain('不得照抄日期或人名')
  })

  it('byte-identical：無 reference ⇒ 與現行完全相同（PRIME DIRECTIVE）', () => {
    // {} 與省略 opts 與現行三者皆同
    expect(buildPartnerGroupSystemPrompt(makeSystemInput(), null, {})).toBe(
      buildPartnerGroupSystemPrompt(makeSystemInput(), null)
    )
    expect(buildPartnerGroupSystemPrompt(makeSystemInput(), null, {})).toBe(
      PARTNER_GROUP_SYSTEM_PROMPT
    )
    // 空字串 / 純空白 ⇒ 視為無 reference
    expect(
      buildPartnerGroupSystemPrompt(makeSystemInput(), null, { itineraryReference: '' })
    ).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(
      buildPartnerGroupSystemPrompt(makeSystemInput(), null, { itineraryReference: '   ' })
    ).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('byte-identical：其他 opts 有設、但無 reference ⇒ 與只設那些 opts 相同', () => {
    expect(
      buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
        webSearchEnabled: true,
      })
    ).toBe(
      buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
        webSearchEnabled: true,
        itineraryReference: '   ',
      })
    )
  })

  it('順序：reference 骨架在知識之後、web_search 之前', () => {
    const prompt = buildPartnerGroupSystemPrompt(
      makeSystemInput(),
      '【清微旅行沉澱問答】\nQ：q\nA：a',
      { webSearchEnabled: true, itineraryReference: SKELETON }
    )
    const knowledgeAt = prompt.indexOf('【清微旅行沉澱問答】')
    const referenceAt = prompt.indexOf(REFERENCE_MARKER)
    const searchAt = prompt.indexOf('【外部佐證｜web_search 已開啟】')
    expect(knowledgeAt).toBeGreaterThan(-1)
    expect(referenceAt).toBeGreaterThan(knowledgeAt)
    expect(searchAt).toBeGreaterThan(referenceAt)
  })
})

// ── responder integration（fake transport，沿用既有 idiom）─────────────────
function makeCostCap(outcome: CostCapCheckOutcome = 'ok', recorded = true) {
  const spends: number[] = []
  const costCap: DailyCostCap = {
    async checkBudget() {
      return { outcome, dailySpendMicroUsd: 0 }
    },
    async recordSpend(usd: number) {
      spends.push(usd)
      return { recorded }
    },
  }
  return { costCap, spends }
}

function makeLog() {
  const lines: string[] = []
  const log = createAgentLogger({ requestId: 'req-test', sink: (l) => lines.push(l) })
  const entries = () => lines.map((l) => JSON.parse(l))
  return { log, entries }
}

const DEPS = {
  apiKey: 'sk-ant-test',
  defaultModel: 'claude-default',
  researchModel: 'claude-research',
  costCap: makeCostCap().costCap,
}

function makeInput(
  action: IntentAction = 'analyze',
  text = '@bot 看一下這團'
): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text,
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action, confidence: 'high', source: 'llm' },
    text,
  }
}

const OK_BODY = { content: [{ type: 'text', text: '建議先確認人數與日期。' }] }
const GOLDEN_BODY = {
  content: [{ type: 'text', text: LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY }],
}

function fakeTransport(response: Partial<Response> & { jsonValue?: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const transport = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit })
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.jsonValue,
    } as unknown as Response
  }) as unknown as typeof fetch
  return { transport, calls }
}

describe('AnthropicPartnerGroupResponder — 排行程 reference 注入（Task 4）', () => {
  it('DRAFT intent ＋注入 itineraryReferenceSource ⇒ system 含骨架', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => SKELETON,
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).toContain(REFERENCE_MARKER)
    expect(body.system).toContain(SKELETON)
    expect(body.system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
  })

  it('NON-draft intent（analyze）⇒ source 不被諮詢、system 無骨架', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const itineraryReferenceSource = vi.fn(async () => SKELETON)
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource,
    })

    await responder.respond(makeInput('analyze', '看一下這團'))

    expect(itineraryReferenceSource).not.toHaveBeenCalled()
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('source throw ⇒ fail-open：照常回覆、system 無骨架、itinerary_reference_unavailable log', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => {
        throw new Error('notion boom')
      },
    })
    const { log, entries } = makeLog()

    const result = await responder.respond({
      ...makeInput('draft', '排個李家7天行程'),
      log,
    })

    expect(result.meta?.responder).toBe('llm')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).not.toContain(REFERENCE_MARKER)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(entries().some((e) => e.event === 'itinerary_reference_unavailable')).toBe(true)
  })

  it('source 回 null ⇒ system 與現行 byte-identical', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => null,
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    expect(JSON.parse(calls[0].init.body as string).system).toBe(
      PARTNER_GROUP_SYSTEM_PROMPT
    )
  })

  it('未注入 source（draft）⇒ 行為不變、system === baseline', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    expect(JSON.parse(calls[0].init.body as string).system).toBe(
      PARTNER_GROUP_SYSTEM_PROMPT
    )
  })
})
