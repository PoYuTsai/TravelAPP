/**
 * run-daily-sheet.test.ts — 廣告刀8：每日轉換表 runner（冪等）。
 *
 * TDD 紅先行。用 MemoryStore + fake sheets + fake summarize 驗四條紀律：
 *   (a) 一筆 unwritten → append 一列且標 sheetWritten
 *   (b) 冪等 re-run 不重 append
 *   (c) 無 firstMessageAt 的 follow-only 跳過
 *   (d) append 失敗不標 sheetWritten 且不擋其他筆
 */

import { describe, it, expect } from 'vitest'
import { MemoryStore } from '../../storage/memory-store'
import type { SheetCell } from '../sheets-client'
import type { OaSummary } from '../summary-adapter'
import { runAdsDailySheet } from '../run-daily-sheet'
import { bangkokDay } from '../../observability/daily-cost-cap'

function fakeSheets(rows: SheetCell[][]) {
  return {
    appendRows: async (_id: string, _range: string, rs: SheetCell[][]) => {
      rows.push(...rs)
    },
  }
}

const summarize = async (): Promise<OaSummary> => ({
  inquiry: '清邁包車',
  headcount: '4大2小',
  amount: 'NT$20000',
})

describe('runAdsDailySheet', () => {
  it('appends one row per unwritten contact and marks sheetWritten', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({
      userId: 'U1',
      followedAt: 100,
      firstMessageAt: 200,
      messages: [{ ts: 200, text: 'q' }],
    })
    const rows: SheetCell[][] = []
    const out = await runAdsDailySheet({
      store,
      sheets: fakeSheets(rows),
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => 1_720_000_000_000,
    })
    expect(out.appended).toBe(1)
    expect(rows).toHaveLength(1)
    expect((await store.getOaContactRecord('U1'))?.sheetWritten).toBe(true)
  })

  it('prepends displayName as the first column (name | date | inquiry | ...)', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({
      userId: 'U1',
      displayName: '陳先生',
      followedAt: 100,
      firstMessageAt: 200,
      messages: [{ ts: 200, text: 'q' }],
    })
    const rows: SheetCell[][] = []
    await runAdsDailySheet({
      store,
      sheets: fakeSheets(rows),
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => 1_720_000_000_000,
    })
    expect(rows[0][0]).toBe('陳先生')
    // 姓名插在最前 → 原本第一欄（日期）右移到 index 1、詢問項目到 index 2。
    expect(rows[0][2]).toBe('清邁包車')
  })

  it('first column is empty string when displayName is unknown', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({
      userId: 'U1',
      followedAt: 100,
      firstMessageAt: 200,
      messages: [{ ts: 200, text: 'q' }],
    })
    const rows: SheetCell[][] = []
    await runAdsDailySheet({
      store,
      sheets: fakeSheets(rows),
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => 1_720_000_000_000,
    })
    expect(rows[0][0]).toBe('')
    expect(rows[0][2]).toBe('清邁包車')
  })

  it('date column uses firstMessageAt (inquiry day), not the export-time now() — retry next day must not shift the date', async () => {
    const store = new MemoryStore()
    // firstMessageAt 落在某一天；now() 是「隔天 cron 重試」時刻（append 失敗後重跑）。
    const firstMessageAt = 1_720_000_000_000
    const retryNow = 1_720_100_000_000 // 明顯是不同的曼谷日
    expect(bangkokDay(firstMessageAt)).not.toBe(bangkokDay(retryNow))

    await store.putOaContactRecord({
      userId: 'U1',
      followedAt: firstMessageAt,
      firstMessageAt,
      messages: [{ ts: firstMessageAt, text: 'q' }],
    })
    const rows: SheetCell[][] = []
    await runAdsDailySheet({
      store,
      sheets: fakeSheets(rows),
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => retryNow,
    })
    // index 1 = 日期欄（姓名在 index 0）。應是客人首次詢問日，不是匯出/重試當日。
    expect(rows[0][1]).toBe(bangkokDay(firstMessageAt))
  })

  it('is idempotent — re-run does not re-append', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({
      userId: 'U1',
      firstMessageAt: 200,
      sheetWritten: true,
    })
    const rows: SheetCell[][] = []
    const out = await runAdsDailySheet({
      store,
      sheets: fakeSheets(rows),
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => 1,
    })
    expect(out.appended).toBe(0)
    expect(rows).toHaveLength(0)
  })

  it('skips contacts with no firstMessageAt (follow-only, never inquired)', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({ userId: 'U1', followedAt: 100 })
    const rows: SheetCell[][] = []
    const out = await runAdsDailySheet({
      store,
      sheets: fakeSheets(rows),
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => 1,
    })
    expect(out.appended).toBe(0)
    expect(rows).toHaveLength(0)
  })

  it('a failed append does not mark sheetWritten and does not block others', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({ userId: 'U1', firstMessageAt: 1, messages: [] })
    await store.putOaContactRecord({ userId: 'U2', firstMessageAt: 2, messages: [] })

    // U1 append 炸；U2 append 成功 — 一筆失敗不得擋另一筆。
    const rows: SheetCell[][] = []
    let calls = 0
    const failingSheets = {
      appendRows: async (_id: string, _range: string, rs: SheetCell[][]) => {
        calls++
        // 第一次呼叫（U1）炸，其餘照常 append。
        if (calls === 1) throw new Error('403 permission denied')
        rows.push(...rs)
      },
    }
    const out = await runAdsDailySheet({
      store,
      sheets: failingSheets,
      summarize,
      spreadsheetId: 'S',
      range: 'A1',
      now: () => 1,
    })
    // U1 失敗不標；U2 成功標並 append。
    expect((await store.getOaContactRecord('U1'))?.sheetWritten).toBeFalsy()
    expect((await store.getOaContactRecord('U2'))?.sheetWritten).toBe(true)
    expect(out.appended).toBe(1)
    expect(rows).toHaveLength(1)
  })
})
