/**
 * qa-knowledge-source.ts — 檢索閉環刀：沉澱問答 DB（已批准）→ system prompt
 * 知識區塊（design 2026-06-12 §1 觸點 1）。
 *
 * Mirror distilled-qa-writer.ts 紀律、方向相反（讀不是寫）：
 *  - SDK 注入式最小面（databases.retrieve ＋ dataSources.query）；真 Client
 *    只在 composition root（install-default-qa-knowledge-source.ts）構建。
 *  - data_source_id 在實例內 lazy cache（單 source DB）。
 *  - Leak guard：raw SDK error 可能夾 token / db id / notion url — 一律吞掉，
 *    只 log fixed code。
 *
 * FAIL-OPEN（對照 cached-rag-source 的 fail-closed）：知識是 enhancement，
 * 任何失敗 ⇒ 回 null，responder 退回現行 prompt。錯誤不快取（cached-loader
 * 保證）— 下一則訊息重試。0 條已批准＝成功的空結果 ⇒ null 且**會**快取
 * （KB 空時不必每則訊息打 Notion）。
 *
 * 全量注入（無 per-message 檢索）：cap 30 條量級下全量比相似度檢索簡單且夠用，
 * 也因此 source 簽名零參數 — 與當則訊息無關，快取一份全群共用。
 */

import { createCachedLoader } from './cached-loader'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'

/** 零參數：全量知識區塊文字；無知識/失敗 ⇒ null。 */
export type QaKnowledgeSource = () => Promise<string | null>

/** 注入 SDK 的最小結構面（真 @notionhq/client v5 Client 結構相容）。 */
export interface QaKnowledgeSdkClient {
  databases: {
    retrieve(args: { database_id: string }): Promise<{
      data_sources?: Array<{ id: string }>
    }>
  }
  dataSources: {
    query(args: {
      data_source_id: string
      filter?: unknown
      page_size?: number
    }): Promise<{ results: unknown[]; has_more?: boolean }>
  }
}

/** 注入上限 — 超過截斷照用＋log（design §2 失敗路徑表）。 */
export const QA_KNOWLEDGE_CAP = 30
/** TTL 10 分鐘 — CC 寫新知識最慢 10 分鐘生效（design §2 快取）。 */
export const QA_KNOWLEDGE_TTL_MS = 10 * 60 * 1000

export const QA_KNOWLEDGE_HEADER =
  '【清微旅行沉澱問答｜以下為過往已確認的問答知識，優先依此回答】'

const APPROVED_STATUS = '已批准'

/** Notion title / rich_text fragment 陣列 → 純文字。 */
function plainText(fragments: unknown): string {
  if (!Array.isArray(fragments)) return ''
  return fragments
    .map((f) =>
      typeof (f as { plain_text?: unknown })?.plain_text === 'string'
        ? (f as { plain_text: string }).plain_text
        : ''
    )
    .join('')
    .trim()
}

interface QaEntry {
  question: string
  answer: string
}

/** Page → QaEntry；非已批准 / 缺 Q 或 A ⇒ null（防衛性 client-side filter）。 */
function toApprovedQaEntry(result: unknown): QaEntry | null {
  const properties = (result as { properties?: Record<string, unknown> })?.properties
  if (typeof properties !== 'object' || properties === null) return null
  const status = (properties['狀態'] as { select?: { name?: unknown } })?.select?.name
  if (status !== APPROVED_STATUS) return null
  const question = plainText((properties['問題'] as { title?: unknown })?.title)
  const answer = plainText((properties['答案'] as { rich_text?: unknown })?.rich_text)
  if (question === '' || answer === '') return null
  return { question, answer }
}

export interface QaKnowledgeSourceDeps {
  sdk: QaKnowledgeSdkClient
  databaseId: string
  /** 測試覆寫；prod 用 QA_KNOWLEDGE_TTL_MS。 */
  ttlMs?: number
  /** 注入時鐘 — cached-loader 同款。 */
  now?: () => number
  /** 快取/截斷事件非綁單一 request — 預設 '-' requestId logger。 */
  log?: AgentLogger
}

export function createQaKnowledgeSource(deps: QaKnowledgeSourceDeps): QaKnowledgeSource {
  const log = deps.log ?? createAgentLogger({ requestId: '-' })
  let dataSourceId: string | null = null

  const load = async (): Promise<string | null> => {
    if (dataSourceId === null) {
      const db = await deps.sdk.databases.retrieve({ database_id: deps.databaseId })
      const sources = Array.isArray(db?.data_sources) ? db.data_sources : []
      if (sources.length === 0) throw new Error('qa knowledge db has no data source')
      dataSourceId = sources[0].id
    }
    // Server-side filter 已批准＋page_size 100（單頁即超 cap 3 倍，不翻頁）；
    // client-side toApprovedQaEntry 再防衛性過濾一次。
    const res = await deps.sdk.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: '狀態', select: { equals: APPROVED_STATUS } },
      page_size: 100,
    })
    const entries = res.results
      .map(toApprovedQaEntry)
      .filter((e): e is QaEntry => e !== null)
    if (entries.length === 0) return null
    if (entries.length > QA_KNOWLEDGE_CAP || res.has_more === true) {
      log('qa_knowledge_truncated', {
        total: entries.length,
        kept: Math.min(entries.length, QA_KNOWLEDGE_CAP),
      })
    }
    const kept = entries.slice(0, QA_KNOWLEDGE_CAP)
    return [
      QA_KNOWLEDGE_HEADER,
      ...kept.map((e) => `Q：${e.question}\nA：${e.answer}`),
    ].join('\n')
  }

  const cachedLoad = createCachedLoader({
    load,
    ttlMs: deps.ttlMs ?? QA_KNOWLEDGE_TTL_MS,
    now: deps.now,
  })

  return async () => {
    try {
      return await cachedLoad()
    } catch {
      // FAIL-OPEN＋leak guard：raw error 吞掉（可能夾 token/db id/url），
      // fixed code log；cached-loader 保證失敗不快取 ⇒ 下一則重試。
      log('qa_knowledge_unavailable', {})
      return null
    }
  }
}
