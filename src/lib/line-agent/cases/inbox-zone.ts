/**
 * inbox-zone.ts
 *
 * SLA-oriented inbox zones for the operator `/inbox` view.
 *
 * This module currently exposes ONLY the `InboxZone` union (the type seam that
 * `reminder.ts` imports).  The `resolveInboxZone` rule table is added in a
 * later task; defining the union on its own first avoids a forward reference
 * between the zone resolver and the reminder engine (plan §3 型別相依順序).
 */

export type InboxZone =
  | 'need_reply' // 需回覆 / 需處理
  | 'awaiting_customer' // 等客人補資料
  | 'ready_itinerary' // 可排行程
  | 'quote_review' // 報價待檢查
  | 'quoted_tracking' // 已報價、追蹤中
  | 'browsing_idle' // 瀏覽中 / 靜置
  | 'needs_eric' // 需 Eric 介入
