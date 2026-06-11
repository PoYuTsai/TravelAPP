/**
 * distill-webhook.test.ts — 沉澱刀2 webhook 接線（Task 8）.
 *
 * 鎖住 AI_AGENT_DISTILL_ENABLED 閘住的 lazy distill seam：
 *   1. 閘未設（default off）→ routeCommand 收不到 distill seam —「@bot 沉澱」
 *      走 responder 路徑，ship 零行為改變
 *   2. 閘開＋key 齊 →「@bot 沉澱」→ reply client 收到候選清單文字（📚 開頭）
 *   3. 閘開＋ANTHROPIC_API_KEY 缺 → seam 不注入（形同閘關）、一行 fixed-code
 *      log、不炸 webhook
 *   4. parse-first 契約（Task 7 review 點名）：普通 botDirected 文字 → approve
 *      純函式短路、store 零讀取 — KV 故障絕不劫持日常問答
 *   5. 批准語句「@bot 1 3 要」（pending batch 預置）→ 批准 ack（含 dry-run 註記）
 *   6. 沉澱回覆送出後照常 putBotAuthoredPartnerMsg — Eric 之後 quote 候選清單
 *      回「1 3 要」免重 tag（既有 step 6 邏輯，測試固定它）
 *
 * 全部用 MemoryStore＋fake source/responder/reply client — 零網路、零真 key。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getEventHandler,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
  getReplyClient,
  setReplyClient,
  setDistillSource,
  setDistilledQaWriter,
  type ReplyClient,
} from '../line/webhook-runtime'
import { MemoryStore } from '../storage/memory-store'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { PartnerGroupResponder } from '../partner-group/responder'
import type { TranscriptEntry } from '../transcript/transcript-entry'
import type { DistillCandidate } from '../distill/pending'
import type { DistilledQaWriter } from '../distill/distilled-qa-writer'
import { setDefaultAgentLogSink } from '../observability/structured-log'
import type { LineMessage } from '../line/message-client'

// Capture the pristine lazy defaults BEFORE any injection so afterEach can
// restore them — the seams are module singletons and would otherwise leak.
const pristineResponder = getPartnerGroupResponder()
const pristineReplyClient = getReplyClient()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
  setReplyClient(pristineReplyClient)
  setDistillSource(null) // null ⇒ 重置回 lazy default — singleton 不串味
  // 同時重置 test override 與 config 終態 off cache（null）— 回 undefined 未解析
  setDistilledQaWriter(null) // 刀3 writer 同理 — lazy cache（含「definitively off」）不串味
  setDefaultAgentLogSink(null)
  vi.doUnmock('../line/install-default-distilled-qa-writer') // test 11 的 doMock 不殘留
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ID = 'G_partner'

function groupEvent(
  text: string,
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: GROUP_ID,
    messageId: 'M_distill_1',
    text,
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
    replyToken: 'rt_distill',
    ...overrides,
  }
}

function transcriptEntry(o: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    messageId: 'M_t1',
    groupId: GROUP_ID,
    lineUserId: 'U_min',
    timestamp: 1_700_000_000_000,
    kind: 'text',
    text: '清邁包車一天多少？',
    ...o,
  }
}

function pendingCandidate(id: number): DistillCandidate {
  return {
    id,
    question: `Q${id}`,
    answer: `A${id}`,
    sourceMessageIds: [],
    occurrences: 2,
    status: 'pending',
    missedCount: 0,
  }
}

function recordingReplyClient(returnIds: string[] = []): {
  client: ReplyClient
  calls: Array<{ replyToken: string; messages: LineMessage[] }>
} {
  const calls: Array<{ replyToken: string; messages: LineMessage[] }> = []
  const client: ReplyClient = async (replyToken, messages) => {
    calls.push({ replyToken, messages })
    return returnIds
  }
  return { client, calls }
}

function fixedResponder(text: string): PartnerGroupResponder {
  return {
    async respond() {
      return { text, meta: { responder: 'llm' as const } }
    },
  }
}

/** Fake LLM source — 一條合法候選 JSON（zero-trust parser 收得下）。 */
const ONE_CANDIDATE_JSON = JSON.stringify([
  {
    question: '清邁包車一天多少',
    answer: '一天 2500 泰銖',
    sourceLines: [1],
    occurrences: 2,
  },
])

// ---------------------------------------------------------------------------
// 沉澱刀2 — webhook distill seam 接線
// ---------------------------------------------------------------------------

describe('webhook distill seam（沉澱刀2 接線）', () => {
  it('1. 閘未設（default）→ distill 路徑不存在 —「@bot 沉澱」走 responder（零行為改變）', async () => {
    const store = new MemoryStore()
    await store.putTranscriptEntry(transcriptEntry())
    setPartnerGroupResponder(fixedResponder('RESPONDER-TEXT'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    // seam 若被注入，source 一被呼叫就炸 — 守住「閘關零注入」
    setDistillSource(async () => {
      throw new Error('distill source must not run when gate is off')
    })

    await getEventHandler()(groupEvent('@bot 沉澱'), store)

    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].text).toBe('RESPONDER-TEXT')
  })

  it('2. 閘開＋key 齊 →「@bot 沉澱」→ reply client 收到候選清單（📚 開頭）', async () => {
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const store = new MemoryStore()
    await store.putTranscriptEntry(transcriptEntry())
    setDistillSource(async () => ONE_CANDIDATE_JSON)
    const { client, calls } = recordingReplyClient(['M_bot_list'])
    setReplyClient(client)

    await getEventHandler()(groupEvent('@bot 沉澱'), store)

    expect(calls).toHaveLength(1)
    const text = calls[0].messages[0].text
    expect(text.startsWith('📚')).toBe(true)
    expect(text).toContain('清邁包車一天多少')
    // 沉澱有跑：pending batch 落地、transcript 標 distilled
    expect((await store.getDistillPending(GROUP_ID))?.candidates).toHaveLength(1)
    expect((await store.getTranscriptEntry('M_t1'))?.distilled).toBe(true)
  })

  it('3. 閘開＋ANTHROPIC_API_KEY 缺 → seam 不注入（形同閘關）、一行 fixed code、不炸', async () => {
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', '') // 防宿主環境殘留 — 視同缺 key
    const store = new MemoryStore()
    await store.putTranscriptEntry(transcriptEntry())
    setPartnerGroupResponder(fixedResponder('RESPONDER-TEXT'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const lines: string[] = []
    setDefaultAgentLogSink((l) => lines.push(l))

    await expect(
      getEventHandler()(groupEvent('@bot 沉澱'), store)
    ).resolves.toBeUndefined()

    // 落回 responder（形同閘關）＋一行可追的 fixed code
    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].text).toBe('RESPONDER-TEXT')
    expect(lines.some((l) => l.includes('distill_api_key_missing'))).toBe(true)
  })

  it('4. parse-first 契約：普通 botDirected 文字 → approve 短路、store 零讀取、落回 responder', async () => {
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const store = new MemoryStore()
    const getPendingSpy = vi.fn(store.getDistillPending.bind(store))
    store.getDistillPending = getPendingSpy
    setPartnerGroupResponder(fixedResponder('RESPONDER-TEXT'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(groupEvent('@bot 今天行程怎麼排'), store)

    // 純函式 parseDistillApproval 先擋 — KV 故障不劫持日常問答
    expect(getPendingSpy).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].text).toBe('RESPONDER-TEXT')
  })

  it('5. 批准語句「@bot 1 3 要」（pending batch 預置）→ 批准 ack（含 dry-run 註記）', async () => {
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP_ID,
      createdAt: 1_700_000_000_000,
      candidates: [pendingCandidate(1), pendingCandidate(2), pendingCandidate(3)],
      resolved: [],
    })
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(groupEvent('@bot 1 3 要'), store)

    expect(calls).toHaveLength(1)
    const text = calls[0].messages[0].text
    expect(text).toContain('✅ 已收：1、3')
    expect(text).toContain('仍掛著：2')
    expect(text).toContain('dry-run')
    // 狀態真的落地：1、3 → resolved，2 留在 candidates（id 不重編）
    const batch = await store.getDistillPending(GROUP_ID)
    expect(batch?.candidates.map((c) => c.id)).toEqual([2])
    expect(batch?.resolved.map((c) => c.id)).toEqual([1, 3])
  })

  it('6. 沉澱回覆送出後照常 putBotAuthoredPartnerMsg（quote 清單回「1 3 要」免重 tag）', async () => {
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    const store = new MemoryStore()
    await store.putTranscriptEntry(transcriptEntry())
    setDistillSource(async () => ONE_CANDIDATE_JSON)
    const { client } = recordingReplyClient(['M_bot_list'])
    setReplyClient(client)

    await getEventHandler()(groupEvent('@bot 沉澱'), store)

    // 既有 step 6 邏輯自動涵蓋 — 固定它：清單訊息被記成 bot-authored＋快取內文
    expect(await store.isBotAuthoredPartnerMsg('M_bot_list')).toBe(true)
    expect(
      (await store.getBotAuthoredPartnerMsgContent('M_bot_list'))?.startsWith('📚')
    ).toBe(true)
  })

  it('7. OA 客訊 → seam builder 不跑 — 閘開＋key 缺的錯誤部署下零 distill log 噪音', async () => {
    // 重現 review 點名的場景：閘開＋key 缺。夥伴群事件會印一行
    // distill_api_key_missing（test 3）；OA 客訊則必須一行都沒有 —
    // sourceChannel 短路讓 getDistillSeams 對 OA 面根本不執行。
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const store = new MemoryStore()
    const lines: string[] = []
    setDefaultAgentLogSink((l) => lines.push(l))

    await getEventHandler()(
      groupEvent('hi', {
        kind: 'oa_text',
        sourceChannel: 'line_oa',
        groupId: undefined,
        mentionsBot: false,
      }),
      store
    )

    expect(lines.some((l) => l.includes('distill_api_key_missing'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 沉澱刀3 — KNOWLEDGE_WRITE_ENABLED 閘住的 lazy knowledge writer
// ---------------------------------------------------------------------------

describe('webhook knowledge writer seam（沉澱刀3 接線）', () => {
  /** 批准語句要走到 approve seam 的前置：distill 閘＋key 齊。 */
  function distillGateOn(): void {
    vi.stubEnv('AI_AGENT_DISTILL_ENABLED', 'true')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
  }

  async function presetBatch(store: MemoryStore): Promise<void> {
    await store.putDistillPending({
      groupId: GROUP_ID,
      createdAt: 1_700_000_000_000,
      candidates: [pendingCandidate(1), pendingCandidate(2), pendingCandidate(3)],
      resolved: [],
    })
  }

  it('8. KNOWLEDGE_WRITE_ENABLED 未設＋批准 → ack 仍 dry-run 文案（刀2 零行為改變）', async () => {
    distillGateOn()
    vi.stubEnv('KNOWLEDGE_WRITE_ENABLED', '') // 防宿主環境殘留 — 視同未設
    const store = new MemoryStore()
    await presetBatch(store)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(groupEvent('@bot 1 3 要'), store)

    expect(calls).toHaveLength(1)
    const text = calls[0].messages[0].text
    expect(text).toContain('（dry-run：刀3 開閘後才寫入 Notion）')
    expect(text).not.toContain('已寫入 Notion')
  })

  it('9. setDistilledQaWriter 注入 fake → ack 含「已寫入 Notion 知識庫」；重置後不串味', async () => {
    distillGateOn()
    const written: number[] = []
    const fakeWriter: DistilledQaWriter = {
      async write(candidate) {
        written.push(candidate.id)
        return `page_${candidate.id}`
      },
    }
    setDistilledQaWriter(fakeWriter)
    const store = new MemoryStore()
    await presetBatch(store)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(groupEvent('@bot 1 3 要'), store)

    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].text).toContain('📥 已寫入 Notion 知識庫 2 條')
    expect(calls[0].messages[0].text).not.toContain('dry-run')
    expect(written).toEqual([1, 3])
    // flush 落標：resolved 兩條都帶 notionPageId（冪等標記）
    const batch = await store.getDistillPending(GROUP_ID)
    expect(batch?.resolved.map((c) => c.notionPageId)).toEqual(['page_1', 'page_3'])

    // 重置（teardown 語意）：回 lazy default — 閘未設 ⇒ 下一則批准回 dry-run
    setDistilledQaWriter(null)
    vi.stubEnv('KNOWLEDGE_WRITE_ENABLED', '')
    await getEventHandler()(
      // 換 messageId — claimPartnerReply 對同 id 的重投遞會 dedup
      groupEvent('@bot 2 要', { messageId: 'M_distill_2', replyToken: 'rt_d2' }),
      store
    )
    expect(calls).toHaveLength(2)
    expect(calls[1].messages[0].text).toContain('（dry-run：刀3 開閘後才寫入 Notion）')
    expect(written).toEqual([1, 3]) // fake writer 不再被呼叫 — 不串味
  })

  it('10. 閘開但 writer build 回 reason → 一行 fixed code、ack 仍 dry-run、不炸 webhook', async () => {
    distillGateOn()
    vi.stubEnv('KNOWLEDGE_WRITE_ENABLED', 'true')
    vi.stubEnv('NOTION_KNOWLEDGE_TOKEN', '') // 缺 token — build 回 fixed reason
    vi.stubEnv('NOTION_DISTILLED_QA_DB', '')
    const store = new MemoryStore()
    await presetBatch(store)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const lines: string[] = []
    setDefaultAgentLogSink((l) => lines.push(l))

    await expect(
      getEventHandler()(groupEvent('@bot 1 3 要'), store)
    ).resolves.toBeUndefined()

    // 形同閘關：ack 仍 dry-run 文案＋一行可追的 fixed code
    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].text).toContain('（dry-run：刀3 開閘後才寫入 Notion）')
    expect(
      lines.some((l) => l.includes('distill_write_missing_knowledge_token'))
    ).toBe(true)
  })

  it('11. sdk_init_failed 不 cache 終態 — 第一則批准 dry-run＋log，修復後同 instance 第二則批准會寫入', async () => {
    distillGateOn()
    vi.stubEnv('KNOWLEDGE_WRITE_ENABLED', 'true')
    vi.stubEnv('NOTION_KNOWLEDGE_TOKEN', 'secret_test')
    vi.stubEnv('NOTION_DISTILLED_QA_DB', 'db_test')
    // Mock composition root（webhook 的 dynamic import 會命中同一 resolved
    // module）：factory 讀 closure 變數 — 先回 transient 失敗，「修復」後回
    // 可用 fake writer。若 sdk_init_failed 被 cache 成終態 null，第二則批准
    // 根本不會重呼叫 build，永遠停在 dry-run — 本測試就會抓到。
    const written: number[] = []
    const fakeWriter: DistilledQaWriter = {
      async write(candidate) {
        written.push(candidate.id)
        return `page_${candidate.id}`
      },
    }
    let buildResult: { reason?: 'sdk_init_failed'; writer?: DistilledQaWriter } = {
      reason: 'sdk_init_failed',
    }
    vi.doMock('../line/install-default-distilled-qa-writer', () => ({
      buildDefaultDistilledQaWriter: () => buildResult,
    }))
    const store = new MemoryStore()
    await presetBatch(store)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const lines: string[] = []
    setDefaultAgentLogSink((l) => lines.push(l))

    // 第一則批准：build 回 sdk_init_failed → ack 仍 dry-run＋一行 fixed code、不炸
    await expect(
      getEventHandler()(groupEvent('@bot 1 要'), store)
    ).resolves.toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0].text).toContain('（dry-run：刀3 開閘後才寫入 Notion）')
    expect(lines.some((l) => l.includes('distill_write_sdk_init_failed'))).toBe(true)

    // 同 instance 內「修復」：build 改回可用 writer。第二則批准必須重試構建
    // 而非沿用終態 off — ack 含「已寫入」，且 flush 連同失敗期 backlog
    // （候選 1，dry-run 時 resolved 但無 notionPageId）一起補寫。
    buildResult = { writer: fakeWriter }
    await getEventHandler()(
      // 換 messageId — claimPartnerReply 對同 id 的重投遞會 dedup
      groupEvent('@bot 2 要', { messageId: 'M_distill_3', replyToken: 'rt_d3' }),
      store
    )
    expect(calls).toHaveLength(2)
    expect(calls[1].messages[0].text).toContain('📥 已寫入 Notion 知識庫 2 條')
    expect(calls[1].messages[0].text).not.toContain('dry-run')
    expect(written).toEqual([1, 2])
  })
})
