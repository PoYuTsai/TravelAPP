/**
 * install-default-distilled-qa-writer.test.ts — 沉澱刀3 composition root
 * （Task 6 Step 1，mirror install-default-partner-rag.test 模式）.
 *
 * `buildDefaultDistilledQaWriter(env, createSdkClient)` 是唯一構建真
 * `@notionhq/client` 寫入 SDK 之處 — webhook 只 dynamic import 本模組。
 * 鎖住的硬邊界：
 *   1. config 三件齊 → { writer }（factory 收到 token、writer 真接到注入 SDK）
 *   2. 閘關 → { writer: undefined, reason: 'disabled' }，factory 零呼叫
 *   3. 閘開缺 token / 缺 db → fixed reason code，factory 零呼叫
 *   4. factory throw → 'sdk_init_failed' — raw error（可能夾 token）絕不外洩
 *
 * 全程注入 fake SDK factory — 零真 SDK 構建、零真 Notion。
 */

import { describe, it, expect, vi } from 'vitest'
import { buildDefaultDistilledQaWriter } from '@/lib/line-agent/line/install-default-distilled-qa-writer'
import type { DistilledQaSdkClient } from '@/lib/line-agent/distill/distilled-qa-writer'
import type { DistillCandidate } from '@/lib/line-agent/distill/pending'

const SECRET = 'secret_knowledge_token_xyz789'
const DB_ID = 'b'.repeat(32)

function fullEnv(): Record<string, string | undefined> {
  return {
    KNOWLEDGE_WRITE_ENABLED: 'true',
    NOTION_KNOWLEDGE_TOKEN: SECRET,
    NOTION_DISTILLED_QA_DB: DB_ID,
  }
}

function fakeSdk(): DistilledQaSdkClient {
  return {
    databases: {
      async retrieve() {
        return { data_sources: [{ id: 'ds1' }] }
      },
    },
    pages: {
      async create() {
        return { id: 'page_1' }
      },
    },
  }
}

function candidate(id: number): DistillCandidate {
  return {
    id,
    question: `Q${id}`,
    answer: `A${id}`,
    sourceMessageIds: [],
    occurrences: 1,
    status: 'approved',
    missedCount: 0,
  }
}

describe('buildDefaultDistilledQaWriter — 沉澱刀3 composition root', () => {
  it('1. config 三件齊 → writer 構建、factory 收到 token、writer 真接到注入 SDK', async () => {
    const factory = vi.fn((_auth: string) => fakeSdk())

    const result = buildDefaultDistilledQaWriter(fullEnv(), factory)

    expect(result.writer).toBeDefined()
    expect(result.reason).toBeUndefined()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledWith(SECRET)
    // 接線是真的：透過注入 SDK 寫一條 → 回 fake 的 page id
    await expect(result.writer!.write(candidate(1), 1_700_000_000_000)).resolves.toBe(
      'page_1'
    )
  })

  it('2. 閘關（KNOWLEDGE_WRITE_ENABLED 未設）→ reason disabled、factory 零呼叫', () => {
    const factory = vi.fn((_auth: string) => fakeSdk())

    const result = buildDefaultDistilledQaWriter({}, factory)

    expect(result.writer).toBeUndefined()
    expect(result.reason).toBe('disabled')
    expect(factory).toHaveBeenCalledTimes(0)
  })

  it('3. 閘開缺 token / 缺 db → fixed reason code、factory 零呼叫', () => {
    const factory = vi.fn((_auth: string) => fakeSdk())

    const noToken = buildDefaultDistilledQaWriter(
      { KNOWLEDGE_WRITE_ENABLED: 'true' },
      factory
    )
    expect(noToken.writer).toBeUndefined()
    expect(noToken.reason).toBe('missing_knowledge_token')

    const noDb = buildDefaultDistilledQaWriter(
      { KNOWLEDGE_WRITE_ENABLED: 'true', NOTION_KNOWLEDGE_TOKEN: SECRET },
      factory
    )
    expect(noDb.writer).toBeUndefined()
    expect(noDb.reason).toBe('missing_database_id')

    expect(factory).toHaveBeenCalledTimes(0)
    expect(JSON.stringify(noDb)).not.toContain(SECRET)
  })

  it('4. factory throw（error 夾 token）→ sdk_init_failed、raw error 不外洩', () => {
    const result = buildDefaultDistilledQaWriter(fullEnv(), () => {
      throw new Error(`bad client init token=${SECRET}`)
    })

    expect(result.writer).toBeUndefined()
    expect(result.reason).toBe('sdk_init_failed')
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })
})
