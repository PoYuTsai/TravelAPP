/**
 * 沉澱刀2 — 過目批准（parseDistillApproval / applyDistillApproval）單元測試.
 *
 * 「1 3 要」「都要」「2 改成〇〇再收」解析＋pending batch 狀態更新。
 * dry-run：只記狀態，絕不寫 Notion（那是刀3；resolved 清單就是刀3 的輸入）。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  parseDistillApproval,
  applyDistillApproval,
  DISTILL_APPROVAL_FAILURE_TEXT,
} from '../distill/approval'
import type { DistillCandidate } from '../distill/pending'
import { MemoryStore } from '../storage/memory-store'

const GROUP = 'G_partner'
const NOW = 1_700_000_900_000

function candidate(overrides: Partial<DistillCandidate> = {}): DistillCandidate {
  return {
    id: 1,
    question: '高山2月可以走嗎',
    answer: '2月乾季可以',
    sourceMessageIds: ['M1'],
    occurrences: 2,
    status: 'pending',
    missedCount: 0,
    ...overrides,
  }
}

/** 種 1..n 條 pending 候選的 batch（resolved 可帶舊資料）。 */
async function seedBatch(
  store: MemoryStore,
  count: number,
  resolved: DistillCandidate[] = []
) {
  await store.putDistillPending({
    groupId: GROUP,
    createdAt: NOW - 1000,
    candidates: Array.from({ length: count }, (_, i) =>
      candidate({ id: i + 1, question: `問${i + 1}`, answer: `答${i + 1}` })
    ),
    resolved,
  })
}

// ---------------------------------------------------------------------------
// parseDistillApproval — 純函式解析
// ---------------------------------------------------------------------------

describe('parseDistillApproval', () => {
  it("'1 3 要' / '1、3要' / '1,3 要' → approve [1,3]（空白／頓號／逗號分隔皆可）", () => {
    expect(parseDistillApproval('1 3 要')).toEqual({ type: 'approve', indices: [1, 3] })
    expect(parseDistillApproval('1、3要')).toEqual({ type: 'approve', indices: [1, 3] })
    expect(parseDistillApproval('1,3 要')).toEqual({ type: 'approve', indices: [1, 3] })
  })

  it("'1，3 要' → approve [1,3]（全形逗號——中文輸入法直打）", () => {
    expect(parseDistillApproval('1，3 要')).toEqual({ type: 'approve', indices: [1, 3] })
    expect(parseDistillApproval('1，3要')).toEqual({ type: 'approve', indices: [1, 3] })
  })

  it("'@bot 1 3 要' → approve [1,3]（mention 剝除，同 isDistillCommand 剝法）", () => {
    expect(parseDistillApproval('@bot 1 3 要')).toEqual({ type: 'approve', indices: [1, 3] })
  })

  it("'都要' / '全部要' / '全要' → approve_all", () => {
    expect(parseDistillApproval('都要')).toEqual({ type: 'approve_all' })
    expect(parseDistillApproval('全部要')).toEqual({ type: 'approve_all' })
    expect(parseDistillApproval('全要')).toEqual({ type: 'approve_all' })
  })

  it("'2 改成包含保險再收' → modify index 2、newAnswer '包含保險'", () => {
    expect(parseDistillApproval('2 改成包含保險再收')).toEqual({
      type: 'modify',
      index: 2,
      newAnswer: '包含保險',
    })
  })

  it("'2 改成 包含保險 再收' → newAnswer trim 成 '包含保險'", () => {
    expect(parseDistillApproval('2 改成 包含保險 再收')).toEqual({
      type: 'modify',
      index: 2,
      newAnswer: '包含保險',
    })
  })

  it("'好啊' / '要不要去吃飯' / '1' / '' → null（不是批准語句）", () => {
    expect(parseDistillApproval('好啊')).toBeNull()
    expect(parseDistillApproval('要不要去吃飯')).toBeNull()
    expect(parseDistillApproval('1')).toBeNull()
    expect(parseDistillApproval('')).toBeNull()
  })

  it("'0 要' → null（index <1 過濾後全空）", () => {
    expect(parseDistillApproval('0 要')).toBeNull()
  })

  it("'1 2 2 要' → approve [1,2]（去重）", () => {
    expect(parseDistillApproval('1 2 2 要')).toEqual({ type: 'approve', indices: [1, 2] })
  })

  it("'都要喔' → null（全句 match，尾巴多字不算——防誤觸）", () => {
    expect(parseDistillApproval('都要喔')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// applyDistillApproval — pending batch 狀態更新（dry-run：絕不寫 Notion）
// ---------------------------------------------------------------------------

describe('applyDistillApproval', () => {
  it('無 pending batch → null、store 零寫入（router 落回 responder）', async () => {
    const store = new MemoryStore()
    const put = vi.spyOn(store, 'putDistillPending')

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve_all' },
      now: NOW,
    })

    expect(result).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })

  it('batch 存在但 candidates 全空（只剩 resolved）→ null', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 0, [candidate({ id: 1, status: 'approved' })])
    const put = vi.spyOn(store, 'putDistillPending')

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve_all' },
      now: NOW,
    })

    expect(result).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })

  it("approve [1,3]（batch 有 1-4）→ 1、3 移 resolved（append）、2、4 留下且 id 不重編、ack 列已收＋仍掛＋dry-run 註記", async () => {
    const store = new MemoryStore()
    const oldResolved = [candidate({ id: 7, question: '更早批的', status: 'approved' })]
    await seedBatch(store, 4, oldResolved)

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [1, 3] },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toBe(
      [
        '✅ 已收：1、3',
        '仍掛著：2、4',
        '（dry-run：刀3 開閘後才寫入 Notion）',
      ].join('\n')
    )

    const batch = await store.getDistillPending(GROUP)
    // id 不重編 — 清單已貼出，編號對 Eric 是穩定的；下次沉澱才重編
    expect(batch?.candidates.map((c) => c.id)).toEqual([2, 4])
    expect(batch?.candidates.every((c) => c.status === 'pending')).toBe(true)
    // 原 resolved 保留，新批准 append 在後
    expect(batch?.resolved.map((c) => ({ id: c.id, status: c.status }))).toEqual([
      { id: 7, status: 'approved' },
      { id: 1, status: 'approved' },
      { id: 3, status: 'approved' },
    ])
    // 批准不是建立新 batch — createdAt 保留原值（orchestrator 每輪沉澱才刷新）
    expect(batch?.createdAt).toBe(NOW - 1000)
  })

  it("殘批非連續 id（[2,4]）→ '2 要' 收 id 2、剩 id 4（Map-by-id，絕非陣列序位）", async () => {
    const store = new MemoryStore()
    await store.putDistillPending({
      groupId: GROUP,
      createdAt: NOW - 1000,
      candidates: [
        candidate({ id: 2, question: '問2', answer: '答2' }),
        candidate({ id: 4, question: '問4', answer: '答4' }),
      ],
      resolved: [],
    })

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [2] },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toBe(
      [
        '✅ 已收：2',
        '仍掛著：4',
        '（dry-run：刀3 開閘後才寫入 Notion）',
      ].join('\n')
    )

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates.map((c) => c.id)).toEqual([4])
    expect(batch?.resolved.map((c) => ({ id: c.id, status: c.status }))).toEqual([
      { id: 2, status: 'approved' },
    ])
  })

  it("超界 index（'9 要'、batch 只有 3 條）→ 整批拒絕：不動狀態、不寫 store、提示「沒有第 9 條」", async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)
    const put = vi.spyOn(store, 'putDistillPending')

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [9] },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toContain('沒有第 9 條')
    expect(result?.meta).toEqual({ reason: 'distill_approval_index_not_found' })
    expect(put).not.toHaveBeenCalled()
  })

  it("部分超界（'1 9 要'）同樣整批拒絕（保守——避免打錯行號收錯條）", async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)
    const put = vi.spyOn(store, 'putDistillPending')

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [1, 9] },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toContain('沒有第 9 條')
    expect(put).not.toHaveBeenCalled()
    // 1 也沒被收 — 整批拒絕
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates).toHaveLength(3)
    expect(batch?.resolved).toEqual([])
  })

  it('approve_all → 全部 pending 移 resolved、ack 註明候選已全部處理完', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve_all' },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toBe(
      [
        '✅ 已收：1、2、3',
        '候選已全部處理完',
        '（dry-run：刀3 開閘後才寫入 Notion）',
      ].join('\n')
    )

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates).toEqual([])
    expect(batch?.resolved.map((c) => ({ id: c.id, status: c.status }))).toEqual([
      { id: 1, status: 'approved' },
      { id: 2, status: 'approved' },
      { id: 3, status: 'approved' },
    ])
  })

  it("modify 2 → status 'modified'、modifiedAnswer 存 Eric 版本（原 answer 保留）、ack 顯示修改後版本", async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'modify', index: 2, newAnswer: '包含保險' },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toBe(
      [
        '✏️ 第 2 條已改收，A：包含保險',
        '仍掛著：1、3',
        '（dry-run：刀3 開閘後才寫入 Notion）',
      ].join('\n')
    )

    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates.map((c) => c.id)).toEqual([1, 3])
    expect(batch?.resolved).toHaveLength(1)
    expect(batch?.resolved[0]).toMatchObject({
      id: 2,
      status: 'modified',
      answer: '答2', // 原 answer 保留
      modifiedAnswer: '包含保險',
    })
  })

  it("modify 超界 index → 同整批拒絕路徑（沒有第 N 條、不寫 store）", async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)
    const put = vi.spyOn(store, 'putDistillPending')

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'modify', index: 5, newAnswer: '包含保險' },
      now: NOW,
    })

    expect(result?.status).toBe('stub_ok')
    expect(result?.outboundText).toContain('沒有第 5 條')
    expect(result?.meta).toEqual({ reason: 'distill_approval_index_not_found' })
    expect(put).not.toHaveBeenCalled()
  })

  it('store 寫入失敗 → errorResult（fixed code distill_pending_write_failed）、不裸 throw', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 2)
    vi.spyOn(store, 'putDistillPending').mockRejectedValue(new Error('kv down'))
    const logged: string[] = []

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve_all' },
      now: NOW,
      log: (event, fields) => logged.push(JSON.stringify({ event, ...fields })),
    })

    expect(result?.status).toBe('error')
    expect(result?.outboundText).toBe(DISTILL_APPROVAL_FAILURE_TEXT)
    expect(result?.meta).toEqual({ reason: 'distill_pending_write_failed' })
    expect(logged.some((l) => l.includes('distill_pending_write_failed'))).toBe(true)
  })

  it('approve 收掉最後一條 → ack 註明「候選已全部處理完」', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 1)

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [1] },
      now: NOW,
    })

    expect(result?.outboundText).toBe(
      [
        '✅ 已收：1',
        '候選已全部處理完',
        '（dry-run：刀3 開閘後才寫入 Notion）',
      ].join('\n')
    )
  })
})

// ---------------------------------------------------------------------------
// applyDistillApproval × knowledgeWriter — 刀3 writer seam（批准即 flush）
// ---------------------------------------------------------------------------

/** fake writer — 記錄被寫的 candidate id；failIds 內的 id 模擬 Notion 抖動。 */
function fakeWriter(failIds: number[] = []) {
  const calls: number[] = []
  return {
    calls,
    writer: {
      write: async (c: DistillCandidate) => {
        calls.push(c.id)
        if (failIds.includes(c.id)) throw new Error('notion down')
        return `page-${c.id}`
      },
    },
  }
}

describe('applyDistillApproval × knowledgeWriter（刀3 seam）', () => {
  it('守門：knowledgeWriter 未注入 → ack 逐字同刀2（含 dry-run note）、meta 無 written/writeFailed', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 4)

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [1, 3] },
      now: NOW,
    })

    expect(result?.outboundText).toBe(
      [
        '✅ 已收：1、3',
        '仍掛著：2、4',
        '（dry-run：刀3 開閘後才寫入 Notion）',
      ].join('\n')
    )
    expect(result?.meta).toEqual({ resolvedCount: 2, remainingCount: 2 })
  })

  it('writer 注入＋approve 2 條（resolved 已有 1 條 dry-run backlog 未寫）→ flush 寫 3 條、ack 含 📥、不含 dry-run note', async () => {
    const store = new MemoryStore()
    // 刀2 dry-run 期累積的 backlog（無 notionPageId）— flush 必須一併補寫
    await seedBatch(store, 3, [
      candidate({ id: 7, question: '更早批的', status: 'approved' }),
    ])
    const { calls, writer } = fakeWriter()

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [1, 3] },
      now: NOW,
      knowledgeWriter: writer,
    })

    expect(result?.outboundText).toBe(
      ['✅ 已收：1、3', '仍掛著：2', '📥 已寫入 Notion 知識庫 3 條'].join('\n')
    )
    expect(result?.outboundText).not.toContain('dry-run')
    expect(calls).toEqual([7, 1, 3]) // backlog 在前（resolved append 順序）
    expect(result?.meta).toEqual({
      resolvedCount: 2,
      remainingCount: 1,
      written: 3,
      writeFailed: 0,
    })

    // notionPageId 已落標（冪等防重）
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.resolved.map((c) => ({ id: c.id, notionPageId: c.notionPageId }))).toEqual([
      { id: 7, notionPageId: 'page-7' },
      { id: 1, notionPageId: 'page-1' },
      { id: 3, notionPageId: 'page-3' },
    ])
  })

  it('writer 注入＋flush 部分失敗（written 2 / failed 1）→ ack 加 ⚠️ 補寫提示', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)
    const { writer } = fakeWriter([2]) // 第 2 條模擬 Notion 抖動

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve_all' },
      now: NOW,
      knowledgeWriter: writer,
    })

    expect(result?.outboundText).toBe(
      [
        '✅ 已收：1、2、3',
        '候選已全部處理完',
        '📥 已寫入 Notion 知識庫 2 條',
        '⚠️ 1 條寫入失敗，下次批准補寫',
      ].join('\n')
    )
    expect(result?.meta).toEqual({
      resolvedCount: 3,
      remainingCount: 0,
      written: 2,
      writeFailed: 1,
    })
  })

  it('writer 注入＋超界 index 整批拒絕 → writer 零呼叫（沒有狀態變化就沒有 flush）', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)
    const { calls, writer } = fakeWriter()
    const put = vi.spyOn(store, 'putDistillPending')

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'approve', indices: [9] },
      now: NOW,
      knowledgeWriter: writer,
    })

    expect(result?.outboundText).toContain('沒有第 9 條')
    expect(calls).toEqual([])
    expect(put).not.toHaveBeenCalled()
  })

  it('modify 路徑＋writer → 同樣 flush、ack headline 不變', async () => {
    const store = new MemoryStore()
    await seedBatch(store, 3)
    const { calls, writer } = fakeWriter()

    const result = await applyDistillApproval({
      store,
      groupId: GROUP,
      approval: { type: 'modify', index: 2, newAnswer: '包含保險' },
      now: NOW,
      knowledgeWriter: writer,
    })

    expect(result?.outboundText).toBe(
      [
        '✏️ 第 2 條已改收，A：包含保險',
        '仍掛著：1、3',
        '📥 已寫入 Notion 知識庫 1 條',
      ].join('\n')
    )
    expect(calls).toEqual([2])
    expect(result?.meta).toEqual({
      resolvedCount: 1,
      remainingCount: 2,
      written: 1,
      writeFailed: 0,
    })
  })
})
