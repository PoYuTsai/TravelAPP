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
} from './itinerary-reference-template'
import type { ItineraryCaseProfile } from './customer-itinerary-gate'

export interface SelectedReference {
  source: 'case' | 'template'
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
  source: 'case' | 'template'
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

export function selectItineraryReference(index: RagIndex, need: string): SelectedReference {
  const trunk = goldenTrunk()
  const hits = retrieveRagCases(index, need)
  for (const hit of hits) {
    const ref = toItineraryReference(hit) // 相似案於此過 sanitizeItinerarySnippet（去個資/航班碼）
    if (ref) {
      // 第一個 sanitize 成功的相似案附為「可微調素材」，主幹仍為兩套 golden。
      const skeleton = `${trunk}\n\n【參考真實案例（可微調素材，非主幹）】\n${ref.skeleton}`
      return { source: 'case', skeleton }
    }
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
