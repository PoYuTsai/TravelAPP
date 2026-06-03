import { describe, expect, test } from 'vitest'
import {
  resolveInboxZone,
  compareWithinZone,
  type ZoneInput,
  type ZoneSortable,
} from '../cases/inbox-zone'

const base: ZoneInput = {
  status: 'new_inquiry',
  latestEventCategory: 'new_inquiry',
  hasUnansweredQuestion: false,
  isEscalation: false,
  newInquiryOverdue: false,
}

const cases: Array<[string, Partial<ZoneInput>, string]> = [
  ['escalation 最優先', { isEscalation: true }, 'needs_eric'],
  // escalation 即使同時命中 need_reply 訊號，仍以 needs_eric 為準
  [
    'escalation 蓋過 need_reply 訊號',
    { isEscalation: true, hasUnansweredQuestion: true, latestEventCategory: 'price_question' },
    'needs_eric',
  ],
  ['未回提問 → need_reply', { hasUnansweredQuestion: true }, 'need_reply'],
  ['change_request → need_reply', { latestEventCategory: 'change_request' }, 'need_reply'],
  ['price_question → need_reply', { latestEventCategory: 'price_question' }, 'need_reply'],
  [
    'product_or_itinerary_question → need_reply',
    { latestEventCategory: 'product_or_itinerary_question' },
    'need_reply',
  ],
  [
    'media_or_ocr_needed → need_reply',
    { latestEventCategory: 'media_or_ocr_needed' },
    'need_reply',
  ],
  ['new_inquiry 逾時 → need_reply', { newInquiryOverdue: true }, 'need_reply'],
  [
    'needs_info 等補資料 → awaiting_customer',
    { status: 'needs_info', latestEventCategory: 'follow_up_info' },
    'awaiting_customer',
  ],
  ['ready_for_itinerary → ready_itinerary', { status: 'ready_for_itinerary' }, 'ready_itinerary'],
  ['quote_review → quote_review', { status: 'quote_review' }, 'quote_review'],
  ['ready_for_quote → quote_review', { status: 'ready_for_quote' }, 'quote_review'],
  ['quoted_tracking → quoted_tracking', { status: 'quoted_tracking' }, 'quoted_tracking'],
  [
    'menu_browsing → browsing_idle',
    { latestEventCategory: 'menu_browsing', status: 'idle' },
    'browsing_idle',
  ],
  [
    'non_actionable → browsing_idle',
    { latestEventCategory: 'non_actionable', status: 'idle' },
    'browsing_idle',
  ],
  [
    '兜底 → need_reply',
    { latestEventCategory: undefined, status: 'itinerary_in_progress' },
    'need_reply',
  ],
]

describe('resolveInboxZone（規則由上往下，命中即停）', () => {
  for (const [name, override, expected] of cases) {
    test(name, () => {
      expect(resolveInboxZone({ ...base, ...override })).toBe(expected)
    })
  }

  test('need_reply 蓋過後段 status 規則（補資料訊息不被靜音）', () => {
    // status 已進 needs_info，但客人最新一則是改期 → 仍須回覆，不可錯放 awaiting_customer
    expect(
      resolveInboxZone({
        ...base,
        status: 'needs_info',
        latestEventCategory: 'change_request',
      })
    ).toBe('need_reply')
  })
})

describe('compareWithinZone（severity → ageHours → 最後客人訊息時間）', () => {
  const mk = (over: Partial<ZoneSortable>): ZoneSortable => ({
    severity: 'info',
    ageHours: 0,
    lastCustomerMessageAt: '2026-06-03T00:00:00.000Z',
    ...over,
  })

  test('urgent 排在 attention 之前', () => {
    const urgent = mk({ severity: 'urgent' })
    const attention = mk({ severity: 'attention' })
    expect(compareWithinZone(urgent, attention)).toBeLessThan(0)
    expect(compareWithinZone(attention, urgent)).toBeGreaterThan(0)
  })

  test('同 severity 時 ageHours 大者在前', () => {
    const older = mk({ severity: 'attention', ageHours: 10 })
    const newer = mk({ severity: 'attention', ageHours: 2 })
    expect(compareWithinZone(older, newer)).toBeLessThan(0)
  })

  test('同 severity 同 ageHours 時最後訊息新者在前', () => {
    const recent = mk({ lastCustomerMessageAt: '2026-06-03T05:00:00.000Z' })
    const stale = mk({ lastCustomerMessageAt: '2026-06-03T01:00:00.000Z' })
    expect(compareWithinZone(recent, stale)).toBeLessThan(0)
  })

  test('無 reminder（severity undefined）排在有 reminder 之後', () => {
    const flagged = mk({ severity: 'attention' })
    const none = mk({ severity: undefined })
    expect(compareWithinZone(flagged, none)).toBeLessThan(0)
    expect(compareWithinZone(none, flagged)).toBeGreaterThan(0)
  })
})
