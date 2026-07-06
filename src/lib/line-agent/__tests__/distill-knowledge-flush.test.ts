/**
 * 沉澱刀3 — flushResolvedToNotion 單元測試（MemoryStore＋fake writer）.
 *
 * 紀律驗證：backlog 全清（不只本次點名）、每寫成一條立刻落 notionPageId、
 * 單條失敗/落標失敗不扣整批、candidates（仍 pending）絕不被動到。
 */

import { describe, it, expect, vi } from 'vitest'
import { flushResolvedToNotion } from '../distill/knowledge-flush'
import type { DistilledQaWriter } from '../distill/distilled-qa-writer'
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
    status: 'approved',
    missedCount: 0,
    ...overrides,
  }
}

async function seedBatch(
  store: MemoryStore,
  resolved: DistillCandidate[],
  candidates: DistillCandidate[] = []
) {
  await store.putDistillPending({
    groupId: GROUP,
    createdAt: NOW - 1000,
    candidates,
    resolved,
  })
}

/** Fake writer：依序回 page-<id>；可指定哪些 candidate id 要 throw。 */
function fakeWriter(failIds: number[] = []) {
  const write = vi.fn(async (c: DistillCandidate) => {
    if (failIds.includes(c.id)) throw new Error('boom')
    return `page-${c.id}`
  })
  const writer: DistilledQaWriter = { write }
  return { writer, write }
}

describe('flushResolvedToNotion', () => {
  it('resolved 3 條全未寫 → writer 3 次、{written:3, failed:0}、store 裡 3 條都有 notionPageId', async () => {
    const store = new MemoryStore()
    await seedBatch(store, [
      candidate({ id: 1 }),
      candidate({ id: 2 }),
      candidate({ id: 3 }),
    ])
    const { writer, write } = fakeWriter()

    const result = await flushResolvedToNotion({ store, groupId: GROUP, writer, now: NOW })

    expect(result).toEqual({ written: 3, failed: 0 })
    expect(write).toHaveBeenCalledTimes(3)
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.resolved.map((c) => c.notionPageId)).toEqual([
      'page-1',
      'page-2',
      'page-3',
    ])
  })

  it('其中 1 條已有 notionPageId → writer 只被叫 2 次（冪等跳過）', async () => {
    const store = new MemoryStore()
    await seedBatch(store, [
      candidate({ id: 1 }),
      candidate({ id: 2, notionPageId: 'page-existing' }),
      candidate({ id: 3 }),
    ])
    const { writer, write } = fakeWriter()

    const result = await flushResolvedToNotion({ store, groupId: GROUP, writer, now: NOW })

    expect(result).toEqual({ written: 2, failed: 0 })
    expect(write).toHaveBeenCalledTimes(2)
    expect(write.mock.calls.map(([c]) => c.id)).toEqual([1, 3])
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.resolved[1].notionPageId).toBe('page-existing')
  })

  it('第 2 條 writer throw → 第 1、3 條照寫且落標、{written:2, failed:1}、第 2 條 notionPageId 仍 undefined', async () => {
    const store = new MemoryStore()
    await seedBatch(store, [
      candidate({ id: 1 }),
      candidate({ id: 2 }),
      candidate({ id: 3 }),
    ])
    const { writer, write } = fakeWriter([2])
    const log = vi.fn()

    const result = await flushResolvedToNotion({
      store,
      groupId: GROUP,
      writer,
      now: NOW,
      log,
    })

    expect(result).toEqual({ written: 2, failed: 1 })
    expect(write).toHaveBeenCalledTimes(3)
    expect(log).toHaveBeenCalledWith('store_write_failed', {
      reason: 'distill_notion_write_failed',
    })
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.resolved[0].notionPageId).toBe('page-1')
    expect(batch?.resolved[1].notionPageId).toBeUndefined()
    expect(batch?.resolved[2].notionPageId).toBe('page-3')
  })

  it('落標的 store put throw → 不中斷、仍計 written、log distill_write_marker_failed（絕不回滾）', async () => {
    const store = new MemoryStore()
    await seedBatch(store, [candidate({ id: 1 }), candidate({ id: 2 })])
    // 種完 batch 後才讓 put 開始炸 — 落標全失敗，但頁都已建
    vi.spyOn(store, 'putDistillPending').mockRejectedValue(new Error('kv down'))
    const { writer, write } = fakeWriter()
    const log = vi.fn()

    const result = await flushResolvedToNotion({
      store,
      groupId: GROUP,
      writer,
      now: NOW,
      log,
    })

    expect(result).toEqual({ written: 2, failed: 0 })
    expect(write).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith('store_write_failed', {
      reason: 'distill_write_marker_failed',
    })
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('無 batch / resolved 空 / 全部已寫 → writer 零呼叫、{written:0, failed:0}', async () => {
    const { writer, write } = fakeWriter()

    // 無 batch
    const empty = new MemoryStore()
    expect(
      await flushResolvedToNotion({ store: empty, groupId: GROUP, writer, now: NOW })
    ).toEqual({ written: 0, failed: 0 })

    // resolved 空
    const noResolved = new MemoryStore()
    await seedBatch(noResolved, [])
    expect(
      await flushResolvedToNotion({ store: noResolved, groupId: GROUP, writer, now: NOW })
    ).toEqual({ written: 0, failed: 0 })

    // 全部已寫
    const allWritten = new MemoryStore()
    await seedBatch(allWritten, [
      candidate({ id: 1, notionPageId: 'page-a' }),
      candidate({ id: 2, notionPageId: 'page-b' }),
    ])
    expect(
      await flushResolvedToNotion({ store: allWritten, groupId: GROUP, writer, now: NOW })
    ).toEqual({ written: 0, failed: 0 })

    expect(write).not.toHaveBeenCalled()
  })

  it('candidates（仍 pending 的）原樣保留，絕不被 flush 動到', async () => {
    const store = new MemoryStore()
    const pending = [
      candidate({ id: 9, status: 'pending', question: '還在過目的問題' }),
    ]
    await seedBatch(store, [candidate({ id: 1 })], pending)
    const { writer, write } = fakeWriter()

    await flushResolvedToNotion({ store, groupId: GROUP, writer, now: NOW })

    expect(write).toHaveBeenCalledTimes(1)
    const batch = await store.getDistillPending(GROUP)
    expect(batch?.candidates).toEqual(pending)
  })
})
