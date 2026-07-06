/**
 * OaContactRecord — 廣告刀1 的被動聯絡記錄（NOT case state）。
 *
 * 以 LINE userId 為 primary key，被動記錄 OA 客人「加好友 → 首則訊息」的軌跡，
 * 供每日轉換表自動填 Sheet 用。獨立 namespace — 絕不漏進案件面（listAll/get），
 * 也不觸發任何對客自動回覆。
 */

/** 單則被動記錄的訊息（時間戳＋文字，長度上限 OA_TEXT_MAX_CHARS）。 */
export interface OaContactMessage {
  ts: number
  text: string
}

export interface OaContactRecord {
  userId: string
  followedAt?: number
  firstMessageAt?: number
  /** 保留最新，上限 OA_MESSAGES_MAX 則。 */
  messages?: OaContactMessage[]
  sheetWritten?: boolean
}

/** 每筆記錄保留的訊息上限（保留最新）。 */
export const OA_MESSAGES_MAX = 20

/** 單則訊息文字的字元上限（防長訊息灌爆儲存值）。 */
export const OA_TEXT_MAX_CHARS = 2000
