/**
 * knowledge-flush.ts — 沉澱刀3：把 pending batch 裡「未寫入的 resolved」逐條
 * 寫進 Notion 沉澱問答 DB，逐條落 notionPageId（design §3 ⑤）.
 *
 * 紀律：
 *   - flush 全部 backlog，不只本次點名的 — 刀2 dry-run 期累積的 resolved
 *     就是刀3 的輸入（approval.ts:8 的承諾）。
 *   - 每條寫成功**立刻** putDistillPending 落標 — 把「頁建了標丟了」的重複窗
 *     縮到單條；落標失敗 log 後繼續（頁已存在，回滾只會更糟）。
 *   - 單條寫失敗跳過續寫其他條 — Notion 抖動不該扣住整批。
 *   - 絕不動 candidates（仍 pending 的）— 那是過目流程的狀態。
 */

import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import type { DistilledQaWriter } from './distilled-qa-writer'

export interface FlushResult {
  written: number
  failed: number
}

export async function flushResolvedToNotion(input: {
  store: CaseStore
  groupId: string
  writer: DistilledQaWriter
  now: number
  log?: AgentLogger
}): Promise<FlushResult> {
  const { store, groupId, writer, now, log } = input

  const batch = await store.getDistillPending(groupId)
  if (!batch) return { written: 0, failed: 0 }

  let written = 0
  let failed = 0
  // 對 resolved 的工作副本逐條推進；每寫成一條立刻整 batch 落標寫回。
  const resolved = [...batch.resolved]
  for (let i = 0; i < resolved.length; i += 1) {
    if (resolved[i].notionPageId !== undefined) continue // 冪等：已寫過
    let pageId: string
    try {
      pageId = await writer.write(resolved[i], now)
    } catch {
      failed += 1
      log?.('store_write_failed', { reason: 'distill_notion_write_failed' })
      continue
    }
    written += 1
    resolved[i] = { ...resolved[i], notionPageId: pageId }
    try {
      await store.putDistillPending({ ...batch, resolved })
    } catch {
      // 頁已建、標沒落 — 最壞下次重寫一頁（人工刪重複）。絕不回滾。
      log?.('store_write_failed', { reason: 'distill_write_marker_failed' })
    }
  }
  return { written, failed }
}
