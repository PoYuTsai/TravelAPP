# LINE OA Agent — 截圖智慧回覆 Implementation Plan

> **狀態（2026-06-16）：實作完成，待開閘真群驗收。** Phase 1–7 全數完工（subagent-driven + 兩段 review，commits ee6b52f→6c5f944）。全套測試綠（1983 passed，唯一 fail 為 api-auth.test.ts 在滿載 worker 下的 5s timeout，單跑 879ms 通過＝環境 flaky 非回歸）、lint 乾淨、本刀檔案型別零新錯（專案另有 72 個既有無關錯）。對外開閘步驟見文末「開閘真群驗收」，需 Eric 親自 flip `.env.local`。
>
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓夥伴群「截一張客人圖 + tag bot」後，bot 看懂語義 → LLM **自主**呼叫 RAG（92 筆 Notion 案例）/ web_search → 回一則兩段式內容（①乾淨對外可複製 ②內部佐證／待確認）。

**Architecture:** 圖進來 → vision adapter 從「轉錄」升級為「語義抽 need（summary/knownFacts/gaps，JSON）」→ 交給**新的 agentic tool-use 迴圈** responder，掛兩個工具：`search_chiangmai_cases`（RAG 自家案例，client tool_use）+ `web_search`（Anthropic server tool）。LLM 多輪自主決定呼叫哪個 / 都呼叫 / 都不呼叫，最後輸出兩段文字回夥伴群。全程沿用 daily/tool cost cap 與 structured log；三閘 default off ⇒ gate-off byte-identical。

**Tech Stack:** TypeScript, Next.js 14, Anthropic Messages API（`tool_use` 迴圈 + `web_search_20250305` server tool）, Vitest（fake transport 注入）, 既有 RAG index（`searchRagIndex` / `toOperatorSafeCaseSummary`）。

**決策（brainstorm + 2026-06-16 補充已定案，不再重議）：**
- 工具選擇＝**真 tool_use agentic loop**（Eric 2026-06-16 拍板）。RAG 與 web 都當工具，LLM 自主多輪。
- 路由偏好（Eric 補充）：清邁相關（餐廳/景點/行程）→ 先 RAG，撈不到/不相關 → web；開放問題大多直接 web（後台資料庫多半還沒資料）。**用 tool description + system prompt 表達此偏好，不寫死 if/else gate。**
- vision 輸出＝結構化 `VisionNeedBrief { isConversation, summary, knownFacts[], gaps[] }`（JSON），fail-closed parse（壞了就把原文當 summary，永不丟掉抽取）。`knownFacts`/`gaps` 用 string[] 泛化，開放問題與排行程共用同一形狀。
- 兩段輸出＝**單一則訊息、兩個分隔區塊**（`【可直接複製給客人】` / `【內部備註・待確認】`），由 system prompt 規範＋輕量後處理切分驗證。不拆兩則 LINE 訊息。
- 「對外段零贅述」＝**system prompt 規範**為主（不做脆弱後處理改寫）；後處理只驗格式存在，不重寫內容。
- RAG tool 走 `searchRagIndex` + `toOperatorSafeCaseSummary`（通用、operator-safe），**不**走 `itineraryReferenceSource`（那是排行程骨架專用，餐廳類問題不合用）。
- 新建 `smart-reply-agent.ts` 獨立模組，**不**改動既有 `anthropic-responder.ts`（draft tripwire 路徑保持穩定）。

**三閘（缺一即 gate-off，byte-identical）：**
| 閘 | env | 控制 | 讀取點 |
|----|-----|------|--------|
| OCR | `AI_AGENT_OCR_ENABLED` + `AI_AGENT_TOOL_COST_CAP_USD` | vision 路徑是否觸發（雙閘） | `tool-config.ts` / `shouldUseVisionIntake` |
| Web | `AI_AGENT_WEB_SEARCH_ENABLED` + cost cap | web_search tool 是否掛上 | `canUseExternalTool('web_search')` |
| RAG | `AI_AGENT_NOTION_RAG_ENABLED` | RAG tool 是否掛上 + index 是否建 | composition root |
| 預算 | `AI_AGENT_DAILY_COST_CAP_USD` | 每日總額 fail-closed brake | `costCap.checkBudget()` |

**測試指令：** `npm run test:run -- <path>`（單檔）／`npm run test:run`（全部）。型別：`npx tsc --noEmit`。

**分支：** `codex/line-oa-agent-mvp`（branch as-is，不開 worktree、不 merge/PR）。Feature commit 先、docs commit 後。

---

## 模組地圖（新增/修改）

```
新增  src/lib/line-agent/partner-group/vision-need-extraction.ts      # 語義抽 need（JSON）
新增  src/lib/line-agent/partner-group/rag-case-tool.ts               # search_chiangmai_cases tool body
新增  src/lib/line-agent/partner-group/smart-reply-agent.ts           # agentic tool_use 迴圈 + 兩段輸出
新增  src/lib/line-agent/partner-group/vision-smart-reply-surfacing.ts# 新 vision responder（取代 triage dead-end）
改   src/lib/line-agent/line/webhook-runtime.ts                       # composition root 接線
改   scripts/agent-command.mjs                                        # partner-image-respond 黑箱驗收入口
（保留但停用）vision-intake-surfacing.ts 的 createVisionIntakeResponder → Phase 7 決定刪/留
```

---

## Phase 1 — Vision 語義抽 need（JSON）

### Task 1.1: `VisionNeedBrief` 型別 + fail-closed parser

**Files:**
- Create: `src/lib/line-agent/partner-group/vision-need-extraction.ts`
- Test: `src/lib/line-agent/__tests__/vision-need-extraction.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { parseVisionNeedBrief } from '../partner-group/vision-need-extraction'

describe('parseVisionNeedBrief', () => {
  it('parses well-formed JSON into a brief', () => {
    const raw = JSON.stringify({
      isConversation: true,
      summary: '4大2小想玩大象、玩水、看動物、吃美食',
      knownFacts: ['7/1-7/5', '4大2小', '小孩4歲與6歲'],
      gaps: ['航班時間', '住宿區域', '上車點'],
    })
    const brief = parseVisionNeedBrief(raw)
    expect(brief.isConversation).toBe(true)
    expect(brief.summary).toContain('大象')
    expect(brief.knownFacts).toHaveLength(3)
    expect(brief.gaps).toContain('航班時間')
  })

  it('fail-closed: non-JSON becomes summary, never throws, never loses text', () => {
    const brief = parseVisionNeedBrief('客人問清邁雨季幾月適合去')
    expect(brief.isConversation).toBe(true)
    expect(brief.summary).toBe('客人問清邁雨季幾月適合去')
    expect(brief.knownFacts).toEqual([])
    expect(brief.gaps).toEqual([])
  })

  it('honours isConversation:false for non-chat screenshots', () => {
    const brief = parseVisionNeedBrief(
      JSON.stringify({ isConversation: false, summary: '這張圖不是客人對話截圖', knownFacts: [], gaps: [] })
    )
    expect(brief.isConversation).toBe(false)
  })

  it('coerces non-array fields fail-closed (defensive against model drift)', () => {
    const brief = parseVisionNeedBrief(JSON.stringify({ isConversation: true, summary: 'x', knownFacts: 'oops', gaps: null }))
    expect(brief.knownFacts).toEqual([])
    expect(brief.gaps).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/line-agent/__tests__/vision-need-extraction.test.ts`
Expected: FAIL（module not found / parseVisionNeedBrief undefined）

**Step 3: Write minimal implementation**

```typescript
/**
 * vision-need-extraction.ts — 圖片智慧回覆刀的「語義抽 need」層。
 *
 * 取代 vision-intake-adapter 的「純轉錄」：把截圖讀成結構化 need（語義摘要 +
 * 已知事實 + 缺漏），餵給下游 agentic smart-reply 迴圈。fail-closed 紀律：
 * model 回的不是合法 JSON ⇒ 把原文當 summary（永不丟掉抽取、永不 throw）。
 */

import type { LineImageContent } from '../line/content-client'
import {
  createAnthropicVisionIntakeSource,
  type AnthropicVisionIntakeSourceDeps,
} from './vision-intake-adapter'

export interface VisionNeedBrief {
  /** false ⇒ 非對話截圖（風景/地圖）⇒ 上游回固定誠實句、不進 agentic 迴圈。 */
  isConversation: boolean
  /** 客人需求/問題的語義摘要（繁中、可含開放問題，不只排行程）。 */
  summary: string
  /** 圖中明確提供的事實（日期/人數/年齡/偏好…）。 */
  knownFacts: string[]
  /** 排行程/報價常需、但圖中沒提到的（航班/住宿/上車點…）。 */
  gaps: string[]
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

/** Fail-closed parse：壞 JSON ⇒ 原文當 summary、其餘空。永不 throw。 */
export function parseVisionNeedBrief(raw: string): VisionNeedBrief {
  const text = raw.trim()
  try {
    // model 偶爾包 ```json fence；剝掉再 parse。
    const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const obj = JSON.parse(stripped) as Record<string, unknown>
    const summary = typeof obj.summary === 'string' && obj.summary.trim() !== '' ? obj.summary : text
    return {
      isConversation: obj.isConversation !== false, // 預設視為對話（缺欄位也照走）
      summary,
      knownFacts: asStringArray(obj.knownFacts),
      gaps: asStringArray(obj.gaps),
    }
  } catch {
    return { isConversation: true, summary: text, knownFacts: [], gaps: [] }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/line-agent/__tests__/vision-need-extraction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/vision-need-extraction.ts src/lib/line-agent/__tests__/vision-need-extraction.test.ts
git commit -m "feat(line-agent): vision need brief 型別 + fail-closed parser（語義抽 need 第一刀）"
```

---

### Task 1.2: 語義抽取 system prompt（tripwire 常數）+ `createAnthropicVisionNeedSource`

**Files:**
- Modify: `src/lib/line-agent/partner-group/vision-need-extraction.ts`
- Test: `src/lib/line-agent/__tests__/vision-need-extraction.test.ts`（擴充）

**Step 1: Write the failing test**（追加）

```typescript
import {
  VISION_NEED_SYSTEM_INSTRUCTION,
  createAnthropicVisionNeedSource,
} from '../partner-group/vision-need-extraction'
import type { DailyCostCap } from '../observability/daily-cost-cap'

const okCap: DailyCostCap = {
  checkBudget: async () => ({ outcome: 'ok', dailySpendMicroUsd: 0 }),
  recordSpend: async () => ({ recorded: true }),
}

describe('VISION_NEED_SYSTEM_INSTRUCTION (tripwire)', () => {
  it('要求 JSON 結構並列出四個欄位', () => {
    for (const f of ['isConversation', 'summary', 'knownFacts', 'gaps'])
      expect(VISION_NEED_SYSTEM_INSTRUCTION).toContain(f)
  })
  it('保留誠實邊界：不腦補、不提價格', () => {
    expect(VISION_NEED_SYSTEM_INSTRUCTION).toMatch(/不得腦補|不要猜/)
    expect(VISION_NEED_SYSTEM_INSTRUCTION).toMatch(/價格|報價/)
  })
})

describe('createAnthropicVisionNeedSource', () => {
  it('把 vision 回的 JSON parse 成 brief', async () => {
    const fakeTransport = (async () =>
      new Response(
        JSON.stringify({
          content: [{ text: JSON.stringify({ isConversation: true, summary: '想去清邁玩水', knownFacts: ['7/1-7/5'], gaps: ['航班'] }) }],
          usage: { input_tokens: 1500, output_tokens: 80 },
        }),
        { status: 200 }
      )) as unknown as typeof fetch
    const source = createAnthropicVisionNeedSource({ transport: fakeTransport, apiKey: 'k', costCap: okCap })
    const brief = await source({ base64: 'AAAA', mediaType: 'image/jpeg' } as LineImageContent)
    expect(brief.summary).toContain('玩水')
    expect(brief.gaps).toEqual(['航班'])
  })
})
```

**Step 2:** Run → FAIL（缺常數/函式）。

**Step 3: Implement**（追加到 vision-need-extraction.ts）

```typescript
import type { DailyCostCap } from '../observability/daily-cost-cap'

/** 語義抽取 max_tokens：JSON brief 比純轉錄短。 */
const NEED_EXTRACTION_MAX_TOKENS = 700

export const VISION_NEED_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的內部助手。輸入是一張 LINE 對話截圖（客人與夥伴的對話）。',
  '任務：讀懂「客人方」表達的需求或問題，輸出一個 JSON 物件，供後續助手查資料與回覆。',
  '只輸出 JSON，不要任何前綴、後綴、markdown fence 或說明。JSON 欄位：',
  '- isConversation (boolean)：是否為客人對話截圖。若是風景照/地圖/非對話 ⇒ false，其餘欄位給空。',
  '- summary (string)：用繁體中文一句話講清楚客人想要什麼或在問什麼（可以是開放問題，不限排行程）。',
  '- knownFacts (string[])：截圖中**實際出現**的關鍵事實（日期、天數、人數、小孩年齡、偏好、預算…），照原文寫。',
  '- gaps (string[])：排行程或報價常需要、但這張圖**沒有提到**的資訊（航班、住宿區域、上車點…）。圖裡已寫的不要列。',
  '硬規則：只根據截圖內容；不得腦補、不要猜沒寫出來的資訊；不得提價格或做任何承諾。',
].join('\n')

const NEED_EXTRACTION_USER_TEXT = '請讀懂這張截圖並輸出 need JSON。'

export interface VisionNeedSourceDeps {
  transport: typeof fetch
  apiKey: string
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AnthropicVisionIntakeSourceDeps['log']
}

export type VisionNeedSource = (image: LineImageContent) => Promise<VisionNeedBrief>

/** 複用 vision-intake-adapter 的 transport/cost-cap 機制，只換 prompt + parse。 */
export function createAnthropicVisionNeedSource(deps: VisionNeedSourceDeps): VisionNeedSource {
  const raw = createAnthropicVisionIntakeSource({
    transport: deps.transport,
    apiKey: deps.apiKey,
    costCap: deps.costCap,
    model: deps.model,
    env: deps.env,
    log: deps.log,
    systemInstruction: VISION_NEED_SYSTEM_INSTRUCTION,
    userText: NEED_EXTRACTION_USER_TEXT,
    maxTokens: NEED_EXTRACTION_MAX_TOKENS,
  })
  return async (image) => parseVisionNeedBrief(await raw(image))
}
```

> 注意：`createAnthropicVisionIntakeSource` 已支援 `systemInstruction`/`userText`/`maxTokens` override（見 `vision-intake-adapter.ts:91-102`），cost cap 與 fixed-code error 一併複用，本層不重造輪子。`VisionIntakeError` 仍會在 vision 失敗時上拋 → 由 Phase 4 responder fail-closed 接住。

**Step 4:** Run → PASS。
**Step 5: Commit** `feat(line-agent): 語義抽取 prompt + createAnthropicVisionNeedSource（複用 vision adapter transport/cost-cap）`

---

## Phase 2 — RAG tool（`search_chiangmai_cases`）

### Task 2.1: tool 定義 + tool body（query → operator-safe 案例摘要）

**Files:**
- Create: `src/lib/line-agent/partner-group/rag-case-tool.ts`
- Test: `src/lib/line-agent/__tests__/rag-case-tool.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { RAG_CASE_TOOL_DEF, runRagCaseTool } from '../partner-group/rag-case-tool'
import { buildRagIndex, buildRagIndexRecord } from '../notion/rag-index'

describe('RAG_CASE_TOOL_DEF', () => {
  it('宣告 name=search_chiangmai_cases 且 description 點出「清邁相關先查這個」', () => {
    expect(RAG_CASE_TOOL_DEF.name).toBe('search_chiangmai_cases')
    expect(RAG_CASE_TOOL_DEF.description).toMatch(/清邁/)
    expect(RAG_CASE_TOOL_DEF.input_schema.properties.query).toBeTruthy()
  })
})

describe('runRagCaseTool', () => {
  it('命中時回 operator-safe 摘要陣列（去私密欄位）', async () => {
    const index = buildRagIndex([/* fixture：以 buildRagIndexRecord 造 1-2 筆大象+親子案例 */])
    const out = await runRagCaseTool({ query: '大象 親子' }, { getIndex: async () => index, maxResults: 3 })
    expect(out.results.length).toBeGreaterThan(0)
    expect(JSON.stringify(out.results)).not.toMatch(/lineUserId|電話|@/) // operator-safe：無私密欄位
  })

  it('無命中 ⇒ results:[] + 明確訊息（不 throw、不腦補）', async () => {
    const index = buildRagIndex([])
    const out = await runRagCaseTool({ query: '完全不相關xyz' }, { getIndex: async () => index, maxResults: 3 })
    expect(out.results).toEqual([])
    expect(out.note).toMatch(/沒有|找不到/)
  })

  it('getIndex throw ⇒ fail-soft：回空 + 錯誤註記（agentic 迴圈不被 RAG 失敗中斷）', async () => {
    const out = await runRagCaseTool({ query: 'x' }, { getIndex: async () => { throw new Error('kv down') }, maxResults: 3 })
    expect(out.results).toEqual([])
    expect(out.note).toMatch(/暫時|無法/)
  })
})
```

> Fixture 造法：用 `buildRagIndexRecord({...})`（見 `rag-index.ts:167`）造 1-2 筆含「大象/親子」的 record，再 `buildRagIndex([...])`。執行時先讀 `rag-index.ts:90-143`（`RagIndexRecord`/`RagCaseFacts` 欄位）與既有 `__tests__` 內的 fixture builder（若有 helper 直接複用）。

**Step 2:** Run → FAIL。

**Step 3: Implement**

```typescript
/**
 * rag-case-tool.ts — agentic smart-reply 迴圈的 client 端 RAG 工具。
 *
 * LLM 判斷「這題跟清邁自家案例有關」時呼叫本工具；我們對 RAG index 檢索，
 * 回 operator-safe 案例摘要（toOperatorSafeCaseSummary 已去私密欄位）。
 * fail-soft：index 不可用 / 無命中 ⇒ 回空 results + note，永不 throw —— 不可
 * 讓 RAG 失敗中斷整個 agentic 迴圈（web 仍可補）。
 */

import type { RagIndex } from '../notion/rag-index'
import { searchRagIndex, toOperatorSafeCaseSummary, type OperatorSafeCaseSummary } from '../notion/notion-rag-search'

export const RAG_CASE_TOOL_DEF = {
  name: 'search_chiangmai_cases',
  description:
    '搜尋本旅行社的清邁自家案例庫（92 筆真實成行案例：行程、景點、餐廳、親子安排）。' +
    '只要問題跟清邁有關（餐廳推薦、景點、行程規劃、親子安排等），先用這個工具查自家案例；' +
    '查不到或不相關再考慮用 web_search 上網查。',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: '檢索關鍵詞（繁中，例：「大象 親子 玩水」「素帖山 餐廳」）' },
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

export async function runRagCaseTool(
  input: { query: string },
  deps: RunRagCaseToolDeps
): Promise<RagCaseToolResult> {
  let index: RagIndex
  try {
    index = await deps.getIndex()
  } catch {
    return { results: [], note: '案例庫暫時無法存取，這題請改用網路查或既有知識。' }
  }
  const hits = searchRagIndex(index, { query: input.query }).slice(0, deps.maxResults)
  if (hits.length === 0) return { results: [], note: '案例庫沒有相關案例，這題請改用網路查或既有知識。' }
  return { results: hits.map(toOperatorSafeCaseSummary) }
}
```

> 執行前讀 `notion-rag-search.ts:30-117` 確認 `searchRagIndex` 的入參型別（是 `{ query }` 或 parsed query）與 `OperatorSafeCaseSummary` 欄位；若 `searchRagIndex` 需要 `parseRagQuery` 先轉，補一行。tool result 之後在 Phase 3 會 `JSON.stringify` 進 `tool_result` block。

**Step 4:** Run → PASS。
**Step 5: Commit** `feat(line-agent): search_chiangmai_cases RAG tool（operator-safe、fail-soft）`

---

## Phase 3 — Agentic tool-use 迴圈 + 兩段輸出

> 這是計畫核心新基礎建設。風險最高，TDD 最密。所有 LLM 互動用 fake transport 注入、不打真 API。

### Task 3.1: 兩段輸出 system prompt + 切分驗證

**Files:**
- Create: `src/lib/line-agent/partner-group/smart-reply-agent.ts`（先放 prompt + 純函式）
- Test: `src/lib/line-agent/__tests__/smart-reply-two-segment.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import {
  SMART_REPLY_SYSTEM_PROMPT,
  OUTBOUND_HEADER,
  INTERNAL_HEADER,
  ensureTwoSegments,
} from '../partner-group/smart-reply-agent'

describe('SMART_REPLY_SYSTEM_PROMPT (tripwire)', () => {
  it('規範兩段格式與「對外段零贅述」', () => {
    expect(SMART_REPLY_SYSTEM_PROMPT).toContain(OUTBOUND_HEADER)
    expect(SMART_REPLY_SYSTEM_PROMPT).toContain(INTERNAL_HEADER)
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/可直接複製|不要.*我幫你整理|不要.*以上/)
  })
  it('規範 RAG 優先、web 標「待確認」、只列真缺', () => {
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/案例|RAG|自家/)
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/待確認/)
  })
  it('絕不自動回客人、只回夥伴群', () => {
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/夥伴|不.*直接.*客人|不代發/)
  })
})

describe('ensureTwoSegments', () => {
  it('已含兩段 header ⇒ 原樣回', () => {
    const t = `${OUTBOUND_HEADER}\n建議行程…\n\n${INTERNAL_HEADER}\n待確認：航班`
    expect(ensureTwoSegments(t)).toBe(t)
  })
  it('LLM 漏了 header ⇒ 包成對外段（fail-safe，永遠有可複製內容）', () => {
    const out = ensureTwoSegments('就是一段沒有標頭的內容')
    expect(out.startsWith(OUTBOUND_HEADER)).toBe(true)
    expect(out).toContain('就是一段沒有標頭的內容')
  })
})
```

**Step 2:** Run → FAIL。

**Step 3: Implement**（smart-reply-agent.ts 第一段）

```typescript
export const OUTBOUND_HEADER = '【可直接複製給客人】'
export const INTERNAL_HEADER = '【內部備註・待確認】'

export const SMART_REPLY_SYSTEM_PROMPT = [
  '你是清邁包車旅行社「清微旅行」的內部 AI 助手。夥伴會貼一張客人截圖並 tag 你，你要幫夥伴',
  '準備好可以回客人的內容。你**只**回給夥伴群，夥伴會自己決定怎麼轉給客人——你絕不代發、不直接稱呼客人。',
  '',
  '查資料原則：',
  '- 只要問題跟清邁有關（餐廳、景點、行程、親子安排），**先呼叫 search_chiangmai_cases** 查自家真實案例；',
  '  查到就以自家案例為主幹（最可信）。',
  '- 自家案例查不到、不相關，或是一般開放問題（天氣、簽證、匯率、最新資訊等），用 web_search 上網查。',
  '- 兩個都查得到就整合；都不需要就用你已知的，但不確定的事絕不腦補。',
  '',
  '輸出**固定兩段**，照這個格式（兩個標頭都必須出現）：',
  `${OUTBOUND_HEADER}`,
  '（乾淨、可直接整段複製貼給客人的內容。不要寫「我幫你整理」「以上若需修正」這類贅述，不要稱呼夥伴，',
  ' 直接就是給客人看的話。用自家案例的內容可以直接寫；上網查到、還沒跟客人確認的，措辭保守。）',
  '',
  `${INTERNAL_HEADER}`,
  '（給夥伴看的備註：哪些是自家案例佐證、哪些是網路查的（標「網路資料・待確認」）、哪些是你的補充；',
  ' 以及「待確認項」——**只列**客人截圖裡真的沒提到、但報價/排行程需要的（如航班、住宿、上車點）。',
  ' 圖裡已寫的不要再問。沒有待確認就寫「無」。這段可精簡。）',
].join('\n')

/** Fail-safe：LLM 萬一沒照兩段格式，至少包成對外段 —— 夥伴永遠有可複製內容。 */
export function ensureTwoSegments(text: string): string {
  const t = text.trim()
  if (t.includes(OUTBOUND_HEADER)) return text
  return `${OUTBOUND_HEADER}\n${t}`
}
```

**Step 4:** Run → PASS。
**Step 5: Commit** `feat(line-agent): smart-reply 兩段輸出 system prompt + ensureTwoSegments fail-safe`

---

### Task 3.2: agentic tool_use 迴圈（核心）

**Files:**
- Modify: `src/lib/line-agent/partner-group/smart-reply-agent.ts`
- Test: `src/lib/line-agent/__tests__/smart-reply-agent-loop.test.ts`

**設計約束（執行時務必遵守）：**
- 入參：`brief: VisionNeedBrief`、`input: PartnerGroupRespondInput`（拿 log / event / botDirected）。
- 工具掛載：`getRagIndex` 有給 ⇒ 掛 `RAG_CASE_TOOL_DEF`；`webSearchEnabled` ⇒ 掛 `web_search_20250305`（沿用 `anthropic-responder.ts:223-229` 的形狀）。兩者皆無 ⇒ 純單發 LLM（仍走兩段）。
- 迴圈：`MAX_ROUNDS = 4`。每輪 POST `/v1/messages`，帶累積 `messages`。
  - `stop_reason === 'tool_use'`：對每個 `type:'tool_use'` 且 `name==='search_chiangmai_cases'` 的 block 執行 `runRagCaseTool`，把 `{ type:'tool_result', tool_use_id, content: JSON.stringify(result) }` 推進 `messages`，續迴圈。（`web_search` 是 server tool，server 端自動執行、結果同輪回來，**不需** client round。）
  - `stop_reason !== 'tool_use'`（end_turn 等）：抽 text blocks 串接 → `ensureTwoSegments` → 收 citations 附「資料來源」（沿用 `anthropic-responder.ts:340-348`）→ return。
  - 達 `MAX_ROUNDS` 仍 tool_use ⇒ 收斂：用目前最後一輪 text（或固定 degrade 句）+ ensureTwoSegments，log `degradedReason:'max_rounds'`。
- **成本：每輪 POST 前 `costCap.checkBudget()`，非 ok ⇒ 立即 degrade（回 stub 句）。每輪後 `recordSpend`（token 估算沿用 `estimateCostUsd` + web search 計費，見 `anthropic-responder.ts:296-323`）。** 記帳失敗不丟回覆。
- per-request 防衛：`allowWebSearch = webSearchEnabled && event.sourceChannel!=='line_oa' && botDirected`（沿用 `anthropic-responder.ts:188-191`）。
- 錯誤一律 fixed-code、secret-free（沿用既有 degraded()/log 形狀）；transport throw / 非 200 / parse fail ⇒ degrade，**永不 throw**（不可 500 webhook）。
- meta：成功 `{ responder:'llm', model, ... }`；degrade `{ responder:'stub', degraded:true, error }`。

**Step 1: Write the failing tests**（重點覆蓋率，fake transport 用「呼叫序列」回應）

```typescript
// 測試骨架（執行時補全 fake transport / input builder）：
// 1. 'LLM 直接 end_turn（不呼叫工具）' → 回兩段、meta.responder==='llm'
// 2. 'LLM 呼叫 search_chiangmai_cases 一輪後 end_turn'：
//      第一次 response stop_reason='tool_use' 帶 tool_use block；
//      斷言第二次 POST 的 body.messages 末端含 tool_result（tool_use_id 對上）；
//      最終回兩段。
// 3. 'web_search server tool 掛載'：webSearchEnabled=true 時第一次 POST body.tools 含 web_search_20250305；
//      OA channel 時不掛（allowWebSearch 收窄）。
// 4. 'RAG 未注入（getRagIndex undefined）'：body.tools 不含 search_chiangmai_cases。
// 5. 'cost cap 非 ok' → 不 POST、回 degrade stub、meta.error==='cost_cap_*'。
// 6. 'transport throw' → degrade 'anthropic_api_error'、不 throw。
// 7. 'MAX_ROUNDS 用盡仍 tool_use' → 收斂回兩段 + log max_rounds、不無限迴圈。
// 8. 'ensureTwoSegments 生效'：LLM 只回一段 → 結果含 OUTBOUND_HEADER。
```

**Step 2–4:** 逐一 RED→GREEN 實作 `createSmartReplyAgent(deps): (brief, input) => Promise<PartnerGroupRespondResult>`。

**Step 5: Commit** `feat(line-agent): smart-reply agentic tool_use 迴圈（RAG client tool + web server tool，雙 cost-cap fail-closed）`

> 實作筆記：
> - 第一輪 `messages` 起點＝把 brief 序列化成 user message：`客人需求：${brief.summary}\n已知：${brief.knownFacts.join('、')||'（無）'}\n圖中未提供：${brief.gaps.join('、')||'（無）'}`。
> - web_search 與 RAG 可同輪並存：一個 response 可同時有 server `web_search` 結果 block 與 client `tool_use(rag)`；只處理 client tool_use 的續輪，web search block 照抽 citations。
> - `MAX_ROUNDS=4` 是迴圈天花板，不是預期值；正常 0-2 輪。
> - 抽 text/citations、token 估算、web search 計費**儘量複用** anthropic-responder 既有邏輯；若重複過多，可抽出 `anthropic-response-parse.ts` 共用 helper（額外重構 task，非必須）。

---

## Phase 4 — Vision smart-reply responder（取代 triage dead-end）

### Task 4.1: 新 vision responder（圖 → need → agentic → 兩段）

**Files:**
- Create: `src/lib/line-agent/partner-group/vision-smart-reply-surfacing.ts`
- Test: `src/lib/line-agent/__tests__/vision-smart-reply-surfacing.test.ts`

**設計：**`createVisionSmartReplyResponder({ fetchImage, need, agent })` 回 `PartnerGroupResponder`。
- 解析 `quotedMessageId`（沿用 `vision-intake-surfacing.ts:113-125` fail-closed）。
- `fetchImage` 抓圖（404 → `VISION_INTAKE_NO_IMAGE_REPLY`，其餘 → `UNAVAILABLE`，沿用既有固定句與 fixed-code meta）。
- `need(image)` 抽 brief；`VisionIntakeError` → `UNAVAILABLE`。
- `brief.isConversation === false` ⇒ 回固定句「這張圖看起來不是客人對話截圖，請確認後再 tag 我」，meta degraded `not_a_conversation`，**不進 agentic（不燒 RAG/web）**。
- 否則 `agent(brief, input)` → 回其結果（已兩段）。

**Step 1: Tests**（fake fetchImage / fake need / fake agent 注入）：
- 正常：need→agent，回 agent 的兩段文字。
- 非對話：isConversation:false → 固定句、agent 不被呼叫（spy 斷言 0 次）。
- 抓圖 404 → NO_IMAGE 句。
- need throw VisionIntakeError → UNAVAILABLE 句、agent 不被呼叫。
- 無 quotedMessageId → NO_IMAGE 句。

**Step 2–4:** RED→GREEN。
**Step 5: Commit** `feat(line-agent): vision smart-reply responder（圖→need→agentic 兩段，fail-closed 全鏈）`

---

## Phase 5 — Composition root 接線（webhook-runtime.ts）

### Task 5.1: 把新 vision smart-reply responder 接成 `visionIntake`

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（約 527-615，見下）
- Test: `src/lib/line-agent/__tests__/webhook-runtime-vision-smart-reply.test.ts`（或擴充既有 webhook-runtime 測試）

**接線（取代 `webhook-runtime.ts:583-594` 既有 `createVisionIntakeResponder` 區塊）：**
```typescript
// RAG index loader：複用 itinerary-reference-wiring 既有 TTL 快取 getIndex；
// 受 AI_AGENT_NOTION_RAG_ENABLED 控 —— 閘關 ⇒ getRagIndex undefined ⇒ RAG tool 不掛。
const ragEnabled = process.env.AI_AGENT_NOTION_RAG_ENABLED === 'true'
const getRagIndex = ragEnabled ? (/* 既有 index installer，見 itinerary-reference-wiring.ts */) : undefined

const smartReplyAgent = models.anthropicApiKey
  ? createSmartReplyAgent({
      transport: fetch,
      apiKey: models.anthropicApiKey,
      defaultModel: models.defaultModel,
      costCap,
      getRagIndex,
      webSearchEnabled: webSearchGate.allowed, // 既有 webhook-runtime.ts:546-555 已算好
    })
  : undefined

const visionIntake =
  models.anthropicApiKey && smartReplyAgent
    ? createVisionSmartReplyResponder({
        fetchImage: (messageId) =>
          fetchLineImageContent(messageId, process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''),
        need: createAnthropicVisionNeedSource({ transport: fetch, apiKey: models.anthropicApiKey, costCap, env: process.env }),
        agent: smartReplyAgent,
      })
    : undefined
```

**驗收（gate-off byte-identical）測試：**
- 三閘全關時：`visionIntake` 仍可建（OCR 閘在 `shouldUseVisionIntake` surfacing 端擋，dispatcher 不會進 vision 路）—— 確認 dispatcher 對非圖訊息行為 byte-identical（沿用既有 dispatcher 測試）。
- `AI_AGENT_NOTION_RAG_ENABLED` 關 ⇒ `getRagIndex===undefined` ⇒ agent body.tools 不含 RAG（在 Phase 3 Task 已覆蓋；此處測 wiring 真的傳 undefined）。

**Step 1–4:** TDD（webhook composition 多為整合測；用既有 webhook-runtime 測試風格，注入 fake env/transport）。
**Step 5: Commit** `feat(line-agent): composition root 接 smart-reply agentic vision 路（受三閘控，gate-off byte-identical）`

---

## Phase 6 — CLI 黑箱驗收入口

### Task 6.1: `partner-image-respond` 子命令（本機圖 → 兩段回覆）

**Files:**
- Modify: `scripts/agent-command.mjs`（新增子命令，鏡像 `partner-respond` 1696-1828 結構）
- Test: `src/lib/line-agent/__tests__/agent-command-partner-image-respond.test.ts`

**設計：**`npm run agent:partner-image-respond -- ./path/to/shot.jpg`
- 讀本機圖檔 → base64 + 推 mediaType → `LineImageContent`。
- 建 `createAnthropicVisionNeedSource` + `createSmartReplyAgent`（**這支要把 `getRagIndex` 與 `webSearchEnabled` 都接上** —— 修掉舊 `partner-respond` 沒傳 itineraryReferenceSource 的同類坑，design §8）。
- 跑 need → agent → 印兩段結果到 stdout。
- 同 `partner-respond`：mode 非 anthropic ⇒ 明確報錯（黑箱要打真 API）。
- 在 `package.json` `scripts` 加 `"agent:partner-image-respond": "tsx scripts/agent-command.mjs partner-image-respond"`（對齊既有 `agent:partner-respond` 寫法）。

**Step 1: Test**（注入 fake transport + 暫存圖檔 fixture，驗：解析 argv、組 LineImageContent、呼叫鏈、輸出含兩段 header）。
**Step 2–4:** RED→GREEN。
**Step 5: Commit** `feat(line-agent): partner-image-respond CLI 黑箱入口（圖→need→RAG+web→兩段，補齊 source 接線）`

---

## Phase 7 — 收尾：清理、全綠、型別

### Task 7.1: 停用/移除舊 triage dead-end

**Files:** `src/lib/line-agent/partner-group/vision-intake-surfacing.ts` + 其測試

- 確認 `createVisionIntakeResponder`（transcribe→triage）已無 production caller（composition root 已改用 smart-reply）。
- 決策：刪除 or 標 `@deprecated`。若 `沉澱刀1` 或其他路徑仍用其 transcription，**保留 adapter 的 transcription 常數**（`VISION_EXTRACTION_SYSTEM_INSTRUCTION`），只移除 responder。先 `grep -rn createVisionIntakeResponder src/` 確認 caller。
- 對應測試同步刪/改。
- Commit `refactor(line-agent): 移除 vision triage dead-end responder（已被 smart-reply 取代）`

### Task 7.2: 全套綠 + 型別 + lint

```bash
npx tsc --noEmit
npm run test:run
npm run lint
```
全綠後，REQUIRED SUB-SKILL: superpowers:verification-before-completion 逐項貼證據。

### Task 7.3: docs commit

- 更新本檔狀態為「實作完成、待開閘真群驗收」。
- 更新 `docs/plans/2026-06-16-line-agent-image-intake-smart-reply-design.md` §9 開放項標記定案。
- 更新 `project_line_oa_agent_m1` memory pointer。
- Commit `docs(line-agent): 截圖智慧回覆實作完成，標記開閘前驗收待辦`

---

## 開閘真群驗收（Eric，需 .env.local）

> 程式完工 ≠ 上線。對外步驟需 Eric 親自 flip env（preview + deploy 兩 scope 都要）：
```
AI_AGENT_OCR_ENABLED=true
AI_AGENT_WEB_SEARCH_ENABLED=true
AI_AGENT_NOTION_RAG_ENABLED=true
AI_AGENT_TOOL_COST_CAP_USD=<正數>     # 未設＝web/ocr 雙閘擋，不可當過關
AI_AGENT_DAILY_COST_CAP_USD=<正數>    # 每日 brake
```
- 驗收＝Eric 用 思思 case 圖（7/1-7/5、4大2小、4&6歲、大象/玩水/動物/美食）真群煙測，主觀判斷「圖 vs bot 回的兩段內容」品質（design §8）。
- 先 CLI `agent:partner-image-respond` 離線跑同一張圖看兩段品質，再 flip env 進真群。

## 風險與注意

- **新基礎建設＝agentic 迴圈**：失敗面比單發大（多輪、tool_result 對位、MAX_ROUNDS 天花板、每輪成本）。Phase 3 TDD 是重中之重；務必覆蓋「迴圈不無限」「cost cap 每輪把守」「transport throw 不 500」。
- **成本**：每輪 LLM + 最多 3 次 web search／題。`AI_AGENT_TOOL_COST_CAP_USD` 未設＝靜默 disabled，**不可當過關**（既有鐵律）。
- **Boundary**：bot 只回夥伴群；客人 OA 永不自動回（system prompt + tool-gate 雙重，OA channel 不滿足 surfacing）。
- **gate-off byte-identical**：每個 wiring task 都要有「閘關 ⇒ 行為不變」測試。
```
