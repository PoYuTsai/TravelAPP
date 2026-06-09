/**
 * customer-itinerary-lint.ts
 *
 * M3.3a — Customer itinerary lint layer. PURE & DETERMINISTIC, NO LLM.
 *
 * Validates a `customer_itinerary_v1` text against a machine-readable case
 * profile (`CustomerItineraryConstraints`) and returns the rule violations it
 * finds. This is the regression backstop for a future itinerary composer /
 * LLM generator: the generator may phrase freely, but its output must pass
 * these rules — the same way `itinerary-parser.ts` lifts area/theme signal with
 * a strict whitelist rather than inventing.
 *
 * Scope guardrails (Eric 2026-06-09): validator + fixture + tests only. No
 * generator, no LINE live path, no Sanity, no Notion API, no gate flip. The
 * golden fixture (李先生一家 7D6N) MUST pass with zero issues; each single-rule
 * mutation MUST be caught.
 *
 * Design notes that keep the golden PASSing:
 *   - Rules are scoped to the lines they reason about (天使瀑布 markers only on
 *     天使瀑布 lines, lodging-area only on 住宿 lines) so legitimate elderly
 *     mobility notes elsewhere (蘭花園「可依長輩體力替換」, 瓦吉拉瀑布「若步行不便可改」)
 *     never false-positive.
 *   - `ok` is true iff there are no `error` issues; `warn` issues (missing tram
 *     note, missing meal label, leaked internal note) surface advice without
 *     failing the draft.
 */

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface CustomerItineraryMobility {
  /** e.g. 'limited_mobility_wheelchair_assisted' — substring 'limited'/'wheelchair' enables mobility lints. */
  type: string
  wheelchairFoldedSizeCm?: [number, number, number]
  canWalkHoursPerDay?: [number, number]
  canSelfBoardVehicle?: boolean
}

export interface CustomerItineraryKnownFlight {
  airline: string
  arrivalTime: string
}

export interface CustomerItineraryConstraints {
  days: number
  nights: number
  /** Canonical lodging area key, e.g. 'chiangmai_old_city'. */
  stayArea: string
  sameLodgingAllTrip: boolean
  departureDayTransferTime?: string
  departureDayPeriod?: 'morning' | 'afternoon' | 'evening'
  mobility?: CustomerItineraryMobility
  knownFlight?: CustomerItineraryKnownFlight
  customerVersion: boolean
}

export type ItineraryLintSeverity = 'error' | 'warn'

export interface ItineraryLintIssue {
  code: string
  severity: ItineraryLintSeverity
  message: string
  /** 1-based day number when the issue is scoped to a specific day. */
  day?: number
}

export interface ItineraryLintResult {
  ok: boolean
  issues: ItineraryLintIssue[]
}

// ---------------------------------------------------------------------------
// Markers / whitelists (extend these tables, keep the logic intact)
// ---------------------------------------------------------------------------

const DAY_HEADING_RE = /^Day\s*(\d+)｜/
const LUNCH_PREFIX = '午餐：'
const DINNER_PREFIX = '晚餐：'
const LODGING_MARKER = '住宿：'
const ACTIVITY_PREFIX = '・'

/** Lodging-area conflicts, keyed by the trip's canonical stayArea. */
const FORBIDDEN_LODGING_TOKENS: Record<string, string[]> = {
  chiangmai_old_city: ['清萊', '尼曼', '寧曼', 'Nimman', '芳縣', '南邦', '南奔', '曼谷'],
}

/** Activities to remove for a limited-mobility / wheelchair-assisted case. */
const MOBILITY_UNSUITABLE_TOKENS = [
  '叢林飛索',
  '飛索',
  'Jungle Flight',
  '帕丘峽谷',
  '帕丘',
  '黏黏瀑布',
]

/** Phrases that wrongly cast 天使瀑布 as intense / replaceable (it's a cafe/photo stop). */
const TIANSHI_MISCATEGORY_MARKERS = [
  '激烈',
  '高強度',
  '高風險',
  '需替換',
  '替換',
  '若長輩不適可改',
]

/** Internal-only signals that must never appear in a customer version. */
const INTERNAL_ONLY_TOKENS = ['內部備註', '成本', '分潤', '報價總額', '利潤', '需 Eric']

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface DayBlock {
  day: number
  lines: string[]
}

interface ParsedItinerary {
  headerLines: string[]
  blocks: DayBlock[]
}

function parse(text: string): ParsedItinerary {
  const headerLines: string[] = []
  const blocks: DayBlock[] = []
  let current: DayBlock | null = null

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const m = line.match(DAY_HEADING_RE)
    if (m) {
      current = { day: Number(m[1]), lines: [] }
      blocks.push(current)
      continue
    }
    if (current) current.lines.push(line)
    else headerLines.push(line)
  }

  return { headerLines, blocks }
}

function lunchLines(b: DayBlock): string[] {
  return b.lines.filter((l) => l.startsWith(LUNCH_PREFIX))
}
function dinnerLines(b: DayBlock): string[] {
  return b.lines.filter((l) => l.startsWith(DINNER_PREFIX))
}
function lodgingLines(b: DayBlock): string[] {
  return b.lines.filter((l) => l.includes(LODGING_MARKER))
}
function activityLines(b: DayBlock): string[] {
  return b.lines.filter((l) => l.startsWith(ACTIVITY_PREFIX) && !l.includes(LODGING_MARKER))
}

function parseHour(time?: string): number | undefined {
  if (!time) return undefined
  const m = time.match(/^(\d{1,2}):/)
  return m ? Number(m[1]) : undefined
}

function isLimitedMobility(c: CustomerItineraryConstraints): boolean {
  const t = c.mobility?.type ?? ''
  return t.includes('limited') || t.includes('wheelchair')
}

function isMorningDeparture(c: CustomerItineraryConstraints): boolean {
  if (c.departureDayPeriod) return c.departureDayPeriod === 'morning'
  const hour = parseHour(c.departureDayTransferTime)
  return hour !== undefined && hour < 12
}

// ---------------------------------------------------------------------------
// lintCustomerItinerary
// ---------------------------------------------------------------------------

export function lintCustomerItinerary(
  text: string,
  constraints: CustomerItineraryConstraints
): ItineraryLintResult {
  const issues: ItineraryLintIssue[] = []
  const { headerLines, blocks } = parse(text)
  const finalDay = constraints.days
  const morningDeparture = isMorningDeparture(constraints)
  const limitedMobility = isLimitedMobility(constraints)

  // -- Rule 13: day headings must be the consecutive set 1..days -------------
  const present = new Set(blocks.map((b) => b.day))
  for (let d = 1; d <= constraints.days; d++) {
    if (!present.has(d)) {
      issues.push({ code: 'missing_day_heading', severity: 'error', day: d, message: `缺少 Day ${d}｜ 標題` })
    }
  }
  for (const d of Array.from(present)) {
    if (d < 1 || d > constraints.days) {
      issues.push({ code: 'unexpected_day_heading', severity: 'error', day: d, message: `不應出現 Day ${d}（總天數為 ${constraints.days}）` })
    }
  }

  for (const block of blocks) {
    const { day } = block
    const lunches = lunchLines(block)
    const dinners = dinnerLines(block)
    const lodgings = lodgingLines(block)
    const activities = activityLines(block)
    const isFinalMorning = day === finalDay && morningDeparture

    // -- Rules 2-4: morning-transfer final day carries no meal/lodging -------
    if (isFinalMorning) {
      if (lunches.length > 0) issues.push({ code: 'final_day_lunch', severity: 'error', day, message: '最後一天早上送機，不應出現午餐' })
      if (dinners.length > 0) issues.push({ code: 'final_day_dinner', severity: 'error', day, message: '最後一天早上送機，不應出現晚餐' })
      if (lodgings.length > 0) issues.push({ code: 'final_day_lodging', severity: 'error', day, message: '最後一天早上送機，不應出現住宿' })
    }

    // -- Rules 6-7: no duplicate meal of the same kind in one day -----------
    if (lunches.length >= 2) issues.push({ code: 'duplicate_lunch', severity: 'error', day, message: `Day ${day} 出現 ${lunches.length} 個午餐` })
    if (dinners.length >= 2) issues.push({ code: 'duplicate_dinner', severity: 'error', day, message: `Day ${day} 出現 ${dinners.length} 個晚餐` })

    // -- Rule 5: all-trip lodging stays in stayArea -------------------------
    if (constraints.sameLodgingAllTrip) {
      const forbidden = FORBIDDEN_LODGING_TOKENS[constraints.stayArea] ?? []
      for (const line of lodgings) {
        const hit = forbidden.find((tok) => line.includes(tok))
        if (hit) issues.push({ code: 'lodging_area_inconsistent', severity: 'error', day, message: `Day ${day} 住宿出現 ${hit}，與全程同一住宿（${constraints.stayArea}）不符` })
      }
    }

    // -- Rules 8-9: limited mobility removes intense/unsuitable activities ---
    if (limitedMobility) {
      for (const line of activities) {
        const hit = MOBILITY_UNSUITABLE_TOKENS.find((tok) => line.includes(tok))
        if (hit) issues.push({ code: 'mobility_unsuitable_activity', severity: 'error', day, message: `Day ${day} 含長輩不適合的 ${hit}，limited mobility case 應移除` })
      }
    }

    // -- Rule 10: 天使瀑布 must not be tagged high-risk/replaceable ----------
    for (const line of block.lines) {
      if (!line.includes('天使瀑布')) continue
      const hit = TIANSHI_MISCATEGORY_MARKERS.find((mk) => line.includes(mk))
      if (hit) issues.push({ code: 'tianshi_waterfall_miscategorized', severity: 'error', day, message: `天使瀑布是景點咖啡/拍照型停留點，不應標為「${hit}」` })
    }

    // -- Rule 11: 夜間動物園 needs a 遊園車 / 減少步行 note (warn) ------------
    const blockText = block.lines.join('\n')
    if (blockText.includes('夜間動物園') && !blockText.includes('遊園車') && !blockText.includes('減少步行')) {
      issues.push({ code: 'night_safari_missing_tram_note', severity: 'warn', day, message: `Day ${day} 夜間動物園建議註明有遊園車／可減少步行` })
    }

    // -- Rule 14: a non-final full day should label both meals (warn) -------
    if (!isFinalMorning) {
      if (lunches.length === 0) issues.push({ code: 'missing_meal_label', severity: 'warn', day, message: `Day ${day} 缺少午餐欄` })
      if (dinners.length === 0) issues.push({ code: 'missing_meal_label', severity: 'warn', day, message: `Day ${day} 缺少晚餐欄` })
    }
  }

  // -- Rule 12: known flight → Day 1 must not still ask to confirm it -------
  if (constraints.knownFlight) {
    const day1 = blocks.find((b) => b.day === 1)
    if (day1) {
      for (const line of day1.lines) {
        if (line.includes('確認') && (line.includes('航班') || line.includes('CNX'))) {
          issues.push({ code: 'redundant_flight_confirm', severity: 'error', day: 1, message: '航班已知（' + constraints.knownFlight.airline + ' ' + constraints.knownFlight.arrivalTime + '），Day 1 不需再寫需確認航班' })
          break
        }
      }
    }
  }

  // -- Rule 15: customer version must not leak internal-only notes (warn) ---
  if (constraints.customerVersion) {
    const scan = (line: string, day?: number) => {
      const hit = INTERNAL_ONLY_TOKENS.find((tok) => line.includes(tok))
      if (hit) issues.push({ code: 'internal_notes_in_customer_version', severity: 'warn', day, message: `客人版不應出現內部資訊「${hit}」` })
    }
    for (const line of headerLines) scan(line)
    for (const block of blocks) for (const line of block.lines) scan(line, block.day)
  }

  const ok = !issues.some((i) => i.severity === 'error')
  return { ok, issues }
}
