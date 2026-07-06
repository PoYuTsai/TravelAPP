/**
 * itinerary-case-profile.ts — 合併刀（M-2）的本案 profile 推導器。
 *
 * 從一則鬆散的夥伴群對話文字，抽出 customer-itinerary-gate 的 per-case lint 子集
 * （ItineraryCaseProfile）。設計鐵律：
 *  - **高訊號才設**：抽不到的欄位一律不設 ⇒ gate 回退中性，no-profile 路徑零變化。
 *  - **knownFlight 保守**：gate 的 redundant_flight_confirm 是 error 規則，誤設會把
 *    合法的「待確認航班」草稿錯擋（牴觸 Task 7 persona）。故僅在明確航班碼/航空＋
 *    明確抵達時刻、且無「待確認/還沒訂」抑制詞時才設。航班真相長線收斂進 Task 8
 *    航班時刻表 RAG（計畫 item7），此處只認客人**自己明講**的航班。
 *  - 純函式：不讀 env、不碰 I/O。全抽不到 ⇒ 回 null。
 */
import type { ItineraryCaseProfile } from './customer-itinerary-gate'

/** 行動不便訊號（保守）：明確提到輪椅/行動受限才觸發；單純「長輩同行」不算。 */
const LIMITED_MOBILITY_RE =
  /輪椅|wheelchair|行動不便|不良於行|拄?拐杖|走不[遠動]|無障礙/i

/** 住宿區域：古城是唯一帶 lodging 衝突規則（Rule 5）的 canonical key。 */
const OLD_CITY_RE = /古城|舊城|old\s*city/i

/** 全程同住一間：觸發 stayArea lodging 一致性規則。 */
const SAME_LODGING_RE = /全程(住|同|不換)|不(想|用)?換(飯店|旅館|酒店|宿)|都住同一|同一(間|家)(飯店|旅館|酒店)/

/** 航班未定的抑制詞：出現即不設 knownFlight（避免錯擋「待確認」草稿）。 */
const FLIGHT_UNKNOWN_RE = /待確認|還沒訂|還在(看|查|找)|未訂|沒訂|不確定/

/** 明確航班碼：兩字母 + 3~4 碼數字（CI851 / BR257）。 */
const FLIGHT_CODE_RE = /\b[A-Z]{2}\s?\d{3,4}\b/
/** 中文航空名（保守白名單）。 */
const AIRLINE_NAME_RE = /華航|中華航空|長榮|泰航|泰國航空|虎航|亞航|酷鳥|曼谷航空/
/** 抵達時刻：HH:MM（全半形冒號）或 X點/X時（可含時段前綴）。 */
const ARRIVAL_TIME_RE =
  /\d{1,2}\s?[:：]\s?\d{2}|(?:上午|下午|早上|晚上|中午|傍晚|凌晨)?\s?\d{1,2}\s?[點時]/

/**
 * 推導本案 profile。抽不到任何欄位回 null（gate 走中性，與 no-profile 等價）。
 */
export function deriveCaseProfile(text: string): ItineraryCaseProfile | null {
  const profile: ItineraryCaseProfile = {}

  if (LIMITED_MOBILITY_RE.test(text)) {
    profile.mobility = { type: 'limited_mobility_wheelchair_assisted' }
  }
  if (OLD_CITY_RE.test(text)) {
    profile.stayArea = 'chiangmai_old_city'
  }
  if (SAME_LODGING_RE.test(text)) {
    profile.sameLodgingAllTrip = true
  }

  // knownFlight — 保守：抑制詞優先；要同時有「航班碼或航空名」＋「明確抵達時刻」。
  if (!FLIGHT_UNKNOWN_RE.test(text)) {
    const code = text.match(FLIGHT_CODE_RE)?.[0]
    const airlineName = text.match(AIRLINE_NAME_RE)?.[0]
    const arrival = text.match(ARRIVAL_TIME_RE)?.[0]
    const airline = code ?? airlineName
    if (airline && arrival) {
      profile.knownFlight = { airline: airline.trim(), arrivalTime: arrival.trim() }
    }
  }

  return Object.keys(profile).length > 0 ? profile : null
}
