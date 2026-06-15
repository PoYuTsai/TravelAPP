/**
 * itinerary-reference-source.ts — design 2026-06-14 §4。
 *
 * 新客需 → retrieveRagCases 取候選 → toItineraryReference（含 sanitizer）。
 * 有真案例優先；low_confidence（無訊號/無命中）或全數 fail-closed ⇒ 退回手工
 * 「清邁親子5天4夜經典套餐」markdown 骨架。絕不讓 LLM 從零亂編。
 */
import type { RagIndex } from './rag-index'
import { retrieveRagCases } from './rag-query'
import { toItineraryReference } from './itinerary-reference'
import { sanitizeItinerarySnippet } from './itinerary-reference-sanitizer'
import { ITINERARY_TEMPLATE_SKELETON } from './itinerary-reference-template'
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
 * fallback 手工骨架（I-1/I-2）：inline TS 常數（無 readFileSync docs/** 的 lambda 風險），
 * 並與真案例共走同一 sanitizeItinerarySnippet assert（統一不變量）。常數已 curated 乾淨
 * （drift-guard 測試把關），sanitize 不會 fail-closed；萬一未來被改髒，`?? 常數` 確保仍有骨架可注入。
 */
function templateSkeleton(): string {
  const r = sanitizeItinerarySnippet(ITINERARY_TEMPLATE_SKELETON)
  return r.skeleton ?? ITINERARY_TEMPLATE_SKELETON
}

export function selectItineraryReference(index: RagIndex, need: string): SelectedReference {
  const hits = retrieveRagCases(index, need)
  for (const hit of hits) {
    const ref = toItineraryReference(hit)
    if (ref) return { source: 'case', skeleton: ref.skeleton } // 第一個 sanitize 成功的即用
  }
  return { source: 'template', skeleton: templateSkeleton() }
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
