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
import { LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY } from '@/lib/line-agent/notion/__fixtures__/customer-itinerary-golden'

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

/** Sequence transport — returns canned jsonValues in order, one per call. */
function sequenceTransport(jsonValues: unknown[]) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  let i = 0
  const transport = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit })
    const jsonValue = jsonValues[Math.min(i, jsonValues.length - 1)]
    i += 1
    return { ok: true, status: 200, json: async () => jsonValue } as unknown as Response
  }) as unknown as typeof fetch
  return { transport, calls }
}

const BAD_PROSE_BODY = {
  content: [{ type: 'text', text: '幫你排個 5 天行程：\n第一天去古城逛逛，第二天上山看大象，很棒喔！' }],
}
const GOLDEN_BODY = {
  content: [{ type: 'text', text: LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY }],
}

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

  it('draft intent Pass 1 不掛 web_search（先出乾淨草稿，web 留給 Pass 2）', async () => {
    // GOLDEN_BODY 第一次就過閘 ⇒ Pass 1 單次，Pass 2 才掛 web。斷言 call[0]（Pass 1）無 tool。
    const { transport, calls } = sequenceTransport([GOLDEN_BODY, GOLDEN_BODY])
    const input = makeInput('draft', '@bot 排個李家7天行程')
    input.botDirected = true
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(input)
    const body = JSON.parse(calls[0].init.body as string)
    expect('tools' in body).toBe(false) // Pass 1 一律關 web，保格式乾淨
  })
})

describe('AnthropicPartnerGroupResponder — 多 block 解析＋citations（外部佐證刀）', () => {
  const SEARCH_BODY = {
    content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'yi peng 2026' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      { type: 'text', text: '天燈節是 11/25', citations: [{ type: 'web_search_result_location', url: 'https://a.example/yipeng', title: 'A' }] },
      { type: 'text', text: '，建議提前訂房。', citations: [
        { type: 'web_search_result_location', url: 'https://a.example/yipeng', title: 'A' },
        { type: 'web_search_result_location', url: 'https://b.example/hotels', title: 'B' },
      ] },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
  }

  it('串接所有 text block＋citations 去重抽 URL 附文末', async () => {
    const { transport } = fakeTransport({ jsonValue: SEARCH_BODY })
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(makeInput())
    expect(result.text).toBe(
      '天燈節是 11/25，建議提前訂房。\n\n資料來源：\n- https://a.example/yipeng\n- https://b.example/hotels'
    )
    expect(result.meta?.responder).toBe('llm')
  })

  it('來源最多 3 個 URL', async () => {
    const many = {
      content: [{
        type: 'text', text: 'x',
        citations: [1, 2, 3, 4, 5].map((i) => ({ type: 'web_search_result_location', url: `https://s${i}.example/` })),
      }],
    }
    const { transport } = fakeTransport({ jsonValue: many })
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(makeInput())
    expect((result.text.match(/^- https:/gm) ?? []).length).toBe(3)
  })

  it('純 text 單 block（無 citations）⇒ 文末無資料來源段（現行行為不變）', async () => {
    const { transport } = fakeTransport({ jsonValue: OK_BODY })
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(makeInput())
    expect(result.text).toBe('建議先確認人數與日期。')
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

describe('AnthropicPartnerGroupResponder — Q2 draft intent tripwire（重產→降級）', () => {
  it('draft：v1 過不了閘 → 帶 problems 重產一次成功（無 ⚠️ 未過檢註記）', async () => {
    const { transport, calls } = sequenceTransport([BAD_PROSE_BODY, GOLDEN_BODY])
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(
      makeInput('draft', '排個李家7天行程'),
    )
    expect(calls).toHaveLength(2)
    expect(result.text).toContain('Day 1｜')
    expect(result.text).not.toContain('未過自動檢查')
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.degraded).toBeUndefined()
  })

  it('draft：兩次都過不了閘 → 降級保留原文＋⚠️ 未過檢註記', async () => {
    const { transport, calls } = sequenceTransport([BAD_PROSE_BODY, BAD_PROSE_BODY])
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(
      makeInput('draft', '排個行程'),
    )
    expect(calls).toHaveLength(2)
    expect(result.text).toContain('未過自動檢查')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('itinerary_gate_failed')
  })

  it('draft：第一次就過閘 → 只呼叫一次、原樣回（無重產）', async () => {
    const { transport, calls } = sequenceTransport([GOLDEN_BODY])
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(
      makeInput('draft', '排個李家7天行程'),
    )
    expect(calls).toHaveLength(1)
    expect(result.text).toContain('Day 1｜')
    expect(result.meta?.degraded).toBeUndefined()
  })

  it('非 draft intent（analyze）⇒ 不走閘、單次呼叫、行為零變化', async () => {
    const { transport, calls } = sequenceTransport([BAD_PROSE_BODY])
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(
      makeInput('analyze', '看一下這團'),
    )
    expect(calls).toHaveLength(1)
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.degraded).toBeUndefined()
  })
})

describe('AnthropicPartnerGroupResponder — draft 二段：乾淨草稿→web 佐證修正（design 2026-06-17）', () => {
  /** 帶 citations 的 golden body — Pass 2 web 修正後仍是合法 v1 並附來源。 */
  const GOLDEN_BODY_WITH_CITATIONS = {
    content: [
      {
        type: 'text',
        text: LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY,
        citations: [{ type: 'web_search_result_location', url: 'https://src.example/hours', title: 'H' }],
      },
    ],
    usage: { input_tokens: 200, output_tokens: 120, server_tool_use: { web_search_requests: 2 } },
  }

  function draftInput(text = '@bot 排個李家7天行程') {
    const input = makeInput('draft', text)
    input.botDirected = true
    return input
  }

  it('draft + webSearchEnabled=true ⇒ 兩次呼叫；Pass 1 無 tools、Pass 2 掛 web_search', async () => {
    const { transport, calls } = sequenceTransport([GOLDEN_BODY, GOLDEN_BODY_WITH_CITATIONS])
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(draftInput())

    expect(calls).toHaveLength(2)
    const pass1 = JSON.parse(calls[0].init.body as string)
    const pass2 = JSON.parse(calls[1].init.body as string)
    expect('tools' in pass1).toBe(false)
    expect(pass2.tools).toEqual([
      { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
    ])
    // Pass 2 收到 Pass 1 草稿＋查核指示
    expect(pass2.messages[0].content).toContain('Day 1｜')
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.degraded).toBeUndefined()
    // Pass 2 過閘 ⇒ 採用 Pass 2 文字並附來源連結
    expect(result.text).toContain('資料來源：')
    expect(result.text).toContain('https://src.example/hours')
  })

  it('draft + webSearchEnabled=false ⇒ 單段（今日行為，無 Pass 2）', async () => {
    const { transport, calls } = sequenceTransport([GOLDEN_BODY])
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(
      draftInput(),
    )
    expect(calls).toHaveLength(1) // 沒開閘 ⇒ 不做 web 佐證
    expect(result.text).toContain('Day 1｜')
    expect(result.meta?.degraded).toBeUndefined()
  })

  it('Pass 2 過不了閘 ⇒ 回退 Pass 1 文字（永不比今日差）', async () => {
    // Pass 1 = golden（過閘）；Pass 2 = 散文（不過閘）⇒ 採用 Pass 1。
    const { transport, calls } = sequenceTransport([GOLDEN_BODY, BAD_PROSE_BODY])
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(draftInput())

    expect(calls).toHaveLength(2)
    expect(result.text).toBe(LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY) // 採 Pass 1 原文
    expect(result.text).not.toContain('未過自動檢查')
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.degraded).toBeUndefined()
  })

  it('Pass 2 transport 降級（非 200）⇒ 回退 Pass 1 文字', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    let i = 0
    const transport = (async (url: unknown, init: unknown) => {
      calls.push({ url: String(url), init: (init ?? {}) as RequestInit })
      const ok = i === 0 // Pass 1 成功，Pass 2 500
      i += 1
      return { ok, status: ok ? 200 : 500, json: async () => GOLDEN_BODY } as unknown as Response
    }) as unknown as typeof fetch

    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(draftInput())

    expect(calls).toHaveLength(2)
    expect(result.text).toBe(LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY)
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.degraded).toBeUndefined()
  })

  it('兩段都記帳：recordSpend 被呼叫兩次（Pass 1 + Pass 2，含 Pass 2 搜尋費）', async () => {
    const { transport } = sequenceTransport([GOLDEN_BODY, GOLDEN_BODY_WITH_CITATIONS])
    const { costCap, spends } = makeCostCap('ok')
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, costCap, webSearchEnabled: true,
    }).respond(draftInput())

    expect(spends).toHaveLength(2) // Pass 1 + Pass 2 都記帳
    // Pass 2 帶 web_search_requests=2 ⇒ 至少含 2×$0.01 搜尋費
    expect(spends[1]).toBeGreaterThanOrEqual(0.02)
  })

  it('Pass 1 降級（解析失敗）⇒ 不進 Pass 2，原樣透出 stub（單次 LLM 呼叫）', async () => {
    const { transport, calls } = sequenceTransport([{ content: [] }])
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(draftInput())
    expect(calls).toHaveLength(1)
    expect(result.meta?.responder).toBe('stub')
    expect(result.meta?.error).toBe('anthropic_parse_error')
  })

  it('draft + webSearchEnabled=true 但 line_oa ⇒ 防衛性不做 Pass 2（單段）', async () => {
    const { transport, calls } = sequenceTransport([GOLDEN_BODY])
    const input = draftInput()
    input.event.sourceChannel = 'line_oa'
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(input)
    expect(calls).toHaveLength(1)
  })
})

describe('AnthropicPartnerGroupResponder — draft 注入今天日期（年份 bug 2026-06-17）', () => {
  // Asia/Taipei 正午（避免 UTC 換日漂移）⇒ 2026年6月17日。
  const fixedNow = () => new Date('2026-06-17T04:00:00Z')

  it('draft intent ⇒ Pass 1 system 注入今天日期（2026 年）＋跨年/ M-D 規則', async () => {
    const { transport, calls } = sequenceTransport([GOLDEN_BODY])
    await new AnthropicPartnerGroupResponder({ transport, ...DEPS, now: fixedNow }).respond(
      makeInput('draft', '排個李家7天行程'),
    )
    const sys = JSON.parse(calls[0].init.body as string).system
    expect(sys).toContain('【今天日期】2026年6月17日')
    expect(sys).toContain('明年')
    expect(sys).toContain('7/1~7/5')
  })

  it('非 draft intent（analyze）⇒ system 不含今天日期注入（byte-identical 保持）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport, ...DEPS, now: fixedNow }).respond(
      makeInput('analyze'),
    )
    const sys = JSON.parse(calls[0].init.body as string).system
    expect(sys).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(sys).not.toContain('今天日期')
  })
})

describe('AnthropicPartnerGroupResponder — 搜尋費記帳（外部佐證刀）', () => {
  it('usage.server_tool_use.web_search_requests=2 ⇒ recordSpend 含 2×$0.01', async () => {
    const body = {
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 100, output_tokens: 50, server_tool_use: { web_search_requests: 2 } },
    }
    const { transport } = fakeTransport({ jsonValue: body })
    const { costCap, spends } = makeCostCap('ok')
    const { log, entries } = makeLog()
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, costCap, webSearchEnabled: true,
    }).respond({ ...makeInput(), log })

    const tokenCost = (100 / 1_000_000) * 3 + (50 / 1_000_000) * 15
    expect(spends[0]).toBeCloseTo(tokenCost + 0.02, 12)
    expect(entries().find((e) => e.event === 'llm_call')?.webSearchRequests).toBe(2)
  })

  it('開閘＋usage 整包缺 ⇒ 保守按 max_uses 3 全用滿估搜尋費', async () => {
    const { transport } = fakeTransport({ jsonValue: { content: [{ type: 'text', text: 'ok' }] } })
    const { costCap, spends } = makeCostCap('ok')
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, costCap, webSearchEnabled: true,
    }).respond(makeInput())
    expect(spends[0]).toBeGreaterThanOrEqual(0.03) // 3 × $0.01 下限
  })

  it('閘關 ⇒ 記帳公式與現行完全相同（零搜尋費）', async () => {
    const body = { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 421, output_tokens: 96 } }
    const { transport } = fakeTransport({ jsonValue: body })
    const { costCap, spends } = makeCostCap('ok')
    await new AnthropicPartnerGroupResponder({ transport, ...DEPS, costCap }).respond(makeInput())
    expect(spends[0]).toBeCloseTo((421 / 1_000_000) * 3 + (96 / 1_000_000) * 15, 12)
  })
})
