/**
 * distill-approval-resolve.test.ts — 刀A 三層接話 orchestrator
 * （design 2026-06-12 §1：regex → LLM intent → deterministic 套用＋複述確認＋防呆兜底）。
 */

import { describe, it, expect, vi } from 'vitest'
import { MemoryStore } from '../storage/memory-store'
import {
  resolveDistillApproval,
  composeConfirmationText,
  DISTILL_APPROVAL_FALLBACK_TEXT,
} from '../distill/approval'

function seedPending(store: MemoryStore) {
  return store.putDistillPending({
    groupId: 'G1',
    createdAt: 1000,
    candidates: [
      { id: 1, question: 'q1', answer: 'a1', sourceMessageIds: [], occurrences: 2, status: 'pending', missedCount: 0 },
      { id: 3, question: 'q3', answer: 'a3', sourceMessageIds: [], occurrences: 1, status: 'pending', missedCount: 0 },
    ],
    resolved: [],
  })
}

const base = { groupId: 'G1', now: 2000 }

describe('resolveDistillApproval — 三層接話', () => {
  it('層1：regex 命中走既有路徑、零 LLM 呼叫', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn()
    const result = await resolveDistillApproval({ ...base, store, text: '1 3 要', intentSource })
    expect(result?.outboundText).toContain('✅ 已收：1、3')
    expect(intentSource).not.toHaveBeenCalled()
  })

  it('regex miss＋無 pending → null（落回 responder），零 LLM', async () => {
    const store = new MemoryStore()
    const intentSource = vi.fn()
    expect(await resolveDistillApproval({ ...base, store, text: '都收了吧', intentSource })).toBeNull()
    expect(intentSource).not.toHaveBeenCalled()
  })

  it('層2 not_approval → null（日常問答不受劫持）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"not_approval"}')
    expect(await resolveDistillApproval({ ...base, store, text: '清萊一日來得及嗎', intentSource })).toBeNull()
  })

  it('層2 high → 層3 套用（含 LLM context 帶到候選與引用）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"approve","indices":[1],"confidence":"high"}')
    const result = await resolveDistillApproval({
      ...base, store, text: '第一條收吧', quotedBotContent: '候選清單那則', intentSource,
    })
    expect(result?.outboundText).toContain('✅ 已收：1')
    expect(intentSource).toHaveBeenCalledWith({
      text: '第一條收吧',
      candidates: [
        { id: 1, question: 'q1', answer: 'a1' },
        { id: 3, question: 'q3', answer: 'a3' },
      ],
      quotedBotContent: '候選清單那則',
    })
  })

  it('層2 high 但行號超界 → 既有「整批未生效」拒絕（層3 deterministic）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"approve","indices":[2],"confidence":"high"}')
    const result = await resolveDistillApproval({ ...base, store, text: '第二條收', intentSource })
    expect(result?.outboundText).toContain('沒有第 2 條')
  })

  it('層2 low → 寫確認狀態＋回複述句；引用複述＋「對」→ 套用', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"approve","indices":[1,3],"confidence":"low"}')
    const first = await resolveDistillApproval({ ...base, store, text: '那兩條都ok', intentSource })
    expect(first?.outboundText).toBe('你是要收 1、3 對嗎？引用這句回「對」就收')
    expect(await store.getDistillConfirmation('G1')).not.toBeNull()

    const second = await resolveDistillApproval({
      ...base, store, text: '對', quotedBotContent: first!.outboundText!, intentSource,
    })
    expect(second?.outboundText).toContain('✅ 已收：1、3')
    expect(await store.getDistillConfirmation('G1')).toBeNull()
  })

  it('確認掛著但講了別的 → 確認作廢、不卡路徑（落層2）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    await store.putDistillConfirmation({
      groupId: 'G1',
      approval: { type: 'approve', indices: [1] },
      restatementText: '你是要收 1 對嗎？引用這句回「對」就收',
      createdAt: 1000,
    })
    const intentSource = vi.fn().mockResolvedValue('{"action":"not_approval"}')
    expect(await resolveDistillApproval({ ...base, store, text: '清萊車程多久', intentSource })).toBeNull()
    expect(await store.getDistillConfirmation('G1')).toBeNull()
  })

  it('防呆兜底：LLM throw / 解析 null → 固定文案，絕不靜默', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const boom = vi.fn().mockRejectedValue(new Error('cost_cap_over_cap'))
    const r1 = await resolveDistillApproval({ ...base, store, text: '嗯收吧', intentSource: boom })
    expect(r1?.outboundText).toBe(DISTILL_APPROVAL_FALLBACK_TEXT)

    const garbage = vi.fn().mockResolvedValue('我覺得都可以收')
    const r2 = await resolveDistillApproval({ ...base, store, text: '嗯收吧', intentSource: garbage })
    expect(r2?.outboundText).toBe(DISTILL_APPROVAL_FALLBACK_TEXT)
  })

  it('intentSource 未注入 → 行為同刀2（regex-only，miss 即 null）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    expect(await resolveDistillApproval({ ...base, store, text: '都收了吧' })).toBeNull()
  })
})

describe('composeConfirmationText', () => {
  it('approve / approve_all / modify 三款複述', () => {
    const candidates = [{ id: 1 }, { id: 3 }] as never
    expect(composeConfirmationText({ type: 'approve', indices: [1, 3] }, candidates))
      .toBe('你是要收 1、3 對嗎？引用這句回「對」就收')
    expect(composeConfirmationText({ type: 'approve_all' }, candidates))
      .toBe('你是要全部收（1、3）對嗎？引用這句回「對」就收')
    expect(composeConfirmationText({ type: 'modify', index: 2, newAnswer: '含保險' }, candidates))
      .toBe('你是要把第 2 條改成「含保險」再收對嗎？引用這句回「對」就收')
  })
})
