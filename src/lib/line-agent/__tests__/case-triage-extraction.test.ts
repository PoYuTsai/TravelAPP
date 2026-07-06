/**
 * case-triage-extraction.test.ts — extractKnownFacts / deriveMissingFields
 * 三個真機煙測確診 bug（2026-06-11 圖片刀B 煙測截圖場景）：
 *
 *   bug 1 — 「30-50分鐘」這類時長/區間被誤認成 travelDate
 *   bug 2 — 「2人」這種無大小拆分的人數完全不被認得
 *   bug 3 — 文字裡只要出現「住宿」（含「還沒訂住宿」「推薦住宿嗎」）就
 *           被當成住宿地點已知
 */

import { describe, expect, it } from 'vitest'
import {
  extractKnownFacts,
  deriveMissingFields,
  buildSummaryText,
} from '../commands/case-triage'
import { triageCaseIntake } from '../partner-group/case-intake-triage'

// ---------------------------------------------------------------------------
// bug 1 — 時長/數字區間不是日期
// ---------------------------------------------------------------------------

describe('extractKnownFacts — travelDate（bug 1：時長誤判）', () => {
  it('does NOT treat a duration range like 30-50分鐘 as a travel date', () => {
    const facts = extractKnownFacts('行程安排很順，每個點之間車程約30-50分鐘')
    expect(facts.travelDate).toBeUndefined()
  })

  it('does NOT treat a plausible-looking duration like 5-10分鐘 as a date', () => {
    const facts = extractKnownFacts('停留大約5-10分鐘就走')
    expect(facts.travelDate).toBeUndefined()
  })

  it('does NOT treat a day-count range like 3-5天 as a date', () => {
    const facts = extractKnownFacts('想包車3-5天')
    expect(facts.travelDate).toBeUndefined()
  })

  it('does NOT treat an implausible month like 30-50 as a date even without a unit', () => {
    const facts = extractKnownFacts('預算大概30-50之間')
    expect(facts.travelDate).toBeUndefined()
  })

  it('still extracts a real M/D date', () => {
    const facts = extractKnownFacts('客人 12/20 出發到清邁')
    expect(facts.travelDate).toBe('12/20')
  })

  it('still extracts a real dashed date with year', () => {
    const facts = extractKnownFacts('2026-12-31 抵達清邁')
    expect(facts.travelDate).toBe('2026-12-31')
  })
})

// ---------------------------------------------------------------------------
// bug 2 — 無大小拆分的「N人」要認得（partySize）
// ---------------------------------------------------------------------------

describe('extractKnownFacts — partySize（bug 2：「2人」不認）', () => {
  it('extracts a bare head-count 2人 as partySize', () => {
    const facts = extractKnownFacts('我們2人，1/15到清邁')
    expect(facts.partySize).toBe(2)
    expect(facts.adults).toBeUndefined()
    expect(facts.children).toBeUndefined()
  })

  it('extracts 4位 as partySize', () => {
    const facts = extractKnownFacts('一行4位想去茵他儂')
    expect(facts.partySize).toBe(4)
  })

  it('does NOT read vehicle capacity 10人座 as partySize', () => {
    const facts = extractKnownFacts('需要10人座的車')
    expect(facts.partySize).toBeUndefined()
  })

  it('keeps the 大/小 split authoritative when both forms could match', () => {
    const facts = extractKnownFacts('2大2小')
    expect(facts.adults).toBe(2)
    expect(facts.children).toBe(2)
    expect(facts.partySize).toBeUndefined()
  })

  it('a bare head-count satisfies the partySize missing-field check', () => {
    const text = '我們2人，1/15到清邁'
    const facts = extractKnownFacts(text)
    const missing = deriveMissingFields([], text, facts)
    expect(missing).not.toContain('partySize')
  })

  it('renders a bare head-count in the summary', () => {
    const summary = buildSummaryText({ partySize: 2 })
    expect(summary).toContain('人數：2人')
  })
})

// ---------------------------------------------------------------------------
// bug 3 — 提到「住宿」≠ 住宿地點已知
// ---------------------------------------------------------------------------

describe('deriveMissingFields — hotelOrPickupLocation（bug 3：住宿誤判已知）', () => {
  it('還沒訂住宿 still counts as missing', () => {
    const text = '我們還沒訂住宿'
    const missing = deriveMissingFields([], text, extractKnownFacts(text))
    expect(missing).toContain('hotelOrPickupLocation')
  })

  it('asking 住宿可以推薦嗎 still counts as missing', () => {
    const text = '住宿可以推薦嗎？'
    const missing = deriveMissingFields([], text, extractKnownFacts(text))
    expect(missing).toContain('hotelOrPickupLocation')
  })

  it('a concrete hotel statement counts as known', () => {
    const text = '住宿清邁古城民宿'
    const missing = deriveMissingFields([], text, extractKnownFacts(text))
    expect(missing).not.toContain('hotelOrPickupLocation')
  })

  it('a negated mention plus a concrete one counts as known（句子各自判斷）', () => {
    const text = '原本還沒訂住宿。\n後來訂了尼曼路的飯店'
    const missing = deriveMissingFields([], text, extractKnownFacts(text))
    expect(missing).not.toContain('hotelOrPickupLocation')
  })
})

// ---------------------------------------------------------------------------
// 整合 fixture — 模擬煙測截圖 vision 轉錄文字走完三分流
// ---------------------------------------------------------------------------

describe('triageCaseIntake — 煙測截圖場景整合', () => {
  const SMOKE_TRANSCRIPT = [
    '客人：行程安排得很順，每個點之間車程約30-50分鐘',
    '客人：我們2人，想去大象保護區',
    '客人：住宿還沒訂，可以推薦嗎？',
  ].join('\n')

  it('does not invent a travel date, accepts 2人, and keeps 住宿 missing', () => {
    const result = triageCaseIntake(SMOKE_TRANSCRIPT)
    expect(result.knownFacts.travelDate).toBeUndefined()
    expect(result.knownFacts.partySize).toBe(2)
    expect(result.missingFields).toContain('travelDates')
    expect(result.missingFields).not.toContain('partySize')
    expect(result.missingFields).toContain('hotelOrPickupLocation')
    expect(result.flow).toBe('insufficient')
  })
})
