/**
 * overdue-reminder.ts — OA 客人超時未回提醒狀態機（design 2026-06-10 §3 刀1）.
 *
 * 技術死穴（設計前提）：LINE webhook 看不到 OA 後台手動回覆（官方帳號自己的
 * 訊息無 event）→ 系統天然不知道「回了沒」，解除必須顯式 ack
 * （`@bot done <caseId>` → reducer `case_handled` → handledAt）。
 *
 * 狀態閉環（全部 DERIVED，本模組純函式、不寫 KV、不發 LINE）：
 *   - handledAt >= lastCustomerMessageAt        → handled（已 ack，不催）
 *   - 客人再發新訊息（lastCustomerMessageAt 前進）→ ack 自動失效，重開計時，
 *     reminderCount 由 reducer 歸零
 *   - age <= threshold                          → within_threshold（還不到催）
 *   - reminderCount >= cap                      → capped（單 case 上限，防無限重複）
 *   - 其餘                                       → would_remind
 *
 * 範圍守門：只監控 OA 客人 case；terminal／idle 不監控；瀏覽／寒暄不催
 * （NON_REMINDABLE_CATEGORIES，與 reminder.ts 同一張表）。
 *
 * 刀1 是 DRY-RUN：`formatOverdueDryRunReport` 只產 operator 側文字，永不自動
 * 回客人。刀2（cron + 群內 push）落地前，這裡的任何輸出都不會主動送出。
 */

import type { AgentCase } from './case-state'
import { TERMINAL_STATUSES } from './case-state'
import { NON_REMINDABLE_CATEGORIES } from './reminder'

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface OverdueReminderPolicy {
  /** 客人最後訊息後超過幾小時未 ack 就 would-remind（design 的 X）。 */
  thresholdHours: number
  /** 單 case 一輪（自 lastCustomerMessageAt 起）最多提醒幾次。 */
  maxRemindersPerCycle: number
}

/** v1 預設：2 小時未處理開始催（同 reminder.ts 最嚴格檔）；一輪最多 3 次。 */
export const DEFAULT_OVERDUE_POLICY: OverdueReminderPolicy = {
  thresholdHours: 2,
  maxRemindersPerCycle: 3,
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export type OverdueCaseState =
  | 'not_monitored' // terminal / idle / 瀏覽寒暄 — 不在監控範圍
  | 'handled' // 已顯式 ack 且其後客人沒再發訊息
  | 'within_threshold' // 計時中，還沒超過 X 小時
  | 'would_remind' // 超時且未 ack → 刀2 會推；刀1 dry-run 列出
  | 'capped' // 超時未 ack 但本輪提醒已達上限

export interface OverdueEvaluation {
  caseId: string
  state: OverdueCaseState
  /** Hours since lastCustomerMessageAt（not_monitored 時為 0）。 */
  ageHours: number
  /** 本輪已 surfaced 的提醒數。 */
  reminderCount: number
  /** ISO-8601 of the evaluation moment (= input now). */
  evaluatedAt: string
}

const HOUR_MS = 3_600_000

/**
 * Evaluate ONE case against the overdue policy. PURE：`now` 注入，零 I/O。
 */
export function evaluateOverdueCase(
  agentCase: AgentCase,
  now: string,
  policy: OverdueReminderPolicy = DEFAULT_OVERDUE_POLICY
): OverdueEvaluation {
  const reminderCount = agentCase.reminderCount ?? 0
  const base = {
    caseId: agentCase.caseId,
    reminderCount,
    evaluatedAt: now,
  }

  // 範圍守門：terminal / idle 不監控。
  if (TERMINAL_STATUSES.has(agentCase.status) || agentCase.status === 'idle') {
    return { ...base, state: 'not_monitored', ageHours: 0 }
  }
  // 瀏覽不催／寒暄不催（與 reminder.ts 同表）。
  if (
    agentCase.latestEventCategory &&
    NON_REMINDABLE_CATEGORIES.has(agentCase.latestEventCategory)
  ) {
    return { ...base, state: 'not_monitored', ageHours: 0 }
  }

  const ageHours =
    (Date.parse(now) - Date.parse(agentCase.lastCustomerMessageAt)) / HOUR_MS

  // 顯式 ack 後客人沒再發訊息 → handled。（客人再發 ⇒ lastCustomerMessageAt
  // 前進、這個比較自動失效 — 重開計時不需要清 handledAt。）
  if (
    agentCase.handledAt !== undefined &&
    Date.parse(agentCase.handledAt) >= Date.parse(agentCase.lastCustomerMessageAt)
  ) {
    return { ...base, state: 'handled', ageHours }
  }

  if (ageHours <= policy.thresholdHours) {
    return { ...base, state: 'within_threshold', ageHours }
  }

  if (reminderCount >= policy.maxRemindersPerCycle) {
    return { ...base, state: 'capped', ageHours }
  }

  return { ...base, state: 'would_remind', ageHours }
}

/**
 * Evaluate a case list → would-remind 清單，最久未回排最前。PURE。
 */
export function listWouldRemindCases(
  cases: AgentCase[],
  now: string,
  policy: OverdueReminderPolicy = DEFAULT_OVERDUE_POLICY
): OverdueEvaluation[] {
  return cases
    .map((c) => evaluateOverdueCase(c, now, policy))
    .filter((e) => e.state === 'would_remind')
    .sort((a, b) => b.ageHours - a.ageHours)
}

// ---------------------------------------------------------------------------
// Dry-run report（operator 側文字；刀1 絕不主動送出）
// ---------------------------------------------------------------------------

/**
 * 把 would-remind 清單 render 成 operator 報告。內容只含 caseId / 時數 /
 * 次數 — 不含客人訊息內文（操作者要看內文走 /inbox）。
 */
export function formatOverdueDryRunReport(
  wouldRemind: OverdueEvaluation[],
  policy: OverdueReminderPolicy = DEFAULT_OVERDUE_POLICY
): string {
  const header = `OA 超時未回 dry-run（門檻 ${policy.thresholdHours}h，單案上限 ${policy.maxRemindersPerCycle} 次）`
  if (wouldRemind.length === 0) {
    return `${header}\n目前沒有超時未處理的 case。`
  }
  const lines = wouldRemind.map((e, i) => {
    const hours = Math.floor(e.ageHours * 10) / 10
    return `${i + 1}. ${e.caseId} — 客人最後訊息已 ${hours}h 未標記處理（本輪已提醒 ${e.reminderCount} 次）`
  })
  return [
    `${header}`,
    `共 ${wouldRemind.length} 件需要注意：`,
    ...lines,
    '處理完請在夥伴群回 @bot done <caseId> 解除。',
  ].join('\n')
}
