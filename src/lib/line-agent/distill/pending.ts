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
  /**
   * 刀3：寫入 Notion 成功後落的 page id — 有值＝已寫入，flush 跳過（冪等）。
   * resolved 清單裡才會有；undefined ＝ 還沒寫（含刀2 dry-run 期的 backlog）。
   */
  notionPageId?: string
  /** 被貼出但 Eric 沒回應的次數；≥2 不再提（行動即投票）。 */
  missedCount: number
}

/**
 * 批准動作 union（刀2）。住在這裡（純型別模組）而非 approval.ts —
 * store.ts 介面要引用它，放 approval.ts 會跟 CaseStore 循環依賴。
 */
export type DistillApproval =
  | { type: 'approve'; indices: number[] }
  | { type: 'approve_all' }
  | { type: 'modify'; index: number; newAnswer: string }

/**
 * 刀A 複述確認狀態（design §1）— 信心 low 時 bot 貼複述句並掛此狀態；
 * 確認語必須「引用那句複述」＋對/要/好。KV TTL 10 分鐘，過期自動作廢。
 */
export interface DistillApprovalConfirmation {
  groupId: string
  /** 確認成立後原樣走 applyDistillApproval 的動作。 */
  approval: DistillApproval
  /** bot 貼出的複述句全文 — 與 quotedBotContent 比對（cache 可能截斷，用 startsWith）。 */
  restatementText: string
  /** ms since epoch（injected，determinism）。 */
  createdAt: number
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
