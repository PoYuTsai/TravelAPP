/**
 * customer-itinerary-change-composer.ts
 *
 * M3.3c — Deterministic customer-change composer. PURE, NO LLM, NO RAG live, NO
 * CLI. Does NOT touch LINE / Sanity / gate / live path.
 *
 * Positioning: a feasibility / advice layer that models Eric's professional
 * scheduling judgement — not a "do whatever the customer typed" machine. A
 * structured change request is classified per item as:
 *
 *   - applied   : reasonable → applied to the plan as-is
 *   - adjusted  : re-arranged into a more comfortable, executable version
 *   - declined  : infeasible/unsafe → NOT written into the draft; a professional
 *                 alternative is offered through customerExplanation instead
 *
 * Pipeline (design 2026-06-09-m3.3c §1):
 *   1. applyChanges(base, changes, retrievalCases) → { adjustedInput, decisions }
 *      — pure transform + decision classification.
 *   2. decisions are projected into customerExplanation (customer voice) and
 *      operatorNotes (internal reasons).
 *   3. composeCustomerItineraryDraft(adjustedInput) — M3.3b render → M3.3a lint
 *      gate. lint warn never fails-closed; lint error → draft = null.
 *
 * Contract invariants:
 *   - ok === (draft !== null).
 *   - On fail-closed, draft = null but customerExplanation / operatorNotes are
 *     STILL returned so an operator can reply professionally.
 *   - The draft is always the clean customer version; every adjustment reason
 *     travels the explanation / operatorNotes side-channel, so internal/operator
 *     wording can never leak into the draft.
 *   - retrievalCases are a whitelist of alternative attractions ONLY. When none
 *     fit, fall back to a generic phrase — never invent an attraction name.
 *   - declined/feasibility checks reuse the lint module's token tables
 *     (MOBILITY_UNSUITABLE_TOKENS / FORBIDDEN_LODGING_TOKENS) so the change layer
 *     and the lint gate never disagree.
 */

import {
  composeCustomerItineraryDraft,
  type ComposeCustomerItineraryInput,
  type CustomerItineraryDayPlan,
} from './customer-itinerary-composer'
import {
  FORBIDDEN_LODGING_TOKENS,
  MOBILITY_UNSUITABLE_TOKENS,
  type CustomerItineraryKnownFlight,
  type CustomerItineraryMobility,
  type ItineraryLintIssue,
} from './customer-itinerary-lint'

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

/** A retrieval-supplied alternative attraction. Whitelist only — never invented. */
export interface RetrievalCaseRef {
  name: string
  themeTag?: string
  mobilityFriendly?: boolean
}

export interface CustomerChangeRequest {
  /** Newly known / changed flight. */
  knownFlight?: CustomerItineraryKnownFlight
  /** Elders' stamina is worse than the base plan assumed. */
  mobilityDowngrade?: CustomerItineraryMobility
  /** Customer insists on the same lodging for the whole trip. */
  sameLodgingAllTrip?: { stayArea: string }
  /** Per-day lodging changes (kept separate from addActivities by design). */
  lodgingChangeRequests?: Array<{ day: number; lodging: string }>
  /** Final day has an early-morning airport transfer. */
  finalDayMorningTransfer?: { time: string }
  addActivities?: Array<{ day: number; activity: string }>
  removeActivities?: Array<{ day: number; activity: string }>
  /** Activities the customer explicitly wants kept → protected from auto-removal. */
  keepActivities?: string[]
  /** Per-day stop ceilings — the over-full rerank signal. */
  dayCapacities?: Array<{ day: number; maxStops: number }>
  /** Area tags per activity — required for a safe, no-cross-area rerank. */
  activityAreaTags?: Array<{ activity: string; areaTag: string }>
}

export interface ChangeComposerInput {
  base: ComposeCustomerItineraryInput
  changes: CustomerChangeRequest
  /** Alternative-attraction whitelist; not retrieved live here. */
  retrievalCases?: RetrievalCaseRef[]
}

export type ChangeStatus = 'applied' | 'adjusted' | 'declined'

export interface ChangeDecision {
  status: ChangeStatus
  /** Internal-only reason. */
  operatorNote: string
  /** Customer-facing phrasing (omitted for silent applies). */
  customerNote?: string
}

export interface CustomerChangeResult {
  /** Defined as (draft !== null): is there a usable customer draft? */
  ok: boolean
  draft: string | null
  /** A few sentences an operator can paste to the customer. */
  customerExplanation: string
  /** Internal-only adjustment/decline reasons. */
  operatorNotes: string[]
  /** Residual lint violations when fail-closed. */
  issues: ItineraryLintIssue[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneInput(input: ComposeCustomerItineraryInput): ComposeCustomerItineraryInput {
  return JSON.parse(JSON.stringify(input))
}

function isLimitedMobility(m?: CustomerItineraryMobility): boolean {
  const t = m?.type ?? ''
  return t.includes('limited') || t.includes('wheelchair')
}

function unsuitableHit(activity: string): string | undefined {
  return MOBILITY_UNSUITABLE_TOKENS.find((tok) => activity.includes(tok))
}

function parseHour(time?: string): number | undefined {
  if (!time) return undefined
  const m = time.match(/^(\d{1,2}):/)
  return m ? Number(m[1]) : undefined
}

function dayStops(day: CustomerItineraryDayPlan): number {
  return (day.morningActivities?.length ?? 0) + (day.afternoonActivities?.length ?? 0)
}

// ---------------------------------------------------------------------------
// applyChanges — pure transform + decision classification
// ---------------------------------------------------------------------------

export function applyChanges(
  base: ComposeCustomerItineraryInput,
  changes: CustomerChangeRequest,
  retrievalCases: RetrievalCaseRef[] = []
): { adjustedInput: ComposeCustomerItineraryInput; decisions: ChangeDecision[] } {
  const adjusted = cloneInput(base)
  const decisions: ChangeDecision[] = []
  const days = adjusted.requirements.days
  const keep = new Set(changes.keepActivities ?? [])
  const findDay = (n: number) => days.find((d) => d.day === n)

  // 1. knownFlight → update constraints + refresh any Day 1 "confirm flight" line.
  if (changes.knownFlight) {
    const f = changes.knownFlight
    adjusted.constraints.knownFlight = f
    const day1 = findDay(1)
    if (day1) {
      day1.morningActivities = (day1.morningActivities ?? []).map((a) =>
        a.includes('確認') && (a.includes('航班') || a.includes('CNX'))
          ? `清邁機場接機（${f.airline}${f.arrivalTime}抵達）`
          : a
      )
    }
    decisions.push({
      status: 'applied',
      operatorNote: `航班已知（${f.airline} ${f.arrivalTime}），Day 1 接機資訊已更新。`,
    })
  }

  // 2. mobilityDowngrade → merge into constraints (raises the feasibility bar).
  if (changes.mobilityDowngrade) {
    adjusted.constraints.mobility = {
      ...(adjusted.constraints.mobility ?? {}),
      ...changes.mobilityDowngrade,
    }
    decisions.push({
      status: 'applied',
      operatorNote: '已套用更保守的長輩體力設定。',
      customerNote: '我們會把整體步調再放慢，行程以輕鬆好走、好拍照為主。',
    })
  }
  const limited = isLimitedMobility(adjusted.constraints.mobility)

  // 3. sameLodgingAllTrip → pin the lodging policy + area.
  if (changes.sameLodgingAllTrip) {
    adjusted.constraints.sameLodgingAllTrip = true
    adjusted.constraints.stayArea = changes.sameLodgingAllTrip.stayArea
    decisions.push({
      status: 'applied',
      operatorNote: `全程同住設定：${changes.sameLodgingAllTrip.stayArea}。`,
    })
  }

  // 4. removeActivities → honour keepActivities as a protection list.
  for (const rm of changes.removeActivities ?? []) {
    const day = findDay(rm.day)
    if (!day) continue
    if (keep.has(rm.activity)) {
      decisions.push({
        status: 'declined',
        operatorNote: `Day ${rm.day} 保留清單含「${rm.activity}」，不移除。`,
      })
      continue
    }
    const before = dayStops(day)
    day.morningActivities = (day.morningActivities ?? []).filter((a) => a !== rm.activity)
    day.afternoonActivities = (day.afternoonActivities ?? []).filter((a) => a !== rm.activity)
    if (dayStops(day) < before) {
      decisions.push({ status: 'applied', operatorNote: `Day ${rm.day} 已移除「${rm.activity}」。` })
    }
  }

  // 5. addActivities → feasibility check against the shared mobility token table.
  for (const add of changes.addActivities ?? []) {
    const day = findDay(add.day)
    if (!day) continue
    const hit = limited ? unsuitableHit(add.activity) : undefined
    if (hit) {
      const alt = retrievalCases.find((c) => c.mobilityFriendly)
      const altPhrase = alt ? `可改成「${alt.name}」` : '可改成較輕鬆的替代景點'
      decisions.push({
        status: 'declined',
        operatorNote: `Day ${add.day}「${add.activity}」含長輩不適合項目（${hit}），未加入；替代＝${
          alt ? alt.name : '無白名單，泛稱替代景點'
        }。`,
        customerNote: `「${add.activity}」對長輩體力比較吃力，這次先不安排，${altPhrase}，會更輕鬆又好拍。`,
      })
      continue
    }
    day.afternoonActivities = [...(day.afternoonActivities ?? []), add.activity]
    decisions.push({ status: 'applied', operatorNote: `Day ${add.day} 已加入「${add.activity}」。` })
  }

  // 6. lodgingChangeRequests → decline area-inconsistent moves under same-lodging.
  for (const lc of changes.lodgingChangeRequests ?? []) {
    const day = findDay(lc.day)
    if (!day) continue
    const forbidden = adjusted.constraints.sameLodgingAllTrip
      ? FORBIDDEN_LODGING_TOKENS[adjusted.constraints.stayArea] ?? []
      : []
    const conflict = forbidden.find((tok) => lc.lodging.includes(tok))
    if (conflict) {
      decisions.push({
        status: 'declined',
        operatorNote: `Day ${lc.day} 住宿改「${lc.lodging}」與全程同住（${adjusted.constraints.stayArea}）衝突（${conflict}），未變更住宿。`,
        customerNote: `為了不用每天換飯店、減少長輩搬行李的辛苦，${conflict}這邊建議排成一日往返，當天玩完再回原本住宿休息。`,
      })
      continue
    }
    day.lodging = lc.lodging
    decisions.push({ status: 'applied', operatorNote: `Day ${lc.day} 住宿已更新為「${lc.lodging}」。` })
  }

  // 7. finalDayMorningTransfer → strip the final day's meals/lodging.
  if (changes.finalDayMorningTransfer) {
    const time = changes.finalDayMorningTransfer.time
    adjusted.constraints.departureDayTransferTime = time
    const hour = parseHour(time)
    if (hour !== undefined && hour < 12) adjusted.constraints.departureDayPeriod = 'morning'
    const finalDay = findDay(adjusted.constraints.days)
    if (finalDay && adjusted.constraints.departureDayPeriod === 'morning') {
      const stripped: string[] = []
      if (finalDay.lunch) {
        stripped.push('午餐')
        delete finalDay.lunch
      }
      if (finalDay.dinner) {
        stripped.push('晚餐')
        delete finalDay.dinner
      }
      if (finalDay.lodging) {
        stripped.push('住宿')
        delete finalDay.lodging
      }
      if (stripped.length > 0) {
        decisions.push({
          status: 'adjusted',
          operatorNote: `末日早上 ${time} 送機，已移除末日${stripped.join('／')}。`,
          customerNote: `最後一天早上 ${time} 就要送機，當天就不另外排正餐囉，想吃的可以放到前一天，行李也比較好整理。`,
        })
      }
    }
  }

  // 8. over-full rerank — conservative, signal-gated, no cross-area moves.
  rerankOverFullDays(adjusted, changes, keep, decisions)

  return { adjustedInput: adjusted, decisions }
}

/**
 * Move trailing, non-protected activities off over-full days — but ONLY when the
 * structured signal is strong enough to do it safely:
 *   - the activity carries an areaTag, and
 *   - a target day already contains an activity of the SAME areaTag (no cross-area
 *     jumps), and that target still has spare capacity.
 * Missing signal → nothing is moved; the day's congestion is surfaced as advice.
 */
function rerankOverFullDays(
  adjusted: ComposeCustomerItineraryInput,
  changes: CustomerChangeRequest,
  keep: Set<string>,
  decisions: ChangeDecision[]
): void {
  const caps = changes.dayCapacities ?? []
  if (caps.length === 0) return
  const days = adjusted.requirements.days
  const tags = new Map((changes.activityAreaTags ?? []).map((t) => [t.activity, t.areaTag]))
  const capByDay = new Map(caps.map((c) => [c.day, c.maxStops]))

  for (const cap of caps) {
    const day = days.find((d) => d.day === cap.day)
    if (!day) continue
    let guard = 0
    while (dayStops(day) > cap.maxStops && guard++ < 20) {
      const note = moveOneTrailingActivity(day, days, tags, capByDay, keep)
      if (!note) {
        decisions.push({
          status: 'adjusted',
          operatorNote: `Day ${day.day} 活動偏多（${dayStops(day)} 站，建議上限 ${cap.maxStops}），缺少足夠分區／保留訊號，未自動重排，待人工確認。`,
          customerNote: '這天的點安排得比較滿，如果想玩得更輕鬆，我們可以再一起挑幾個重點，把步調放慢一點。',
        })
        break
      }
      decisions.push({
        status: 'adjusted',
        operatorNote: note,
        customerNote: '我們把這天比較滿的行程稍微分散到其他天，整體會更輕鬆好走。',
      })
    }
  }
}

function moveOneTrailingActivity(
  day: CustomerItineraryDayPlan,
  days: CustomerItineraryDayPlan[],
  tags: Map<string, string>,
  capByDay: Map<number, number>,
  keep: Set<string>
): string | null {
  const aft = day.afternoonActivities ?? []
  for (let i = aft.length - 1; i >= 0; i--) {
    const act = aft[i]
    if (keep.has(act)) continue
    const areaTag = tags.get(act)
    if (!areaTag) continue
    const target = days.find((d) => {
      if (d.day === day.day) return false
      const inArea = [...(d.morningActivities ?? []), ...(d.afternoonActivities ?? [])].some(
        (a) => tags.get(a) === areaTag
      )
      if (!inArea) return false
      const cap = capByDay.get(d.day)
      return cap === undefined || dayStops(d) < cap
    })
    if (!target) continue
    aft.splice(i, 1)
    day.afternoonActivities = aft
    target.afternoonActivities = [...(target.afternoonActivities ?? []), act]
    return `Day ${day.day}「${act}」已移至 Day ${target.day}（同區 ${areaTag}），平衡每日站數。`
  }
  return null
}

// ---------------------------------------------------------------------------
// Decision → customer / operator projection
// ---------------------------------------------------------------------------

function buildCustomerExplanation(decisions: ChangeDecision[]): string {
  const notes = decisions
    .map((d) => d.customerNote)
    .filter((n): n is string => Boolean(n))
  if (notes.length === 0) {
    return '行程已依您的需求更新，這是最新版本，您再看看，有想調整的地方都可以跟我說～'
  }
  return notes.join('\n')
}

// ---------------------------------------------------------------------------
// composeCustomerChange — applyChanges → project → M3.3b draft gate
// ---------------------------------------------------------------------------

export function composeCustomerChange(input: ChangeComposerInput): CustomerChangeResult {
  const { base, changes, retrievalCases = [] } = input
  const { adjustedInput, decisions } = applyChanges(base, changes, retrievalCases)
  const composed = composeCustomerItineraryDraft(adjustedInput)

  return {
    ok: composed.draft !== null,
    draft: composed.draft,
    customerExplanation: buildCustomerExplanation(decisions),
    operatorNotes: decisions.map((d) => d.operatorNote),
    issues: composed.issues,
  }
}
