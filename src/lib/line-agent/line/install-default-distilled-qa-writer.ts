/**
 * install-default-distilled-qa-writer.ts — 沉澱刀3 composition root：唯一
 * 構建真 @notionhq/client 寫入 SDK 之處（mirror install-default-partner-rag.ts）。
 * webhook 只 dynamic import 本模組 — 靜態圖零 SDK。Fail-closed＋leak-safe：
 * 缺 config / 構建失敗 ⇒ writer undefined ＋ fixed reason code，永不 throw。
 */

import { Client } from '@notionhq/client'
import { resolveKnowledgeWriteConfig } from '../distill/knowledge-write-config'
import {
  createDistilledQaWriter,
  type DistilledQaSdkClient,
  type DistilledQaWriter,
} from '../distill/distilled-qa-writer'

export interface BuildDistilledQaWriterResult {
  writer?: DistilledQaWriter
  reason?:
    | 'disabled'
    | 'missing_knowledge_token'
    | 'missing_database_id'
    | 'sdk_init_failed'
}

export function buildDefaultDistilledQaWriter(
  env: Record<string, string | undefined> = process.env,
  createSdkClient: (auth: string) => DistilledQaSdkClient = (auth) =>
    new Client({ auth }) as unknown as DistilledQaSdkClient
): BuildDistilledQaWriterResult {
  const config = resolveKnowledgeWriteConfig(env)
  if (!config.enabled) return { reason: config.reason ?? 'disabled' }
  let sdk: DistilledQaSdkClient
  try {
    sdk = createSdkClient(config.token)
  } catch {
    return { reason: 'sdk_init_failed' } // raw error 可能夾 token — 吞掉
  }
  return { writer: createDistilledQaWriter({ sdk, databaseId: config.databaseId }) }
}
