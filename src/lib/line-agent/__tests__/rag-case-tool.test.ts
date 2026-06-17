/**
 * rag-case-tool.test.ts
 *
 * search_chiangmai_cases — agentic smart-reply 迴圈的 client 端 RAG 工具。
 * 行為鎖定三條：
 *   1. tool def 宣告 name/description/input_schema（清邁相關先查這個）
 *   2. 命中 ⇒ operator-safe 摘要陣列（去私密欄位 / PII）
 *   3. fail-soft：無命中 / getIndex throw ⇒ results:[] + note，永不 throw
 */

import { describe, it, expect } from 'vitest'
import { RAG_CASE_TOOL_DEF, runRagCaseTool } from '../partner-group/rag-case-tool'
import {
  buildRagIndex,
  buildRagIndexRecord,
  type RagCaseFacts,
  type RagIndexRecord,
} from '../notion/rag-index'

// --- fixture：以 buildRagIndexRecord 造大象 + 親子案例（canonical snake_case 主題）--

function rec(
  id: string,
  facts: RagCaseFacts,
  privateContext?: RagIndexRecord['privateContext']
): RagIndexRecord {
  return buildRagIndexRecord({
    identity: { sourceRecordIds: [id], sourceTables: ['private_2026'] },
    facts,
    audience: 'partner_group',
    privateContext,
  })
}

const elephantFamilyCase = rec(
  'cm-fam-elephant',
  {
    days: 5,
    nights: 4,
    partySize: 4,
    adults: 2,
    children: 2,
    childAges: [5, 8],
    itinerarySnippet: 'Day 2｜大象保護營 親子玩水',
    areaHints: ['chiangmai'],
    themeHints: ['elephant', 'family'],
  },
  {
    // 私密欄位 + PII：projection 必須全部丟掉
    notionPageUrl: 'https://www.notion.so/secret-deadbeef',
    cost: 42000,
    revenue: 88000,
    privateNotes: '客戶電話 0912345678 信箱 wang@example.com lineUserId=U123',
  }
)

describe('RAG_CASE_TOOL_DEF', () => {
  it('宣告 name=search_chiangmai_cases 且 description 點出「清邁相關先查這個」', () => {
    expect(RAG_CASE_TOOL_DEF.name).toBe('search_chiangmai_cases')
    expect(RAG_CASE_TOOL_DEF.description).toMatch(/清邁/)
    expect(RAG_CASE_TOOL_DEF.input_schema.properties.query).toBeTruthy()
  })
})

describe('runRagCaseTool', () => {
  it('命中時回 operator-safe 摘要陣列（去私密欄位）', async () => {
    const index = buildRagIndex([elephantFamilyCase])
    const out = await runRagCaseTool(
      { query: '大象 親子' },
      { getIndex: async () => index, maxResults: 3 }
    )
    expect(out.results.length).toBeGreaterThan(0)
    // operator-safe：無私密欄位 / PII
    expect(JSON.stringify(out.results)).not.toMatch(/lineUserId|電話|@/)
  })

  it('命中時把 sanitized 具名行程骨架送進模型（GAP-1 放寬），且仍剝真 PII', async () => {
    // 真 Notion snippet：header 帶姓名/人數/日期，內文帶具名餐廳/逐日框架 + 電話。
    const namedCase = rec('cm-named', {
      days: 5,
      nights: 4,
      partySize: 4,
      itinerarySnippet: [
        '<王先生一家訂製>',
        '人數：4 大 2 小',
        '📅 日期：2026/01/01',
        'Day 1｜抵達 晚餐 千人火鍋',
        'Day 2｜大象保護營 午餐 拳師餐廳 客戶電話 0912345678',
      ].join('\n'),
      areaHints: ['chiangmai'],
      themeHints: ['family'],
    })
    const index = buildRagIndex([namedCase])
    const out = await runRagCaseTool(
      { query: '清邁 親子' },
      { getIndex: async () => index, maxResults: 3 }
    )
    const json = JSON.stringify(out.results)
    // 具名餐廳 / 逐日框架要送進模型（abstract-only 治本）
    expect(json).toMatch(/千人火鍋/)
    expect(json).toMatch(/拳師餐廳/)
    expect(json).toMatch(/Day 2/)
    // 真 PII 仍剝除：姓名 header / 電話 / 日期
    expect(json).not.toMatch(/王先生/)
    expect(json).not.toMatch(/0912345678/)
    expect(json).not.toMatch(/2026\/01\/01/)
  })

  it('無命中 ⇒ results:[] + 明確訊息（不 throw、不腦補）', async () => {
    const index = buildRagIndex([])
    const out = await runRagCaseTool(
      { query: '完全不相關xyz' },
      { getIndex: async () => index, maxResults: 3 }
    )
    expect(out.results).toEqual([])
    expect(out.note).toMatch(/沒有|找不到/)
  })

  it('getIndex throw ⇒ fail-soft：回空 + 錯誤註記（agentic 迴圈不被 RAG 失敗中斷）', async () => {
    const out = await runRagCaseTool(
      { query: 'x' },
      {
        getIndex: async () => {
          throw new Error('kv down')
        },
        maxResults: 3,
      }
    )
    expect(out.results).toEqual([])
    expect(out.note).toMatch(/暫時|無法/)
  })
})
