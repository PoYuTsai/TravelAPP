/**
 * run-daily-sheet.ts — 廣告刀8：每日轉換表 runner（可測、注入 deps）。
 *
 * 掃 KV 內所有 OaContactRecord，挑「已有 firstMessageAt（真詢問過）且尚未
 * sheetWritten」者，逐筆摘要 → Sheets append 一列 → 標 sheetWritten（冪等）。
 *
 * 紀律：
 *   - 冪等：sheetWritten=true 者略過；標記在 append 成功「之後」才寫，故某筆
 *     append 失敗會留待下次 cron 重試，且不擋其他筆（逐筆 try/catch）。
 *   - follow-only（只加好友、沒詢問過 → 無 firstMessageAt）一律跳過，不佔行。
 *   - 日期欄＝客人「首次詢問日」（record.firstMessageAt），絕不用匯出/重試當下的
 *     now()——否則 append 失敗、隔天 cron 重試會把日期錯記成重試日。換算共用
 *     daily-cost-cap 的 bangkokDay（UTC+7），絕不自寫。
 *   - route（composition root）另負責綁真 sheets / summarize；本層純邏輯不觸網。
 */

import type { CaseStore } from '../storage/store'
import type { OaContactRecord } from './oa-contact-record'
import type { OaSummary } from './summary-adapter'
import type { SheetCell, SheetsClient } from './sheets-client'
import { bangkokDay } from '../observability/daily-cost-cap'

export interface RunAdsDailySheetDeps {
  store: CaseStore
  sheets: Pick<SheetsClient, 'appendRows'>
  summarize: (input: { messages: OaContactRecord['messages'] }) => Promise<OaSummary>
  spreadsheetId: string
  range: string
  /**
   * 注入式時鐘（epoch ms）。日期欄改用 record.firstMessageAt（見上方紀律），
   * 本欄目前保留給未來其他用途（例如診斷 log 的匯出時間戳）。
   */
  now: () => number
  /** 固定碼 log（可選）；raw error 可能含敏感字，只記 code。 */
  log?: (code: string, meta?: Record<string, unknown>) => void
}

export interface RunAdsDailySheetResult {
  appended: number
  skipped: number
  failed: number
}

/** ts → YYYY-MM-DD（UTC+7）；無 ts 回空字串。 */
function toDay(ts: number | undefined): string {
  return ts ? bangkokDay(ts) : ''
}

/**
 * 欄序對齊設計：姓名 | 日期 | 詢問項目 | 人數 | 預估金額 | 加好友日 | 成交✓ | 成交金額 | 備註。
 * 姓名（LINE displayName）擺最前；未知則空字串。成交欄（✓／金額）留空給 Eric
 * 人工回填；備註標「自動」以區分手動列。改欄序時務必同步手動改 Sheet 表頭。
 */
function buildRow(record: OaContactRecord, summary: OaSummary): SheetCell[] {
  return [
    record.displayName ?? '',
    toDay(record.firstMessageAt),
    summary.inquiry,
    summary.headcount,
    summary.amount,
    toDay(record.followedAt),
    '',
    '',
    '自動',
  ]
}

export async function runAdsDailySheet(
  deps: RunAdsDailySheetDeps,
): Promise<RunAdsDailySheetResult> {
  const all = await deps.store.listOaContactRecords()
  const pending = all.filter((r) => r.firstMessageAt && !r.sheetWritten)

  let appended = 0
  let failed = 0
  for (const record of pending) {
    try {
      const summary = await deps.summarize({ messages: record.messages ?? [] })
      await deps.sheets.appendRows(deps.spreadsheetId, deps.range, [
        buildRow(record, summary),
      ])
      // 標記只在 append 成功後 — 失敗留待下次 cron 重試（冪等）。
      await deps.store.putOaContactRecord({ ...record, sheetWritten: true })
      appended++
    } catch {
      failed++
      // raw error 可能含 sheet id / token — 只記固定碼 + userId。
      deps.log?.('ads_row_failed', { userId: record.userId })
    }
  }

  return { appended, skipped: all.length - pending.length, failed }
}
