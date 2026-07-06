import { describe, expect, it, vi } from 'vitest'
import {
  selectItineraryReference,
  createItineraryReferenceSource,
  matchGoldenCase,
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

describe('matchGoldenCase（第3刀：天數為主鍵、關鍵字消歧）', () => {
  it('5 天且無消歧關鍵字 → 經典 5D4N', () => {
    const m = matchGoldenCase('清邁親子5天4夜')
    expect(m?.id).toBe('classic-5d4n')
    expect(m?.skeleton).toContain('人妖秀') // 經典特徵
  })

  it('5 天 + 跨年/天燈/CAD 關鍵字 → 跨年案（消歧勝出）', () => {
    const m = matchGoldenCase('清邁跨年5天4夜')
    expect(m?.id).toBe('newyear-5d4n')
    expect(m?.skeleton).toMatch(/CAD|天燈/)
    expect(m?.skeleton).not.toContain('人妖秀') // 不可命中經典
  })

  it('6 天 → 泰北深度 6D5N', () => {
    const m = matchGoldenCase('泰北深度6天5夜')
    expect(m?.id).toBe('northern-6d5n')
    expect(m?.skeleton).toMatch(/清道|金三角/)
  })

  it('7 天 → 李先生長輩 7D6N', () => {
    const m = matchGoldenCase('排個李家7天行程')
    expect(m?.id).toBe('li-7d6n')
    expect(m?.skeleton).toMatch(/謝桐興|天使瀑布|輪椅/)
  })

  it('支援中文數字天數：清邁親子五天 → 經典', () => {
    const m = matchGoldenCase('清邁親子五天')
    expect(m?.id).toBe('classic-5d4n')
  })

  it('支援中文數字天數：七天長輩 → 李先生', () => {
    const m = matchGoldenCase('七天 長輩')
    expect(m?.id).toBe('li-7d6n')
  })

  it('抽不到天數 → 關鍵字 fallback：長輩 → 李先生', () => {
    const m = matchGoldenCase('帶長輩輪椅行程')
    expect(m?.id).toBe('li-7d6n')
  })

  it('抽不到天數 → 關鍵字 fallback：天燈跨年 → 跨年', () => {
    const m = matchGoldenCase('想看天燈跨年')
    expect(m?.id).toBe('newyear-5d4n')
  })

  it('抽不到天數 → 關鍵字 fallback：金三角深度 → 深度', () => {
    const m = matchGoldenCase('金三角清萊深度遊')
    expect(m?.id).toBe('northern-6d5n')
  })

  it('抽不到天數且無關鍵字 → null', () => {
    expect(matchGoldenCase('隨便問問')).toBeNull()
  })

  it('其他天數（4/8）→ null', () => {
    expect(matchGoldenCase('清邁4天3夜')).toBeNull()
    expect(matchGoldenCase('清邁8天7夜')).toBeNull()
  })
})

describe('selectItineraryReference', () => {
  // 第3刀（design 2026-06-18）：golden 檢索優先級。need 命中四案 → 只放該 golden 排第一、
  // source='golden'；RAG firstRef 仍可附為「可微調素材」。未命中 → 維持現行 trunk 路徑
  // （firstRef 有→case；無→template）。

  it('命中經典 5D4N（清邁親子五天）→ source=golden，只放該案', () => {
    const index = buildRagIndex([])
    const r = selectItineraryReference(index, '清邁親子五天')
    expect(r.source).toBe('golden')
    expect(r.skeleton).toContain('最相符 golden 範本')
    expect(r.skeleton).toContain('人妖秀') // 經典特徵
    // 優先級非擴主幹：命中只放該案，不再 dump 6D5N 清道主幹
    expect(r.skeleton).not.toContain('清道')
    expect(r.skeleton).not.toMatch(/微調素材|參考真實案例/) // 無 RAG firstRef
  })

  it('命中李先生 7D6N（排個李家7天行程）→ source=golden 含李先生特徵', () => {
    const r = selectItineraryReference(buildRagIndex([]), '排個李家7天行程')
    expect(r.source).toBe('golden')
    expect(r.skeleton).toMatch(/謝桐興|天使瀑布|輪椅/)
  })

  it('命中跨年 5D4N（清邁跨年5天4夜）→ source=golden 含 CAD/天燈，不含人妖秀', () => {
    const r = selectItineraryReference(buildRagIndex([]), '清邁跨年5天4夜')
    expect(r.source).toBe('golden')
    expect(r.skeleton).toMatch(/CAD|天燈/)
    expect(r.skeleton).not.toContain('人妖秀') // 消歧：不可命中經典
  })

  it('命中深度 6D5N（泰北深度6天5夜）→ source=golden 含清道/金三角', () => {
    const r = selectItineraryReference(buildRagIndex([]), '泰北深度6天5夜')
    expect(r.source).toBe('golden')
    expect(r.skeleton).toMatch(/清道|金三角/)
  })

  it('命中 golden 且有 RAG 命中：golden 排第一，RAG 附為可微調素材', () => {
    const index = indexWith({
      days: 5,
      nights: 4,
      areaHints: ['chiangmai'],
      themeHints: ['family', 'elephant'],
      itinerarySnippet:
        '<王先生一家套餐訂製> 清邁親子5天4夜\nDay 1｜抵達清邁\n・大象保護營\n・清邁大峽谷水上樂園',
    })

    const r = selectItineraryReference(index, '清邁親子5天4夜 大象 水上樂園')
    expect(r.source).toBe('golden')
    expect(r.skeleton).toContain('最相符 golden 範本')
    expect(r.skeleton).toContain('人妖秀') // golden 經典
    expect(r.skeleton).toMatch(/微調素材|參考真實案例/) // RAG firstRef 附上
  })

  it('未命中 golden 但有 RAG 命中：退 trunk + 微調素材，source=case', () => {
    const index = indexWith({
      days: 5,
      nights: 4,
      areaHints: ['chiangmai'],
      themeHints: ['family', 'elephant'],
      // need 不含天數/關鍵字 → matchGoldenCase 回 null → 走現行 trunk 路徑
      itinerarySnippet:
        '<王先生一家套餐訂製> 清邁親子\nDay 1｜抵達清邁\n・大象保護營\n・清邁大峽谷水上樂園',
    })

    const r = selectItineraryReference(index, '清邁親子 大象 水上樂園')
    expect(r.source).toBe('case')
    expect(r.skeleton).toContain('Day 5｜') // golden 主幹（A）恆在
    expect(r.skeleton).toContain('清道') // golden 主幹（B）恆在
    expect(r.skeleton).toMatch(/微調素材|參考真實案例/)
  })

  it('未命中 golden 且無 RAG：退兩套 golden trunk，source=template', () => {
    const r = selectItineraryReference(buildRagIndex([]), '隨便問問')
    expect(r.source).toBe('template')
    expect(r.skeleton).toContain('Day 5｜')
    expect(r.skeleton).toContain('清道')
    expect(r.skeleton).not.toMatch(/微調素材|參考真實案例/)
  })

  // sanitize 邊界：golden（含 matched）刻意保留航班碼/markdown（不過 sanitizer）。
  it('未命中路徑的 golden trunk 刻意保留航班碼與 markdown（未被誤送 sanitizer）', () => {
    const r = selectItineraryReference(buildRagIndex([]), '隨便問問')
    expect(r.source).toBe('template')
    expect(r.skeleton).toMatch(/BR25[78]/) // golden 保留具體航班碼
    expect(r.skeleton).toMatch(/\*\*/) // golden 保留 markdown 粗體
  })

  it('命中 golden 的 matched 範本也刻意保留 markdown（不過 sanitizer）', () => {
    const r = selectItineraryReference(buildRagIndex([]), '清邁跨年5天4夜')
    expect(r.source).toBe('golden')
    expect(r.skeleton).toMatch(/\*\*/) // matched golden 保留 markdown
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

  it('命中 golden：回 {source:golden, 骨架} 並把 deriveProfile 結果放進 profile（一次 retrieval）', async () => {
    const index = indexWith(CASE_FACTS)
    const deriveProfile = vi.fn(() => PROFILE)
    const source = createItineraryReferenceSource({
      getIndex: async () => index,
      deriveProfile,
    })

    // need 含 5 天 → matchGoldenCase 命中經典 → source=golden（RAG firstRef 附為素材）
    const r = await source('清邁親子5天4夜 大象 水上樂園')

    expect(r).not.toBeNull()
    expect(r?.source).toBe('golden')
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
