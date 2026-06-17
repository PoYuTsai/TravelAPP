import { describe, expect, it, vi } from 'vitest'
import {
  selectItineraryReference,
  createItineraryReferenceSource,
} from '../notion/itinerary-reference-source'
import type { ItineraryCaseProfile } from '../notion/customer-itinerary-gate'
import {
  buildRagIndex,
  type RagCaseFacts,
  type RagIndex,
  type RagIndexRecord,
} from '../notion/rag-index'

// Build a real RagIndex via buildRagIndex (which runs dedupe/merge and
// materializes the lookup maps) so the test genuinely exercises
// retrieveRagCases → queryRagIndex ranking — NOT a hand-fed hit list.
function indexWith(facts: Partial<RagCaseFacts>): RagIndex {
  const record: RagIndexRecord = {
    identity: { sourceTables: ['private_2026'], sourceRecordIds: ['p1'] },
    facts: { ...facts },
  } as RagIndexRecord
  return buildRagIndex([record])
}

describe('selectItineraryReference', () => {
  // 反轉（Task 2，design 2026-06-17 §2 #4）：兩套 golden 主幹恆為 skeleton 主體；
  // RAG 相似案降為「可微調素材」，只在命中時附於主幹之後並切 source=case。

  it('無 RAG 命中：skeleton 含兩套 golden 主幹，source=template', () => {
    const index = buildRagIndex([])
    const r = selectItineraryReference(index, '清邁親子五天')
    expect(r.source).toBe('template')
    expect(r.skeleton).toContain('Day 5｜') // 5D4N 主幹在（A）
    expect(r.skeleton).toContain('清道') // 6D5N 主幹在（B，泰北芳縣特徵地名）
    // 無命中時不得出現 RAG 微調素材標籤
    expect(r.skeleton).not.toMatch(/微調素材|參考真實案例/)
  })

  it('有 RAG 命中：兩套 golden 主幹仍在，且附相似案微調素材，source=case', () => {
    const index = indexWith({
      days: 5,
      nights: 4,
      // area/theme hints that retrieveRagCases ranking will hit for the query
      // below (清邁→chiangmai, 親子→family, 大象→elephant).
      areaHints: ['chiangmai'],
      themeHints: ['family', 'elephant'],
      itinerarySnippet:
        '<王先生一家套餐訂製> 清邁親子5天4夜\nDay 1｜抵達清邁\n・大象保護營\n・清邁大峽谷水上樂園',
    })

    const r = selectItineraryReference(index, '清邁親子5天4夜 大象 水上樂園')
    expect(r.source).toBe('case')
    expect(r.skeleton).toContain('Day 5｜') // golden 主幹（A）恆在
    expect(r.skeleton).toContain('清道') // golden 主幹（B）恆在
    expect(r.skeleton).toMatch(/微調素材|參考真實案例/) // RAG 段有標籤
  })

  it('相似案 sanitizer fail-closed ⇒ 退純 golden 主幹，source=template', () => {
    // The only retrievable case carries a residual 王太太 honorific that the
    // sanitizer denylist trips on (fail-closed) → no case survives → trunk only.
    const index = indexWith({
      days: 5,
      areaHints: ['chiangmai'],
      themeHints: ['family'],
      itinerarySnippet: 'Day 1｜送王太太回飯店',
    })

    const r = selectItineraryReference(index, '清邁親子5天')
    expect(r.source).toBe('template')
    expect(r.skeleton).toContain('Day 5｜')
    expect(r.skeleton).not.toMatch(/微調素材|參考真實案例/)
  })

  // sanitize 邊界：golden 主幹是「權威範本」刻意保留航班碼/markdown（不過 sanitizer）；
  // 只有 RAG 相似案段過 sanitizer。故主幹路徑必含航班碼/`**`（證明沒被誤送 sanitizer）。
  it('golden 主幹刻意保留航班碼與 markdown（未被誤送 sanitizer）', () => {
    const r = selectItineraryReference(buildRagIndex([]), '隨便問問')
    expect(r.source).toBe('template')
    expect(r.skeleton).toMatch(/BR25[78]/) // golden 保留具體航班碼
    expect(r.skeleton).toMatch(/\*\*/) // golden 保留 markdown 粗體
  })
})

// ── 合併刀（M-2 + item6）：createItineraryReferenceSource ───────────────────
// 把 selectItineraryReference（骨架＋來源訊號）＋ deriveProfile（本案 profile）
// 包成單一注入式 source，一個 turn 對 retrieval 只打一次。index 與 deriveProfile
// 皆注入（responder/composition-root 在別處接真 getIndex＋真推導器）。
describe('createItineraryReferenceSource（合併 source）', () => {
  const CASE_FACTS: Partial<RagCaseFacts> = {
    days: 5,
    nights: 4,
    areaHints: ['chiangmai'],
    themeHints: ['family', 'elephant'],
    itinerarySnippet:
      '<王先生一家套餐訂製> 清邁親子5天4夜\nDay 1｜抵達清邁\n・大象保護營\n・清邁大峽谷水上樂園',
  }
  const PROFILE: ItineraryCaseProfile = {
    mobility: { type: 'limited_mobility_wheelchair_assisted' },
    stayArea: 'chiangmai_old_city',
    sameLodgingAllTrip: true,
  }

  it('命中案例：回 {source:case, 骨架} 並把 deriveProfile 結果放進 profile（一次 retrieval）', async () => {
    const index = indexWith(CASE_FACTS)
    const deriveProfile = vi.fn(() => PROFILE)
    const source = createItineraryReferenceSource({
      getIndex: async () => index,
      deriveProfile,
    })

    const r = await source('清邁親子5天4夜 大象 水上樂園')

    expect(r).not.toBeNull()
    expect(r?.source).toBe('case')
    expect(r?.skeleton).toMatch(/Day 1｜/)
    expect(r?.profile).toBe(PROFILE)
  })

  it('item6 合約：selectItineraryReference 與 deriveProfile 都收到 need===入參', async () => {
    const index = buildRagIndex([])
    const deriveProfile = vi.fn(() => null)
    const source = createItineraryReferenceSource({
      getIndex: async () => index,
      deriveProfile,
    })

    await source('排個李家7天行程')

    // deriveProfile 拿到的 need 必須等於傳進 source 的字串（選取/推導同源同字）。
    expect(deriveProfile).toHaveBeenCalledTimes(1)
    expect(deriveProfile).toHaveBeenCalledWith('排個李家7天行程')
  })

  it('未命中：退手工範本 source=template，profile 仍走 deriveProfile（可為 null）', async () => {
    const deriveProfile = vi.fn(() => null)
    const source = createItineraryReferenceSource({
      getIndex: async () => buildRagIndex([]),
      deriveProfile,
    })

    const r = await source('隨便問問')

    expect(r?.source).toBe('template')
    expect(r?.skeleton.length).toBeGreaterThan(0)
    expect(r?.profile).toBeNull()
  })

  it('getIndex 失敗 ⇒ 上拋（responder 端 fail-open 接住）', async () => {
    const source = createItineraryReferenceSource({
      getIndex: async () => {
        throw new Error('notion boom')
      },
      deriveProfile: () => null,
    })

    await expect(source('清邁親子5天')).rejects.toThrow('notion boom')
  })
})
