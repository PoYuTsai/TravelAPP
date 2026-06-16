/**
 * rag-case-tool.ts — agentic smart-reply 迴圈的 client 端 RAG 工具。
 *
 * LLM 判斷「這題跟清邁自家案例有關」時呼叫本工具；我們對 RAG index 檢索，
 * 回 operator-safe 案例摘要（toOperatorSafeCaseSummary 已去私密欄位 / PII）。
 * fail-soft：index 不可用 / 無命中 ⇒ 回空 results + note，永不 throw —— 不可
 * 讓 RAG 失敗中斷整個 agentic 迴圈（web search 仍可補）。
 */

import type { RagIndex } from '../notion/rag-index'
import {
  searchRagIndex,
  type OperatorSafeCaseSummary,
} from '../notion/notion-rag-search'

export const RAG_CASE_TOOL_DEF = {
  name: 'search_chiangmai_cases',
  description:
    '搜尋本旅行社的清邁自家案例庫（真實成行案例：行程、景點、餐廳、親子安排）。' +
    '只要問題跟清邁有關（餐廳推薦、景點、行程規劃、親子安排等），先用這個工具查自家案例；' +
    '查不到或不相關再考慮用 web_search 上網查。',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '檢索關鍵詞（繁中，例：「大象 親子 玩水」「素帖山 餐廳」）',
      },
    },
    required: ['query'],
  },
}

export interface RunRagCaseToolDeps {
  getIndex: () => Promise<RagIndex>
  maxResults: number
}

export interface RagCaseToolResult {
  results: OperatorSafeCaseSummary[]
  note?: string
}

/**
 * 對 RAG index 檢索並回 operator-safe 摘要。searchRagIndex 內部已解析自由文字、
 * 取 topN 並投影成 operator-safe 摘要（結構上無從攜帶 privateContext / PII）。
 * 任何路徑都不 throw：getIndex 失敗 ⇒ 暫時無法存取；無命中 ⇒ 明確 note。
 */
export async function runRagCaseTool(
  input: { query: string },
  deps: RunRagCaseToolDeps
): Promise<RagCaseToolResult> {
  let index: RagIndex
  try {
    index = await deps.getIndex()
  } catch {
    return {
      results: [],
      note: '案例庫暫時無法存取，這題請改用網路查或既有知識。',
    }
  }

  const search = searchRagIndex(index, input.query, { topN: deps.maxResults })
  if (search.results.length === 0) {
    return {
      results: [],
      note: '案例庫沒有相關案例，這題請改用網路查或既有知識。',
    }
  }
  return { results: search.results }
}
