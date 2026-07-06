/**
 * 沉澱刀2 — orchestrator（runDistillation）單元測試.
 *
 * MemoryStore＋可程式化 fake DistillSource：掃檔→織串→一次 LLM→解析→
 * carryover 合併→pending 寫入→標 distilled 全流程；失敗路徑零副作用。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isDistillEnabled,
  isDistillCommand,
  runDistillation,
  DISTILL_NO_NEW_MESSAGES_TEXT,
  DISTILL_NO_CANDIDATES_TEXT,
  DISTILL_FAILURE_TEXT,
} from '../distill/run-distillation'
import type { DistillSource } from '../distill/distill-llm-adapter'
import type { DistillCandidate, DistillPendingBatch } from '../distill/pending'
import { MemoryStore } from '../storage/memory-store'
import type { TranscriptEntry } from '../transcript/transcript-entry'

const GROUP = 'G_partner'
const NOW = 1_700_000_500_000

function entry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    messageId: 'M1',
    groupId: GROUP,
    lineUserId: 'U_tsai',
    timestamp: 1_700_000_000_000,
    kind: 'text',
    text: '高山行程2月可以走嗎',
    ...overrides,
  }
}

/** 可程式化 fake source：回傳固定 JSON（或丟錯）。 */
function sourceReturning(raw: string): DistillSource {
  return vi.fn(async () => raw)
}

function candidateJson(
  items: Array<{
    question: string
    answer: string
    sourceLines?: number[]
    occurrences?: number
  }>
): string {
  return JSON.stringify(
    items.map((i) => ({
      question: i.question,
      answer: i.answer,
      sourceLines: i.sourceLines ?? [],
      occurrences: i.occurrences ?? 2,
    }))
  )
}

function pendingCandidate(
  overrides: Partial<DistillCandidate> = {}
): DistillCandidate {
  return {
    id: 1,
    question: '舊問題',
    answer: '舊答案',
    sourceMessageIds: ['M_old'],
    occurrences: 2,
    status: 'pending',
    missedCount: 0,
    ...overrides,
  }
}

async function seed(store: MemoryStore, entries: TranscriptEntry[]) {
  for (const e of entries) await store.putTranscriptEntry(e)
}

// ---------------------------------------------------------------------------
// isDistillEnabled — 環境閘（同 isTranscriptCaptureEnabled 慣例）
// ---------------------------------------------------------------------------

describe('isDistillEnabled', () => {
  it("'true' → true", () => {
    expect(isDistillEnabled({ AI_AGENT_DISTILL_ENABLED: 'true' })).toBe(true)
  })

  it("未設 / 'false' → false；'TRUE '（trim+lowercase）→ true", () => {
    expect(isDistillEnabled({})).toBe(false)
    expect(isDistillEnabled({ AI_AGENT_DISTILL_ENABLED: 'false' })).toBe(false)
    expect(isDistillEnabled({ AI_AGENT_DISTILL_ENABLED: 'TRUE ' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isDistillCommand — 剝 @mention 後全等「沉澱」才算
// ---------------------------------------------------------------------------

describe('isDistillCommand', () => {
  it("'@bot 沉澱' / '沉澱' → true", () => {
    expect(isDistillCommand('@bot 沉澱')).toBe(true)
    expect(isDistillCommand('沉澱')).toBe(true)
  })

  it("'幫我看看沉澱物' / '沉澱一下' / '' → false（杜絕誤觸）", () => {
    expect(isDistillCommand('幫我看看沉澱物')).toBe(false)
    expect(isDistillCommand('沉澱一下')).toBe(false)
    expect(isDistillCommand('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// runDistillation
// ---------------------------------------------------------------------------

describe('runDistillation', () => {
  it('零新訊息＋零 carryover → 不叫 source、固定文案、不無中生有寫 pending', async () => {
    const store = new MemoryStore()
    const source = sourceReturning('[]')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(source).not.toHaveBeenCalled()
    expect(result.status).toBe('stub_ok')
    expect(result.outboundText).toBe(DISTILL_NO_NEW_MESSAGES_TEXT)
    // 舊 batch 不存在 → 絕不無中生有寫入
    expect(await store.getDistillPending(GROUP)).toBeNull()
  })

  it('零新訊息＋舊 batch 存在 → 不叫 source，但 missedCount+1 後寫回（被略過的事實要記錄）', async () => {
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [pendingCandidate({ id: 1, missedCount: 0 })],
      resolved: [],
    })
    const source = sourceReturning('[]')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(source).not.toHaveBeenCalled()
    expect(result.status).toBe('stub_ok')
    // meta 與主路徑對稱（scannedCount 0 — 本輪沒掃新訊息）
    expect(result.meta).toEqual({
      scannedCount: 0,
      candidateCount: 1,
      carryoverCount: 1,
      unreadableImageCount: 0,
    })
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates).toHaveLength(1)
    expect(batch?.candidates[0].missedCount).toBe(1)
  })

  it('有新訊息 → source 收到織好的 promptText（#1 行格式）；回覆含編號候選＋回覆方式說明', async () => {
    const store = new MemoryStore()
    await seed(store, [
      entry({ messageId: 'M1', text: '高山2月可以走嗎' }),
      entry({
        messageId: 'M2',
        lineUserId: 'U_min',
        timestamp: 1_700_000_001_000,
        text: '2月乾季可以',
      }),
    ])
    const source = sourceReturning(
      candidateJson([
        {
          question: '高山2月可以走嗎',
          answer: '2月乾季可以',
          sourceLines: [1, 2],
          occurrences: 2,
        },
      ])
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(source).toHaveBeenCalledTimes(1)
    const promptText = (source as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(promptText).toBe(
      ['#1 [夥伴A] 高山2月可以走嗎', '#2 [夥伴B] 2月乾季可以'].join('\n')
    )

    expect(result.status).toBe('stub_ok')
    expect(result.outboundText).toBe(
      [
        '📚 沉澱候選（1 條）：',
        '1️⃣ Q：高山2月可以走嗎',
        '　A：2月乾季可以（出現 2 次）',
        '回覆方式：「1 3 要」｜「都要」｜「2 改成〇〇再收」；不回的下次沉澱再提。',
      ].join('\n')
    )
  })

  it('成功後：掃過的 entries（含 text=\'\' 的圖）全部標 distilled；pending 寫入、ids＝1..N、createdAt＝now', async () => {
    const store = new MemoryStore()
    await seed(store, [
      entry({ messageId: 'M1', text: '問題一' }),
      entry({
        messageId: 'M2',
        kind: 'image',
        text: '', // OCR 失敗的截圖 — 不入文但要被標 distilled（掃過了）
        timestamp: 1_700_000_001_000,
      }),
    ])
    const source = sourceReturning(
      candidateJson([
        { question: 'Q1', answer: 'A1', sourceLines: [1] },
        { question: 'Q2', answer: 'A2', sourceLines: [1] },
      ])
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('stub_ok')
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBe(true)
    expect((await store.getTranscriptEntry('M2'))?.distilled).toBe(true)

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.createdAt).toBe(NOW)
    expect(batch?.candidates.map((c) => c.id)).toEqual([1, 2])
    expect(batch?.candidates.every((c) => c.status === 'pending')).toBe(true)
    expect(batch?.candidates.every((c) => c.missedCount === 0)).toBe(true)
  })

  it('新 batch 寫入 → 舊複述確認作廢（刀A：re-distill 換 batch，舊確認絕不留著套錯）', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1' })])
    await store.putDistillConfirmation({
      groupId: GROUP,
      approval: { type: 'approve', indices: [1] },
      restatementText: '你是要收 1 對嗎？引用這句回「對」就收',
      createdAt: NOW - 1000,
      batchCreatedAt: NOW - 1000,
    })
    const source = sourceReturning(
      candidateJson([{ question: 'Q1', answer: 'A1', sourceLines: [1] }])
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('stub_ok')
    expect(await store.getDistillConfirmation(GROUP)).toBeNull()
  })

  it('deleteDistillConfirmation throw → best-effort 吞掉、沉澱照常完成', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1' })])
    vi.spyOn(store, 'deleteDistillConfirmation').mockRejectedValue(new Error('kv down'))
    const source = sourceReturning(
      candidateJson([{ question: 'Q1', answer: 'A1', sourceLines: [1] }])
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('stub_ok')
    expect(result.outboundText).toContain('📚 沉澱候選')
    expect((await store.getDistillPending(GROUP))?.candidates).toHaveLength(1)
  })

  it('source throw → 零 markTranscriptDistilled、pending 不動、status error＋固定文案（重跑冪等）', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1' })])
    const priorBatch: DistillPendingBatch = {
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [pendingCandidate()],
      resolved: [],
    }
    await store.putDistillPending(priorBatch)
    const source: DistillSource = vi.fn(async () => {
      throw new Error('boom')
    })

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('error')
    expect(result.outboundText).toBe(DISTILL_FAILURE_TEXT)
    expect(result.meta).toEqual({ reason: 'distill_source_failed' })
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBeUndefined()
    // pending 原封不動（含 missedCount — 失敗的輪不算「被略過」）
    expect(await store.getDistillPending(GROUP)).toEqual(priorBatch)
  })

  it('parse throw（source 回垃圾）→ 同上零副作用', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1' })])
    const source = sourceReturning('這不是 JSON')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('error')
    expect(result.outboundText).toBe(DISTILL_FAILURE_TEXT)
    expect(result.meta).toEqual({ reason: 'distill_parse_invalid_json' })
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBeUndefined()
    expect(await store.getDistillPending(GROUP)).toBeNull()
  })

  it('carryover：missedCount 0 的 pending 舊候選 +1 與新候選合併重編號；missedCount 1 的被丟', async () => {
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [
        pendingCandidate({ id: 1, question: '留下的舊問', answer: '留下的舊答', missedCount: 0 }),
        pendingCandidate({ id: 2, question: '被丟的舊問', answer: '被丟的舊答', missedCount: 1 }),
      ],
      resolved: [],
    })
    await seed(store, [entry({ messageId: 'M1' })])
    const source = sourceReturning(
      candidateJson([{ question: '新問', answer: '新答', sourceLines: [1] }])
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates.map((c) => ({ id: c.id, question: c.question, missedCount: c.missedCount }))).toEqual([
      { id: 1, question: '留下的舊問', missedCount: 1 },
      { id: 2, question: '新問', missedCount: 0 },
    ])
    // 被丟的（略過兩次）不在新 batch 也不在文案
    expect(result.outboundText).not.toContain('被丟的舊問')
    expect(result.outboundText).toContain('留下的舊問')
    expect(result.outboundText).toContain('新問')
  })

  it('resolved 保留不動（刀3 的輸入，絕不洗掉）', async () => {
    const store = new MemoryStore()
    const resolved: DistillCandidate[] = [
      pendingCandidate({ id: 9, question: '已批准', status: 'approved' }),
    ]
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [],
      resolved,
    })
    await seed(store, [entry({ messageId: 'M1' })])
    const source = sourceReturning(
      candidateJson([{ question: '新問', answer: '新答' }])
    )

    await runDistillation({ groupId: GROUP, store, source, now: NOW })

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.resolved).toEqual(resolved)
  })

  it('讀不到的圖 → 文案末尾 ⚠️ 行；無讀不到 → 無該行', async () => {
    const store = new MemoryStore()
    await seed(store, [
      entry({ messageId: 'M1', text: '問題' }),
      entry({ messageId: 'M2', kind: 'image', text: '', timestamp: 1_700_000_001_000 }),
    ])
    const source = sourceReturning(
      candidateJson([{ question: 'Q', answer: 'A' }])
    )

    const withBroken = await runDistillation({ groupId: GROUP, store, source, now: NOW })
    expect(withBroken.outboundText?.endsWith('⚠️ 有 1 張截圖讀不到，已略過')).toBe(true)

    // 對照組：全部可讀 → 無 ⚠️ 行
    const store2 = new MemoryStore()
    await seed(store2, [entry({ messageId: 'M1', text: '問題' })])
    const ok = await runDistillation({
      groupId: GROUP,
      store: store2,
      source: sourceReturning(candidateJson([{ question: 'Q', answer: 'A' }])),
      now: NOW,
    })
    expect(ok.outboundText).not.toContain('⚠️')
  })

  it('只掃對應 groupId；distilled:true 不重掃（不進 promptText）', async () => {
    const store = new MemoryStore()
    await seed(store, [
      entry({ messageId: 'M1', text: '本群新訊息' }),
      entry({ messageId: 'M_other', groupId: 'G_other', text: '別群訊息' }),
      entry({ messageId: 'M_done', text: '掃過的訊息', distilled: true }),
    ])
    const source = sourceReturning(candidateJson([{ question: 'Q', answer: 'A' }]))

    await runDistillation({ groupId: GROUP, store, source, now: NOW })

    const promptText = (source as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(promptText).toContain('本群新訊息')
    expect(promptText).not.toContain('別群訊息')
    expect(promptText).not.toContain('掃過的訊息')
    // 別群/已掃的不被本輪標記或重標（只標本輪掃的）
    expect((await store.getTranscriptEntry('M_other'))?.distilled).toBeUndefined()
  })

  it('sourceLines 映射：去重＋無效行號跳過', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1', text: '問題' })])
    const source = sourceReturning(
      candidateJson([
        { question: 'Q', answer: 'A', sourceLines: [1, 1, 99] }, // 重複＋無效行號
      ])
    )

    await runDistillation({ groupId: GROUP, store, source, now: NOW })

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates[0].sourceMessageIds).toEqual(['M1'])
  })

  it('LLM 回 [] 且無 carryover → 固定文案＋仍標 distilled（掃過了就不重掃）', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1' })])
    const source = sourceReturning('[]')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('stub_ok')
    expect(result.outboundText).toBe(DISTILL_NO_CANDIDATES_TEXT)
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBe(true)
    // 舊 batch 不存在 → 不無中生有寫入
    expect(await store.getDistillPending(GROUP)).toBeNull()
  })

  it('LLM 回 [] 且有 carryover → 只貼 carryover（missedCount+1、重編號）', async () => {
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [pendingCandidate({ id: 3, question: '舊問', answer: '舊答', missedCount: 0 })],
      resolved: [],
    })
    await seed(store, [entry({ messageId: 'M1' })])
    const source = sourceReturning('[]')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('stub_ok')
    expect(result.outboundText).toContain('📚 沉澱候選（1 條）：')
    expect(result.outboundText).toContain('1️⃣ Q：舊問')
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBe(true)
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates.map((c) => c.id)).toEqual([1])
    expect(batch?.candidates[0].missedCount).toBe(1)
  })

  it('零新訊息＋舊 batch 存在＋putDistillPending throw → errorResult、不裸 throw', async () => {
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      // missedCount 1 → 本輪 +1 達 2 即棄 → carryover 空 → 走 writeBatch([]) 分支
      candidates: [pendingCandidate({ missedCount: 1 })],
      resolved: [],
    })
    vi.spyOn(store, 'putDistillPending').mockRejectedValue(new Error('kv down'))
    const source = sourceReturning('[]')
    const logged: string[] = []

    const result = await runDistillation({
      groupId: GROUP,
      store,
      source,
      now: NOW,
      log: (event, fields) => logged.push(JSON.stringify({ event, ...fields })),
    })

    expect(result.status).toBe('error')
    expect(result.outboundText).toBe(DISTILL_FAILURE_TEXT)
    expect(result.meta).toEqual({ reason: 'distill_pending_write_failed' })
    expect(logged.some((l) => l.includes('distill_pending_write_failed'))).toBe(true)
  })

  it('零新訊息＋carryover＋putDistillPending throw → errorResult、不裸 throw', async () => {
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [pendingCandidate({ missedCount: 0 })], // 留下 → carryover-only 分支
      resolved: [],
    })
    vi.spyOn(store, 'putDistillPending').mockRejectedValue(new Error('kv down'))
    const source = sourceReturning('[]')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(source).not.toHaveBeenCalled()
    expect(result.status).toBe('error')
    expect(result.outboundText).toBe(DISTILL_FAILURE_TEXT)
    expect(result.meta).toEqual({ reason: 'distill_pending_write_failed' })
  })

  it('主路徑 putDistillPending throw → entries 未標 distilled＋errorResult（順序鐵律：pending 先、distilled 後）', async () => {
    const store = new MemoryStore()
    await seed(store, [entry({ messageId: 'M1' })])
    vi.spyOn(store, 'putDistillPending').mockRejectedValue(new Error('kv down'))
    const source = sourceReturning(
      candidateJson([{ question: 'Q', answer: 'A', sourceLines: [1] }])
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.status).toBe('error')
    expect(result.outboundText).toBe(DISTILL_FAILURE_TEXT)
    expect(result.meta).toEqual({ reason: 'distill_pending_write_failed' })
    // pending 寫失敗 → 絕不標 distilled（下次重掃即可；反過來會永遠丟掉這批）
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBeUndefined()
  })

  it('fresh 全是讀不到的截圖（空 prompt）→ 不叫 source、照標 distilled、文案報 2 張讀不到', async () => {
    const store = new MemoryStore()
    await seed(store, [
      entry({ messageId: 'M1', kind: 'image', text: '' }),
      entry({ messageId: 'M2', kind: 'image', text: '', timestamp: 1_700_000_001_000 }),
    ])
    const source = sourceReturning('[]')

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(source).not.toHaveBeenCalled() // 空 prompt 絕不打 LLM（必 400 死循環）
    expect(result.status).toBe('stub_ok')
    expect(result.outboundText).toContain(DISTILL_NO_CANDIDATES_TEXT)
    expect(result.outboundText).toContain('⚠️ 有 2 張截圖讀不到，已略過')
    // 掃過了就要標 distilled — 否則每輪重掃同批死循環
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBe(true)
    expect((await store.getTranscriptEntry('M2'))?.distilled).toBe(true)
  })

  it('markTranscriptDistilled 單筆 throw → 其餘照標、整體仍成功（漏標只是下次重掃）', async () => {
    const store = new MemoryStore()
    await seed(store, [
      entry({ messageId: 'M1', text: '一' }),
      entry({ messageId: 'M2', text: '二', timestamp: 1_700_000_001_000 }),
      entry({ messageId: 'M3', text: '三', timestamp: 1_700_000_002_000 }),
    ])
    const original = store.markTranscriptDistilled.bind(store)
    vi.spyOn(store, 'markTranscriptDistilled').mockImplementation(async (id) => {
      if (id === 'M2') throw new Error('kv flake')
      return original(id)
    })
    const source = sourceReturning(candidateJson([{ question: 'Q', answer: 'A' }]))
    const logged: string[] = []

    const result = await runDistillation({
      groupId: GROUP,
      store,
      source,
      now: NOW,
      log: (event, fields) => logged.push(JSON.stringify({ event, ...fields })),
    })

    expect(result.status).toBe('stub_ok')
    expect((await store.getTranscriptEntry('M1'))?.distilled).toBe(true)
    expect((await store.getTranscriptEntry('M2'))?.distilled).toBeUndefined()
    expect((await store.getTranscriptEntry('M3'))?.distilled).toBe(true)
    expect(logged.some((l) => l.includes('distill_mark_failed'))).toBe(true)
  })

  it('>9 條候選 → 第 10 條用「10.」普通編號（防衛）', async () => {
    // DISTILL_MAX_CANDIDATES=5，靠 carryover 5＋新 5 撐破 9
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: Array.from({ length: 5 }, (_, i) =>
        pendingCandidate({ id: i + 1, question: `舊問${i + 1}`, missedCount: 0 })
      ),
      resolved: [],
    })
    await seed(store, [entry({ messageId: 'M1' })])
    const source = sourceReturning(
      candidateJson(
        Array.from({ length: 5 }, (_, i) => ({
          question: `新問${i + 1}`,
          answer: `新答${i + 1}`,
        }))
      )
    )

    const result = await runDistillation({ groupId: GROUP, store, source, now: NOW })

    expect(result.outboundText).toContain('9️⃣ Q：新問4')
    expect(result.outboundText).toContain('10. Q：新問5')
  })
})
