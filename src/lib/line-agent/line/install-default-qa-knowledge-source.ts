/**
 * install-default-qa-knowledge-source.ts — 檢索閉環刀 composition root：唯一
 * 構建真 @notionhq/client 讀取 SDK 之處（mirror install-default-distilled-qa-writer）。
 * webhook 只 dynamic import 本模組 — 靜態圖零 SDK。Fail-open＋leak-safe：
 * 缺 config / 構建失敗 ⇒ source undefined ＋ fixed reason code，永不 throw。
 */

import { Client } from '@notionhq/client'
import { resolveQaKnowledgeReadConfig } from '../partner-group/qa-knowledge-config'
import {
  createQaKnowledgeSource,
  type QaKnowledgeSdkClient,
  type QaKnowledgeSource,
} from '../partner-group/qa-knowledge-source'

export interface BuildQaKnowledgeSourceResult {
  source?: QaKnowledgeSource
  reason?:
    | 'disabled'
    | 'missing_knowledge_token'
    | 'missing_database_id'
    | 'sdk_init_failed'
}

/**
 * Notion 讀取逾時 — 慢比掛更危險：reply token 預算遠小於 SDK 預設 60s。
 * （writer path 非 latency-critical 所以沒設；讀取在回覆關鍵路徑上，必設。）
 */
const QA_KNOWLEDGE_NOTION_TIMEOUT_MS = 5000

export function buildDefaultQaKnowledgeSource(
  env: Record<string, string | undefined> = process.env,
  createSdkClient: (auth: string) => QaKnowledgeSdkClient = (auth) =>
    new Client({
      auth,
      timeoutMs: QA_KNOWLEDGE_NOTION_TIMEOUT_MS,
    }) as unknown as QaKnowledgeSdkClient
): BuildQaKnowledgeSourceResult {
  const config = resolveQaKnowledgeReadConfig(env)
  if (!config.enabled) return { reason: config.reason ?? 'disabled' }
  let sdk: QaKnowledgeSdkClient
  try {
    sdk = createSdkClient(config.token)
  } catch {
    return { reason: 'sdk_init_failed' } // raw error 可能夾 token — 吞掉
  }
  return { source: createQaKnowledgeSource({ sdk, databaseId: config.databaseId }) }
}
