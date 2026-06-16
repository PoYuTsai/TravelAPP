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
