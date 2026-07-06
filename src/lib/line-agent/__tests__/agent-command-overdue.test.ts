/**
 * agent-command-overdue.test.ts — `agent:overdue-dry-run` / `agent:case-done`
 * CLI dev harness（design 2026-06-10 §3 刀1）.
 *
 * dry-run 是 READ-ONLY（store 注入，零 KV 寫、零 LINE）；case-done 與群內
 * @bot done 共用 markCaseHandled。真 kit + MemoryStore，零網路。
 */

import { describe, expect, it } from 'vitest'
import {
  runOverdueDryRunCommand,
  runCaseDoneCommand,
} from '../../../../scripts/agent-command.mjs'
import {
  listWouldRemindCases,
  formatOverdueDryRunReport,
} from '../cases/overdue-reminder'
import { markCaseHandled } from '../cases/handled-command'
import { MemoryStore } from '../storage/memory-store'
import { createInitialCase } from '../cases/case-state'

const NOW = '2026-06-11T10:00:00.000Z'

function realKit() {
  return {
    listWouldRemindCases,
    formatOverdueDryRunReport,
    markCaseHandled,
    selectStore: () => {
      throw new Error('selectStore must not be called when store is injected')
    },
  }
}

async function seededStore() {
  const store = new MemoryStore()
  await store.put(
    createInitialCase({
      caseId: 'CW-0611-001',
      lineUserId: 'U-customer',
      customerDisplayName: '王小姐',
      now: '2026-06-11T04:00:00.000Z', // 6h ago → would_remind
    })
  )
  await store.put(
    createInitialCase({
      caseId: 'CW-0611-002',
      lineUserId: 'U-customer-2',
      customerDisplayName: '林先生',
      now: '2026-06-11T09:30:00.000Z', // 0.5h ago → within threshold
    })
  )
  return store
}

describe('runOverdueDryRunCommand', () => {
  it('lists only overdue cases, read-only', async () => {
    const store = await seededStore()
    const out = await runOverdueDryRunCommand({ kit: realKit(), store, now: NOW })
    expect(out).toContain('CW-0611-001')
    expect(out).not.toContain('CW-0611-002')
    expect(out).toContain('@bot done')
    // read-only：兩案皆無 handledAt
    expect((await store.get('CW-0611-001'))?.handledAt).toBeUndefined()
  })

  it('empty store → 安心訊息', async () => {
    const out = await runOverdueDryRunCommand({
      kit: realKit(),
      store: new MemoryStore(),
      now: NOW,
    })
    expect(out).toContain('沒有超時未處理')
  })
})

describe('runCaseDoneCommand', () => {
  it('acks the case via the shared handler，之後 dry-run 不再列', async () => {
    const store = await seededStore()
    const out = await runCaseDoneCommand({
      query: 'CW-0611-001',
      kit: realKit(),
      store,
      now: NOW,
    })
    expect(out).toContain('已標記 CW-0611-001 為已處理')
    expect((await store.get('CW-0611-001'))?.handledAt).toBe(NOW)

    const report = await runOverdueDryRunCommand({ kit: realKit(), store, now: NOW })
    expect(report).toContain('沒有超時未處理')
  })

  it('缺 caseId → usage 訊息；查無 case → 固定找不到訊息', async () => {
    const store = new MemoryStore()
    expect(await runCaseDoneCommand({ query: '', kit: realKit(), store, now: NOW })).toContain(
      'agent:case-done'
    )
    expect(
      await runCaseDoneCommand({ query: 'CW-0000-000', kit: realKit(), store, now: NOW })
    ).toContain('找不到 case')
  })
})
