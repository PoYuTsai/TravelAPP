/**
 * transcript-entry.ts — 沉澱管線刀1（旁聽存檔層）的單筆存檔型別.
 *
 * 夥伴群每則文字/截圖訊息一筆，KV TTL 30 天自動過期（design 2026-06-11 §2 ①）。
 * 截圖「進群當下」OCR 成文字存進 text — 不存圖片本體（省錢＋隱私重量）。
 * priority / distilled 是刀2/刀4 的欄位，刀1 只定義不寫。
 */

export interface TranscriptEntry {
  /** LINE message ID — primary key；同 id 覆寫（LINE at-least-once 冪等）。 */
  messageId: string
  /** 來源夥伴群 groupId（永遠是 partner group；OA 客人面絕不入檔）。 */
  groupId: string
  /** 發話者 LINE userId（顯示名對映留給刀2 編織時做）。 */
  lineUserId: string
  /** LINE event timestamp（ms since epoch）。 */
  timestamp: number
  /** 文字訊息或截圖。 */
  kind: 'text' | 'image'
  /** 原文；截圖＝進群當下的 OCR 文字（OCR 失敗時為 ''，如實留缺）。 */
  text: string
  /** 引用線索 — group_quoted 事件帶的 quotedMessageId（刀2 織對話串用）。 */
  quotedMessageId?: string
  /** 刀4 隨手標：Eric「記一下」標過。刀1 不寫。 */
  priority?: boolean
  /** 刀2 批次沉澱：已被沉澱掃過（避免重複掃）。刀1 不寫。 */
  distilled?: boolean
}

/**
 * 防衛性 text 上限（LINE 文字訊息本身上限 5000 chars；OCR 輸出遠小於此）。
 * 超長一律 slice — 存檔絕不能因一則長訊息膨脹。
 */
export const TRANSCRIPT_TEXT_MAX_CHARS = 5000
