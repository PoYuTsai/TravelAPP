/**
 * install-default-itinerary-reference-index.test.ts — 排行程合併刀的 SDK 邊界。
 *
 * buildDefaultItineraryRagIndexLoader 是唯一 import 真 @notionhq/client、建 Notion
 * 索引載入器的地方（webhook 以 lazy dynamic-import 觸發）。seam/source/responder
 * 全保持 SDK-free＋可注入。硬邊界：
 *  - import 無副作用（無 token 讀取、無 SDK 構造、無 Notion）；
 *  - 缺 NOTION_TOKEN ⇒ fail closed（不建 SDK、loader=null、固定碼，不洩 token）；
 *  - SDK 構造失敗 ⇒ notion_client_init_failed（吞原始錯、不洩 token）；
 *  - 有 token＋假 SDK ⇒ 回 loader；retrieve 延後到 loader() 才打；TTL 內第二次走快取。
 *
 * 全程注入假 SDK，零真 Notion / 零真 key。
 */
import { describe, it, expect, vi } from 'vitest'
import {
  buildDefaultItineraryRagIndexLoader,
  DEFAULT_ITINERARY_RAG_TTL_MS,
} from '@/lib/line-agent/line/install-default-itinerary-reference-index'
import type { NotionLikeSdkClient } from '@/lib/line-agent/notion/notion-rag-client'

const SECRET = 'secret_leaky_token_abc123'

function fullEnv(): Record<string, string | undefined> {
  return {
    NOTION_TOKEN: SECRET,
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
    NOTION_PRIVATE_2026_DATABASE_ID: 'a'.repeat(32),
  }
}

function countingSdk(opts: { throws?: boolean } = {}) {
  let retrieveCount = 0
  const sdk: NotionLikeSdkClient = {
    databases: {
      async retrieve() {
        retrieveCount += 1
        if (opts.throws) throw new Error(`notion boom token=${SECRET}`)
        return { data_sources: [{ id: 'ds1' }] }
      },
    },
    dataSources: {
      async query() {
        return { results: [], has_more: false, next_cursor: null }
      },
    },
  }
  return { sdk, retrieveCalls: () => retrieveCount }
}

describe('buildDefaultItineraryRagIndexLoader — SDK 邊界', () => {
  it('缺 NOTION_TOKEN ⇒ loader=null + missing_notion_token，SDK 工廠未被呼叫', () => {
    const factory = vi.fn((_auth: string) => countingSdk().sdk)
    const r = buildDefaultItineraryRagIndexLoader({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' }, // 無 token
      createSdkClient: factory,
    })
    expect(r.loader).toBeNull()
    expect(r.reason).toBe('missing_notion_token')
    expect(factory).toHaveBeenCalledTimes(0)
  })

  it('SDK 構造失敗 ⇒ loader=null + notion_client_init_failed，不洩 token', () => {
    const r = buildDefaultItineraryRagIndexLoader({
      env: fullEnv(),
      createSdkClient: () => {
        throw new Error(`init boom token=${SECRET}`)
      },
    })
    expect(r.loader).toBeNull()
    expect(r.reason).toBe('notion_client_init_failed')
    expect(JSON.stringify(r)).not.toContain(SECRET)
  })

  it('有 token＋假 SDK ⇒ loader 延後讀 Notion，TTL 內第二次走快取', async () => {
    const fake = countingSdk()
    const factory = vi.fn((_auth: string) => fake.sdk)
    let clock = 1_000
    const r = buildDefaultItineraryRagIndexLoader({
      env: fullEnv(),
      createSdkClient: factory,
      now: () => clock,
    })

    expect(r.loader).not.toBeNull()
    expect(factory).toHaveBeenCalledTimes(1) // client 構造（lazy，無網路）
    expect(fake.retrieveCalls()).toBe(0) // 尚未讀 Notion

    const idx1 = await r.loader!()
    expect(idx1).toBeDefined()
    expect(fake.retrieveCalls()).toBe(1) // 首次 loader() 才打

    await r.loader!() // TTL 內
    expect(fake.retrieveCalls()).toBe(1) // 快取命中、不重打

    clock += DEFAULT_ITINERARY_RAG_TTL_MS // 過期
    await r.loader!()
    expect(fake.retrieveCalls()).toBe(2) // 重建
  })
})
