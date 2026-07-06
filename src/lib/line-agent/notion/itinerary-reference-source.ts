/**
 * itinerary-reference-source.ts — design 2026-06-17 §2（golden 主幹反轉）。
 *
 * 兩套 golden 標準範本（A：清邁親子 5D4N、B：泰北芳縣深度 6D5N）**恆為**注入 LLM 的
 * skeleton 主幹（LLM 依需求自選一套再套日期/微調）。RAG 相似案降為「可微調素材」：
 * 命中且 sanitize 成功時，附於主幹之後並切 source=case；否則只回純 golden 主幹 source=template。
 *
 * sanitize 邊界（關鍵）：golden 主幹是「權威範本」，刻意保留具體航班碼/`**` markdown，
 * **不**過 sanitizer；只有 RAG 相似案段（toItineraryReference 內已過 sanitizeItinerarySnippet）
 * 維持 sanitize。絕不把整段 skeleton（含 golden）丟進 sanitizer，否則 golden 航班碼/markdown 會被改動。
 */
import type { RagIndex } from './rag-index'
import { retrieveRagCases } from './rag-query'
import { toItineraryReference } from './itinerary-reference'
import {
  GOLDEN_CHIANGMAI_FAMILY_5D4N,
  GOLDEN_NORTHERN_DEEP_6D5N,
  GOLDEN_LI_FAMILY_ELDERLY_7D6N,
  GOLDEN_NEWYEAR_5D4N,
} from './itinerary-reference-template'
import type { ItineraryCaseProfile } from './customer-itinerary-gate'

export interface SelectedReference {
  source: 'golden' | 'case' | 'template'
  skeleton: string
}

/**
 * 合併刀（開閘前必修 M-2）：排行程 draft 一個 turn 對 retrieval **只打一次**，
 * 同時回骨架（skeleton）、來源訊號（source，M-1 調語料涵蓋率的關鍵）、本案 profile
 * （per-case lint，profile 推不出 ⇒ null ⇒ gate 走中性）。取代 Task 4/5 落地時的兩條
 * inline 簽名（itineraryReferenceSource: string|null ＋ caseProfileSource: profile|null）。
 */
export interface ItineraryReferenceResult {
  skeleton: string
  source: 'golden' | 'case' | 'template'
  profile: ItineraryCaseProfile | null
}

/**
 * 注入 responder 的單一排行程參考源（開閘前必修 item6 型別別名）。`need` = 當則 draft
 * 請求文字（責任：responder 永遠傳 input.text）。未命中/低信心 ⇒ 由實作回 template
 * 骨架（絕不回 null 致 LLM 從零亂編）；整體不可用才回 null（responder fail-open）。
 */
export type ItineraryReferenceSource = (
  need: string
) => Promise<ItineraryReferenceResult | null>

/**
 * 兩套 golden 主幹恆注入（design 2026-06-17 §2 #4）：LLM 依需求自選一套再套日期/微調。
 * 刻意**不**過 sanitizer —— golden 是權威範本，保留具體航班碼/`**` markdown（見檔頭 sanitize 邊界）。
 */
function goldenTrunk(): string {
  return [
    '【標準範本 A：清邁親子 5 天 4 夜】',
    GOLDEN_CHIANGMAI_FAMILY_5D4N,
    '',
    '【標準範本 B：泰北芳縣深度 6 天 5 夜】',
    GOLDEN_NORTHERN_DEEP_6D5N,
  ].join('\n')
}

/** 跨年/天燈/CAD 消歧關鍵字（5 天時用以從經典分流到跨年；天數抽不到時亦用於 fallback）。 */
const NEWYEAR_KEYWORDS = /跨年|天燈|新年|CAD|水燈/
/** 長輩/行動不便消歧關鍵字（天數抽不到時 fallback 到李先生案）。 */
const ELDERLY_KEYWORDS = /長輩|輪椅|年長|行動不便|銀髮/
/** 泰北深度消歧關鍵字（天數抽不到時 fallback 到深度案）。 */
const DEEP_KEYWORDS = /深度|芳縣|清萊|金三角|泰北深度/

const CN_DIGITS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

/**
 * 從 need 抽天數：先抓「(數字)(天|日)」（阿拉伯或單一中文數字一~十）。
 * 取**第一個**匹配（避免「5天4夜」誤抓 4 夜——「夜」不在單位內，且天數優先）。
 * 抽不到回 null。
 */
function extractDays(need: string): number | null {
  const m = need.match(/([0-9]+|[一二三四五六七八九十])\s*[天日]/)
  if (!m) return null
  const token = m[1]
  if (/^[0-9]+$/.test(token)) return parseInt(token, 10)
  return CN_DIGITS[token] ?? null
}

interface GoldenCase {
  id: string
  skeleton: string
}

const GOLDEN_CLASSIC: GoldenCase = { id: 'classic-5d4n', skeleton: GOLDEN_CHIANGMAI_FAMILY_5D4N }
const GOLDEN_DEEP: GoldenCase = { id: 'northern-6d5n', skeleton: GOLDEN_NORTHERN_DEEP_6D5N }
const GOLDEN_LI: GoldenCase = { id: 'li-7d6n', skeleton: GOLDEN_LI_FAMILY_ELDERLY_7D6N }
const GOLDEN_NEWYEAR: GoldenCase = { id: 'newyear-5d4n', skeleton: GOLDEN_NEWYEAR_5D4N }

/**
 * 第3刀：golden 檢索優先級 matcher。**天數為主鍵、關鍵字消歧**。
 *
 * - 抽到 days：5→（跨年關鍵字勝出則跨年，否則經典）；6→深度；7→李先生；其他（4/8…）→ null。
 * - 抽不到 days：關鍵字 fallback（跨年 > 李先生 > 深度），都沒 → null。
 *
 * 命中回該案 {id, skeleton}（skeleton 為權威範本，呼叫端**絕不**送 sanitizer）；不命中回 null。
 */
export function matchGoldenCase(need: string): GoldenCase | null {
  const days = extractDays(need)
  if (days !== null) {
    if (days === 5) return NEWYEAR_KEYWORDS.test(need) ? GOLDEN_NEWYEAR : GOLDEN_CLASSIC
    if (days === 6) return GOLDEN_DEEP
    if (days === 7) return GOLDEN_LI
    return null // 其他天數（4、8…）目前無 golden
  }
  // 天數抽不到 → 關鍵字 fallback（消歧優先序：跨年 > 李先生 > 深度）
  if (NEWYEAR_KEYWORDS.test(need)) return GOLDEN_NEWYEAR
  if (ELDERLY_KEYWORDS.test(need)) return GOLDEN_LI
  if (DEEP_KEYWORDS.test(need)) return GOLDEN_DEEP
  return null
}

export function selectItineraryReference(index: RagIndex, need: string): SelectedReference {
  // 第3刀：先比對四案。命中 ⇒ 只放該 golden 排第一（優先級非擴主幹），切 source=golden。
  const matched = matchGoldenCase(need)

  // 沿用既有迴圈取第一個 sanitize 成功的 RAG 相似案（可微調素材）。
  let firstRef: { skeleton: string } | null = null
  const hits = retrieveRagCases(index, need)
  for (const hit of hits) {
    const ref = toItineraryReference(hit) // 相似案於此過 sanitizeItinerarySnippet（去個資/航班碼）
    if (ref) {
      firstRef = ref
      break
    }
  }

  if (matched) {
    // 命中路徑：只放該 matched golden（不再 dump 兩套 trunk）。matched 是權威範本，
    // **絕不**過 sanitizer；只有 RAG firstRef 段（已於 toItineraryReference 內 sanitize）附後。
    let skeleton = `【最相符 golden 範本（依需求套日期/微調）】\n${matched.skeleton}`
    if (firstRef) {
      skeleton += `\n\n【參考真實案例（可微調素材，非主幹）】\n${firstRef.skeleton}`
    }
    return { source: 'golden', skeleton }
  }

  // 未命中：維持現行 trunk 路徑（firstRef 有 → case；無 → template）。
  const trunk = goldenTrunk()
  if (firstRef) {
    const skeleton = `${trunk}\n\n【參考真實案例（可微調素材，非主幹）】\n${firstRef.skeleton}`
    return { source: 'case', skeleton }
  }
  return { source: 'template', skeleton: trunk }
}

/**
 * 合併刀（M-2）：把骨架選取（selectItineraryReference）＋本案 profile 推導
 * （deriveProfile）包成單一 ItineraryReferenceSource，一個 draft turn 對
 * retrieval **只打一次**。index 與 deriveProfile 皆注入 —— 本模組不讀 env、不
 * 建 Notion client（真 getIndex（TTL 快取）＋真推導器由 composition root 接）。
 * getIndex 失敗 ⇒ 直接上拋，由 responder 端 fail-open 接住（itinerary_reference_
 * unavailable log），絕不在此吞掉成「無骨架」靜默降級。
 */
export interface CreateItineraryReferenceSourceDeps {
  /** Expensive：讀語料建索引，由 caller 以 TTL + single-flight 快取。 */
  getIndex: () => Promise<RagIndex>
  /** 從當則 draft 文字推導本案 per-case lint profile；推不出回 null（gate 走中性）。 */
  deriveProfile: (need: string) => ItineraryCaseProfile | null
}

export function createItineraryReferenceSource(
  deps: CreateItineraryReferenceSourceDeps
): ItineraryReferenceSource {
  return async (need) => {
    const index = await deps.getIndex()
    const selected = selectItineraryReference(index, need)
    return {
      skeleton: selected.skeleton,
      source: selected.source,
      profile: deps.deriveProfile(need),
    }
  }
}
