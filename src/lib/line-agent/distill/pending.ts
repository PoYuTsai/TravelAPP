/**
 * pending.ts — 沉澱刀2：過目 pending batch 型別（design 2026-06-11 §3 ④）.
 */

export type DistillCandidateStatus = 'pending' | 'approved' | 'modified'

export interface DistillCandidate {
  /** 呈現編號（1-based，每次貼出重編）— Eric 回「1 3 要」對應這個。 */
  id: number
  question: string
  answer: string
  /** 出處 transcript messageIds（刀3 寫 Notion 出處欄用）。 */
  sourceMessageIds: string[]
  /** LLM 判定的出現次數（≥2 或 priority 才入選）。 */
  occurrences: number
  status: DistillCandidateStatus
  /** 「2 改成XXX再收」時存 Eric 改寫的答案；status='modified' 才有。 */
  modifiedAnswer?: string
  /** 被貼出但 Eric 沒回應的次數；≥2 不再提（行動即投票）。 */
  missedCount: number
}

export interface DistillPendingBatch {
  groupId: string
  /** ms since epoch — 由呼叫端注入（determinism）。 */
  createdAt: number
  /** 本輪呈現中的候選（status 一律 'pending'）。 */
  candidates: DistillCandidate[]
  /** 已批准/已修改、等刀3 寫 Notion 的累積清單。 */
  resolved: DistillCandidate[]
}
