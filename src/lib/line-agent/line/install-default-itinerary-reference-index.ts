/**
 * install-default-itinerary-reference-index.ts — 排行程合併刀的 SDK 邊界
 * （wiring 刀本體）。
 *
 * 唯一 import 真 `@notionhq/client` 並構造 Notion 索引載入器的地方。webhook
 * （composition root）以 lazy `import()` 觸發，故 webhook/responder/seam 的靜態
 * 圖維持 SDK-free。複用既有的 partner-rag 拼圖：`createNotionRagClient`（adapter）
 * ＋ `loadNotionRagIndex`（EXPENSIVE，fail-closed）＋ `createCachedLoader`
 * （TTL＋single-flight），故排行程與夥伴問答走同一套已驗證的索引建置。
 *
 * import 無副作用：什麼都不跑、不讀 env、不構造 SDK、不碰 Notion。只有
 * `buildDefaultItineraryRagIndexLoader` 被呼叫時才動作。Fail-closed＋不洩漏：
 *  - 缺 NOTION_TOKEN ⇒ 不構造 SDK、loader=null、固定碼 `missing_notion_token`。
 *  - SDK 構造失敗 ⇒ 吞原始錯（可能含 token）、回 `notion_client_init_failed`。
 * 它**不**翻任何 env 閘；開閘由 webhook 的 AI_AGENT_NOTION_RAG_ENABLED 判定，
 * 此處只負責「閘已開後」把真索引載入器接上。
 */
import { Client } from '@notionhq/client'
import {
  createNotionRagClient,
  type NotionLikeSdkClient,
} from '../notion/notion-rag-client'
import { loadNotionRagIndex } from '../partner-group/notion-rag-answer-source'
import { createCachedLoader } from '../partner-group/cached-loader'
import type { RagIndex } from '../notion/rag-index'

/** 預設快取壽命（§6 成本守門）：與 partner-rag 對齊，一個窗最多一次 Notion 讀。 */
export const DEFAULT_ITINERARY_RAG_TTL_MS = 10 * 60 * 1000

/** 由 auth token 建注入式 Notion-like SDK（測試注入假的）。 */
export type NotionSdkClientFactory = (auth: string) => NotionLikeSdkClient

export interface BuildItineraryRagIndexLoaderDeps {
  /** 讀 token＋RAG config 的 env，預設 process.env。 */
  env?: Record<string, string | undefined>
  /** 快取壽命 ms，預設 DEFAULT_ITINERARY_RAG_TTL_MS。 */
  ttlMs?: number
  /** SDK 工廠 seam，預設真 `@notionhq/client` Client；測試注入假的。 */
  createSdkClient?: NotionSdkClientFactory
  /** 注入時鐘（ms），預設 wall clock；測試 pin 死以驗 TTL。 */
  now?: () => number
}

export interface BuildItineraryRagIndexLoaderResult {
  /** TTL 快取的 RagIndex 載入器；fail-closed 時為 null。 */
  loader: (() => Promise<RagIndex>) | null
  /** 未建成時的固定碼 —— 絕不含 token / db id / url。 */
  reason?: 'missing_notion_token' | 'notion_client_init_failed'
}

/**
 * 真 SDK 工廠。v5 `Client` 結構上相容我們的窄 `NotionLikeSdkClient` port，型別較寬
 * 故經 `unknown` 轉。構造為 lazy（無網路），install 時建是安全的。
 */
const defaultSdkFactory: NotionSdkClientFactory = (auth) =>
  new Client({ auth }) as unknown as NotionLikeSdkClient

/**
 * 建排行程的 TTL 快取 RagIndex 載入器。讀 token → 經（可注入）工廠建 SDK →
 * 包成 NotionRagClient → 用 createCachedLoader 包 loadNotionRagIndex。fail-closed
 * ＋不洩漏（見檔頭）。回 loader（或 null＋固定碼）。
 */
export function buildDefaultItineraryRagIndexLoader(
  deps: BuildItineraryRagIndexLoaderDeps = {}
): BuildItineraryRagIndexLoaderResult {
  const env = deps.env ?? process.env
  const token = (env.NOTION_TOKEN ?? '').trim()
  if (token === '') {
    return { loader: null, reason: 'missing_notion_token' }
  }

  const createSdkClient = deps.createSdkClient ?? defaultSdkFactory
  let sdk: NotionLikeSdkClient
  try {
    sdk = createSdkClient(token)
  } catch {
    // 吞原始構造錯（可能 echo token），回固定碼；什麼都不接。
    return { loader: null, reason: 'notion_client_init_failed' }
  }

  const client = createNotionRagClient(sdk)
  const loader = createCachedLoader<RagIndex>({
    load: () => loadNotionRagIndex({ env, client }),
    ttlMs: deps.ttlMs ?? DEFAULT_ITINERARY_RAG_TTL_MS,
    ...(deps.now ? { now: deps.now } : {}),
  })
  return { loader }
}
