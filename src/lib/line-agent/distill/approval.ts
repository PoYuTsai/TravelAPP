/**
 * approval.ts — 沉澱刀2：過目批准（design 2026-06-11 §3 ④）.
 *
 * 候選清單貼群後，Eric（或任何夥伴）回「1 3 要」「都要」「2 改成〇〇再收」→
 * 解析＋更新 pending batch。
 *
 * 紀律：
 *   - 刀3 writer seam：knowledgeWriter 未注入 ⇒ dry-run（只記狀態，絕不寫
 *     Notion，ack 逐字同刀2）；注入 ⇒ 批准落地後 flush 全部 resolved backlog。
 *   - id 不重編：清單已貼出，編號對 Eric 是穩定的 — 收掉 1、3 之後，2、4
 *     必須還叫 2、4（下次「沉澱」才由 orchestrator 重編 1..N）。
 *   - 超界 index 整批拒絕（含部分超界）— 保守：避免 Eric 打錯行號收錯條。
 *   - store 寫失敗收斂成 errorResult（fixed code）— 照 run-distillation.ts 慣例，
 *     不裸 throw。
 *   - mention 剝除限制：`/@\S+/g` 會把 modify 答案裡的 @人名 也剝掉（與
 *     isDistillCommand 一致的取捨）；答案要 @人 的情境，用「改成」前先把人名
 *     寫成純文字。
 */

import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import type { HandlerResult } from '../commands/handlers'
import type { DistillCandidate } from './pending'
import type { DistilledQaWriter } from './distilled-qa-writer'
import { flushResolvedToNotion } from './knowledge-flush'

// ---------------------------------------------------------------------------
// 解析 — 純函式，剝 @mention（同 isDistillCommand 剝法）＋trim 後全句 match
// ---------------------------------------------------------------------------

export type DistillApproval =
  | { type: 'approve'; indices: number[] }
  | { type: 'approve_all' }
  | { type: 'modify'; index: number; newAnswer: string }

/** 全句 match（「都要喔」不算）— 防一般聊天誤觸。 */
const APPROVE_ALL_RE = /^(都要|全部要|全要)$/
const APPROVE_RE = /^([\d\s,，、]+)要$/ // ，＝全形逗號（中文輸入法直打）
const MODIFY_RE = /^(\d+)\s*改成([\s\S]+?)再收$/

/** 不是批准語句 → null（router 落回 responder）。 */
export function parseDistillApproval(text: string): DistillApproval | null {
  const stripped = text.replace(/@\S+/g, '').trim()

  if (APPROVE_ALL_RE.test(stripped)) return { type: 'approve_all' }

  const modify = stripped.match(MODIFY_RE)
  if (modify) {
    const newAnswer = modify[2].trim()
    if (newAnswer === '') return null
    return { type: 'modify', index: Number(modify[1]), newAnswer }
  }

  const approve = stripped.match(APPROVE_RE)
  if (approve) {
    // 去重（保留輸入順序）＋過濾 <1；全空 → null（「0 要」不是有效批准）
    const indices = [
      ...new Set(
        approve[1]
          .split(/[\s,，、]+/)
          .filter((s) => s !== '')
          .map(Number)
          .filter((n) => n >= 1)
      ),
    ]
    if (indices.length === 0) return null
    return { type: 'approve', indices }
  }

  return null
}

// ---------------------------------------------------------------------------
// 固定文案（exported for tests — 排版以測試鎖定）
// ---------------------------------------------------------------------------

export const DISTILL_APPROVAL_FAILURE_TEXT = '批准失敗，請稍後重試'
const DRY_RUN_NOTE = '（dry-run：刀3 開閘後才寫入 Notion）'

function joinIds(candidates: DistillCandidate[]): string {
  return candidates.map((c) => c.id).join('、')
}

function composeAck(
  headline: string,
  remaining: DistillCandidate[],
  writeLine: string
): string {
  return [
    headline,
    remaining.length > 0 ? `仍掛著：${joinIds(remaining)}` : '候選已全部處理完',
    writeLine,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// 套用 — 更新 pending batch（dry-run 狀態記錄）
// ---------------------------------------------------------------------------

export interface ApplyDistillApprovalInput {
  store: CaseStore
  groupId: string
  approval: DistillApproval
  /**
   * ms since epoch — injected for determinism。批准寫回保留原 batch.createdAt
   * （批准不是建立新 batch），此值目前僅保留給未來時間戳需求。
   */
  now: number
  log?: AgentLogger
  /**
   * 刀3 seam — webhook 在 KNOWLEDGE_WRITE_ENABLED（＋token＋db id）齊時注入；
   * 未注入 ⇒ 刀2 dry-run 行為逐字不變（ship 零行為改變）。
   */
  knowledgeWriter?: DistilledQaWriter
}

function errorResult(reason: string): HandlerResult {
  return {
    handler: 'applyDistillApproval',
    status: 'error',
    outboundText: DISTILL_APPROVAL_FAILURE_TEXT,
    meta: { reason },
  }
}

/** 無 pending batch（或 candidates 全空）→ 回 null（router 落回 responder）。 */
export async function applyDistillApproval(
  input: ApplyDistillApprovalInput
): Promise<HandlerResult | null> {
  const { store, groupId, approval, log } = input

  const batch = await store.getDistillPending(groupId)
  if (!batch || batch.candidates.length === 0) return null

  // ① 對行號：超界（含部分超界）整批拒絕、零寫入 — 打錯行號寧可重打，
  //    絕不收錯條。
  const wantedIds =
    approval.type === 'approve_all'
      ? batch.candidates.map((c) => c.id)
      : approval.type === 'approve'
        ? approval.indices
        : [approval.index]
  const byId = new Map(batch.candidates.map((c) => [c.id, c]))
  const missing = wantedIds.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    return {
      handler: 'applyDistillApproval',
      status: 'stub_ok',
      outboundText: `沒有第 ${missing.join('、')} 條（目前掛著：${joinIds(batch.candidates)}），這次回覆整批未生效，請重打`,
      meta: { reason: 'distill_approval_index_not_found' },
    }
  }

  // ② 移動：被點名的 → resolved（append，原 resolved 是刀3 的輸入，絕不洗掉）；
  //    其餘留在 candidates、id 不重編（編號對 Eric 是穩定的）。
  const wantedSet = new Set(wantedIds)
  const moved: DistillCandidate[] = batch.candidates
    .filter((c) => wantedSet.has(c.id))
    .map((c) =>
      approval.type === 'modify'
        ? // 原 answer 保留 — 刀3 寫 Notion 時兩版都看得到
          { ...c, status: 'modified' as const, modifiedAnswer: approval.newAnswer }
        : { ...c, status: 'approved' as const }
    )
  const remaining = batch.candidates.filter((c) => !wantedSet.has(c.id))

  try {
    await store.putDistillPending({
      groupId,
      // 批准不是建立新 batch — createdAt 保留原值（orchestrator 每輪沉澱才刷新）
      createdAt: batch.createdAt,
      candidates: remaining,
      resolved: [...batch.resolved, ...moved],
    })
  } catch {
    log?.('store_write_failed', { reason: 'distill_pending_write_failed' })
    return errorResult('distill_pending_write_failed')
  }

  const headline =
    approval.type === 'modify'
      ? `✏️ 第 ${approval.index} 條已改收，A：${approval.newAnswer}`
      : `✅ 已收：${joinIds(moved)}`

  const meta: Record<string, unknown> = {
    resolvedCount: moved.length,
    remainingCount: remaining.length,
  }

  // 刀3：批准狀態落地後 flush（含 dry-run 期 backlog）。flush 自己讀最新
  // batch、自己處理單條失敗 — 這裡只決定 ack 的第三行。
  let writeLine = DRY_RUN_NOTE
  if (input.knowledgeWriter) {
    // 包 try/catch：flush 外層自己也會讀 store（可能 KV down throw）——批准狀態
    // 已落地，例外絕不能裸丟出去吞掉 ack（fail-safe：批准是 Eric 的決定，
    // 落地失敗下次 flush 自癒，不回滾）。
    try {
      const flush = await flushResolvedToNotion({
        store,
        groupId,
        writer: input.knowledgeWriter,
        now: input.now,
        log,
      })
      writeLine = [
        `📥 已寫入 Notion 知識庫 ${flush.written} 條`,
        ...(flush.failed > 0
          ? [`⚠️ ${flush.failed} 條寫入失敗，下次批准補寫`]
          : []),
      ].join('\n')
      meta.written = flush.written
      meta.writeFailed = flush.failed
    } catch {
      log?.('store_write_failed', { reason: 'distill_flush_unexpected_error' })
      writeLine = '⚠️ 寫入 Notion 時發生未預期錯誤，下次批准補寫'
    }
  }

  return {
    handler: 'applyDistillApproval',
    status: 'stub_ok',
    outboundText: composeAck(headline, remaining, writeLine),
    meta,
  }
}
