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

export interface SelectedReference {
  source: 'case' | 'template'
  skeleton: string
}

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
