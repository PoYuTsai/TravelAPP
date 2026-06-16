/**
 * smart-reply-agent-loop.test.ts — Task 3.2 agentic tool_use 迴圈（截圖智慧回覆）。
 *
 * 全程注入 fake transport（typeof fetch），絕不打真 API、不需真 key。覆蓋：
 *  1. LLM 直接 end_turn ⇒ 兩段輸出、meta.responder==='llm'。
 *  2. 呼叫 search_chiangmai_cases 一輪後 end_turn ⇒ 第 2 次 POST 的 messages 尾端
 *     含對應 tool_use_id 的 tool_result；最終結果兩個 header 都在。
 *  3. web_search server tool 掛載：webSearchEnabled=true ⇒ 第 1 次 POST tools 含
 *     web_search_20250305；channel=line_oa 或非 botDirected ⇒ 不掛（allowWebSearch 收窄）。
 *  4. RAG 未注入（getRagIndex undefined）⇒ tools 不含 search_chiangmai_cases。
 *  5. cost cap 非 ok ⇒ 不 POST、回 degrade stub、meta.error 為 cost_cap_*。
 *  6. transport throw ⇒ degrade（anthropic_api_error）、不 throw。
 *  7. MAX_ROUNDS 耗盡仍 tool_use ⇒ 收斂成兩段輸出＋log max_rounds、POST 次數有上限。
 *  8. ensureTwoSegments 生效：只回一段 ⇒ 結果含 OUTBOUND_HEADER。
 */

import { describe, it, expect } from 'vitest'
import {
  createSmartReplyAgent,
  OUTBOUND_HEADER,
  INTERNAL_HEADER,
} from '@/lib/line-agent/partner-group/smart-reply-agent'
import { createAgentLogger } from '@/lib/line-agent/observability/structured-log'
import type {
  DailyCostCap,
  CostCapCheckOutcome,
} from '@/lib/line-agent/observability/daily-cost-cap'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'
import type { VisionNeedBrief } from '@/lib/line-agent/partner-group/vision-need-extraction'
import type { RagIndex } from '@/lib/line-agent/notion/rag-index'

/** Allow-all / blocked cost cap fake — records every spend. */
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

/** Collecting structured logger. */
function makeLog() {
  const lines: string[] = []
  const log = createAgentLogger({ requestId: 'req-test', sink: (l) => lines.push(l) })
  const entries = () => lines.map((l) => JSON.parse(l))
  return { log, entries }
}

/** Empty RAG index ⇒ runRagCaseTool 回 {results:[], note}（決定性、不需真資料）。 */
function emptyRagIndex(): RagIndex {
  return {
    records: [],
    byCaseKey: new Map(),
    bySourceTable: new Map(),
    byArea: new Map(),
    byTheme: new Map(),
  }
}

const DEPS = {
  apiKey: 'sk-ant-test',
  defaultModel: 'claude-default',
  costCap: makeCostCap().costCap,
  webSearchEnabled: false,
}

const BRIEF: VisionNeedBrief = {
  isConversation: true,
  summary: '客人想安排清邁親子三天兩夜',
  knownFacts: ['3 天 2 夜', '兩大一小（小孩 5 歲）'],
  gaps: ['航班時間', '住宿區域'],
}

function makeInput(overrides: Partial<PartnerGroupRespondInput> = {}): PartnerGroupRespondInput {
  const base: PartnerGroupRespondInput = {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '@bot 看一下這張截圖',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    } as PartnerGroupRespondInput['event'],
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: '@bot 看一下這張截圖',
    botDirected: true,
  }
  return { ...base, ...overrides }
}

/** Sequence transport — returns canned jsonValues in order, records every request body. */
function sequenceTransport(jsonValues: unknown[]) {
  const calls: Array<{ url: string; init: RequestInit; body: any }> = []
  let i = 0
  const transport = (async (url: unknown, init: unknown) => {
    const initObj = (init ?? {}) as RequestInit
    calls.push({
      url: String(url),
      init: initObj,
      body: initObj.body ? JSON.parse(initObj.body as string) : undefined,
    })
    const jsonValue = jsonValues[Math.min(i, jsonValues.length - 1)]
    i += 1
    return { ok: true, status: 200, json: async () => jsonValue } as unknown as Response
  }) as unknown as typeof fetch
  return { transport, calls }
}

const TWO_SEGMENT_TEXT = `${OUTBOUND_HEADER}\n清邁三天兩夜建議這樣排。\n\n${INTERNAL_HEADER}\n待確認：航班、住宿。`
const END_TURN_BODY = {
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: TWO_SEGMENT_TEXT }],
  usage: { input_tokens: 100, output_tokens: 50 },
}

const TOOL_USE_BODY = {
  stop_reason: 'tool_use',
  content: [
    { type: 'text', text: '我先查自家案例。' },
    {
      type: 'tool_use',
      id: 'toolu_abc123',
      name: 'search_chiangmai_cases',
      input: { query: '清邁 親子 三天' },
    },
  ],
  usage: { input_tokens: 80, output_tokens: 30 },
}

describe('createSmartReplyAgent — 場景 1：直接 end_turn', () => {
  it('LLM 直接 end_turn ⇒ 兩段輸出、meta.responder==="llm"', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({ ...DEPS, transport })
    const result = await agent(BRIEF, makeInput())

    expect(calls).toHaveLength(1)
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.model).toBe('claude-default')
    expect(result.meta?.degraded).toBeUndefined()
    expect(result.text).toContain(OUTBOUND_HEADER)
    expect(result.text).toContain(INTERNAL_HEADER)
  })

  it('第一則 user message 把 brief 序列化（summary / 已知 / 圖中未提供）', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({ ...DEPS, transport })
    await agent(BRIEF, makeInput())

    const firstUser = calls[0].body.messages[0]
    expect(firstUser.role).toBe('user')
    expect(firstUser.content).toContain(BRIEF.summary)
    expect(firstUser.content).toContain('3 天 2 夜')
    expect(firstUser.content).toContain('航班時間')
  })
})

describe('createSmartReplyAgent — 場景 2：RAG client tool 一輪後 end_turn', () => {
  it('第 2 次 POST 的 messages 尾端含對應 tool_use_id 的 tool_result，最終兩段', async () => {
    const { transport, calls } = sequenceTransport([TOOL_USE_BODY, END_TURN_BODY])
    const agent = createSmartReplyAgent({
      ...DEPS,
      transport,
      getRagIndex: async () => emptyRagIndex(),
    })
    const result = await agent(BRIEF, makeInput())

    expect(calls).toHaveLength(2)
    // 第 2 次 POST 帶 assistant（tool_use）＋ user（tool_result）
    const secondMessages = calls[1].body.messages
    const lastUser = secondMessages[secondMessages.length - 1]
    expect(lastUser.role).toBe('user')
    const toolResultBlock = lastUser.content.find((b: any) => b.type === 'tool_result')
    expect(toolResultBlock).toBeDefined()
    expect(toolResultBlock.tool_use_id).toBe('toolu_abc123')
    expect(typeof toolResultBlock.content).toBe('string') // JSON.stringify(result)

    // assistant turn（tool_use）也被回填
    const assistantTurn = secondMessages.find((m: any) => m.role === 'assistant')
    expect(assistantTurn).toBeDefined()

    expect(result.meta?.responder).toBe('llm')
    expect(result.text).toContain(OUTBOUND_HEADER)
    expect(result.text).toContain(INTERNAL_HEADER)
  })

  it('getRagIndex 注入 ⇒ 第 1 次 POST tools 含 search_chiangmai_cases', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({
      ...DEPS,
      transport,
      getRagIndex: async () => emptyRagIndex(),
    })
    await agent(BRIEF, makeInput())

    const toolNames = (calls[0].body.tools ?? []).map((t: any) => t.name)
    expect(toolNames).toContain('search_chiangmai_cases')
  })
})

describe('createSmartReplyAgent — 場景 3：web_search server tool 掛載收窄', () => {
  it('webSearchEnabled=true + botDirected + partner group ⇒ tools 含 web_search_20250305', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({ ...DEPS, transport, webSearchEnabled: true })
    await agent(BRIEF, makeInput())

    const tools = calls[0].body.tools ?? []
    expect(tools.some((t: any) => t.type === 'web_search_20250305')).toBe(true)
  })

  it('channel=line_oa ⇒ 不掛 web_search（OA 永不）', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({ ...DEPS, transport, webSearchEnabled: true })
    const input = makeInput()
    input.event.sourceChannel = 'line_oa'
    await agent(BRIEF, input)

    const tools = calls[0].body.tools ?? []
    expect(tools.some((t: any) => t.type === 'web_search_20250305')).toBe(false)
  })

  it('非 botDirected ⇒ 不掛 web_search', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({ ...DEPS, transport, webSearchEnabled: true })
    const input = makeInput({ botDirected: false })
    input.event.mentionsBot = false
    await agent(BRIEF, input)

    const tools = calls[0].body.tools ?? []
    expect(tools.some((t: any) => t.type === 'web_search_20250305')).toBe(false)
  })
})

describe('createSmartReplyAgent — 場景 4：RAG 未注入', () => {
  it('getRagIndex undefined ⇒ tools 不含 search_chiangmai_cases', async () => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const agent = createSmartReplyAgent({ ...DEPS, transport })
    await agent(BRIEF, makeInput())

    const toolNames = (calls[0].body.tools ?? []).map((t: any) => t.name)
    expect(toolNames).not.toContain('search_chiangmai_cases')
  })
})

describe('createSmartReplyAgent — 場景 5：cost cap 非 ok', () => {
  it.each([
    ['over_cap', 'cost_cap_exceeded'],
    ['disabled', 'cost_cap_disabled'],
    ['kv_unavailable', 'cost_cap_kv_unavailable'],
  ] as const)('checkBudget=%s ⇒ 不 POST、degrade stub、error=%s', async (outcome, error) => {
    const { transport, calls } = sequenceTransport([END_TURN_BODY])
    const { costCap } = makeCostCap(outcome)
    const agent = createSmartReplyAgent({ ...DEPS, transport, costCap })
    const result = await agent(BRIEF, makeInput())

    expect(calls).toHaveLength(0)
    expect(result.meta?.responder).toBe('stub')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe(error)
  })
})

describe('createSmartReplyAgent — 場景 6：transport throw', () => {
  it('transport throw ⇒ degrade anthropic_api_error，不 throw', async () => {
    const transport = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const agent = createSmartReplyAgent({ ...DEPS, transport })
    const { log, entries } = makeLog()

    const result = await agent(BRIEF, { ...makeInput(), log })

    expect(result.meta?.responder).toBe('stub')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('anthropic_api_error')
    const llm = entries().find((e) => e.event === 'llm_call')
    expect(llm?.degradedReason).toBe('anthropic_api_error')
  })
})

describe('createSmartReplyAgent — 場景 7：MAX_ROUNDS 耗盡', () => {
  it('永遠 tool_use ⇒ 收斂兩段輸出、POST 次數有界、log max_rounds', async () => {
    // 每次都回 tool_use ⇒ 迴圈必須被 MAX_ROUNDS 擋下。
    const { transport, calls } = sequenceTransport([TOOL_USE_BODY])
    const agent = createSmartReplyAgent({
      ...DEPS,
      transport,
      getRagIndex: async () => emptyRagIndex(),
    })
    const { log, entries } = makeLog()

    const result = await agent(BRIEF, { ...makeInput(), log })

    // 不會無限迴圈：POST 次數受 MAX_ROUNDS(4) 上限
    expect(calls.length).toBeGreaterThan(1)
    expect(calls.length).toBeLessThanOrEqual(4)
    expect(result.text).toContain(OUTBOUND_HEADER)
    const llm = entries().find((e) => e.event === 'llm_call' && e.degradedReason === 'max_rounds')
    expect(llm).toBeDefined()
  })
})

describe('createSmartReplyAgent — 場景 8：ensureTwoSegments 生效', () => {
  it('LLM 只回一段 ⇒ 結果含 OUTBOUND_HEADER', async () => {
    const oneSeg = {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '就直接這樣回客人即可。' }],
      usage: { input_tokens: 50, output_tokens: 20 },
    }
    const { transport } = sequenceTransport([oneSeg])
    const agent = createSmartReplyAgent({ ...DEPS, transport })
    const result = await agent(BRIEF, makeInput())

    expect(result.text).toContain(OUTBOUND_HEADER)
    expect(result.text).toContain('就直接這樣回客人即可。')
  })
})
