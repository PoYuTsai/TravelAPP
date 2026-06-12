/**
 * anthropic-responder.test.ts — real-model adapter via an INJECTED fake
 * transport (design 2026-06-03 §5 / §6 / §8 test 3).  Never hits a real API,
 * never needs a real key.
 *
 * Asserts the request contract (URL, headers, routed model, locked system
 * prompt, user text) and the safe-default error behavior: throw / non-200 /
 * parse-failure all fall back to stub text with meta.degraded=true and the
 * matching error code, and NEVER throw (a thrown error would 500 the webhook).
 */

import { describe, it, expect, vi } from 'vitest'
import { AnthropicPartnerGroupResponder } from '@/lib/line-agent/partner-group/anthropic-responder'
import { PARTNER_GROUP_SYSTEM_PROMPT } from '@/lib/line-agent/partner-group/system-prompt'
import { createAgentLogger } from '@/lib/line-agent/observability/structured-log'
import type { DailyCostCap, CostCapCheckOutcome } from '@/lib/line-agent/observability/daily-cost-cap'
import type {
  PartnerGroupRespondInput,
} from '@/lib/line-agent/partner-group/responder'
import type { IntentAction } from '@/lib/line-agent/commands/intent'

/** Allow-all cost cap fake — budget always ok; records every spend（P0-A 刀 2）. */
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

/** Collecting structured logger bound to a fixed requestId. */
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

function makeInput(action: IntentAction = 'analyze', text = '@bot 看一下這團'): PartnerGroupRespondInput {
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

/** Build a fake transport that records its call and returns a canned response. */
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

const OK_BODY = { content: [{ type: 'text', text: '建議先確認人數與日期。' }] }

describe('AnthropicPartnerGroupResponder — request contract', () => {
  it('POSTs to the Anthropic messages endpoint with the injected key + version header', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    await responder.respond(makeInput())

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages')
    expect(calls[0].init.method).toBe('POST')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['content-type']).toBe('application/json')
  })

  it('sends the locked system prompt, the user text, and a positive max_tokens', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    await responder.respond(makeInput('analyze', '@bot 這團幾天'))

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(body.messages[0]).toEqual({ role: 'user', content: '@bot 這團幾天' })
    expect(typeof body.max_tokens).toBe('number')
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('routes the model dynamically from intent (analyze→default, draft→research)', async () => {
    const a = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport: a.transport, ...DEPS }).respond(makeInput('analyze'))
    expect(JSON.parse(a.calls[0].init.body as string).model).toBe('claude-default')

    const d = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport: d.transport, ...DEPS }).respond(makeInput('draft'))
    expect(JSON.parse(d.calls[0].init.body as string).model).toBe('claude-research')
  })

  it('parses content[0].text into the result and tags meta.responder=llm + model', async () => {
    const { transport } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    const result = await responder.respond(makeInput('analyze'))

    expect(result.text).toBe('建議先確認人數與日期。')
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.model).toBe('claude-default')
    expect(result.meta?.degraded).toBeUndefined()
  })
})

describe('AnthropicPartnerGroupResponder — safe-default error paths (never throws)', () => {
  it('transport throw → stub text + degraded + error=anthropic_api_error（structured llm_call log）', async () => {
    const transport = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    expect(result.text).toContain('收到，我先記下來')
    expect(result.meta?.responder).toBe('stub')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('anthropic_api_error')
    expect(result.meta?.model).toBe('claude-default') // the attempted model
    const llm = entries().find((e) => e.event === 'llm_call')
    expect(llm?.outcome).toBe('degraded')
    expect(llm?.degradedReason).toBe('anthropic_api_error')
  })

  it('non-200 → stub text + degraded + error=anthropic_non_200（log 帶 httpStatus）', async () => {
    const { transport } = fakeTransport({ ok: false, status: 500, jsonValue: {} })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    expect(result.text).toContain('收到，我先記下來')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('anthropic_non_200')
    const llm = entries().find((e) => e.event === 'llm_call')
    expect(llm?.degradedReason).toBe('anthropic_non_200')
    expect(llm?.httpStatus).toBe(500)
  })

  it('unparseable success body → stub text + degraded + error=anthropic_parse_error', async () => {
    const { transport } = fakeTransport({ ok: true, status: 200, jsonValue: { content: [] } })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    expect(result.text).toContain('收到，我先記下來')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('anthropic_parse_error')
    expect(entries().find((e) => e.event === 'llm_call')?.degradedReason).toBe(
      'anthropic_parse_error',
    )
  })
})

describe('AnthropicPartnerGroupResponder — 檢索閉環刀 knowledgeSource', () => {
  it('注入 knowledgeSource ⇒ 送出的 system 含知識區塊（接在 frozen persona 之後）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      knowledgeSource: async () => '【清微旅行沉澱問答】\nQ：q\nA：a',
    })

    await responder.respond(makeInput())

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).toContain('Q：q')
    expect(body.system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
  })

  it('knowledgeSource 回 null ⇒ system 與現行 byte-identical', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      knowledgeSource: async () => null,
    })

    await responder.respond(makeInput())

    expect(JSON.parse(calls[0].init.body as string).system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('knowledgeSource throw ⇒ fail-open：照常回覆 llm、原 prompt＋qa_knowledge_unavailable log', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      knowledgeSource: async () => {
        throw new Error('boom')
      },
    })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput(), log })

    expect(result.meta?.responder).toBe('llm')
    expect(JSON.parse(calls[0].init.body as string).system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(entries().some((e) => e.event === 'qa_knowledge_unavailable')).toBe(true)
  })

  it('costCap over_cap ⇒ knowledgeSource 零呼叫（budget gate 先於知識讀取）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const { costCap } = makeCostCap('over_cap')
    const knowledgeSource = vi.fn(async () => '【清微旅行沉澱問答】\nQ：q\nA：a')
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      costCap,
      knowledgeSource,
    })

    const result = await responder.respond(makeInput())

    expect(knowledgeSource).not.toHaveBeenCalled() // 沒預算 ⇒ 連 Notion 讀都不發生
    expect(calls).toHaveLength(0)
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('cost_cap_exceeded')
  })
})

describe('AnthropicPartnerGroupResponder — 外部佐證刀 web_search tool', () => {
  it('webSearchEnabled 省略 ⇒ body 無 tools key（與現行 byte-identical）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(makeInput())
    const body = JSON.parse(calls[0].init.body as string)
    expect('tools' in body).toBe(false)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('webSearchEnabled=true ⇒ body 掛 web_search_20250305（max_uses 3）＋搜證條款進 system', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(makeInput())
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.tools).toEqual([
      { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
    ])
    expect(body.system).toContain('【外部佐證｜web_search 已開啟】')
  })

  it('webSearchEnabled=true 但 event 是 line_oa ⇒ 防衛性不掛 tool（OA 永不）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const input = makeInput()
    input.event.sourceChannel = 'line_oa'
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(input)
    const body = JSON.parse(calls[0].init.body as string)
    expect('tools' in body).toBe(false)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('webSearchEnabled=true 但非 botDirected ⇒ 不掛 tool', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const input = makeInput()
    input.event.mentionsBot = false
    input.botDirected = false
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(input)
    expect('tools' in JSON.parse(calls[0].init.body as string)).toBe(false)
  })
})

describe('AnthropicPartnerGroupResponder — daily cost cap（P0-A 刀 2，雙 fail-closed）', () => {
  const OK_BODY_WITH_USAGE = {
    content: [{ type: 'text', text: '建議先確認人數與日期。' }],
    usage: { input_tokens: 421, output_tokens: 96 },
  }

  it.each([
    ['over_cap', 'cost_cap_exceeded'],
    ['disabled', 'cost_cap_disabled'],
    ['kv_unavailable', 'cost_cap_kv_unavailable'],
  ] as const)('checkBudget=%s → transport NOT called, degraded error=%s', async (outcome, error) => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY_WITH_USAGE })
    const { costCap, spends } = makeCostCap(outcome)
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS, costCap })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    expect(calls).toHaveLength(0) // LLM 沒被打 — fail-closed
    expect(spends).toHaveLength(0)
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe(error)
    expect(result.text).toContain('收到，我先記下來')
    const cap = entries().find((e) => e.event === 'cost_cap')
    expect(cap?.checkOutcome).toBe(outcome)
  })

  it('budget ok → calls LLM, then records the usage-estimated spend', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY_WITH_USAGE })
    const { costCap, spends } = makeCostCap('ok')
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS, costCap })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    expect(calls).toHaveLength(1)
    expect(result.meta?.responder).toBe('llm')
    // 'claude-default' 不在 family 表 → 最貴費率（sonnet $3/$15）
    const expected = (421 / 1_000_000) * 3 + (96 / 1_000_000) * 15
    expect(spends).toHaveLength(1)
    expect(spends[0]).toBeCloseTo(expected, 12)

    const llm = entries().find((e) => e.event === 'llm_call')
    expect(llm?.outcome).toBe('ok')
    expect(llm?.model).toBe('claude-default')
    expect(llm?.inputTokens).toBe(421)
    expect(llm?.outputTokens).toBe(96)
    expect(llm?.costUsd).toBeCloseTo(expected, 12)
    expect(typeof llm?.latencyMs).toBe('number')
  })

  it('usage missing from the response → conservative estimate is still recorded（usageMissing 標記）', async () => {
    const { transport } = fakeTransport({ jsonValue: OK_BODY }) // 無 usage 欄位
    const { costCap, spends } = makeCostCap('ok')
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS, costCap })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    expect(result.meta?.responder).toBe('llm')
    expect(spends).toHaveLength(1)
    expect(spends[0]).toBeGreaterThan(0) // 保守估值，絕不記 0
    expect(entries().find((e) => e.event === 'llm_call')?.usageMissing).toBe(true)
  })

  it('recordSpend failure → reply is NOT dropped; cost_cap log carries reason=record_failed', async () => {
    const { transport } = fakeTransport({ jsonValue: OK_BODY_WITH_USAGE })
    const { costCap } = makeCostCap('ok', /* recorded */ false)
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS, costCap })
    const { log, entries } = makeLog()

    const result = await responder.respond({ ...makeInput('analyze'), log })

    // 已付費的回覆照常送出
    expect(result.text).toBe('建議先確認人數與日期。')
    expect(result.meta?.responder).toBe('llm')
    const capEvents = entries().filter((e) => e.event === 'cost_cap')
    expect(capEvents.some((e) => e.reason === 'record_failed')).toBe(true)
  })
})
