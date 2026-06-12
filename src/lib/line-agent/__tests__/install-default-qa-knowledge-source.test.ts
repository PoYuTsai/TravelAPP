/**
 * install-default-qa-knowledge-source.test.ts — 檢索閉環刀 composition root
 * （Task 6 Step 1，mirror install-default-distilled-qa-writer.test 模式）.
 *
 * `buildDefaultQaKnowledgeSource(env, createSdkClient)` 是唯一構建真
 * `@notionhq/client` 讀取 SDK 之處 — webhook 只 dynamic import 本模組。
 * 鎖住的硬邊界：
 *   1. 閘關 → { source: undefined, reason: 'disabled' }，factory 零呼叫
 *   2. 閘開缺 token / 缺 db → fixed reason code，factory 零呼叫
 *   3. config 三件齊 → { source }（factory 收到 token、token 不外洩）
 *   4. factory throw → 'sdk_init_failed' — raw error（可能夾 token）絕不外洩
 *
 * 全程注入 fake SDK factory — 零真 SDK 構建、零真 Notion。
 */

import { describe, it, expect, vi } from 'vitest'
import { buildDefaultQaKnowledgeSource } from '@/lib/line-agent/line/install-default-qa-knowledge-source'
import type { QaKnowledgeSdkClient } from '@/lib/line-agent/partner-group/qa-knowledge-source'

const SECRET = 'secret_knowledge_token_xyz789'
const DB_ID = 'a'.repeat(32)

function fullEnv(): Record<string, string | undefined> {
  return {
    QA_KNOWLEDGE_READ_ENABLED: 'true',
    NOTION_KNOWLEDGE_TOKEN: SECRET,
    NOTION_DISTILLED_QA_DB: DB_ID,
  }
}

function fakeSdk(): QaKnowledgeSdkClient {
  return {
    databases: {
      async retrieve() {
        return { data_sources: [{ id: 'ds1' }] }
      },
    },
    dataSources: {
      async query() {
        return { results: [] }
      },
    },
  }
}

describe('buildDefaultQaKnowledgeSource — 檢索閉環刀 composition root', () => {
  it('1. 閘關（QA_KNOWLEDGE_READ_ENABLED 未設）→ reason disabled、factory 零呼叫', () => {
    const factory = vi.fn((_auth: string) => fakeSdk())

    const result = buildDefaultQaKnowledgeSource({}, factory)

    expect(result.source).toBeUndefined()
    expect(result).toEqual({ reason: 'disabled' })
    expect(factory).toHaveBeenCalledTimes(0)
  })

  it('2. 閘開缺 token / 缺 db → fixed reason code、factory 零呼叫', () => {
    const factory = vi.fn((_auth: string) => fakeSdk())

    const noToken = buildDefaultQaKnowledgeSource(
      { ...fullEnv(), NOTION_KNOWLEDGE_TOKEN: '' },
      factory
    )
    expect(noToken).toEqual({ reason: 'missing_knowledge_token' })

    const noDb = buildDefaultQaKnowledgeSource(
      { QA_KNOWLEDGE_READ_ENABLED: 'true', NOTION_KNOWLEDGE_TOKEN: SECRET },
      factory
    )
    expect(noDb).toEqual({ reason: 'missing_database_id' })

    expect(factory).toHaveBeenCalledTimes(0)
    expect(JSON.stringify(noDb)).not.toContain(SECRET)
  })

  it('3. config 三件齊＋fake sdk factory → 回 source（token 進 factory、不外洩）', () => {
    const factory = vi.fn((_auth: string) => fakeSdk())

    const result = buildDefaultQaKnowledgeSource(fullEnv(), factory)

    expect(typeof result.source).toBe('function')
    expect(result.reason).toBeUndefined()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledWith(SECRET)
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it('4. factory throw（error 夾 token）→ sdk_init_failed、raw error 不外洩', () => {
    const result = buildDefaultQaKnowledgeSource(fullEnv(), () => {
      throw new Error(`bad client init token=${SECRET}`)
    })

    expect(result.source).toBeUndefined()
    expect(result.reason).toBe('sdk_init_failed')
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })
})
