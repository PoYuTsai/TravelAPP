/**
 * handled-command.ts — `@bot done <caseId>` ack（design 2026-06-10 §3 刀1）.
 *
 * Ack 語意從第一天照「群內 @bot 指令」設計（B 系列 permissions 現成：done 走
 * 既有 tagged-message 路徑，不是 dev action）；CLI 只是同一個 handler 的 dev
 * 驗證 harness。
 *
 * 寫入走 reducer（`case_handled` event）＋ store.put ＋ appendAudit — 與 OA
 * case 持久化同一條紀律，audit 可追「誰、何時 ack 了哪個 case」。
 */

import type { CaseStore } from '../storage/store'
import { caseReducer } from './case-reducer'

// ---------------------------------------------------------------------------
// Parser — deterministic, explicit token
// ---------------------------------------------------------------------------

/**
 * 配對「done <caseId>」：done 必須是獨立 token（@bot mention 已由上游剝掉與
 * 否都吃得到），caseId 吃一個非空白 token（標準格式 CW-MMDD-NNN，但 parser
 * 刻意寬鬆 — 查無此 case 由 handler 回報，比 silently 不匹配好除錯）。
 */
const DONE_COMMAND_RE = /(?:^|\s)done\s+([A-Za-z0-9_-]+)/i

export function parseCaseDoneCommand(text: string): string | null {
  if (!text) return null
  const match = text.match(DONE_COMMAND_RE)
  return match ? match[1] : null
}

// ---------------------------------------------------------------------------
// Handler — shared by the partner-group router path and the CLI harness
// ---------------------------------------------------------------------------

export interface MarkCaseHandledInput {
  store: CaseStore
  caseId: string
  /** 誰 ack 的（partner lineUserId / 'cli-operator'）。 */
  actor: string
  /** ISO-8601 — injected for determinism. */
  now: string
}

export interface MarkCaseHandledResult {
  ok: boolean
  /** Group/CLI 回覆文字（固定模板，不含客人內文）。 */
  replyText: string
}

export async function markCaseHandled(
  input: MarkCaseHandledInput
): Promise<MarkCaseHandledResult> {
  const { store, caseId, actor, now } = input

  const current = await store.get(caseId)
  if (current === null) {
    return {
      ok: false,
      replyText: `找不到 case ${caseId}，請確認編號（格式如 CW-0601-001）。`,
    }
  }

  const prevAudit = await store.getAudit(caseId)
  const result = caseReducer(current, { type: 'case_handled', actor, now }, prevAudit)

  await store.put(result.case)
  // appendAudit 是 append-only：只補上 reducer 新增的最後一筆。
  const newEntry = result.audit[result.audit.length - 1]
  if (newEntry) await store.appendAudit(caseId, newEntry)

  return {
    ok: true,
    replyText: `已標記 ${caseId} 為已處理，超時提醒解除。客人再傳訊息會重新開始計時。`,
  }
}
