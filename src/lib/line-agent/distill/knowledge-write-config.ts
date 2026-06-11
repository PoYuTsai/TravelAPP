/**
 * knowledge-write-config.ts — 沉澱刀3：寫入 Notion 的 env resolver（pure）.
 *
 * 三件齊才 enabled：KNOWLEDGE_WRITE_ENABLED='true' ＋ NOTION_KNOWLEDGE_TOKEN ＋
 * NOTION_DISTILLED_QA_DB。任一缺 ⇒ enabled:false ＋ fixed reason code —
 * 呼叫端（webhook lazy seam）一行 log 即形同閘關，絕不炸 webhook。
 *
 * token 用知識庫 integration（讀+寫），絕不用 NOTION_TOKEN（RAG 行程 DB 的
 * read integration）— .env.example 119-122 預留的那條線。
 */

import { normaliseDatabaseId } from '../notion/notion-rag-config'

export type KnowledgeWriteConfig =
  | { enabled: true; token: string; databaseId: string }
  | {
      enabled: false
      reason?: 'missing_knowledge_token' | 'missing_database_id'
    }

export function resolveKnowledgeWriteConfig(
  env: Record<string, string | undefined>
): KnowledgeWriteConfig {
  // Disabled gate short-circuits FIRST（同 resolveNotionRagConfig 紀律）。
  if ((env.KNOWLEDGE_WRITE_ENABLED ?? '').trim() !== 'true') {
    return { enabled: false }
  }
  const token = (env.NOTION_KNOWLEDGE_TOKEN ?? '').trim()
  if (token === '') return { enabled: false, reason: 'missing_knowledge_token' }
  const databaseId = normaliseDatabaseId((env.NOTION_DISTILLED_QA_DB ?? '').trim())
  if (databaseId === '') return { enabled: false, reason: 'missing_database_id' }
  return { enabled: true, token, databaseId }
}
