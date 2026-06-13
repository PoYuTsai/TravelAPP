# Tough QA 外部佐證刀 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> 設計定稿：`docs/plans/2026-06-13-tough-qa-web-search-evidence-design.md`（858d1da，Eric 四段逐段 OK）。
> Branch：`codex/line-oa-agent-mvp`（as-is，不 merge / 不開 PR）。

**Goal:** 夥伴群 tag bot 問實質問題（文字或截圖），bot 自動用 Anthropic 原生 `web_search` server tool 找外部佐證，回「結論＋來源連結＋待導遊確認」。

**Architecture:** 閘判定集中 composition root（webhook-runtime / CLI 用 `canUseExternalTool` 算出 boolean 注入 factory）；responder 不讀 env、閘關時 request body byte-identical。截圖一條龍＝刀B vision 抽字後改餵 partner-respond（知識注入＋web search），不再只走 triage。所有花費走既有 daily cost cap（搜尋費 $0.01/次補記帳）。

**Tech Stack:** Next.js 14 / TypeScript、vitest（`npx vitest run <file>`）、Anthropic Messages API `web_search_20250305` server tool（不引 SDK、不加新 key）。

**鐵律（每個 task 都要守）：**
- OA 客人面（`line_oa`）永遠 deny web search，任何 env 救不回。
- responder / factory 絕不讀 `process.env`；env 只在 composition root 解析。
- 閘關（default off）時 Anthropic request body 必須與現行 byte-identical。
- search/vision 任何錯誤 ⇒ 既有 degraded 路徑（stub／固定誠實句），永不 500 webhook。
- log 只有 fixed code＋數字，絕不帶 key／prompt／訊息內容。

---

## 刀序對照（design §3）

| 刀 | 本 plan tasks |
|---|---|
| 刀1 tool-gate＋responder 掛 tool＋多 block 解析＋搜尋費記帳 | Task 1, 3, 4, 5 |
| 刀2 system prompt 搜證條款 | Task 2 |
| （接線，design §1「factory 判定後注入」的落點） | Task 6 |
| 刀3 CLI 黑箱驗收真打 | Task 7 |
| 刀4 截圖一條龍 | Task 8, 9, 10 |
| docs 收尾 | Task 11 |

---

### Task 1: tool-gate — web_search 免第 5 關（tag 即授權）

**Files:**
- Modify: `src/lib/line-agent/tools/tool-gate.ts`（第 94–102 行的第 5 關）
- Test: `src/lib/line-agent/__tests__/tool-gate.test.ts`

**Step 1: 改既有測試＋寫新失敗測試**

`tool-gate.test.ts` 第 120–127 行的「denies when the user did not explicitly request external/realtime data」**只對 web_search 成立的部分要翻轉**。把該測試改成 ocr 案例，並新增 web_search 豁免測試：

```ts
  it('web_search 不再看 userRequestedExternalData — tag 即授權（外部佐證刀）', () => {
    const result = canUseExternalTool(
      passingRequest({ userRequestedExternalData: false }),
      enabledConfig()
    )
    expect(result.allowed).toBe(true)
  })

  it('ocr 仍要求 userRequestedExternalData（第 5 關只對 web_search 鬆綁）', () => {
    const result = canUseExternalTool(
      passingRequest({ tool: 'ocr', userRequestedExternalData: false }),
      enabledConfig({ AI_AGENT_OCR_ENABLED: 'true' })
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/request|external|realtime/i)
  })
```

（原第 120–127 行那個測試直接刪除，由上面兩個取代。同檔 docstring 第 15–17 行的「user explicitly requested」敘述補一句 web_search 例外。）

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/tool-gate.test.ts`
Expected: 新增的 web_search 豁免測試 FAIL（目前 gate 仍 deny）。

**Step 3: 最小實作**

`tool-gate.ts` 第 5 關改成：

```ts
  // 5. User must explicitly ask for external/realtime data.
  //    外部佐證刀（design 2026-06-13 §0）：web_search 豁免本關 — 在夥伴群
  //    tag bot 本身就是 explicit intent（tag 即授權）。OCR / notion_rag 不動。
  if (request.tool !== 'web_search' && !request.userRequestedExternalData) {
    return {
      allowed: false,
      reason:
        'canUseExternalTool: user did not explicitly request external/realtime data; ' +
        'external lookups are never auto-triggered.',
    }
  }
```

模組 header 第 15–16 行的決策順序註解同步補：`5. （web_search 豁免）user did not explicitly request external data → denied.`

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/tool-gate.test.ts src/lib/line-agent/__tests__/vision-intake-surfacing.test.ts`
Expected: 全 PASS（vision surfacing 用 ocr 分支，行為不受影響——一起跑當回歸）。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/tools/tool-gate.ts src/lib/line-agent/__tests__/tool-gate.test.ts
git commit -m "feat(line-agent): 外部佐證刀1 — tool-gate web_search 免第5關（tag 即授權，OCR/RAG 不動）"
git push
```

---

### Task 2: system-prompt — 搜證條款（開閘才注入，tripwire）

**Files:**
- Modify: `src/lib/line-agent/partner-group/system-prompt.ts`
- Test: `src/lib/line-agent/__tests__/system-prompt.test.ts`

**Step 1: 寫失敗測試**

加進 `system-prompt.test.ts`（新 describe）：

```ts
import {
  PARTNER_GROUP_SYSTEM_PROMPT,
  PARTNER_GROUP_WEB_SEARCH_PROMPT,
  buildPartnerGroupSystemPrompt,
} from '@/lib/line-agent/partner-group/system-prompt'

describe('buildPartnerGroupSystemPrompt — 外部佐證刀搜證條款（tripwire）', () => {
  it('未開閘（省略 / false）⇒ 與現行 byte-identical，絕無搜證字樣', () => {
    expect(buildPartnerGroupSystemPrompt(makeInput())).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(
      buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: false })
    ).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('開閘 ⇒ frozen persona 開頭＋搜證條款各句逐字在場', () => {
    const prompt = buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: true })
    expect(prompt.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
    expect(prompt).toContain('【外部佐證｜web_search 已開啟】')
    expect(prompt).toContain('本區塊優先於前面「不得聲稱你已查到任何即時資料」與「我目前還不能上網即時查資料」兩條')
    expect(prompt).toContain('實質問題（景點開放時間、節慶日期、交通、票價、規定等）內部知識不足時，必須用 web_search 查公開網頁')
    expect(prompt).toContain('回覆格式：先給結論，再列來源連結，文末固定加一句「以上為網路資料供參考，重要細節建議再與導遊確認」')
    expect(prompt).toContain('內部沉澱案例優先：沉澱知識已有答案時以內部為準，web 結果只佐證不覆蓋')
    expect(prompt).toContain('搜不到就誠實說搜不到，絕不腦補來源、絕不編造連結')
  })

  it('順序：知識區塊在搜證條款之前、引用脈絡在最後', () => {
    const prompt = buildPartnerGroupSystemPrompt(
      { ...makeInput(), quotedBotContent: '昨天那個草稿' },
      '【清微旅行沉澱問答】\nQ：q\nA：a',
      { webSearchEnabled: true }
    )
    const knowledgeAt = prompt.indexOf('【清微旅行沉澱問答】')
    const searchAt = prompt.indexOf('【外部佐證｜web_search 已開啟】')
    const quotedAt = prompt.indexOf('【引用脈絡】')
    expect(knowledgeAt).toBeGreaterThan(-1)
    expect(searchAt).toBeGreaterThan(knowledgeAt)
    expect(quotedAt).toBeGreaterThan(searchAt)
  })
})
```

（`makeInput` 用該測試檔既有的 helper；若名稱不同，沿用檔內現成的 input fixture。）

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/system-prompt.test.ts`
Expected: FAIL — `PARTNER_GROUP_WEB_SEARCH_PROMPT` 不存在。

**Step 3: 實作**

`system-prompt.ts` 新增常數（放 `PARTNER_GROUP_SYSTEM_PROMPT` 之後）：

```ts
/**
 * 外部佐證刀（design 2026-06-13 §1）— 搜證條款。ONLY injected when the
 * composition root determined the web_search gate is open；閘關時
 * buildPartnerGroupSystemPrompt 與現行 byte-identical（tripwire 驗）。
 * 條款明文 supersede 凍結 persona 中的「不得聲稱已查即時資料」「不能上網」
 * 兩句 — 凍結區不動，覆寫責任在這個附加區塊。
 */
export const PARTNER_GROUP_WEB_SEARCH_PROMPT = [
  '【外部佐證｜web_search 已開啟】',
  '本區塊優先於前面「不得聲稱你已查到任何即時資料」與「我目前還不能上網即時查資料」兩條：現在你可以、也應該用 web_search 工具查公開網頁。',
  '實質問題（景點開放時間、節慶日期、交通、票價、規定等）內部知識不足時，必須用 web_search 查公開網頁佐證，不要只回「不確定」。',
  '回覆格式：先給結論，再列來源連結，文末固定加一句「以上為網路資料供參考，重要細節建議再與導遊確認」。',
  '內部沉澱案例優先：沉澱知識已有答案時以內部為準，web 結果只佐證不覆蓋。',
  '閒聊、寒暄、內部既有規則可答的問題不要搜尋 — 每次搜尋都是真實花費。',
  '搜不到就誠實說搜不到，絕不腦補來源、絕不編造連結。',
].join('\n')
```

`buildPartnerGroupSystemPrompt` 簽名加第三參數，知識之後、引用之前插入：

```ts
export function buildPartnerGroupSystemPrompt(
  input: PartnerGroupRespondInput,
  knowledge?: string | null,
  opts?: { webSearchEnabled?: boolean }
): string {
  const sections = [PARTNER_GROUP_SYSTEM_PROMPT]
  const trimmedKnowledge = knowledge?.trim()
  if (trimmedKnowledge) {
    sections.push('', trimmedKnowledge)
  }
  if (opts?.webSearchEnabled === true) {
    sections.push('', PARTNER_GROUP_WEB_SEARCH_PROMPT)
  }
  const quoted = input.quotedBotContent?.trim()
  // …（既有引用脈絡段不動）
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/system-prompt.test.ts src/lib/line-agent/__tests__/m2-guardrails.test.ts`
Expected: 全 PASS（m2-guardrails 驗凍結 persona 沒被動到）。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/partner-group/system-prompt.ts src/lib/line-agent/__tests__/system-prompt.test.ts
git commit -m "feat(line-agent): 外部佐證刀2 — system prompt 搜證條款（開閘才注入，tripwire 驗序）"
git push
```

---

### Task 3: anthropic-responder — 掛 web_search server tool（閘關 byte-identical）

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts`
- Test: `src/lib/line-agent/__tests__/anthropic-responder.test.ts`

**Step 1: 寫失敗測試**

新 describe 加進 `anthropic-responder.test.ts`：

```ts
describe('AnthropicPartnerGroupResponder — 外部佐證刀 web_search tool', () => {
  it('webSearchEnabled 省略 ⇒ body 無 tools key（與現行 byte-identical）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(makeInput())
    const body = JSON.parse(calls[0].init.body as string)
    expect('tools' in body).toBe(false)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('webSearchEnabled=true ⇒ body 掛 web_search_20250305（max_uses 3）＋搜證條款進 system', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(makeInput())
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.tools).toEqual([
      { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
    ])
    expect(body.system).toContain('【外部佐證｜web_search 已開啟】')
  })

  it('webSearchEnabled=true 但 event 是 line_oa ⇒ 防衛性不掛 tool（OA 永不）', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const input = makeInput()
    input.event.sourceChannel = 'line_oa'
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(input)
    const body = JSON.parse(calls[0].init.body as string)
    expect('tools' in body).toBe(false)
  })

  it('webSearchEnabled=true 但非 botDirected ⇒ 不掛 tool', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const input = makeInput()
    input.event.mentionsBot = false
    input.botDirected = false
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(input)
    expect('tools' in JSON.parse(calls[0].init.body as string)).toBe(false)
  })
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: FAIL — deps 沒有 `webSearchEnabled`（TS error）。

**Step 3: 實作**

`anthropic-responder.ts`：

常數區（`MAX_TOKENS` 下方）：

```ts
/** 外部佐證刀 — 每題搜尋次數上限（design §3 成本：3 × $0.01 ≈ $0.03/題）。 */
const WEB_SEARCH_MAX_USES = 3
```

`AnthropicPartnerGroupResponderDeps` 加欄位：

```ts
  /**
   * 外部佐證刀 — web_search server tool 開關。composition root（webhook /
   * CLI）用 canUseExternalTool 判定後注入；responder 不讀 env 鐵律不破。
   * 省略 / false ⇒ request body 與現行 byte-identical。
   */
  webSearchEnabled?: boolean
```

ctor：`this.webSearchEnabled = deps.webSearchEnabled === true`（private readonly boolean）。

`respond()` 內、`buildPartnerGroupSystemPrompt` 呼叫前：

```ts
    // 外部佐證刀 — per-request 防衛性收窄：deps 開閘之外，本則訊息還要確實
    // 是 bot-directed 且不在 OA 客人面（tool-gate 第 1/4 關在最後一哩重判，
    // 只會收窄、永不放寬）。
    const allowWebSearch =
      this.webSearchEnabled &&
      input.event.sourceChannel !== 'line_oa' &&
      (input.botDirected ?? input.event.mentionsBot) === true

    const system = buildPartnerGroupSystemPrompt(input, knowledge, {
      webSearchEnabled: allowWebSearch,
    })
```

request body：

```ts
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: input.text }],
          ...(allowWebSearch
            ? {
                tools: [
                  { type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES },
                ],
              }
            : {}),
        }),
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 全 PASS（既有測試全部不動就過 = 閘關零行為變化的證據）。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts src/lib/line-agent/__tests__/anthropic-responder.test.ts
git commit -m "feat(line-agent): 外部佐證刀1 — responder 掛 web_search server tool（閘關 body byte-identical）"
git push
```

---

### Task 4: anthropic-responder — 多 block 解析＋citations 來源附文末

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts`（第 170–187 行解析段、第 208–231 行成功回傳段）
- Test: `src/lib/line-agent/__tests__/anthropic-responder.test.ts`

**Step 1: 寫失敗測試**

```ts
describe('AnthropicPartnerGroupResponder — 多 block 解析＋citations（外部佐證刀）', () => {
  const SEARCH_BODY = {
    content: [
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'yi peng 2026' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      { type: 'text', text: '天燈節是 11/25', citations: [{ type: 'web_search_result_location', url: 'https://a.example/yipeng', title: 'A' }] },
      { type: 'text', text: '，建議提前訂房。', citations: [
        { type: 'web_search_result_location', url: 'https://a.example/yipeng', title: 'A' },
        { type: 'web_search_result_location', url: 'https://b.example/hotels', title: 'B' },
      ] },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
  }

  it('串接所有 text block＋citations 去重抽 URL 附文末', async () => {
    const { transport } = fakeTransport({ jsonValue: SEARCH_BODY })
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(makeInput())
    expect(result.text).toBe(
      '天燈節是 11/25，建議提前訂房。\n\n資料來源：\n- https://a.example/yipeng\n- https://b.example/hotels'
    )
    expect(result.meta?.responder).toBe('llm')
  })

  it('來源最多 3 個 URL', async () => {
    const many = {
      content: [{
        type: 'text', text: 'x',
        citations: [1, 2, 3, 4, 5].map((i) => ({ type: 'web_search_result_location', url: `https://s${i}.example/` })),
      }],
    }
    const { transport } = fakeTransport({ jsonValue: many })
    const result = await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, webSearchEnabled: true,
    }).respond(makeInput())
    expect((result.text.match(/^- https:/gm) ?? []).length).toBe(3)
  })

  it('純 text 單 block（無 citations）⇒ 文末無資料來源段（現行行為不變）', async () => {
    const { transport } = fakeTransport({ jsonValue: OK_BODY })
    const result = await new AnthropicPartnerGroupResponder({ transport, ...DEPS }).respond(makeInput())
    expect(result.text).toBe('建議先確認人數與日期。')
  })
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 第一、二個新測試 FAIL（現行只取 `content[0].text`，第一 block 是 `server_tool_use` 無 text ⇒ degraded）。

**Step 3: 實作**

常數區加：

```ts
/** 文末來源連結上限（design §1：citations 抽 1–3 個）。 */
const MAX_SOURCE_URLS = 3
```

解析段（原第 170–187 行）改成：

```ts
    let text: unknown
    const sourceUrls: string[] = []
    let usage:
      | {
          input_tokens?: unknown
          output_tokens?: unknown
          server_tool_use?: { web_search_requests?: unknown }
        }
      | undefined
    try {
      const data = (await response.json()) as {
        content?: Array<{ text?: unknown; citations?: unknown }>
        usage?: typeof usage
      }
      // 多 block 串接：web search 回應是 text / server_tool_use /
      // web_search_tool_result 混排 — 只取帶 text 的 block。單 text block
      // 時與原 content[0].text 等價（閘關行為零變化）。
      const blocks = Array.isArray(data?.content) ? data.content : []
      const textBlocks = blocks.filter(
        (b): b is { text: string; citations?: unknown } => typeof b?.text === 'string'
      )
      text = textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('') : undefined
      for (const block of textBlocks) {
        const citations = Array.isArray(block.citations) ? block.citations : []
        for (const c of citations as Array<{ url?: unknown }>) {
          if (typeof c?.url === 'string' && c.url !== '' && !sourceUrls.includes(c.url)) {
            sourceUrls.push(c.url)
          }
        }
      }
      usage = data?.usage
    } catch {
      // …（既有 parse-error degraded 段原樣保留）
```

成功回傳段（原第 222–231 行）改成：

```ts
    const finalText =
      sourceUrls.length > 0
        ? `${text}\n\n資料來源：\n${sourceUrls
            .slice(0, MAX_SOURCE_URLS)
            .map((u) => `- ${u}`)
            .join('\n')}`
        : text

    log('llm_call', {
      // …（既有欄位不動）
    })
    return { text: finalText, meta: { responder: 'llm', model } }
```

注意：`text` 在這裡已通過 `typeof text !== 'string'` 檢查，TS narrow 後 `finalText` 是 string。

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts src/lib/line-agent/__tests__/anthropic-responder.test.ts
git commit -m "feat(line-agent): 外部佐證刀1 — 多 block 解析＋citations 去重抽 1-3 個來源 URL 附文末"
git push
```

---

### Task 5: anthropic-responder — 搜尋費記帳（$0.01/次，usage 缺保守估）

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts`（SPEND RECORDING 段）
- Modify: `src/lib/line-agent/observability/structured-log.ts`（`llm_call` 欄位 union）
- Test: `src/lib/line-agent/__tests__/anthropic-responder.test.ts`

**Step 1: 寫失敗測試**

```ts
describe('AnthropicPartnerGroupResponder — 搜尋費記帳（外部佐證刀）', () => {
  it('usage.server_tool_use.web_search_requests=2 ⇒ recordSpend 含 2×$0.01', async () => {
    const body = {
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 100, output_tokens: 50, server_tool_use: { web_search_requests: 2 } },
    }
    const { transport } = fakeTransport({ jsonValue: body })
    const { costCap, spends } = makeCostCap('ok')
    const { log, entries } = makeLog()
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, costCap, webSearchEnabled: true,
    }).respond({ ...makeInput(), log })

    const tokenCost = (100 / 1_000_000) * 3 + (50 / 1_000_000) * 15
    expect(spends[0]).toBeCloseTo(tokenCost + 0.02, 12)
    expect(entries().find((e) => e.event === 'llm_call')?.webSearchRequests).toBe(2)
  })

  it('開閘＋usage 整包缺 ⇒ 保守按 max_uses 3 全用滿估搜尋費', async () => {
    const { transport } = fakeTransport({ jsonValue: { content: [{ type: 'text', text: 'ok' }] } })
    const { costCap, spends } = makeCostCap('ok')
    await new AnthropicPartnerGroupResponder({
      transport, ...DEPS, costCap, webSearchEnabled: true,
    }).respond(makeInput())
    expect(spends[0]).toBeGreaterThanOrEqual(0.03) // 3 × $0.01 下限
  })

  it('閘關 ⇒ 記帳公式與現行完全相同（零搜尋費）', async () => {
    const body = { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 421, output_tokens: 96 } }
    const { transport } = fakeTransport({ jsonValue: body })
    const { costCap, spends } = makeCostCap('ok')
    await new AnthropicPartnerGroupResponder({ transport, ...DEPS, costCap }).respond(makeInput())
    expect(spends[0]).toBeCloseTo((421 / 1_000_000) * 3 + (96 / 1_000_000) * 15, 12)
  })
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 前兩個新測試 FAIL。

**Step 3: 實作**

`structured-log.ts` 的 `llm_call` shape 加一欄：

```ts
    /** 外部佐證刀 — 本次回應實際（或保守估）的 web_search 次數。 */
    webSearchRequests?: number
```

`anthropic-responder.ts` 常數區加：

```ts
/** Anthropic web_search 計費：$10 / 1000 次（design §0 vendor）。 */
const WEB_SEARCH_COST_PER_REQUEST_USD = 0.01
```

SPEND RECORDING 段（`costUsd` 計算處）改成：

```ts
    // 搜尋費補項（外部佐證刀）：usage.server_tool_use.web_search_requests ×
    // $0.01。usage 整包缺且本次有掛 tool ⇒ 按 max_uses 全用滿保守估 —
    // 寧高估觸發煞車，不低估燒錢（同 token 估計的紀律）。
    const searchRequestsRaw = usage?.server_tool_use?.web_search_requests
    const searchRequests =
      typeof searchRequestsRaw === 'number' && searchRequestsRaw > 0 ? searchRequestsRaw : 0
    const billedSearches =
      usageMissing && allowWebSearch ? WEB_SEARCH_MAX_USES : searchRequests
    const costUsd =
      estimateCostUsd(model, inputTokens, outputTokens) +
      billedSearches * WEB_SEARCH_COST_PER_REQUEST_USD
```

成功與 parse-error 兩處 `log('llm_call', …)` 各加：

```ts
      ...(billedSearches > 0 ? { webSearchRequests: billedSearches } : {}),
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts src/lib/line-agent/__tests__/structured-log.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts src/lib/line-agent/observability/structured-log.ts src/lib/line-agent/__tests__/anthropic-responder.test.ts
git commit -m "feat(line-agent): 外部佐證刀1 — 搜尋費記帳 \$0.01/次（usage 缺按 max_uses 保守估）"
git push
```

---

### Task 6: 接線 — factory passthrough＋webhook composition root＋CLI partner-respond

**Files:**
- Modify: `src/lib/line-agent/partner-group/responder-factory.ts`（`CreatePartnerGroupResponderInput`＋adapter 建構）
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（`getPartnerGroupResponder()`，約第 480–519 行）
- Modify: `scripts/agent-command.mjs`（`loadPartnerRespondKit`＋`runPartnerRespondCommand`）
- Test: `src/lib/line-agent/__tests__/responder-factory.test.ts`、`src/lib/line-agent/__tests__/agent-command-partner-respond.test.ts`

**Step 1: 寫失敗測試**

`responder-factory.test.ts` 加（沿用該檔既有 anthropic-mode fixture）：

```ts
  it('webSearchEnabled passthrough：factory 建出的 adapter 開閘掛 tools、省略不掛', async () => {
    const calls: Array<{ body: string }> = []
    const transport = (async (_url: unknown, init: any) => {
      calls.push({ body: init.body })
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) } as Response
    }) as unknown as typeof fetch
    const input = makeRespondInput() // 該檔既有 partner-group botDirected fixture
    await createPartnerGroupResponder({ models: anthropicModels(), transport, costCap: okCostCap(), webSearchEnabled: true }).respond(input)
    await createPartnerGroupResponder({ models: anthropicModels(), transport, costCap: okCostCap() }).respond(input)
    expect('tools' in JSON.parse(calls[0].body)).toBe(true)
    expect('tools' in JSON.parse(calls[1].body)).toBe(false)
  })
```

`agent-command-partner-respond.test.ts` 加（沿用該檔 fake-kit 模式 — kit 紀錄 `createPartnerGroupResponder` 收到的參數）：

```ts
  it('AI_AGENT_WEB_SEARCH_ENABLED=true＋cap ⇒ webSearchEnabled=true 注入＋輸出標示搜證開', async () => {
    const { kit, factoryArgs } = makeRecordingKit() // 該檔既有 helper 擴充：紀錄 factory args
    const out = await runPartnerRespondCommand({
      env: { ...PASSING_ENV, AI_AGENT_WEB_SEARCH_ENABLED: 'true', AI_AGENT_TOOL_COST_CAP_USD: '1.00' },
      kit, kvClient: fakeKv(), query: '天燈節哪天',
    })
    expect(factoryArgs[0].webSearchEnabled).toBe(true)
    expect(out).toContain('搜證：開')
  })

  it('閘未開 ⇒ webSearchEnabled=false＋輸出標示搜證關（照樣跑，不擋）', async () => {
    const { kit, factoryArgs } = makeRecordingKit()
    const out = await runPartnerRespondCommand({
      env: PASSING_ENV, kit, kvClient: fakeKv(), query: '天燈節哪天',
    })
    expect(factoryArgs[0].webSearchEnabled).toBe(false)
    expect(out).toContain('搜證：關')
  })
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/responder-factory.test.ts src/lib/line-agent/__tests__/agent-command-partner-respond.test.ts`
Expected: FAIL。

**Step 3: 實作**

1. `responder-factory.ts`：`CreatePartnerGroupResponderInput` 加

```ts
  /**
   * 外部佐證刀 — web_search 開關。caller（composition root）用
   * canUseExternalTool 判定後傳入；factory 照樣不讀 env。省略 ⇒ off。
   */
  webSearchEnabled?: boolean
```

   adapter 建構處加 `webSearchEnabled: input.webSearchEnabled,`。

2. `webhook-runtime.ts` `getPartnerGroupResponder()`，`createPartnerGroupResponder` 呼叫前：

```ts
    // 外部佐證刀 — composition root 判 web_search 閘：用 tool-gate 本人判
    //（單一事實來源，不重複 env 解析）。sourceChannel / botDirected 帶
    // 「夥伴群＋bot-directed」的前提值 — base responder 只會被這種訊息觸發，
    // adapter 內另有 per-request 防衛性收窄。
    const webSearchGate = canUseExternalTool(
      {
        tool: 'web_search',
        sourceChannel: 'line_partner_group',
        botDirected: true,
        userRequestedExternalData: false, // 刀1 後 web_search 不看此關（tag 即授權）
        costSpentUsd: 0,
      },
      loadToolConfig(process.env)
    )
    const base = createPartnerGroupResponder({
      models,
      transport: fetch,
      costCap,
      knowledgeSource,
      webSearchEnabled: webSearchGate.allowed,
    })
```

   import 補：`import { canUseExternalTool } from '../tools/tool-gate'`、`import { loadToolConfig } from '../tools/tool-config'`（檔內已有就不重複）。

3. `scripts/agent-command.mjs`：
   - `loadPartnerRespondKit` 加兩個 import seam＋kit 欄位：

```js
    importToolGateModule = () => import('../src/lib/line-agent/tools/tool-gate.ts'),
    importToolConfigModule = () => import('../src/lib/line-agent/tools/tool-config.ts'),
```

     kit 加 `canUseExternalTool` / `loadToolConfig`（同樣進 some-null 檢查）。
   - `runPartnerRespondCommand` 在建 responder 前：

```js
  // 外部佐證刀 — 與 webhook 同一個 composition-root 判法（tool-gate 單一事實來源）
  const webSearchGate = kit.canUseExternalTool(
    { tool: 'web_search', sourceChannel: 'line_partner_group', botDirected: true, userRequestedExternalData: false, costSpentUsd: 0 },
    kit.loadToolConfig(env)
  )
```

     `createPartnerGroupResponder({...})` 加 `webSearchEnabled: webSearchGate.allowed`，輸出陣列加一行：

```js
    `搜證：${webSearchGate.allowed ? '開（web_search 已掛，max 3 次/題）' : '關（AI_AGENT_WEB_SEARCH_ENABLED 未開或 AI_AGENT_TOOL_COST_CAP_USD 未設）'}`,
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/responder-factory.test.ts src/lib/line-agent/__tests__/agent-command-partner-respond.test.ts src/lib/line-agent/__tests__/webhook-runtime.test.ts`
Expected: 全 PASS。

**Step 5: 全量回歸＋commit + push**

Run: `npx vitest run`（全套）＋ `npx tsc --noEmit`
Expected: 全 PASS / 零 error。

```bash
git add src/lib/line-agent/partner-group/responder-factory.ts src/lib/line-agent/line/webhook-runtime.ts scripts/agent-command.mjs src/lib/line-agent/__tests__/responder-factory.test.ts src/lib/line-agent/__tests__/agent-command-partner-respond.test.ts
git commit -m "feat(line-agent): 外部佐證刀 — composition root 判閘接線（factory/webhook/CLI，default off）"
git push
```

---

### Task 7: 刀3 — CLI 黑箱驗收（真 API，手動）

**Files:** 無程式改動 — 真打驗收。

> ⚠️ CLI 載 `.env.local`：三閘＋key 齊就是真打 API、真花錢（memory 教訓）。
> 跑之前先 `grep -E 'AI_AGENT_(WEB_SEARCH|DAILY_COST_CAP|TOOL_COST_CAP)' .env.local` 確認現狀。

**Step 1: 關閘 run（基準）**

```bash
npm run agent:partner-respond -- "清邁11月天燈節（Yi Peng）確切日期是哪天？"
```

Expected：輸出含 `搜證：關`；回覆誠實說無法確認確切日期、建議人工查證；**絕無**編造的日期或來源 URL。

**Step 2: 開閘 run（shell env 蓋過 .env.local）**

```bash
AI_AGENT_WEB_SEARCH_ENABLED=true AI_AGENT_TOOL_COST_CAP_USD=1.00 \
  npm run agent:partner-respond -- "清邁11月天燈節（Yi Peng）確切日期是哪天？"
```

Expected：輸出含 `搜證：開`；回覆給出具體日期＋「資料來源：」段帶 1–3 個真實 URL＋「以上為網路資料供參考，重要細節建議再與導遊確認」字樣；meta `responder: 'llm'`。

**Step 3: 驗收結果記錄**

兩次輸出（含成本觀察）摘要進 Task 11 的 docs commit。若品質不足（搜不到 / 來源爛）→ 停下回報 Eric，討論是否走 SerpAPI（design §4 YAGNI 預留）。

#### ✅ 驗收結果（2026-06-13 07:41 UTC，真打）

| 項目 | Step 1 關閘 | Step 2 開閘 |
|---|---|---|
| 搜證標示 | `關` | `開`（web_search 已掛，max 3/題；實際 `webSearchRequests:1`） |
| 回覆行為 | 誠實說讀不到即時資料、無法確認、建議人工查證；**零**編造日期/URL | 結論「2026 清邁天燈節 11/24–25」＋場地＋「資料來源：」段（1 個 URL）＋「以上為網路資料供參考，重要細節建議再與導遊確認」 |
| model | `claude-haiku-4-5` | `claude-haiku-4-5` |
| inputTokens | 1,431 | 14,014（搜證結果灌入 context） |
| costUsd | $0.002391 | $0.025059（約 10×，差在 web 結果 token） |

判定：**通過**。關/開閘行為皆符合 design 預期，tripwire 條款生效。
品質備註：開閘來源為 `hopetrip.com`（非官方一手），日期需人工複核；MVP 行為正確，暫不啟 SerpAPI（design §4 預留）。

---

### Task 8: 刀4a — 截圖一條龍：vision → respond 接線

**Files:**
- Modify: `src/lib/line-agent/partner-group/vision-intake-surfacing.ts`
- Modify: `src/lib/line-agent/partner-group/responder.ts`（input 加 `visionImage`）
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（`createVisionIntakeResponder` 注入 `respond: base`，約第 539–550 行）
- Test: `src/lib/line-agent/__tests__/vision-intake-surfacing.test.ts`

**Step 1: 寫失敗測試**

加進 `vision-intake-surfacing.test.ts`（沿用該檔既有 fixture helper）：

```ts
describe('createVisionIntakeResponder — 一條龍（外部佐證刀4）', () => {
  it('respond 已注入＋無純抽字關鍵詞 ⇒ 抽出文字＋夥伴附言合併餵 respond', async () => {
    const seen: string[] = []
    const respond = {
      async respond(i: PartnerGroupRespondInput) {
        seen.push(i.text)
        return { text: '會擠，建議大車', meta: { responder: 'llm' as const } }
      },
    }
    const responder = createVisionIntakeResponder({
      fetchImage: async () => fakeImage(),
      vision: async () => '客人問：兩大兩小坐小車會不會擠？',
      respond,
    })
    const result = await responder.respond(makeQuotedImageInput('@bot 幫我看這個'))
    expect(result.text).toBe('會擠，建議大車')
    expect(seen[0]).toContain('【截圖中的客人問題】')
    expect(seen[0]).toContain('客人問：兩大兩小坐小車會不會擠？')
    expect(seen[0]).toContain('【夥伴附言】')
    expect(seen[0]).toContain('@bot 幫我看這個')
  })

  it('命中「讀取這張圖」⇒ 走既有純抽字＋三分流，respond 零呼叫', async () => {
    const respond = { respond: vi.fn() }
    const responder = createVisionIntakeResponder({
      fetchImage: async () => fakeImage(),
      vision: async () => '客人問：12/1 有空嗎',
      respond,
    })
    const result = await responder.respond(makeQuotedImageInput('@bot 讀取這張圖'))
    expect(result.text).toContain('【截圖內容整理】')
    expect(respond.respond).not.toHaveBeenCalled()
  })

  it('respond 未注入 ⇒ 行為與刀B 完全不變（回歸）', async () => {
    const responder = createVisionIntakeResponder({
      fetchImage: async () => fakeImage(),
      vision: async () => '客人問：12/1 有空嗎',
    })
    const result = await responder.respond(makeQuotedImageInput('@bot 幫我看'))
    expect(result.text).toContain('【截圖內容整理】')
  })

  it('引用圖但抽不出問題 ⇒ 固定誠實回覆，respond 零呼叫（不搜不花錢）', async () => {
    const respond = { respond: vi.fn() }
    const responder = createVisionIntakeResponder({
      fetchImage: async () => fakeImage(),
      vision: async () => '這張圖不是客人對話截圖',
      respond,
    })
    const result = await responder.respond(makeQuotedImageInput('@bot 幫我看'))
    expect(result.text).toBe(VISION_INTAKE_NO_QUESTION_REPLY)
    expect(result.meta?.error).toBe('no_question_in_image')
    expect(respond.respond).not.toHaveBeenCalled()
  })
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/vision-intake-surfacing.test.ts`
Expected: FAIL — deps 無 `respond`、`VISION_INTAKE_NO_QUESTION_REPLY` 不存在。

**Step 3: 實作**

1. `responder.ts` 的 `PartnerGroupRespondInput` 加（`quotedImage` 欄位之後）：

```ts
  /**
   * 外部佐證刀4 — 一條龍要讀的那張圖。webhook 解析（引用圖優先、30 分鐘內
   * 最近一張圖次之）後注入；vision responder 以此為準，缺席時退回
   * quotedRef。via 區分語意強度：'quote'＝夥伴明確指著這張圖；'recent'＝
   * 順手撈的最近一張 — 抽不出問題時 'recent' 必須退回純文字回答，不可劫持。
   */
  visionImage?: { messageId: string; via: 'quote' | 'recent' }
```

2. `vision-intake-surfacing.ts`：

```ts
export const VISION_INTAKE_NO_QUESTION_REPLY =
  '讀不到圖內的客人問題，請把客人的文字訊息直接貼上來。'

/** 純抽字關鍵詞 — 命中時保留刀B「截圖內容整理＋三分流」（design §2 保留不動）。 */
const PURE_EXTRACTION_PATTERN = /讀取這張圖|讀取圖片/

/** vision 抽取結果不可用：空白或固定「非對話截圖」句（adapter prompt 的硬規則輸出）。 */
function extractionUnusable(extracted: string): boolean {
  return extracted.trim() === '' || extracted.includes('這張圖不是客人對話截圖')
}
```

   `CreateVisionIntakeResponderDeps` 加：

```ts
  /**
   * 一條龍（外部佐證刀4）：抽完字改餵回答路徑（知識注入＋web search）。
   * 未注入 ⇒ 刀B 既有「整理＋三分流」行為 byte-identical。
   */
  respond?: PartnerGroupResponder
```

   `respond()` 第 1 步 messageId 解析改為 `const quotedId = input.visionImage?.messageId ?? input.event.quotedRef?.quotedMessageId`；第 4 步（triage 之前）插入：

```ts
      // 4. 一條龍（外部佐證刀4）：respond 已注入且非純抽字指令 ⇒ 合併餵回答
      //    路徑。命中「讀取這張圖」⇒ 保留刀B 純抽字（design §2）。
      if (deps.respond && !PURE_EXTRACTION_PATTERN.test(input.text)) {
        if (extractionUnusable(extracted)) {
          if (input.visionImage?.via === 'recent') {
            // 最近一張圖是順手撈的 — 抽不出問題就退回純文字回答路徑，
            // 夥伴的文字問題不可被旁邊的圖劫持。
            input.log?.('route_decision', {
              path: 'vision_intake',
              degradedReason: 'recent_image_unusable_fallback_text',
            })
            return deps.respond.respond(input)
          }
          input.log?.('route_decision', {
            path: 'vision_intake',
            degradedReason: 'no_question_in_image',
          })
          return {
            text: VISION_INTAKE_NO_QUESTION_REPLY,
            meta: { responder: 'vision_intake', degraded: true, error: 'no_question_in_image' },
          }
        }
        const merged = [
          '【截圖中的客人問題】',
          extracted,
          '',
          '【夥伴附言】',
          input.text,
        ].join('\n')
        input.log?.('route_decision', { path: 'vision_intake', reason: 'respond_pipeline' })
        return deps.respond.respond({ ...input, text: merged })
      }
      // 5.（既有三分流段原樣保留，編號順延）
```

3. `webhook-runtime.ts` 第 539–550 行 `createVisionIntakeResponder({...})` 加 `respond: base,`（`base` 在上方已建好，含 knowledgeSource＋webSearchEnabled — 兩次 LLM call 共用同一個 costCap，cap 到整條龍熄火，design §2 邊界自動成立）。

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/vision-intake-surfacing.test.ts src/lib/line-agent/__tests__/vision-intake-dispatch.test.ts src/lib/line-agent/__tests__/vision-intake-adapter.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/partner-group/vision-intake-surfacing.ts src/lib/line-agent/partner-group/responder.ts src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/__tests__/vision-intake-surfacing.test.ts
git commit -m "feat(line-agent): 外部佐證刀4 — 截圖一條龍 vision→respond 接線（讀取這張圖保留純抽字）"
git push
```

---

### Task 9: 刀4b — 群內 30 分鐘最近一張圖 fallback

**Files:**
- Modify: `src/lib/line-agent/storage/store.ts`（contract）
- Modify: `src/lib/line-agent/storage/memory-store.ts`
- Modify: `src/lib/line-agent/storage/kv-store.ts`
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（`resolveQuotedImage` → `resolveVisionImage`＋寫入點 1a＋respondInput 注入點）
- Modify: `src/lib/line-agent/partner-group/responder-factory.ts`（dispatcher 觸發條件）
- Test: `src/lib/line-agent/__tests__/case-store-contract.ts`（共用 contract）、`src/lib/line-agent/__tests__/vision-intake-dispatch.test.ts`

**Step 1: 寫失敗測試**

`case-store-contract.ts` 加（沿用該檔 contract-suite 模式，時間用注入參數，不用 Date.now）：

```ts
  it('putLatestPartnerGroupImage / getLatestPartnerGroupImage — 30 分鐘 freshness 窗', async () => {
    const t0 = 1_700_000_000_000
    await store.putLatestPartnerGroupImage('IMG1', t0)
    expect(await store.getLatestPartnerGroupImage(t0 + 29 * 60_000)).toBe('IMG1')
    expect(await store.getLatestPartnerGroupImage(t0 + 31 * 60_000)).toBeNull()
    await store.putLatestPartnerGroupImage('IMG2', t0 + 10 * 60_000) // 後到覆蓋
    expect(await store.getLatestPartnerGroupImage(t0 + 20 * 60_000)).toBe('IMG2')
    await store.putLatestPartnerGroupImage('', t0) // empty no-op
  })
```

`vision-intake-dispatch.test.ts` 加 dispatcher 條件測試：`respondInput.visionImage` 在場（無 `quotedImage`）也要路由到 visionIntake（沿用該檔既有 dispatcher fixture，env 帶 `AI_AGENT_OCR_ENABLED: 'true'`＋`AI_AGENT_TOOL_COST_CAP_USD: '1.00'`）。

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/memory-store.test.ts src/lib/line-agent/__tests__/kv-store.test.ts src/lib/line-agent/__tests__/vision-intake-dispatch.test.ts`
Expected: FAIL — store 方法不存在。

**Step 3: 實作**

1. `store.ts` contract（圖片刀B 區塊之後）：

```ts
  /**
   * 外部佐證刀4 — 記住夥伴群「最近一張圖」（單一 latest pointer，後到覆蓋）。
   * 30 分鐘 freshness 窗由讀端判；empty messageId 是 no-op。
   */
  putLatestPartnerGroupImage(messageId: string, timestampMs: number): Promise<void>

  /** 30 分鐘內的最近一張圖 messageId；過窗 / 從未寫入 ⇒ null。 */
  getLatestPartnerGroupImage(nowMs: number): Promise<string | null>
```

2. `memory-store.ts`：private 欄位 `latestPartnerGroupImage: { messageId: string; ts: number } | null = null`；put 覆蓋、get 檢查 `nowMs - ts <= 30 * 60_000`。

3. `kv-store.ts`：常數 `const PARTNER_GROUP_LATEST_IMG_TTL_SECONDS = 1800`（= freshness 窗，TTL 兜底）＋ key helper `partnerGroupLatestImgKey()`（mirror `partnerGroupImgKey` 命名）；值存 JSON `{ m: messageId, ts: timestampMs }`；get 時 TTL 之外再驗 `nowMs - ts <= 1800_000`（belt-and-braces，KV TTL 精度不可依賴）。

4. `webhook-runtime.ts`：
   - 1a 寫入點（第 265–266 行 try 內）加 `await store.putLatestPartnerGroupImage(event.messageId, Date.now())`。
   - `resolveQuotedImage` 改名 `resolveVisionImage`，回傳 `{ messageId: string; via: 'quote' | 'recent' } | null`：引用圖命中 ⇒ `via: 'quote'`；否則（`group_text` 或引用非圖）`store.getLatestPartnerGroupImage(Date.now())` 命中 ⇒ `via: 'recent'`；全部 fail-safe catch ⇒ null。前置條件不變（botDirected＋`line_partner_group`）。
   - respondInput 注入點（grep `quotedImage:` 找到既有組裝處）：`visionImage: resolved ?? undefined`、`quotedImage: resolved?.via === 'quote'`（保持舊欄位語意）。
5. `responder-factory.ts` dispatcher 條件改：

```ts
        shouldUseVisionIntake({
          sourceChannel: respondInput.event.sourceChannel,
          botDirected,
          quotedImage:
            respondInput.quotedImage === true || respondInput.visionImage != null,
          env,
        })
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/memory-store.test.ts src/lib/line-agent/__tests__/kv-store.test.ts src/lib/line-agent/__tests__/vision-intake-dispatch.test.ts src/lib/line-agent/__tests__/webhook-runtime.test.ts src/lib/line-agent/__tests__/line-webhook-route.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/storage src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/partner-group/responder-factory.ts src/lib/line-agent/__tests__
git commit -m "feat(line-agent): 外部佐證刀4 — 30 分鐘最近一張圖 fallback（latest pointer＋recent 不劫持文字問題）"
git push
```

**風險備忘（review 時驗）：** `via: 'recent'` 代表「圖進群後 30 分鐘內的任何 tag 都會先走一次 Haiku 看圖」（≈ $0.002/次）。劫持風險由 Task 8 的 `recent_image_unusable_fallback_text` 退路擋住；成本風險由 daily cost cap 擋住。真群驗收若發現誤觸率高，再考慮收緊（例如 recent 只在附言含問句時觸發）— 先照設計定稿出貨。

---

### Task 10: 刀4c — CLI `agent:vision-respond` 黑箱入口

**Files:**
- Modify: `package.json`（scripts）
- Modify: `scripts/agent-command.mjs`
- Test: `src/lib/line-agent/__tests__/agent-command-vision-respond.test.ts`（新檔，mirror `agent-command-partner-respond.test.ts`）

**Step 1: 寫失敗測試**

新檔測（fake kit 注入，不打真 API）：
- parse：`vision-respond ./shot.jpg 客人這樣問` ⇒ `{ imagePath: './shot.jpg', remark: '客人這樣問' }`；缺路徑 ⇒ throw 用法說明。
- 前置閘與 partner-respond 同（mode/key/model/cap/KV 缺 ⇒ throw）。
- 餵 fake 圖檔（測試寫 tmp 檔）＋fake kit ⇒ 輸出含 `--- 回覆 ---`，且 vision/respond 兩段都被呼叫（kit 紀錄）。
- 副檔名 → mediaType：`.jpg/.jpeg → image/jpeg`、`.png → image/png`、其他 ⇒ throw。

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/agent-command-vision-respond.test.ts`
Expected: FAIL。

**Step 3: 實作**

1. `package.json` scripts 加：

```json
    "agent:vision-respond": "tsx --env-file=.env.local scripts/agent-command.mjs vision-respond",
```

2. `scripts/agent-command.mjs`：
   - `parseAgentCommandArgs` 加 `vision-respond` 分支（第一個非 flag arg＝圖檔路徑，其餘 join 成附言；附言預設 `'幫我看一下這張截圖的問題'`；拒收 flag，同 partner-respond）。
   - `loadVisionRespondKit`：在 `loadPartnerRespondKit` 的 import 集合上再加 `vision-intake-adapter.ts`（`createAnthropicVisionIntakeSource`）與 `vision-intake-surfacing.ts`（`createVisionIntakeResponder`）。
   - `runVisionRespondCommand(options)`：
     1. 前置閘＝`runPartnerRespondCommand` 的閘①②逐條照抄（mode / key / model / DAILY cap / KV — 驗收 CLI 絕不 exit 0 印 degraded）。
     2. `node:fs/promises` `readFile(imagePath)` → base64；副檔名映 mediaType，讀不到檔 ⇒ throw 明確訊息。
     3. 組真件：`knowledgeSource`＋`webSearchGate`（同 Task 6 CLI 判法）→ base responder；`createAnthropicVisionIntakeSource({ transport, apiKey, costCap, env })`；`createVisionIntakeResponder({ fetchImage: async () => ({ base64, mediaType }), vision, respond: base })`。
     4. 呼叫 `respond({ event: { kind: 'group_quoted', sourceChannel: 'line_partner_group', mentionsBot: true, quotedRef: { quotedMessageId: 'cli-local-image' } }, intent: { action: 'respond', confidence: 'high', source: 'deterministic' }, text: remark, botDirected: true, visionImage: { messageId: 'cli-local-image', via: 'quote' } })`。
     5. 輸出：標頭（黑箱、不碰 store、不貼群）＋圖檔路徑＋知識源/搜證閘狀態＋meta＋`--- 回覆 ---`＋text。
   - `runAgentCommand` 路由＋help 字串補 `vision-respond`。

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/agent-command-vision-respond.test.ts src/lib/line-agent/__tests__/agent-command-script.test.ts`
Expected: 全 PASS。

**Step 5: 真打黑箱驗收（手動，同 Task 7 警語）**

準備一張測試截圖（LINE 對話、客人問實質問題，例：問天燈節日期）存 `docs/fixtures/` 之外的本機路徑（**不 commit 客人截圖**），跑：

```bash
AI_AGENT_OCR_ENABLED=true AI_AGENT_WEB_SEARCH_ENABLED=true AI_AGENT_TOOL_COST_CAP_USD=1.00 \
  npm run agent:vision-respond -- ~/test-screenshot.jpg "客人問的這個怎麼回"
```

Expected：回覆＝結論＋資料來源 URL＋導遊確認句（vision 抽字 → 知識注入 → web search 全程走通）。

**Step 6: Commit + push**

```bash
git add package.json scripts/agent-command.mjs src/lib/line-agent/__tests__/agent-command-vision-respond.test.ts
git commit -m "feat(line-agent): 外部佐證刀4 — CLI agent:vision-respond 黑箱入口（截圖一條龍驗收）"
git push
```

---

### Task 11: docs 收尾＋README build trigger

**Files:**
- Modify: `docs/plans/2026-06-13-tough-qa-web-search-evidence-design.md`（狀態註記＋驗收結果）
- Modify: `README.md`（build trigger，依 repo 慣例）

**Step 1:** design doc 頂部狀態改「已實作（commits <range>），CLI 黑箱驗收結果：…」，附 Task 7 / Task 10 Step 5 的實際輸出摘要（成本觀察一併記）。

**Step 2:** README build trigger 行更新（repo 既有慣例，grep `build trigger`）。

**Step 3: Commit + push**

```bash
git add docs/plans/2026-06-13-tough-qa-web-search-evidence-design.md README.md
git commit -m "docs(line-agent): 外部佐證刀驗收結果＋README build trigger"
git push
```

---

## 啟用（plan 之外，Eric 拍板後）

CLI 驗收過 → Vercel preview 補 `AI_AGENT_WEB_SEARCH_ENABLED=true`（`AI_AGENT_TOOL_COST_CAP_USD` 若未設一併補）→ redeploy → 等真群 tough case（同檢索閉環刀流程）。截圖一條龍另需 `AI_AGENT_OCR_ENABLED=true`（刀B 已有）。
