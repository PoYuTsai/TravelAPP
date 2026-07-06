/**
 * itinerary-reference-wiring.ts — composition-root 閘（wiring 刀本體）。
 *
 * 把排行程合併刀的 source 接線收斂成一個薄閘：webhook（composition root）讀
 * AI_AGENT_NOTION_RAG_ENABLED，閘關回 undefined（factory 不接線 ⇒ responder
 * byte-identical），閘開回 createItineraryReferenceSource（用注入的 TTL 快取
 * getIndex 選骨架 ＋ deriveCaseProfile 抽本案 profile）。
 *
 * 鐵律：本 helper 與 responder 都不建 Notion client、不直接 import SDK —— 真索引
 * 建置（@notionhq/client）走 webhook 的 lazy dynamic-import installer，getIndex
 * 由那裡注入。閘採與 rag-draft-surfacing 相同的字串約定（恰為 "true" 才開）。
 */
import {
  createItineraryReferenceSource,
  type ItineraryReferenceSource,
} from '../notion/itinerary-reference-source'
import { deriveCaseProfile } from '../notion/itinerary-case-profile'
import type { RagIndex } from '../notion/rag-index'

/** 與 AI_AGENT_NOTION_RAG_ENABLED 既有約定一致：trim 後恰為 "true" 才開。 */
export function isNotionRagEnabled(env: Record<string, string | undefined>): boolean {
  return (env.AI_AGENT_NOTION_RAG_ENABLED ?? '').trim() === 'true'
}

export interface ResolveItineraryReferenceSourceDeps {
  /** Composition-root 的 env（webhook 傳 process.env）。 */
  env: Record<string, string | undefined>
  /** TTL 快取的 RagIndex 載入器（SDK 邊界在 webhook 的 lazy installer）。 */
  getIndex: () => Promise<RagIndex>
}

/**
 * 閘關 ⇒ undefined（不接線、byte-identical）；閘開 ⇒ 合併 source。profile 推導器
 * 固定為 deriveCaseProfile（純函式），故開閘即真本案規則生效。
 */
export function resolveItineraryReferenceSource(
  deps: ResolveItineraryReferenceSourceDeps
): ItineraryReferenceSource | undefined {
  if (!isNotionRagEnabled(deps.env)) return undefined
  return createItineraryReferenceSource({
    getIndex: deps.getIndex,
    deriveProfile: deriveCaseProfile,
  })
}
