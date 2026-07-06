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
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY,
  withIntenseActivity,
} from '@/lib/line-agent/notion/__fixtures__/customer-itinerary-golden'
import type { ItineraryCaseProfile } from '@/lib/line-agent/notion/customer-itinerary-gate'
import type { ItineraryReferenceResult } from '@/lib/line-agent/notion/itinerary-reference-source'

const REFERENCE_MARKER = '【排行程參考骨架】'
const GOLDEN_FORCE_COPY_MARKER = '【最相符 golden 範本｜強制照抄】'
const SKELETON = '<家庭套餐訂製> 清邁親子骨架\nDay 1｜古城慢遊\n・參觀寺廟'

/**
 * 合併刀（M-2）：itineraryReferenceSource 一次回 { skeleton, source, profile } —
 * 同一 turn 不對 retrieval 打兩次。預設真案例命中、無 profile（中性閘）。
 */
function makeRef(overrides: Partial<ItineraryReferenceResult> = {}): ItineraryReferenceResult {
  return { skeleton: SKELETON, source: 'case', profile: null, ...overrides }
}

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

// ── 第4刀：golden 命中 ⇒ 強制照抄＋四防（取代軟性「參考骨架」段）─────────────
describe('buildPartnerGroupSystemPrompt — golden 強制照抄＋四防（第4刀）', () => {
  it('itineraryReferenceSource=golden ⇒ 注入「強制照抄」段（非軟性參考段）', () => {
    const prompt = buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
      itineraryReference: SKELETON,
      itineraryReferenceSource: 'golden',
    })
    expect(prompt.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
    // 強制照抄段（golden 專屬），含骨架原文
    expect(prompt).toContain(GOLDEN_FORCE_COPY_MARKER)
    expect(prompt).toContain(SKELETON)
    // golden 是「直接照抄、只換 header」——軟性「不得照抄日期或人名」必須消失
    expect(prompt).not.toContain('不得照抄日期或人名')
    expect(prompt).toContain('customer_itinerary_v1')
  })

  it('golden 段含四防：①防瞎造航班 ②防漏點 ③防越權改寫 ④防 markdown', () => {
    const prompt = buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
      itineraryReference: SKELETON,
      itineraryReferenceSource: 'golden',
    })
    // 強制照抄＋只換日期/人數 header
    expect(prompt).toContain('只替換')
    expect(prompt).toMatch(/人數.*header|header.*人數/)
    // 防① 瞎造航班：航班只能照範本、沒有就標待確認、不得自編
    expect(prompt).toMatch(/航班.*待確認|待確認.*航班/)
    expect(prompt).toContain('不得自行編造航班')
    // 防② 漏點：客人點名項目逐項覆蓋
    expect(prompt).toContain('逐項覆蓋')
    // 防③ 越權改寫：行程正文不得自行優化/改寫
    expect(prompt).toContain('不得自行優化或改寫')
    // 防④ markdown：不可原樣輸出 markdown 記號，須轉純文字 v1
    expect(prompt).toContain('markdown')
    expect(prompt).toMatch(/純文字/)
    // 最終仍須過格式檢查（fail-closed）
    expect(prompt).toContain('格式檢查')
  })

  it('非 golden（case/template/省略）⇒ 維持現行軟性參考段（byte-identical 行為）', () => {
    const generic = buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
      itineraryReference: SKELETON,
    })
    for (const src of ['case', 'template'] as const) {
      const withSrc = buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
        itineraryReference: SKELETON,
        itineraryReferenceSource: src,
      })
      expect(withSrc).toBe(generic)
    }
    // 軟性段該有的字樣仍在、強制照抄段不得出現
    expect(generic).toContain('不得照抄日期或人名')
    expect(generic).not.toContain(GOLDEN_FORCE_COPY_MARKER)
  })

  it('golden source 但無 skeleton（空白）⇒ 不注入任何 reference 段', () => {
    const prompt = buildPartnerGroupSystemPrompt(makeSystemInput(), null, {
      itineraryReference: '   ',
      itineraryReferenceSource: 'golden',
    })
    expect(prompt).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
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

describe('AnthropicPartnerGroupResponder — 排行程 reference 注入（合併刀 M-2）', () => {
  it('DRAFT intent ＋注入 itineraryReferenceSource ⇒ system 含骨架', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => makeRef(),
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).toContain(REFERENCE_MARKER)
    expect(body.system).toContain(SKELETON)
    expect(body.system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
  })

  it('source 收到的 need === input.text（選取合約釘死，item6）', async () => {
    const { transport } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const itineraryReferenceSource = vi.fn(async () => makeRef())
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource,
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    expect(itineraryReferenceSource).toHaveBeenCalledTimes(1)
    expect(itineraryReferenceSource).toHaveBeenCalledWith('排個李家7天行程')
  })

  it('NON-draft intent（analyze）⇒ source 不被諮詢、system 無骨架', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const itineraryReferenceSource = vi.fn(async () => makeRef())
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
    // 無骨架（reference cut 的關注點）；draft 路另含日期區塊（年份 bug 2026-06-17），
    // 故不再 byte-identical 到裸 persona，改驗「以 persona 開頭＋無骨架」。
    expect(body.system).not.toContain(REFERENCE_MARKER)
    expect(body.system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
    expect(entries().some((e) => e.event === 'itinerary_reference_unavailable')).toBe(true)
  })

  it('source 回 null ⇒ system 無骨架（draft 另含日期區塊，非裸 persona）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => null,
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    const system = JSON.parse(calls[0].init.body as string).system
    expect(system).not.toContain(REFERENCE_MARKER)
    expect(system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
  })

  it('未注入 source（draft）⇒ 行為不變、system 以 persona 開頭且無骨架', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    const system = JSON.parse(calls[0].init.body as string).system
    expect(system).not.toContain(REFERENCE_MARKER)
    expect(system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
  })

  // 第4刀：source=golden 命中 ⇒ responder 把來源訊號接進 system，改用強制照抄段。
  it('source=golden ⇒ system 改用「強制照抄」段（非軟性參考段）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => makeRef({ source: 'golden' }),
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    const system = JSON.parse(calls[0].init.body as string).system
    expect(system).toContain(GOLDEN_FORCE_COPY_MARKER)
    expect(system).not.toContain('不得照抄日期或人名')
    expect(system).toContain('不得自行編造航班')
    expect(system).toContain('逐項覆蓋')
  })

  it('source=case ⇒ system 維持軟性參考段（不觸發強制照抄）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => makeRef({ source: 'case' }),
    })

    await responder.respond(makeInput('draft', '排個李家7天行程'))

    const system = JSON.parse(calls[0].init.body as string).system
    expect(system).toContain(REFERENCE_MARKER)
    expect(system).not.toContain(GOLDEN_FORCE_COPY_MARKER)
  })
})

// ── M-1：案例/範本來源訊號入 log（調語料涵蓋率的關鍵訊號）──────────────────
describe('AnthropicPartnerGroupResponder — reference 來源訊號入 log（M-1）', () => {
  it('命中真案例 ⇒ itinerary_reference log 帶 referenceSource=case', async () => {
    const { transport } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => makeRef({ source: 'case' }),
    })
    const { log, entries } = makeLog()

    await responder.respond({ ...makeInput('draft', '排個李家7天行程'), log })

    const ref = entries().find((e) => e.event === 'itinerary_reference')
    expect(ref?.referenceSource).toBe('case')
  })

  it('退手工範本 ⇒ itinerary_reference log 帶 referenceSource=template', async () => {
    const { transport } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => makeRef({ source: 'template' }),
    })
    const { log, entries } = makeLog()

    await responder.respond({ ...makeInput('draft', '排個李家7天行程'), log })

    const ref = entries().find((e) => e.event === 'itinerary_reference')
    expect(ref?.referenceSource).toBe('template')
  })

  it('source 回 null ⇒ 不發 itinerary_reference log', async () => {
    const { transport } = fakeTransport({ jsonValue: GOLDEN_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => null,
    })
    const { log, entries } = makeLog()

    await responder.respond({ ...makeInput('draft', '排個李家7天行程'), log })

    expect(entries().some((e) => e.event === 'itinerary_reference')).toBe(false)
  })
})

// ── 本案 profile 餵 per-case lint 規則（合併進同一 source 的 profile 欄）─────────
// 同一份「含叢林飛索」草稿：profile=null ⇒ 中性閘放行（mobility 規則不開）；
// source 回 limited-mobility profile ⇒ 真規則生效、閘擋下 → 重產→降級。證明
// profile 確實到達 gate；no-source / non-draft / throw / null ⇒ 全部 fail-open。
const ZIPLINE_DRAFT = withIntenseActivity('叢林飛索')
const ZIPLINE_BODY = { content: [{ type: 'text', text: ZIPLINE_DRAFT }] }
const LIMITED_MOBILITY_PROFILE: ItineraryCaseProfile = {
  mobility: { type: 'limited_mobility_wheelchair_assisted' },
  stayArea: 'chiangmai_old_city',
  sameLodgingAllTrip: true,
}

describe('AnthropicPartnerGroupResponder — 本案 profile 餵 per-case lint（合併 source.profile）', () => {
  it('DRAFT＋source.profile=limited-mobility ⇒ 草稿含叢林飛索被閘擋 → 降級', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: ZIPLINE_BODY })
    const itineraryReferenceSource = vi.fn(async () =>
      makeRef({ profile: LIMITED_MOBILITY_PROFILE })
    )
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource,
    })

    const result = await responder.respond(makeInput('draft', '排個李家7天行程'))

    // 合併刀：一個 turn 只諮詢 source 一次（reference + profile 同回）。
    expect(itineraryReferenceSource).toHaveBeenCalledTimes(1)
    // 第一次過不了閘 → 重產一次（fake 同回應仍失敗）→ 共兩次呼叫、降級保留原文。
    expect(calls).toHaveLength(2)
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('itinerary_gate_failed')
  })

  it('未注入 source（同一份含叢林飛索草稿）⇒ 中性閘放行（fail-open，零變化）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: ZIPLINE_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    const result = await responder.respond(makeInput('draft', '排個李家7天行程'))

    expect(calls).toHaveLength(1)
    expect(result.meta?.degraded).toBeUndefined()
    expect(result.meta?.responder).toBe('llm')
  })

  it('source.profile=null ⇒ 中性閘放行（與無 profile 等價）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: ZIPLINE_BODY })
    const responder = new AnthropicPartnerGroupResponder({
      transport,
      ...DEPS,
      itineraryReferenceSource: async () => makeRef({ profile: null }),
    })

    const result = await responder.respond(makeInput('draft', '排個李家7天行程'))

    expect(calls).toHaveLength(1)
    expect(result.meta?.degraded).toBeUndefined()
  })
})
