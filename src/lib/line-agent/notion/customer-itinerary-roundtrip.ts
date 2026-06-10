/**
 * customer-itinerary-roundtrip.ts — parser round-trip 閘（design 2026-06-10 §1）.
 *
 * 核心保證：行程草稿輸出前，先餵回「真 parser」（src/lib/itinerary/parser 的
 * parseBasicInfoText + parseItineraryText）做 round-trip。解析不乾淨或關鍵欄位
 * 缺 → ok=false，呼叫端必須 fail-closed 降級（缺項模式），絕不輸出貼了會壞的
 * 文字。Deterministic，零 LLM 信任。
 *
 * Spike 結論（2026-06-10）：
 *   - parseItineraryText 對 golden 李家 7D6N 完美 round-trip（0 errors/warnings）。
 *   - parseBasicInfoText 行首錨定 `日期：`／`人數：`，吃不到 customer_itinerary_v1
 *     header 的 emoji 前綴（📅／👨‍👩‍👧‍👦）→ 本閘先做「剝行首 emoji」的前置正規化，
 *     不動共用 parser（parser 同時服務報價工具）。
 *   - golden 的人數是「8大（…）」無「小」→ parseBasicInfoText 的人數 regex 不會
 *     命中；人數存在性由本閘自己驗（人數行 + 至少一個「N大」）。
 *
 * Warnings 也算不乾淨：day_skip / date_skip / date_invalid 對客人版草稿都是真
 * 問題，fail-closed 偏嚴是刻意的。
 */

import { parseBasicInfoText, parseItineraryText } from '../../itinerary/parser'

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface RoundTripExpectation {
  /** The day count the draft claims（e.g. 7 for a 7D6N trip）. */
  days: number
}

export interface RoundTripCheckResult {
  /** true iff the draft round-trips perfectly clean through the real parsers. */
  ok: boolean
  /** Human-readable problems（empty iff ok）. */
  problems: string[]
  /** Number of days the real parser actually recovered. */
  parsedDays: number
}

// ---------------------------------------------------------------------------
// Header normalization — strip leading emoji so parseBasicInfoText can anchor
// ---------------------------------------------------------------------------

/**
 * Strip leading pictographs / ZWJ sequences / variation selectors + whitespace
 * from each line（`📅 日期：…` → `日期：…`）. Only the LINE START is touched —
 * body content is never rewritten.
 */
function stripLeadingEmoji(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line.replace(/^[\p{Extended_Pictographic}‍️\s]+/u, '')
    )
    .join('\n')
}

// ---------------------------------------------------------------------------
// checkCustomerItineraryRoundTrip — the gate
// ---------------------------------------------------------------------------

export function checkCustomerItineraryRoundTrip(
  draftText: string,
  expected: RoundTripExpectation
): RoundTripCheckResult {
  const problems: string[] = []

  if (!draftText.trim()) {
    return { ok: false, problems: ['草稿為空'], parsedDays: 0 }
  }

  const normalized = stripLeadingEmoji(draftText)

  // ── 1. Header — date range via the REAL basic-info parser ────────────────
  const basic = parseBasicInfoText(normalized)
  if (!basic.startDate || !basic.endDate) {
    problems.push('header 缺少可解析的日期區間（日期：YYYY/MM/DD～YYYY/MM/DD）')
  }

  // ── 2. Header — 人數 existence（gate-side check; parser 的人數 regex 只認
  //      「N大N小」，客人版 header 常見「8大（…）」）─────────────────────────
  const partyLine = normalized
    .split('\n')
    .find((line) => /^人數[：:]/.test(line.trim()))
  if (!partyLine || !/\d+\s*大/.test(partyLine)) {
    problems.push('header 缺少可解析的人數行（人數：N大…）')
  }

  // ── 3. Body — the REAL itinerary parser must come back perfectly clean ───
  const year = basic.startDate
    ? Number.parseInt(String(basic.startDate).slice(0, 4), 10)
    : undefined
  const itin = parseItineraryText(draftText, year)

  if (!itin.success) problems.push('行程內文解析失敗（沒有解析出任何一天）')
  for (const err of itin.errors) problems.push(`parser error：${err}`)
  for (const warn of itin.warnings) problems.push(`parser warning：${warn.message}`)

  if (itin.days.length !== expected.days) {
    problems.push(`天數不符：草稿宣稱 ${expected.days} 天，parser 解析出 ${itin.days.length} 天`)
  }

  for (const day of itin.days) {
    if (!day.title.trim()) problems.push(`Day ${day.dayNumber} 缺標題`)
    if (!day.date) problems.push(`Day ${day.dayNumber} 缺日期`)
  }

  // ── 4. Cross-check — header date range vs parsed day dates ───────────────
  if (basic.startDate && basic.endDate && itin.days.length > 0) {
    const firstDate = itin.days[0].date
    const lastDate = itin.days[itin.days.length - 1].date
    if (firstDate && firstDate !== basic.startDate) {
      problems.push(`日期不一致：header 起日 ${basic.startDate}，Day 1 是 ${firstDate}`)
    }
    if (lastDate && lastDate !== basic.endDate) {
      problems.push(`日期不一致：header 迄日 ${basic.endDate}，最後一天是 ${lastDate}`)
    }
  }

  return { ok: problems.length === 0, problems, parsedDays: itin.days.length }
}
