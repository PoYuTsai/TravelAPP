# LINE OA Agent M2（第一批）Implementation Plan — Customer Event Classifier / Inbox SLA 分區 / Reminder Candidate

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 為 LINE OA agent 補上「客人事件分類 → SLA 分區 inbox → 溫和提醒候選」的內部判斷層，全程零對客送出、零自動推群。

**Architecture:** 沿用既有 `intent.ts` 的 deterministic-first + injectable LLM seam 模式新增 `CustomerEventClassifier`。分類在 **write-time**（webhook handler 拿得到 `NormalizedLineEvent.kind`）算出並存進 `AgentCase.latestEventCategory`；`InboxZone` 與 `ReminderCandidate` 在 **read-time**（`/inbox` 查詢時）推導，不落 KV、不送 LINE。`/inbox` 文字輸出在 `scripts/agent-command.mjs` 依 zone 分組。

**Tech Stack:** TypeScript、Vitest（`npx vitest run`）、純函式 + 注入 `now`／seam 保持決定性。Auto-reply schema 用 `false` literal type 釘死，型別層擋掉任何送出。

**Scope（第一批，明確邊界）:**
- ✅ 做：CustomerEventCategory + deterministic classifier、auto-reply schema（全 dormant）、ReminderCandidate read-time engine、InboxZone resolver、`/inbox` 分區輸出、守門測試。
- ❌ 不做：夥伴群回答（`PartnerGroupEvent`）、任何 LINE reply/push、語音、報價後台 / quote gate 等級常數、真 LLM 模型接線、postback normalizer 擴充（留 seam）。

**設計依據:**
- `docs/plans/2026-06-03-line-oa-m2-case-intelligence-design.md`（分類法 §3、auto-reply §4、reminder §5、zone resolver §6、資料模型 §7、測試 §9）
- `docs/plans/2026-06-03-line-oa-m2-internal-assistant-event-model-ux.md`（傘狀事件模型、邊界自檢 §12）

**既有相依檔案（實作前先讀）:**
- `src/lib/line-agent/commands/intent.ts` — classifier 範本（deterministic + seam + safe default）
- `src/lib/line-agent/cases/case-state.ts` — `AgentCase`、`CaseStatus`(12)、`CustomerMessage`
- `src/lib/line-agent/commands/case-triage.ts` — deterministic 抽欄位（zone/排序要用 `knownFacts`/`missingFields`/`questions`）
- `src/lib/line-agent/commands/handlers.ts` — `handleListRecentCases`、`CaseSummary`、`handleCreateOrUpdateCase`
- `src/lib/line-agent/line/event-normalizer.ts` — `NormalizedLineEvent.kind`（`oa_text`/`image`/`file`/…；**目前不含 postback**）
- `scripts/agent-command.mjs` — `formatInboxCases`（`/inbox` 文字渲染）

---

## ⚠️ 實作前必讀：三個架構約束

1. **分類時機 = write-time。** `CustomerMessage` 只存 `text`，且 `event-normalizer.ts` 目前丟棄 postback。`menu_browsing`（postback）與 `media_or_ocr_needed`（image/file 無文字）**無法**靠 read-time 重讀 case 文字判斷。因此 classifier 在 `handleCreateOrUpdateCase`（有 `NormalizedLineEvent.kind`）執行，把結果存 `AgentCase.latestEventCategory` + `latestClassifiedAt`（design §7 最小增補）。zone / reminder read-time 讀這個欄位。
2. **資料要跨 HTTP。** `/inbox` 渲染在 `scripts/agent-command.mjs`，吃 route 回傳的 `handlerResult.meta.cases`（JSON）。所以 `zone`、`reminder`、`eventCategory` 必須在伺服器端（`handleListRecentCases`）算好、塞進 `CaseSummary`（純可序列化值），`.mjs` 只分組顯示。
3. **型別相依順序。** `ReminderCandidate.zone: InboxZone`。先建 `inbox-zone.ts` 只放 `InboxZone` union（Task 3a），resolver 規則留 Task 4，避免 forward-reference。
4. **postback 不在第一批接線。** classifier 模組可吃 `isPostback`/`messageType` 並完整測 `menu_browsing`，但 live webhook 要等 normalizer 擴充（未來 milestone）才會真的收到 postback。第一批只把 seam 留好，於 plan 結尾 Open Items 記錄。

---

## Task 1：Customer Event Classifier 模組（types + deterministic + safe default）

對應 design Case Intelligence §3。純模組，無模型、無金鑰、無 I/O。

**Files:**
- Create: `src/lib/line-agent/cases/customer-event.ts`
- Test: `src/lib/line-agent/__tests__/customer-event-classifier.test.ts`

**Step 1: 先寫失敗測試**

涵蓋 8 類 + 優先序邊界 + safe default。範例骨架：

```ts
import { describe, expect, test } from 'vitest'
import {
  classifyCustomerEventDeterministic,
  safeDefaultCustomerClassifier,
  type ClassifyInput,
} from '../cases/customer-event'

const base: ClassifyInput = {
  text: '',
  messageType: 'text',
  isPostback: false,
  hasPriorMessages: false,
  missingFields: [],
  now: '2026-06-03T00:00:00.000Z',
}

describe('classifyCustomerEventDeterministic', () => {
  test('new_inquiry：無歷史 + 行程意圖詞', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '想帶小孩去清邁玩，有包車嗎' })
    expect(r?.category).toBe('new_inquiry')
    expect(r?.source).toBe('deterministic')
  })

  test('follow_up_info：已有歷史 + 補上日期人數', () => {
    const r = classifyCustomerEventDeterministic({
      ...base, text: '8/21，2大2小，住古城', hasPriorMessages: true,
      missingFields: ['travelDates', 'partySize'],
    })
    expect(r?.category).toBe('follow_up_info')
  })

  test('change_request：變更詞 + 已知需求', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '改成 8/22 出發', hasPriorMessages: true })
    expect(r?.category).toBe('change_request')
  })

  test('price_question 優先於 product：同時命中以 price 為準', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '大象體驗含午餐嗎？報價1600是哪間？' })
    expect(r?.category).toBe('price_question')
    expect(r?.signals).toContain('price')
  })

  test('menu_browsing：postback', () => {
    const r = classifyCustomerEventDeterministic({ ...base, isPostback: true, text: '' })
    expect(r?.category).toBe('menu_browsing')
  })

  test('media_or_ocr_needed：image 無文字', () => {
    const r = classifyCustomerEventDeterministic({ ...base, messageType: 'image', text: '' })
    expect(r?.category).toBe('media_or_ocr_needed')
  })

  test('non_actionable：純寒暄無商務詞', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '謝謝' })
    expect(r?.category).toBe('non_actionable')
  })

  test('優先序：image 勝過文字訊號', () => {
    const r = classifyCustomerEventDeterministic({ ...base, messageType: 'image', text: '報價多少' })
    expect(r?.category).toBe('media_or_ocr_needed')
  })
})

describe('safeDefaultCustomerClassifier（low_context 不亂猜）', () => {
  test('未命中 → new_inquiry/low（最保守，丟給人看，不捏造事實）', async () => {
    const r = await safeDefaultCustomerClassifier.classify({ ...base, text: '在嗎' })
    expect(r.category).toBe('new_inquiry')
    expect(r.confidence).toBe('low')
    expect(r.source).toBe('llm')
  })
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/customer-event-classifier.test.ts`
Expected: FAIL（模組不存在）

**Step 3: 實作 `customer-event.ts`**

要件（依 design §3，mirror `intent.ts` 結構）：
- `export type CustomerEventCategory`（8 個 string literal，照 design §3 區塊）。
- `export interface ClassifyInput { text; messageType: 'text'|'image'|'file'|'pdf'|'sticker'; isPostback: boolean; hasPriorMessages: boolean; missingFields: string[]; now: string }`。
- `export interface CustomerEventClassification { category; confidence: 'high'|'medium'|'low'; source: 'deterministic'|'llm'; signals: string[]; classifiedAt: string }`。
- `export interface CustomerEventClassifier { classify(input: ClassifyInput): Promise<CustomerEventClassification> }`。
- `export function classifyCustomerEventDeterministic(input): CustomerEventClassification | null` — 純 regex/keyword，照 design §3.1 訊號表 + **§3.1 優先序**：`media_or_ocr_needed`(看 messageType) → `menu_browsing`(看 isPostback) → `change_request` → `price_question` → `product_or_itinerary_question` → `follow_up_info`(需 hasPriorMessages + 命中 missingFields 對應值) → `new_inquiry` → `non_actionable`(兜底)。`signals` 帶命中的 pattern 名稱供稽核。`classifiedAt = input.now`。
- `export const safeDefaultCustomerClassifier: CustomerEventClassifier` — deterministic 先跑；null → 回 `new_inquiry/low/source:'llm'`（design §3.2 安全預設：unknown → needs human，不放寬權限、不觸發送出）。
- 關鍵詞表沿用 `case-triage.ts` 既有風格（價格詞、變更詞、行程意圖詞、寒暄詞），集中成 const pattern 陣列，**不**內聯散落。

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/customer-event-classifier.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/cases/customer-event.ts src/lib/line-agent/__tests__/customer-event-classifier.test.ts
git commit -m "feat(line-agent): add deterministic customer event classifier"
```

---

## Task 2：Rich Menu / Auto-Reply Mapping Schema（全程 dormant）

對應 design §4。**只定義 + 預設資料，零送出**；`enabled` 用 `false` literal type 釘死。

**Files:**
- Create: `src/lib/line-agent/cases/auto-reply.ts`
- Test: `src/lib/line-agent/__tests__/auto-reply-mapping.test.ts`

**Step 1: 先寫失敗測試**

```ts
import { describe, expect, test } from 'vitest'
import { DEFAULT_AUTO_REPLY_CONFIG, type AutoReplyConfig } from '../cases/auto-reply'

describe('auto-reply schema（dormant）', () => {
  test('全域總開關恆為 false', () => {
    expect(DEFAULT_AUTO_REPLY_CONFIG.autoReplyEnabled).toBe(false)
  })

  test('每個 mapping enabled 皆為 false', () => {
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(m.enabled).toBe(false)
    }
  })

  test('每個 mapping 都對應一個合法 CustomerEventCategory', () => {
    const valid = new Set([
      'new_inquiry','follow_up_info','change_request','price_question',
      'product_or_itinerary_question','menu_browsing','media_or_ocr_needed','non_actionable',
    ])
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(valid.has(m.mapsToCategory)).toBe(true)
    }
  })

  test('draftReplyTemplate 存在但僅供 operator 視圖（非空字串）', () => {
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(typeof m.draftReplyTemplate).toBe('string')
    }
  })
})
```

**Step 2:** Run: `npx vitest run src/lib/line-agent/__tests__/auto-reply-mapping.test.ts` → FAIL

**Step 3: 實作 `auto-reply.ts`**

- `AutoReplyMapping`（`enabled: false` literal）、`AutoReplyConfig`（`autoReplyEnabled: false` literal），照 design §4 區塊。
- `trigger` union：`{ type: 'rich_menu_postback'; value: string } | { type: 'keyword'; value: string }`。
- `mapsToCategory: CustomerEventCategory`（import 自 `customer-event.ts`）。
- `export const DEFAULT_AUTO_REPLY_CONFIG: AutoReplyConfig` — 列出幾個 rich menu 區塊（包車 / 行程 / 報價 / 大象體驗），`trigger.value` 用 placeholder（design §11 Open Q：實際 key 待 LINE OA 後台回填），全部 `enabled: false`。
- 檔案頂部 comment 明示「此 schema M2 一律不送出；`draftReplyTemplate` 只進 operator 視圖，絕不進 LINE reply API」。

**Step 4:** Run 同上 → PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/cases/auto-reply.ts src/lib/line-agent/__tests__/auto-reply-mapping.test.ts
git commit -m "feat(line-agent): add dormant auto-reply mapping schema"
```

---

## Task 3：InboxZone union（型別 seam）+ ReminderCandidate read-time engine

對應 design §5（reminder）+ §6.1（zone union）。先建 zone union 型別解相依，再做 reminder engine。

**Files:**
- Create: `src/lib/line-agent/cases/inbox-zone.ts`（**本 task 只放 union 型別**，resolver 留 Task 4）
- Create: `src/lib/line-agent/cases/reminder.ts`
- Test: `src/lib/line-agent/__tests__/reminder-candidate.test.ts`

**Step 1（type seam，無測試）：** 在 `inbox-zone.ts` 先放：

```ts
export type InboxZone =
  | 'need_reply' | 'awaiting_customer' | 'ready_itinerary'
  | 'quote_review' | 'quoted_tracking' | 'browsing_idle' | 'needs_eric'
```

（resolver 函式 Task 4 補；先給型別讓 `reminder.ts` import。）

**Step 2: 先寫 reminder 失敗測試**（注入 `now`，驗每個 reason 觸發/未觸發邊界，design §5.1）

```ts
import { describe, expect, test } from 'vitest'
import { deriveReminderCandidate, type ReminderInput } from '../cases/reminder'

const base: ReminderInput = {
  caseId: 'CW-test-1',
  status: 'new_inquiry',
  latestEventCategory: 'new_inquiry',
  hasUnansweredQuestion: false,
  lastCustomerMessageAt: '2026-06-03T00:00:00.000Z',
  now: '2026-06-03T00:00:00.000Z',
}

describe('deriveReminderCandidate（read-time，注入 now）', () => {
  test('unanswered_question_overdue：未回提問 > 2hr → urgent', () => {
    const r = deriveReminderCandidate({
      ...base, hasUnansweredQuestion: true,
      lastCustomerMessageAt: '2026-06-03T00:00:00.000Z', now: '2026-06-03T02:30:00.000Z',
    })
    expect(r?.reason).toBe('unanswered_question_overdue')
    expect(r?.severity).toBe('urgent')
  })

  test('未回提問但僅 1hr → 不觸發', () => {
    const r = deriveReminderCandidate({
      ...base, hasUnansweredQuestion: true, now: '2026-06-03T01:00:00.000Z',
    })
    expect(r).toBeNull()
  })

  test('new_inquiry_unhandled：new_inquiry > 4hr → attention', () => {
    const r = deriveReminderCandidate({ ...base, now: '2026-06-03T05:00:00.000Z' })
    expect(r?.reason).toBe('new_inquiry_unhandled')
    expect(r?.severity).toBe('attention')
  })

  test('awaiting_customer_stale：needs_info + 客人 > 48hr → info', () => {
    const r = deriveReminderCandidate({
      ...base, status: 'needs_info', now: '2026-06-05T01:00:00.000Z',
    })
    expect(r?.reason).toBe('awaiting_customer_stale')
  })

  test('quote_review_pending：quote_review > 24hr → attention', () => {
    const r = deriveReminderCandidate({
      ...base, status: 'quote_review', now: '2026-06-04T01:00:00.000Z',
    })
    expect(r?.reason).toBe('quote_review_pending')
  })

  test('menu_browsing 不產生提醒（守門：瀏覽不催）', () => {
    const r = deriveReminderCandidate({
      ...base, latestEventCategory: 'menu_browsing', status: 'idle', now: '2026-06-05T00:00:00.000Z',
    })
    expect(r).toBeNull()
  })
})
```

**Step 3:** Run: `npx vitest run src/lib/line-agent/__tests__/reminder-candidate.test.ts` → FAIL

**Step 4: 實作 `reminder.ts`**

- `export type ReminderReason`（5 個，design §5）。
- `export interface ReminderCandidate { caseId; zone: InboxZone; reason: ReminderReason; severity: 'info'|'attention'|'urgent'; ageHours: number; suggestedAction: string; createdAt: string }`。
- `export interface ReminderInput { caseId; status: CaseStatus; latestEventCategory?: CustomerEventCategory; hasUnansweredQuestion: boolean; lastCustomerMessageAt: string; now: string }`。
- `export function deriveReminderCandidate(input): ReminderCandidate | null` — 依 design §5.1 門檻表（絕對時數）由嚴到鬆判定；`menu_browsing`/`non_actionable` 一律不產生（守門）。`ageHours` 用 `(now - 觸發起算)/3600000`，注入 `now` 決定性。`createdAt = now`。`suggestedAction` 給 operator 一句話（可作未來推播草稿，但本批不 push）。`zone` 暫由 reason 映射（與 Task 4 resolver 對齊；實作時兩者共用一張對照表避免漂移）。
- 檔案 comment 明示「read-time only：不寫 KV、不送 LINE；§5.2 預設不 push，opt-in 才走 send 權限門」。

**Step 5:** Run 同上 → PASS

**Step 6: Commit**

```bash
git add src/lib/line-agent/cases/inbox-zone.ts src/lib/line-agent/cases/reminder.ts src/lib/line-agent/__tests__/reminder-candidate.test.ts
git commit -m "feat(line-agent): add read-time reminder candidate engine"
```

---

## Task 4：InboxZone resolver 規則表

對應 design §6.2（規則由上往下、命中即停）+ §6.3（zone 內排序）。

**Files:**
- Modify: `src/lib/line-agent/cases/inbox-zone.ts`（補 resolver，union 已在 Task 3）
- Test: `src/lib/line-agent/__tests__/inbox-zone.test.ts`

**Step 1: 先寫 table-driven 失敗測試**（(category × status × 旗標) → 期望 zone，design §6.2）

```ts
import { describe, expect, test } from 'vitest'
import { resolveInboxZone, type ZoneInput } from '../cases/inbox-zone'

const base: ZoneInput = {
  status: 'new_inquiry',
  latestEventCategory: 'new_inquiry',
  hasUnansweredQuestion: false,
  isEscalation: false,
  newInquiryOverdue: false,
}

const cases: Array<[string, Partial<ZoneInput>, string]> = [
  ['escalation 最優先', { isEscalation: true }, 'needs_eric'],
  ['未回提問 → need_reply', { hasUnansweredQuestion: true }, 'need_reply'],
  ['change_request → need_reply', { latestEventCategory: 'change_request' }, 'need_reply'],
  ['price_question → need_reply', { latestEventCategory: 'price_question' }, 'need_reply'],
  ['media_or_ocr_needed → need_reply', { latestEventCategory: 'media_or_ocr_needed' }, 'need_reply'],
  ['needs_info 等補資料 → awaiting_customer', { status: 'needs_info', latestEventCategory: 'follow_up_info' }, 'awaiting_customer'],
  ['ready_for_itinerary → ready_itinerary', { status: 'ready_for_itinerary' }, 'ready_itinerary'],
  ['quote_review → quote_review', { status: 'quote_review' }, 'quote_review'],
  ['quoted_tracking → quoted_tracking', { status: 'quoted_tracking' }, 'quoted_tracking'],
  ['menu_browsing → browsing_idle', { latestEventCategory: 'menu_browsing', status: 'idle' }, 'browsing_idle'],
  ['兜底 → need_reply', { latestEventCategory: undefined, status: 'itinerary_in_progress' }, 'need_reply'],
]

describe('resolveInboxZone（規則由上往下，命中即停）', () => {
  for (const [name, override, expected] of cases) {
    test(name, () => {
      expect(resolveInboxZone({ ...base, ...override })).toBe(expected)
    })
  }
})
```

**Step 2:** Run: `npx vitest run src/lib/line-agent/__tests__/inbox-zone.test.ts` → FAIL

**Step 3: 實作 resolver**

- `export interface ZoneInput { status: CaseStatus; latestEventCategory?: CustomerEventCategory; hasUnansweredQuestion: boolean; isEscalation: boolean; newInquiryOverdue: boolean }`。
- `export function resolveInboxZone(input): InboxZone` — 嚴格照 design §6.2 七條規則順序（1 escalation → 2 need_reply → 3 awaiting_customer → 4 ready_itinerary → 5 quote_review → 6 quoted_tracking → 7 browsing_idle → 兜底 need_reply）。
- `isEscalation` 來源：沿用既有 triage/skill 規則（醫療/安全、競品比價、疑似 spam、疑似重複案；design §8）。第一批以入參傳入（由 Task 5 handler 端用既有 `knownFacts`/keyword 推導），**不**新增持久欄位。
- 可選 `export function compareWithinZone(a, b)` 給 Task 5/7 排序用（design §6.3：severity → ageHours → 最後客人訊息時間）。

**Step 4:** Run 同上 → PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/cases/inbox-zone.ts src/lib/line-agent/__tests__/inbox-zone.test.ts
git commit -m "feat(line-agent): add inbox zone resolver"
```

---

## Task 5：把分類接進 write-path + 在 read-path 算 zone/reminder

兩段整合：(A) `handleCreateOrUpdateCase` write-time 分類存 `latestEventCategory`；(B) `handleListRecentCases` read-time 算 zone + reminder 塞進 `CaseSummary`。

**Files:**
- Modify: `src/lib/line-agent/cases/case-state.ts`（加 2 個 optional 欄位）
- Modify: `src/lib/line-agent/commands/handlers.ts`（write-path 分類 + read-path enrich + `CaseSummary` 加欄位）
- Test: `src/lib/line-agent/__tests__/case-persistence.test.ts`（write-path）、`src/lib/line-agent/__tests__/inbox-enrich.test.ts`（read-path，新檔）

**Step 1: case-state.ts 加欄位（向後相容 optional，design §7）**

```ts
// AgentCase 內新增：
/** 最新一則客人訊息的事件分類（呈現/排序用，advisory）。 */
latestEventCategory?: CustomerEventCategory
/** 上述分類時間，ISO-8601。 */
latestClassifiedAt?: string
```

（import `CustomerEventCategory` from `../cases/customer-event`；不改 `createInitialCase` 預設，保持兩欄 undefined。）

**Step 2: 先寫 read-path 失敗測試 `inbox-enrich.test.ts`**

斷言 `handleListRecentCases` 回傳的每筆 `CaseSummary` 帶 `eventCategory`、`zone`、`reminder`（可為 null），且型別正確、可序列化。用 memory-store + 注入 `now`。

```ts
// 重點斷言（骨架）：
const result = await handleListRecentCases(store, { limit: 5, now })
const summary = (result.meta as any).cases[0]
expect(summary.zone).toBeDefined()
expect(typeof summary.eventCategory === 'string' || summary.eventCategory === undefined).toBe(true)
expect(summary.reminder === null || typeof summary.reminder.reason === 'string').toBe(true)
```

**Step 3: 先寫 write-path 失敗測試（補進 `case-persistence.test.ts`）**

斷言「收到一則 image 事件 → case.latestEventCategory === 'media_or_ocr_needed'」「收到行程意圖文字 → 'new_inquiry'」。驗證 write-time 分類有存。

**Step 4: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/inbox-enrich.test.ts src/lib/line-agent/__tests__/case-persistence.test.ts` → FAIL

**Step 5: 實作整合**

(A) write-path：在 `handleCreateOrUpdateCase` reducer 之後、persist 之前，用 `NormalizedLineEvent`（kind/text）+ case 既有狀態組 `ClassifyInput`（`messageType` 由 `event.kind` 映射、`isPostback=false`（normalizer 暫無 postback）、`hasPriorMessages = case.customerMessages.length > 0`、`missingFields = case.missingFields`、`now`），呼叫**注入的** classifier（預設 `safeDefaultCustomerClassifier`，經 `CaseHandlerDeps` 注入 seam，測試可 stub），把 `category`/`classifiedAt` 寫進 `case.latestEventCategory`/`latestClassifiedAt`。**reducer 保持純函式**，分類在 handler async 段做，不放寬任何權限、不送任何訊息。

(B) read-path：`CaseSummary` 加 `eventCategory?: CustomerEventCategory`、`zone: InboxZone`、`reminder: ReminderCandidate | null`。`handleListRecentCases` 內每筆：
- `hasUnansweredQuestion` 由 `triage.knownFacts.questions?.length` 推導。
- `isEscalation` 由既有 triage/keyword（醫療/安全、競品比價）推導（design §8；無命中即 false）。
- `newInquiryOverdue` 由 `now - lastCustomerMessageAt > 4hr && status==='new_inquiry'`。
- 呼叫 `resolveInboxZone(...)` 得 `zone`；呼叫 `deriveReminderCandidate(...)` 得 `reminder`。
- `handleListRecentCases` 的 options 增加 `now: string`（注入，決定性）。
- 排序：先依 zone 顯示順序（`needs_eric` 置頂），zone 內用 `compareWithinZone`。

**Step 6: 跑測試確認通過 + 全 line-agent 套件不回歸**

Run: `npx vitest run src/lib/line-agent` → PASS（含既有 `agent-command-script` 等）

**Step 7: Commit**

```bash
git add src/lib/line-agent/cases/case-state.ts src/lib/line-agent/commands/handlers.ts src/lib/line-agent/__tests__/inbox-enrich.test.ts src/lib/line-agent/__tests__/case-persistence.test.ts
git commit -m "feat(line-agent): classify customer events and enrich inbox with zone/reminder"
```

---

## Task 6：`/inbox` 分區輸出（`formatInboxCases` 改寫）

對應 design §6.4（輸出格式）+ §8.1（UX 原則）。**只動渲染**，資料已由 Task 5 算好。

**Files:**
- Modify: `scripts/agent-command.mjs`（`formatInboxCases` 與相關 label const）
- Test: `src/lib/line-agent/__tests__/agent-command-script.test.ts`（擴充）

**Step 1: 先寫失敗測試（擴充現有檔）**

```ts
test('依 zone 分組、needs_eric 置頂、空區顯示 (0)', () => {
  const output = formatInboxCases([
    { caseId: 'A', zone: 'need_reply', eventCategory: 'price_question',
      reminder: { severity: 'urgent', ageHours: 4.5, reason: 'unanswered_question_overdue', suggestedAction: '對帳1600報價來源' },
      customerDisplayName: 'Eunice 茜', latestCustomerMessageText: '報價1600的是哪間？',
      status: 'new_inquiry', triage: { knownFacts: {} }, missingFields: [], messageCount: 2,
      lastCustomerMessageAt: '2026-06-03T00:00:00.000Z' },
    { caseId: 'B', zone: 'browsing_idle', eventCategory: 'menu_browsing', reminder: null,
      customerDisplayName: '客人 #2', latestCustomerMessageText: '（點選選單）',
      status: 'idle', triage: { knownFacts: {} }, missingFields: [], messageCount: 1,
      lastCustomerMessageAt: '2026-06-03T00:00:00.000Z' },
  ])
  expect(output).toContain('需 Eric 介入】(0)')   // 空區收合顯示
  expect(output).toContain('需回覆 / 需處理】(1)')
  expect(output.indexOf('需 Eric 介入')).toBeLessThan(output.indexOf('需回覆')) // needs_eric 在最上
  expect(output).toContain('對帳1600報價來源')      // suggestedAction
  expect(output).toContain('⚠️')                    // 未回提問旗標
})
```

**Step 2:** Run: `npx vitest run src/lib/line-agent/__tests__/agent-command-script.test.ts` → FAIL

**Step 3: 改寫 `formatInboxCases`**

- 依固定 zone 順序分組（`needs_eric` → `need_reply` → `awaiting_customer` → `ready_itinerary` → `quote_review` → `quoted_tracking` → `browsing_idle`）。
- 每區標題 `【中文區名】(N)`；空區也印 `(0)`（design §8.1 零空區噪音 = 顯示但收合，不展開明細）。
- 每筆一行式：`#i 客人label｜eventCategory｜旗標(⚠️未回/逾時 X.Xhr)` + 次行原文首句 + `下一步：{reminder.suggestedAction || triage 推導}`（沿用既有 `formatCustomerLabel`/`formatNextStep`）。
- header 改 `LINE OA Inbox · 7 區 · 共 N 筆`（design §6.4）。
- zone 中文名抽成 `ZONE_LABELS` const，比照既有 `STATUS_LABELS`。
- **不**移除既有 `formatCustomerLabel` / plain-language label 邏輯，沿用。

**Step 4:** Run 同上 → PASS

**Step 5: Commit**

```bash
git add scripts/agent-command.mjs src/lib/line-agent/__tests__/agent-command-script.test.ts
git commit -m "feat(line-agent): render /inbox as SLA zones"
```

---

## Task 7：守門測試（你點名的四條 + 邊界自檢）

集中驗證 design §9 + §12、UX doc §12 的硬邊界。多數斷言散在前面 task，這裡補「跨流程」整合守門。

**Files:**
- Create: `src/lib/line-agent/__tests__/m2-guardrails.test.ts`

**四條你點名的守門：**

1. **menu browsing 不提醒** — `deriveReminderCandidate({ latestEventCategory: 'menu_browsing', ... })` 任意時數皆 `null`；且 zone 落 `browsing_idle`。
2. **客人自由文字不回覆** — 跑 `handleCreateOrUpdateCase`（含分類）+ `handleListRecentCases` 全流程，注入 spy 版 `LineMessageClient`，斷言 reply/push **零呼叫**；`DEFAULT_AUTO_REPLY_CONFIG.autoReplyEnabled === false` 且所有 `mapping.enabled === false`。
3. **low_context 不亂猜** — `safeDefaultCustomerClassifier.classify({ text: '在嗎' })` → `new_inquiry/low`（needs human），且**不**捏造 `knownFacts`（zone 不會誤判成 ready/quote）。
4. **send intent 不自動推群** — reminder candidate 存在時，inbox 只顯示旗標，**不**觸發 send；唯有 `intent.ts` 的 `send` action + 明確 send intent 才走推群路徑（沿用既有 `permissions.test.ts` / `command-router.test.ts` 行為，這裡斷言 reminder 路徑本身不呼叫 send handler）。

**Step 1–4:** 每條一個 `test`，先 FAIL（若前面 task 漏實作）→ 補齊 → PASS。
Run: `npx vitest run src/lib/line-agent/__tests__/m2-guardrails.test.ts`

**Step 5: 全套件 + typecheck 收尾**

Run:
```bash
npx vitest run src/lib/line-agent
npx tsc --noEmit
```
Expected: 全 PASS、無型別錯。

**Step 6: Commit**

```bash
git add src/lib/line-agent/__tests__/m2-guardrails.test.ts
git commit -m "test(line-agent): add M2 customer-event guardrails"
```

---

## Task 8：文件收尾（feature 之後的 docs commit）

依 CLAUDE.md「feature commit 先、docs commit 後」。

**Files:**
- Modify: 兩份 M2 design doc 頂部狀態 `規格定稿，尚未實作 code` → `第一批已實作（classifier / zone / reminder / inbox 分區）`，並標註未做項（夥伴群回答、postback normalizer、quote gate）。
- Modify: `docs/plans/2026-06-03-line-oa-m2-implementation-plan.md`（本檔）尾端勾稽完成度。
- 視需要更新 `~/.claude/projects/.../memory/project_line_oa_agent_m1.md` 指向 M2 第一批進度（branch tip 更新）。

```bash
git commit -m "docs(line-agent): mark M2 first batch implemented"
```

---

## 完成驗收（whole-plan checklist）

> **第一批完成狀態（2026-06-03，branch tip `c5761f2`）：Tasks 1–8 全數實作 + 守門測試綠。**

- [x] `npx vitest run src/lib/line-agent` 全綠（30 檔 / 385 測試，含既有測試無回歸）。
- [~] `npx tsc --noEmit`：M2 新增/修改檔案全淨；branch 另有 24 個**既有、與 M2 無關**的型別錯（`select-store.test.ts` NODE_ENV、`quoteDisplay.test.ts` null、`activityTickets.test.ts` 重複 key），屬既有技術債，未在本批 scope。
- [x] 8 類分類 contract 測試齊全，含 price>product、follow_up 升級、image/postback 優先序。
- [x] zone resolver 七規則 table 測試齊全 + 兜底 need_reply。
- [x] reminder 五 reason 觸發/未觸發邊界（注入 now）齊全。
- [x] `/inbox` 輸出依 zone 分組、needs_eric 置頂、空區 (0)。
- [x] 四條守門全綠（`__tests__/m2-guardrails.test.ts`，11 測試）：menu browsing 不提醒、客人文字零送出、low_context 不亂猜、send intent 不自動推群。
- [x] `autoReplyEnabled` 與所有 `mapping.enabled` 恆 `false`（型別 `false` literal + runtime 測試）。
- [x] 無 secrets / 金鑰進 repo；LLM seam 用 `safeDefaultCustomerClassifier`（無金鑰、無 I/O）。

---

## Open Items（不阻擋本批，記錄待後續）

- **postback normalizer**：`event-normalizer.ts` 目前丟棄 postback；`menu_browsing` live 觸發需未來擴充 normalizer（classifier 已留 `isPostback` seam）。
- **rich menu key 命名**：`AutoReplyMapping.trigger.value` 待 LINE OA 後台確認後回填（design §11 Open Q）。
- **商務時段 / 假日加權**：reminder 初版用絕對時數（design §5.1 / §13）。
- **第二批（不在本 plan）**：`PartnerGroupEvent`（夥伴群回答）、Eric 介入旗標細化、case 狀態轉移表補強、quote gate 等級常數、L1 解鎖（需 Eric 批 Sanity write token）。
- **price_question suggestedAction**：是否自動帶歷史報價提示，初版只標「需對帳、不判斷」（design §11 Open Q）。

---

## Execution Handoff

Plan 已存 `docs/plans/2026-06-03-line-oa-m2-implementation-plan.md`。兩種執行選項：

1. **Subagent-Driven（本 session）** — 每個 task 派 fresh subagent、task 間 code review，快速迭代。（REQUIRED SUB-SKILL: superpowers:subagent-driven-development）
2. **Parallel Session（另開）** — 新 session 用 superpowers:executing-plans，批次執行 + checkpoint。

要走哪一種？
