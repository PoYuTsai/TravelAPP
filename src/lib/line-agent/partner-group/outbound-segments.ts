/**
 * outbound-segments.ts — 對外/內部兩段的單一真相＋切分 helper（design 2026-06-17）.
 *
 * 備注分離（Eric 拍板）：排行程草稿分兩則 LINE 訊息 —— 第 1 則純 v1 行程，第 2 則
 * 才是「車型建議／待確認／以上哪些需修正」的內部備注。模型在 v1 後另起
 * `【內部備註・待確認】` 段；本檔提供：
 *  - partitionOutbound：切成 {itinerary(上半), notes(含 header)}。gate 只驗 itinerary，
 *    避免備注字樣污染 round-trip / lint（gate「只驗上半」）。
 *  - splitOutboundIntoMessages：送訊時拆成多則訊息字串（無 header ⇒ 單則，零變化）。
 *
 * header 常數的單一真相在這裡；smart-reply-agent re-export 之，既有 importer 不動。
 * 本檔零內部相依（純字串），任何 layer 都能 import、不造成循環。
 */

/** 對外段標頭（截圖路兩段輸出用；可直接複製給客人）。 */
export const OUTBOUND_HEADER = '【可直接複製給客人】'

/** 內部備注段標頭（備注分離的分界；車型建議／待確認／以上哪些需修正）。 */
export const INTERNAL_HEADER = '【內部備註・待確認】'

/**
 * 以 INTERNAL_HEADER 為界切上下半。
 *  - 有 header：itinerary = header 之前（去尾端空白）；notes = header 起到結尾（去頭尾空白，含 header）。
 *  - 無 header：itinerary = 原文（不動）；notes = null。
 */
export function partitionOutbound(text: string): { itinerary: string; notes: string | null } {
  const idx = text.indexOf(INTERNAL_HEADER)
  if (idx === -1) return { itinerary: text, notes: null }
  return {
    itinerary: text.slice(0, idx).replace(/\s+$/u, ''),
    notes: text.slice(idx).trim(),
  }
}

/**
 * 送訊用：拆成多則訊息字串（第 1 則行程、第 2 則備注）。空段過濾；
 * 無 header ⇒ 回 [原文]（單則，與現行送訊行為 byte-identical）。
 */
export function splitOutboundIntoMessages(text: string): string[] {
  const { itinerary, notes } = partitionOutbound(text)
  const parts = [itinerary, notes ?? ''].map((s) => s.trim()).filter((s) => s !== '')
  return parts.length > 0 ? parts : [text]
}
