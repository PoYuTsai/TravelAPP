/**
 * customer-itinerary-golden.ts
 *
 * M3.3a golden fixture — Eric 真實實戰 case「李先生一家清邁長輩友善 7 天 6 夜」.
 *
 * This is a high-value REGRESSION asset, not throwaway test data. It captures:
 *   - LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS — the machine-readable case profile
 *     (days/nights, lodging policy, limited-mobility profile, known flight).
 *   - LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY — Eric's hand-adjusted final
 *     customer-version itinerary text (customer_itinerary_v1 format). The lint
 *     layer MUST treat this as fully PASSing (no error issues).
 *   - bad-case builders — each mutates the golden text to violate exactly ONE
 *     lint rule, so a test can prove the linter catches that regression.
 *
 * Human-readable knowledge counterpart (background + Eric's planning rationale):
 *   docs/ai-agent-knowledge/cases/itinerary-templates/li-family-elderly-chiangmai-7d6n.md
 *
 * NOTE: Eric's golden uses plain `9:00 出發` (no bold) and keeps a wheelchair
 * 需確認 note in the 人數 header — both are intentional and must stay PASSing.
 */

import type { CustomerItineraryConstraints } from '../customer-itinerary-lint'
import type { ComposeCustomerItineraryInput } from '../customer-itinerary-composer'

export const LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS: CustomerItineraryConstraints = {
  days: 7,
  nights: 6,
  stayArea: 'chiangmai_old_city',
  sameLodgingAllTrip: true,
  departureDayTransferTime: '09:30',
  departureDayPeriod: 'morning',
  mobility: {
    type: 'limited_mobility_wheelchair_assisted',
    wheelchairFoldedSizeCm: [50, 28, 73],
    canWalkHoursPerDay: [1, 2],
    canSelfBoardVehicle: true,
  },
  knownFlight: {
    airline: 'CI',
    arrivalTime: '10:20',
  },
  customerVersion: true,
}

/**
 * Eric's final hand-adjusted customer version. Transcribed verbatim from the
 * real case so the linter is pinned against ground truth, not a paraphrase.
 */
export const LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY = `<李先生一家套餐訂製> 清邁長輩友善7天6夜包車中文導遊行程
📅 日期：2025/08/04～2025/08/10
👨‍👩‍👧‍👦 人數：8大（含長輩；媽媽腿腳不舒服時可能需要輪椅，需確認輪椅是否可折疊、上下車是否需要協助、每天可步行時間；全程包車＋中文導遊；全程住宿清邁古城同一間民宿)
8/4 (二)
Day 1｜抵達清邁・換匯入住・古城慢遊
・清邁機場接機（華航10:20抵達）
・Nakhonping Exchange 換匯
午餐：Neng Roasted Pork（清邁必吃脆皮豬）
・民宿 check in/休息
・古城輕鬆散步或塔佩門周邊拍照（依長輩狀況調整）
晚餐：Samsen Villa
・住宿：清邁古城民宿

8/5 (三)
Day 2｜湄林近郊・花園與輕鬆親近動物
9:00 出發
・鮮花花園（以好拍照、步行量可控為主）
・大象便便造紙公園
午餐：Mai Heun 60 (泰北料理)
・蘭花園/蝴蝶園（可依長輩體力替換）
・咖啡廳休息
晚餐：Kung Yim Shop (2nd Branch) (泰國蝦吃到飽)
・住宿：清邁古城民宿

8/6 (四)
Day 3｜大象友善保護營・景點咖啡・清邁市區
9:00 出發
・大象友善保護營（以不騎象、餵食、互動、觀察為主；需確認長輩是否方便行走與營區動線）
午餐：營區或附近餐廳
・天使瀑布
・清邁藍廟
・水果市場
晚餐：清邁康托克帝王餐晚宴＆文化表演秀
・住宿：清邁古城民宿

8/7 (五)
Day 4｜茵他儂國家公園・高山慢遊
8:00 出發
・茵他儂國家公園主峰
・雙塔（依長輩行動狀況安排；步行量可調整）
午餐：山區餐廳或園區附近用餐
・苗族市場
・瓦吉拉瀑布（若步行不便，可改遠觀或縮短停留）
・咖啡廳休息
晚餐：謝桐興餐廳 (中式有名潮州菜)
・住宿：清邁古城民宿

8/8 (六)
Day 5｜素帖山・尼曼區・輕鬆購物
9:00 出發
・素帖山雙龍寺（可依長輩狀況評估是否上去，這間拜拜很靈）
・清邁大學周邊或寧曼區
午餐：待安排
・One Nimman/MAYA 周邊輕鬆逛街
・按摩或回飯店休息
・清邁夜間動物園（有遊園車，減少步行；建議大概傍晚16:30到園區）
晚餐：黑森林餐廳
・住宿：清邁古城民宿

8/9 (日)
Day 6｜週末市集・藝術村・伴手禮
9:00 出發
・真心市集（週末限定；預設只排一個週末市集，避免太累）
午餐：市集或附近餐廳
・Baan Kang Wat 藝術村（週二休；本日若非週二可安排）
・Big C/伴手禮採買
晚餐：GINGER FARM kitchen at ONENIMMAN Chiangmai
・住宿：清邁古城民宿

8/10 (一)
Day 7｜收心慢遊・送機
・早餐後退房/飯店整理行李
・9:30 送機，平安返家`

// ---------------------------------------------------------------------------
// Bad-case builders — each violates exactly ONE lint rule vs the golden text.
// Builders operate by string surgery on the golden so the rest stays PASSing,
// isolating the rule under test.
// ---------------------------------------------------------------------------

/** Day 3 gets a second 午餐 line (the real prior-AI regression). */
export function withDuplicateLunch(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '午餐：營區或附近餐廳\n',
    '午餐：營區或附近餐廳\n午餐：清邁市區小吃\n'
  )
}

/** Day 3 gets a second 晚餐 line. */
export function withDuplicateDinner(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '晚餐：清邁康托克帝王餐晚宴＆文化表演秀\n',
    '晚餐：清邁康托克帝王餐晚宴＆文化表演秀\n晚餐：夜市小吃\n'
  )
}

/** Morning-transfer final day must not carry a 午餐. */
export function withFinalDayLunch(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・9:30 送機，平安返家',
    '午餐：機場餐廳\n・9:30 送機，平安返家'
  )
}

/** Morning-transfer final day must not carry a 晚餐. */
export function withFinalDayDinner(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・9:30 送機，平安返家',
    '晚餐：最後一晚餐廳\n・9:30 送機，平安返家'
  )
}

/** Morning-transfer final day must not carry a 住宿. */
export function withFinalDayLodging(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・9:30 送機，平安返家',
    '・9:30 送機，平安返家\n・住宿：清邁古城民宿'
  )
}

/** sameLodgingAllTrip but one night flips to a different city/area. */
export function withWrongLodgingArea(): string {
  // String.replace hits the FIRST 住宿 line only — Day 1 becomes 清萊.
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・住宿：清邁古城民宿',
    '・住宿：清萊夜市民宿'
  )
}

/** Limited-mobility case must not actively schedule intense/unsuitable items. */
export function withIntenseActivity(token = '叢林飛索'): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・水果市場\n',
    `・水果市場\n・${token}\n`
  )
}

/** 天使瀑布 is a cafe/photo stop here — must not be tagged high-risk/replaceable. */
export function withMiscategorizedTianshi(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・天使瀑布',
    '・天使瀑布（激烈瀑布步道，若長輩不適可改咖啡廳）'
  )
}

/** 夜間動物園 present but stripped of the 遊園車 / 減少步行 mitigation note. */
export function withNightSafariNoTram(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・清邁夜間動物園（有遊園車，減少步行；建議大概傍晚16:30到園區）',
    '・清邁夜間動物園（建議大概傍晚16:30到園區）'
  )
}

/** Flight is known, yet Day 1 still asks to confirm it. */
export function withUnknownFlightPrompt(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・清邁機場接機（華航10:20抵達）',
    '・清邁機場接機（需確認航班號與 CNX 抵達時間）'
  )
}

/** A Day heading is dropped, breaking 1..days consecutiveness. */
export function withMissingDayHeading(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    'Day 3｜大象友善保護營・景點咖啡・清邁市區\n',
    ''
  )
}

/** A non-final full day loses its 午餐 label. */
export function withMissingMealLabel(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '午餐：Mai Heun 60 (泰北料理)\n',
    ''
  )
}

/** Internal-only notes (cost / profit) leak into the customer version. */
export function withInternalNotes(): string {
  return LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(
    '・水果市場\n',
    '・水果市場\n・內部備註：成本約 60000，分潤 30%\n'
  )
}

// ---------------------------------------------------------------------------
// M3.3b — structured requirements for the deterministic composer.
//
// Mirrors the golden case as a machine-readable plan so the composer can render
// a customer_itinerary_v1 draft that PASSES M3.3a lint (the first regression
// benchmark). Day order renders departure → morningActivities → lunch →
// afternoonActivities → dinner → lodging, which naturally interleaves meals.
// ---------------------------------------------------------------------------

export const LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS: ComposeCustomerItineraryInput = {
  constraints: LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS,
  requirements: {
    title: '李先生一家',
    headerTitle: '清邁長輩友善7天6夜包車中文導遊行程',
    dateRange: '2025/08/04～2025/08/10',
    partyDescription:
      '8大（含長輩；媽媽腿腳不舒服時可能需要輪椅，需確認輪椅是否可折疊、上下車是否需要協助、每天可步行時間；全程包車＋中文導遊；全程住宿清邁古城同一間民宿)',
    days: [
      {
        day: 1,
        dateLabel: '8/4 (二)',
        title: '抵達清邁・換匯入住・古城慢遊',
        morningActivities: [
          '清邁機場接機（華航10:20抵達）',
          'Nakhonping Exchange 換匯',
        ],
        lunch: 'Neng Roasted Pork（清邁必吃脆皮豬）',
        afternoonActivities: [
          '民宿 check in/休息',
          '古城輕鬆散步或塔佩門周邊拍照（依長輩狀況調整）',
        ],
        dinner: 'Samsen Villa',
        lodging: '清邁古城民宿',
      },
      {
        day: 2,
        dateLabel: '8/5 (三)',
        title: '湄林近郊・花園與輕鬆親近動物',
        departureTime: '9:00',
        morningActivities: ['鮮花花園（以好拍照、步行量可控為主）', '大象便便造紙公園'],
        lunch: 'Mai Heun 60 (泰北料理)',
        afternoonActivities: ['蘭花園/蝴蝶園（可依長輩體力替換）', '咖啡廳休息'],
        dinner: 'Kung Yim Shop (2nd Branch) (泰國蝦吃到飽)',
        lodging: '清邁古城民宿',
      },
      {
        day: 3,
        dateLabel: '8/6 (四)',
        title: '大象友善保護營・景點咖啡・清邁市區',
        departureTime: '9:00',
        morningActivities: [
          '大象友善保護營（以不騎象、餵食、互動、觀察為主；需確認長輩是否方便行走與營區動線）',
        ],
        lunch: '營區或附近餐廳',
        afternoonActivities: ['天使瀑布', '清邁藍廟', '水果市場'],
        dinner: '清邁康托克帝王餐晚宴＆文化表演秀',
        lodging: '清邁古城民宿',
      },
      {
        day: 4,
        dateLabel: '8/7 (五)',
        title: '茵他儂國家公園・高山慢遊',
        departureTime: '8:00',
        morningActivities: [
          '茵他儂國家公園主峰',
          '雙塔（依長輩行動狀況安排；步行量可調整）',
        ],
        lunch: '山區餐廳或園區附近用餐',
        afternoonActivities: [
          '苗族市場',
          '瓦吉拉瀑布（若步行不便，可改遠觀或縮短停留）',
          '咖啡廳休息',
        ],
        dinner: '謝桐興餐廳 (中式有名潮州菜)',
        lodging: '清邁古城民宿',
      },
      {
        day: 5,
        dateLabel: '8/8 (六)',
        title: '素帖山・尼曼區・輕鬆購物',
        departureTime: '9:00',
        morningActivities: [
          '素帖山雙龍寺（可依長輩狀況評估是否上去，這間拜拜很靈）',
          '清邁大學周邊或寧曼區',
        ],
        lunch: '待安排',
        afternoonActivities: [
          'One Nimman/MAYA 周邊輕鬆逛街',
          '按摩或回飯店休息',
          '清邁夜間動物園（有遊園車，減少步行；建議大概傍晚16:30到園區）',
        ],
        dinner: '黑森林餐廳',
        lodging: '清邁古城民宿',
      },
      {
        day: 6,
        dateLabel: '8/9 (日)',
        title: '週末市集・藝術村・伴手禮',
        departureTime: '9:00',
        morningActivities: ['真心市集（週末限定；預設只排一個週末市集，避免太累）'],
        lunch: '市集或附近餐廳',
        afternoonActivities: [
          'Baan Kang Wat 藝術村（週二休；本日若非週二可安排）',
          'Big C/伴手禮採買',
        ],
        dinner: 'GINGER FARM kitchen at ONENIMMAN Chiangmai',
        lodging: '清邁古城民宿',
      },
      {
        day: 7,
        dateLabel: '8/10 (一)',
        title: '收心慢遊・送機',
        morningActivities: ['早餐後退房/飯店整理行李', '9:30 送機，平安返家'],
      },
    ],
  },
}

/** Deep-clone the structured requirements so a mutation isolates one bad rule. */
function cloneRequirements(): ComposeCustomerItineraryInput {
  return JSON.parse(JSON.stringify(LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS))
}

/** Final morning-transfer day wrongly carries a dinner → composer must fail-closed. */
export function requirementsWithFinalDayDinner(): ComposeCustomerItineraryInput {
  const r = cloneRequirements()
  r.requirements.days[6].dinner = '最後一晚餐廳'
  return r
}

/** One night flips to a different city → composer must fail-closed. */
export function requirementsWithWrongLodging(): ComposeCustomerItineraryInput {
  const r = cloneRequirements()
  r.requirements.days[0].lodging = '清萊夜市民宿'
  return r
}

/** Limited-mobility case schedules an intense activity → composer must fail-closed. */
export function requirementsWithIntenseActivity(token = '叢林飛索'): ComposeCustomerItineraryInput {
  const r = cloneRequirements()
  r.requirements.days[2].afternoonActivities?.push(token)
  return r
}

/** Flight is known but Day 1 still asks to confirm it → composer must fail-closed. */
export function requirementsWithRedundantFlight(): ComposeCustomerItineraryInput {
  const r = cloneRequirements()
  r.requirements.days[0].morningActivities = ['清邁機場接機（需確認航班號與 CNX 抵達時間）']
  return r
}
