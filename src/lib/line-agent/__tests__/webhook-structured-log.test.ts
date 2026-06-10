/**
 * P0-A 刀 2 — webhook 鏈 structured log + requestId 貫穿（design
 * docs/plans/2026-06-10-p0a-cut2-minimal-observability-design.md）。
 *
 * 契約：
 *  - defaultEventHandler 每個 inbound event 生成一個 requestId，該事件產生的
 *    所有 log 行共享同一 id；不同 event 不同 id。
 *  - 事件：webhook_received（channel/messageKind/botDirected）、
 *    route_decision（dispatcher path）、reply_sent / reply_skipped（reason code）、
 *    store_write_failed（bookkeeping 失敗，code-only）。
 *  - 收編後 webhook 鏈不再裸 console.*（error 細節絕不進 log — 只有 code）。
 *  - sink 注入走 setDefaultAgentLogSink（module seam，測試後還原）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  getEventHandler,
  setPartnerGroupResponder,
  getPartnerGroupResponder,
  setReplyClient,
  getReplyClient,
} from '../line/webhook-runtime'
import { setDefaultAgentLogSink } from '../observability/structured-log'
import { createPartnerGroupResponderWithRagDraft } from '../partner-group/responder-factory'
import { createAgentLogger } from '../observability/structured-log'
import { MemoryStore } from '../storage/memory-store'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
} from '../partner-group/responder'

const pristineResponder = getPartnerGroupResponder()
const pristineReplyClient = getReplyClient()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
  setReplyClient(pristineReplyClient)
  setDefaultAgentLogSink(null)
})

function taggedPartnerGroupEvent(
  overrides: Partial<NormalizedLineEvent> = {},
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: '@bot 請幫我確認',
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
    replyToken: 'reply_token_xyz',
    ...overrides,
  }
}

function oaEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'oa_text',
    sourceChannel: 'line_oa',
    lineUserId: 'U_customer',
    messageId: 'M_oa_001',
    text: 'hi',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    replyToken: 'oa_reply_token',
    ...overrides,
  }
}

function collectLogs() {
  const lines: string[] = []
  setDefaultAgentLogSink((line) => lines.push(line))
  const entries = () => lines.map((l) => JSON.parse(l))
  return { entries }
}

const fakeResponder: PartnerGroupResponder = {
  async respond() {
    return { text: '夥伴回覆草稿', meta: { responder: 'stub' } }
  },
}

const okReplyClient = async () => ['SENT_1']

describe('webhook structured log — requestId 貫穿', () => {
  it('a tagged partner-group event logs webhook_received + reply_sent sharing ONE requestId', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(okReplyClient)

    await getEventHandler()(taggedPartnerGroupEvent(), new MemoryStore())

    const received = entries().find((e) => e.event === 'webhook_received')
    expect(received?.channel).toBe('partner_group')
    expect(received?.messageKind).toBe('group_text')
    expect(received?.botDirected).toBe(true)

    const sent = entries().find((e) => e.event === 'reply_sent')
    expect(sent?.sendOutcome).toBe('ok')

    expect(received?.requestId).toBeTruthy()
    expect(sent?.requestId).toBe(received?.requestId)
  })

  it('two events get two DIFFERENT requestIds', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(okReplyClient)
    const store = new MemoryStore()

    await getEventHandler()(taggedPartnerGroupEvent({ messageId: 'M_a' }), store)
    await getEventHandler()(taggedPartnerGroupEvent({ messageId: 'M_b' }), store)

    const ids = entries()
      .filter((e) => e.event === 'webhook_received')
      .map((e) => e.requestId)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('an OA event logs webhook_received channel=oa and reply_skipped reason=not_reply_candidate（不自動回客結構不變）', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(okReplyClient)

    await getEventHandler()(oaEvent(), new MemoryStore())

    expect(entries().find((e) => e.event === 'webhook_received')?.channel).toBe('oa')
    const skipped = entries().find((e) => e.event === 'reply_skipped')
    expect(skipped?.reason).toBe('not_reply_candidate')
    expect(entries().find((e) => e.event === 'reply_sent')).toBeUndefined()
  })

  it('a lost duplicate claim logs reply_skipped reason=duplicate_claim', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(okReplyClient)
    const store = new MemoryStore()
    await store.claimPartnerReply('M001') // 先被別的 instance claim 走

    await getEventHandler()(taggedPartnerGroupEvent(), store)

    expect(entries().find((e) => e.event === 'reply_skipped')?.reason).toBe(
      'duplicate_claim',
    )
  })

  it('a reply client failure logs reply_sent sendOutcome=error reason=line_reply_failed — code only, no raw error text', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(async () => {
      throw new Error('LINE 500 token=SECRET_TOKEN')
    })

    await getEventHandler()(taggedPartnerGroupEvent(), new MemoryStore())

    const sent = entries().find((e) => e.event === 'reply_sent')
    expect(sent?.sendOutcome).toBe('error')
    expect(sent?.reason).toBe('line_reply_failed')
    expect(JSON.stringify(entries())).not.toContain('SECRET_TOKEN')
  })

  it('a missing reply token on a respond decision logs reply_skipped reason=missing_reply_token', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(okReplyClient)

    await getEventHandler()(
      taggedPartnerGroupEvent({ replyToken: undefined }),
      new MemoryStore(),
    )

    expect(entries().find((e) => e.event === 'reply_skipped')?.reason).toBe(
      'missing_reply_token',
    )
  })

  it('a bot-msg bookkeeping failure logs store_write_failed（reply already sent — not dropped）', async () => {
    const { entries } = collectLogs()
    setPartnerGroupResponder(fakeResponder)
    setReplyClient(okReplyClient)
    const store = new MemoryStore()
    store.putBotAuthoredPartnerMsg = async () => {
      throw new Error('kv write failed url=https://secret.upstash.io')
    }

    await getEventHandler()(taggedPartnerGroupEvent(), store)

    expect(entries().find((e) => e.event === 'reply_sent')?.sendOutcome).toBe('ok')
    const failed = entries().find((e) => e.event === 'store_write_failed')
    expect(failed?.reason).toBe('bot_msg_record_failed')
    expect(JSON.stringify(entries())).not.toContain('secret.upstash.io')
  })
})

describe('anti-leak regression lock — log lines are masked by construction', () => {
  it('a full partner-group send with PII-laden message text leaks NOTHING into the log lines', async () => {
    const { entries } = collectLogs()
    // 訊息原文塞滿禁字：姓名/電話/航班/金額/內部字眼
    const piiText = '@bot 客人王小明 0912345678 BR257 報價 42000 成本 31000'
    setPartnerGroupResponder({
      async respond() {
        return { text: '【夥伴群草稿】回覆王小明：BR257 接機安排…', meta: { responder: 'stub' } }
      },
    })
    setReplyClient(okReplyClient)

    await getEventHandler()(taggedPartnerGroupEvent({ text: piiText }), new MemoryStore())

    const allLines = JSON.stringify(entries())
    // 訊息原文與回覆內文都不得出現在任何 log 行（closed field shapes）
    for (const forbidden of ['王小明', '0912345678', 'BR257', '42000', '31000', '夥伴群草稿']) {
      expect(allLines).not.toContain(forbidden)
    }
    // trace 本身存在（不是因為沒 log 而「乾淨」）
    expect(entries().some((e) => e.event === 'webhook_received')).toBe(true)
    expect(entries().some((e) => e.event === 'reply_sent')).toBe(true)
  })
})

describe('dispatcher route_decision log', () => {
  function makeRespondInput(log: ReturnType<typeof createAgentLogger>): PartnerGroupRespondInput {
    const event = taggedPartnerGroupEvent()
    return {
      event,
      intent: { action: 'analyze', confidence: 'high', source: 'llm' },
      text: event.text ?? '',
      botDirected: true,
      log,
    }
  }

  it('logs route_decision path=base when no rag/quoted path applies（gate off）', async () => {
    const lines: string[] = []
    const log = createAgentLogger({ requestId: 'req-d', sink: (l) => lines.push(l) })
    const dispatcher = createPartnerGroupResponderWithRagDraft({
      base: fakeResponder,
      answerSource: async () => {
        throw new Error('must not be called')
      },
      env: {}, // 兩閘全關
    })

    await dispatcher.respond(makeRespondInput(log))

    const entry = lines.map((l) => JSON.parse(l)).find((e) => e.event === 'route_decision')
    expect(entry?.path).toBe('base')
    expect(entry?.ragDraftGate).toBe('disabled')
  })

  it('logs route_decision path=rag_composer when both gates are on and intent matches', async () => {
    const lines: string[] = []
    const log = createAgentLogger({ requestId: 'req-r', sink: (l) => lines.push(l) })
    const dispatcher = createPartnerGroupResponderWithRagDraft({
      base: fakeResponder,
      answerSource: async () => ({ text: '內部過往案例傾向：…' }),
      env: {
        AI_AGENT_NOTION_RAG_ENABLED: 'true',
        AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
      },
    })

    const input = makeRespondInput(log)
    await dispatcher.respond({ ...input, text: '幫我查內部案例：清邁 親子' })

    const entry = lines.map((l) => JSON.parse(l)).find((e) => e.event === 'route_decision')
    expect(entry?.path).toBe('rag_composer')
    expect(entry?.ragDraftGate).toBe('enabled')
  })
})
