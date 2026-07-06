/**
 * outbound-segments.test.ts — 備注分離（design 2026-06-17 Eric 拍板）.
 *
 * 模型在 v1 行程後另起 `【內部備註・待確認】` 段；partitionOutbound 把輸出切成
 * {itinerary, notes}：gate 只驗 itinerary（上半），送訊把兩段拆成兩則 LINE 訊息。
 * 無 header ⇒ itinerary=原文、notes=null、訊息單則（零行為變化 tripwire）。
 */
import { describe, it, expect } from 'vitest'
import {
  INTERNAL_HEADER,
  partitionOutbound,
  splitOutboundIntoMessages,
} from '@/lib/line-agent/partner-group/outbound-segments'

const ITINERARY = '<家庭套餐訂製> 清邁親子5日\nDay 1｜抵達古城\n・參觀寺廟'
const NOTES = `${INTERNAL_HEADER}\n・車型建議：Toyota Commuter 10 人座 Van\n・以上哪些需要修正？`

describe('partitionOutbound', () => {
  it('有 INTERNAL_HEADER ⇒ 切成 {itinerary(上半), notes(含 header)}', () => {
    const { itinerary, notes } = partitionOutbound(`${ITINERARY}\n\n${NOTES}`)
    expect(itinerary).toBe(ITINERARY)
    expect(notes).toBe(NOTES)
    expect(itinerary).not.toContain(INTERNAL_HEADER) // 上半純淨，gate 不吃到備注
  })

  it('無 INTERNAL_HEADER ⇒ itinerary=原文、notes=null（byte-identical tripwire）', () => {
    const { itinerary, notes } = partitionOutbound(ITINERARY)
    expect(itinerary).toBe(ITINERARY)
    expect(notes).toBeNull()
  })
})

describe('splitOutboundIntoMessages', () => {
  it('有備注段 ⇒ 兩則訊息（第 1 則行程、第 2 則備注）', () => {
    const msgs = splitOutboundIntoMessages(`${ITINERARY}\n\n${NOTES}`)
    expect(msgs).toEqual([ITINERARY, NOTES])
  })

  it('無備注段 ⇒ 單則訊息（零行為變化）', () => {
    expect(splitOutboundIntoMessages(ITINERARY)).toEqual([ITINERARY])
  })

  it('過濾空段：只有備注、無行程 ⇒ 單則備注', () => {
    expect(splitOutboundIntoMessages(`\n\n${NOTES}`)).toEqual([NOTES])
  })
})
