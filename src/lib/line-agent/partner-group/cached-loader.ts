/**
 * cached-loader.ts — 檢索閉環刀：TTL + single-flight 快取的泛型核心，
 * 從 cached-rag-source.ts 抽出（design 2026-06-12 §2 快取）。
 *
 * 兩個消費者、兩種失敗語意：
 *  - cached-rag-source（fail-closed）：error 上拋，rag responder 轉 unavailable reply。
 *  - qa-knowledge-source（fail-open）：呼叫端 catch error 轉 null。
 * 共同點：error 永不快取 — 下一次呼叫重試，絕不為整個 TTL 供應 stale failure。
 */

export interface CachedLoaderDeps<T> {
  /** Expensive load（如讀 Notion）。成功結果快取一個 TTL 窗。 */
  load: () => Promise<T>
  /** 快取壽命 ms。建置時間 >= ttlMs 即視為過期重建。 */
  ttlMs: number
  /** 注入時鐘（ms）。預設 wall clock；測試 pin 死。 */
  now?: () => number
}

export function createCachedLoader<T>(deps: CachedLoaderDeps<T>): () => Promise<T> {
  const { load, ttlMs } = deps
  const now = deps.now ?? (() => Date.now())

  let entry: { value: T; builtAt: number } | null = null
  let inFlight: Promise<T> | null = null

  return async function get(): Promise<T> {
    if (entry !== null && now() - entry.builtAt < ttlMs) {
      return entry.value
    }
    if (inFlight !== null) {
      return inFlight
    }
    inFlight = (async () => {
      try {
        const value = await load()
        // builtAt 在 load 之後才蓋章 — TTL 只涵蓋可用快取時間。
        entry = { value, builtAt: now() }
        return value
      } finally {
        // 永遠清 in-flight latch — 成功則下一個呼叫讀 fresh entry；失敗則
        // entry 未動 ⇒ 失敗不被快取，下一次呼叫重試。
        inFlight = null
      }
    })()
    return inFlight
  }
}
