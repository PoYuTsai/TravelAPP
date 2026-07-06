/**
 * customer-itinerary-gate.ts — 排行程草稿輸出前的 tripwire（design 2026-06-13 §①）.
 *
 * Deterministic、零 LLM 信任：不管草稿是 persona LLM 吐的還是手打的，輸出前都先
 * 過 round-trip（真 parser 吃得下）＋ lint（v1 格式/結構/禁詞）。任一 error → ok=false，
 * 呼叫端 fail-closed 降級。
 *
 * lint 需要完整 `CustomerItineraryConstraints`，但排行程當下無從鬆散對話抽出 case
 * profile，故只餵「最小中性 constraints」：`days`（從草稿推導）＋ `customerVersion:true`，
 * 其餘必填欄位填不觸發規則的中性值——`sameLodgingAllTrip:false` 關掉唯一用到
 * `stayArea` 的 error 規則（Rule 5），`nights` 不被任何規則使用，optional 的
 * mobility/knownFlight/departure 全缺則 Rule 2-4/8-9/12 都不觸發。剩下唯一恆開的
 * error 規則是 Rule 13（Day 1..days 連續），正好驗結構。
 */
import { checkCustomerItineraryRoundTrip } from './customer-itinerary-roundtrip'
import { lintCustomerItinerary, type CustomerItineraryConstraints } from './customer-itinerary-lint'

export interface ItineraryGateResult {
  ok: boolean
  problems: string[]
}

/**
 * 本案 profile（Task 5）— 從這位客人的 case 抽出的 per-case lint 參數子集。OPTIONAL：
 * 給了哪幾欄就餵哪幾欄真規則（mobility / stayArea / lodging / 送機時段 / 已知航班），
 * 沒給的欄位回退到 gate 既有的中性值，no-profile 路徑與現行 byte-identical。
 * 推導 heuristic 本身不在本 task 範圍（交給 wiring task）；本 type 只描述 gate 收什麼。
 */
export type ItineraryCaseProfile = Partial<
  Pick<
    CustomerItineraryConstraints,
    | 'stayArea'
    | 'sameLodgingAllTrip'
    | 'departureDayTransferTime'
    | 'departureDayPeriod'
    | 'mobility'
    | 'knownFlight'
  >
>

/** 掃草稿最大的 `Day N｜` 標題推導天數；推不出回 0。 */
function deriveDeclaredDays(text: string): number {
  let max = 0
  for (const m of text.matchAll(/^Day\s+(\d+)\s*｜/gmu)) {
    const n = Number(m[1])
    if (n > max) max = n
  }
  return max
}

export function gateCustomerItineraryDraft(
  draftText: string,
  profile?: ItineraryCaseProfile
): ItineraryGateResult {
  const problems: string[] = []

  const days = deriveDeclaredDays(draftText)
  if (days < 1) {
    return { ok: false, problems: ['草稿無可辨識的 Day N 標題，非 customer_itinerary_v1 格式'] }
  }

  const rt = checkCustomerItineraryRoundTrip(draftText, { days })
  if (!rt.ok) problems.push(...rt.problems)

  // profile 給了哪幾欄就餵哪幾欄真規則；沒給就回退到既有中性值，no-profile 路徑
  // 與現行 byte-identical。stayArea/sameLodgingAllTrip 是必填，故走三元回退；
  // optional 欄位走 exactOptionalPropertyTypes-safe 的 conditional-spread。
  const lint = lintCustomerItinerary(draftText, {
    days,
    nights: Math.max(0, days - 1),
    stayArea: profile?.stayArea ?? '',
    sameLodgingAllTrip: profile?.sameLodgingAllTrip ?? false,
    customerVersion: true,
    ...(profile?.departureDayTransferTime
      ? { departureDayTransferTime: profile.departureDayTransferTime }
      : {}),
    ...(profile?.departureDayPeriod ? { departureDayPeriod: profile.departureDayPeriod } : {}),
    ...(profile?.mobility ? { mobility: profile.mobility } : {}),
    ...(profile?.knownFlight ? { knownFlight: profile.knownFlight } : {}),
  })
  for (const issue of lint.issues) {
    if (issue.severity === 'error') problems.push(`lint: ${issue.message}`)
  }

  return { ok: problems.length === 0, problems }
}
