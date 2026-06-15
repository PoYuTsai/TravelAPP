/**
 * itinerary-reference-wiring.test.ts — composition-root 閘（wiring 刀本體）。
 *
 * resolveItineraryReferenceSource 是 composition root 與 responder 之間的薄閘：
 *  - AI_AGENT_NOTION_RAG_ENABLED 未開 ⇒ 回 undefined ⇒ factory 不接線 ⇒
 *    responder/request body 與本刀前 byte-identical（鐵律）。
 *  - 開閘 ⇒ 回合併 source：用注入的 getIndex（TTL 快取的 RagIndex）選骨架，
 *    並以 deriveCaseProfile 抽本案 profile。helper 不建 Notion client（SDK 邊界
 *    在 webhook 的 lazy installer），故可純測。
 */
import { describe, expect, it, vi } from 'vitest'
import { resolveItineraryReferenceSource } from '../line/itinerary-reference-wiring'
import {
  buildRagIndex,
  type RagCaseFacts,
  type RagIndex,
  type RagIndexRecord,
} from '../notion/rag-index'

function indexWith(facts: Partial<RagCaseFacts>): RagIndex {
  const record: RagIndexRecord = {
    identity: { sourceTables: ['private_2026'], sourceRecordIds: ['p1'] },
    facts: { ...facts },
  } as RagIndexRecord
  return buildRagIndex([record])
}

describe('resolveItineraryReferenceSource — 閘控', () => {
  it('AI_AGENT_NOTION_RAG_ENABLED 未開 / 非 "true" ⇒ undefined（byte-identical 路徑）', () => {
    const getIndex = vi.fn(async () => buildRagIndex([]))
    for (const env of [{}, { AI_AGENT_NOTION_RAG_ENABLED: 'false' }, { AI_AGENT_NOTION_RAG_ENABLED: '' }, { AI_AGENT_NOTION_RAG_ENABLED: 'TRUE' }]) {
      expect(resolveItineraryReferenceSource({ env, getIndex })).toBeUndefined()
    }
    expect(getIndex).not.toHaveBeenCalled()
  })

  it('開閘（"true"）⇒ 回合併 source：getIndex 選骨架 ＋ deriveCaseProfile 抽 profile', async () => {
    const index = indexWith({
      days: 5,
      nights: 4,
      areaHints: ['chiangmai'],
      themeHints: ['family', 'elephant'],
      itinerarySnippet:
        '<王先生一家套餐訂製> 清邁親子5天4夜\nDay 1｜抵達清邁\n・大象保護營\n・清邁大峽谷水上樂園',
    })
    const getIndex = vi.fn(async () => index)
    const source = resolveItineraryReferenceSource({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' },
      getIndex,
    })
    expect(source).toBeDefined()

    // need 帶住宿/行動訊號 ⇒ deriveCaseProfile 應抽出 profile（證明真推導器被接上）。
    const r = await source!('清邁親子5天4夜 大象 水上樂園，長輩坐輪椅，住古城')

    expect(getIndex).toHaveBeenCalledTimes(1)
    expect(r?.source).toBe('case')
    expect(r?.skeleton).toMatch(/Day 1｜/)
    expect(r?.profile?.mobility?.type).toMatch(/limited|wheelchair/)
    expect(r?.profile?.stayArea).toBe('chiangmai_old_city')
  })
})
