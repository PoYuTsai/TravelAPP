/**
 * qa-knowledge-config.ts — 檢索閉環刀：沉澱 QA 讀取閘 env resolver（pure）.
 *
 * Mirror knowledge-write-config.ts、方向相反（讀不是寫）：三件齊才 enabled —
 * QA_KNOWLEDGE_READ_ENABLED='true' ＋ NOTION_KNOWLEDGE_TOKEN ＋
 * NOTION_DISTILLED_QA_DB。任一缺 ⇒ enabled:false ＋ fixed reason code。
 * 讀寫閘獨立：CC 寫入（KNOWLEDGE_WRITE_ENABLED）與 bot 讀取可分開開關。
 */

import { normaliseDatabaseId } from '../notion/notion-rag-config'

export type QaKnowledgeReadConfig =
  | { enabled: true; token: string; databaseId: string }
  | {
      enabled: false
      reason?: 'missing_knowledge_token' | 'missing_database_id'
    }

export function resolveQaKnowledgeReadConfig(
  env: Record<string, string | undefined>
): QaKnowledgeReadConfig {
  // Disabled gate short-circuits FIRST（同 resolveNotionRagConfig 紀律）。
  if ((env.QA_KNOWLEDGE_READ_ENABLED ?? '').trim() !== 'true') {
    return { enabled: false }
  }
  const token = (env.NOTION_KNOWLEDGE_TOKEN ?? '').trim()
  if (token === '') return { enabled: false, reason: 'missing_knowledge_token' }
  const databaseId = normaliseDatabaseId((env.NOTION_DISTILLED_QA_DB ?? '').trim())
  if (databaseId === '') return { enabled: false, reason: 'missing_database_id' }
  return { enabled: true, token, databaseId }
}
