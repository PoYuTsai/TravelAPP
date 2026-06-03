# LINE OA Agent — M2: Case Intelligence / Event Classification（設計規格）

- 日期：2026-06-03
- Branch：`codex/line-oa-agent-mvp`
- 狀態：**規格定稿，尚未實作 code**
- 相依：
  - `src/lib/line-agent/cases/case-state.ts`（`AgentCase`、12 status）
  - `src/lib/line-agent/commands/case-triage.ts`（deterministic known/missing field 抽取）
  - `src/lib/line-agent/commands/intent.ts`（operator 指令分類；本規格沿用其 deterministic-first + LLM seam 架構）
  - `docs/plans/2026-06-01-line-oa-agent-m2-durable-persistence.md`（case store）

---

## 1. 目標與背景

現況有兩個分類平面：

| 平面 | 來源 | 既有檔案 | 用途 |
|------|------|----------|------|
| **Command plane** | operator / 夥伴群指令 | `intent.ts` | 把指令分類成 action（parse / draft / send…）給 router |
| **Customer event plane**（本規格新增） | LINE OA 客人入站訊息 | 無 | 把客人新訊息分類，驅動 /inbox 分區、提醒、模板對應 |

M2 補上第二個平面：**Case Intelligence**。它讓 `/inbox` 能以「下一步該做什麼」呈現，而不是只丟一串原始訊息。

### 本規格交付四件事

1. 客人新訊息**分類法**（8 類 event category）
2. **rich menu / auto-reply mapping schema**（全程 dormant，零送出）
3. **提醒規則**（reminder candidate 產生器，預設不推播）
4. **`/inbox` 分區輸出**（依緊急度 / SLA，以「下一步行動」為主軸）

---

## 2. 範圍與非目標

### In scope（M2）

- Customer event 分類器：deterministic-first，LLM fallback 為 seam（不在 M2 接真模型）
- Auto-reply mapping schema 型別與預設資料（全部 `enabled: false`）
- Reminder candidate 產生規則（read-time 計算，不寫 KV、不送 LINE）
- `/inbox` SLA 分區的 zone resolver 規則表
- `AgentCase` 最小欄位增補 + 新型別定義
- 測試策略（含「絕不送出」守門測試）

### 非目標（明確排除）

- ❌ **不**實作任何 LINE reply / push（含 rich menu 回覆）——auto-reply schema 只定義不啟用
- ❌ **不**開 keyword 自動回覆 gate
- ❌ **不**自動推播夥伴群（需 Eric / operator 明確 send intent）
- ❌ **不**接真 LLM 模型（沿用 `safeDefaultLlmClassifier` 模式）
- ❌ **不**細分付款 / 接送 / 產品子類為獨立 category——那些走 `case-triage` 的 known/missing fields
- ❌ **不**動報價自動化（依 Eric 指示凍結）

> **硬邊界（沿用 CLAUDE.md）**：LINE OA 客人自由文字訊息**絕不自動回覆**。M2 送出 LINE 訊息次數 = 0。

---

## 3. 客人事件分類法（CustomerEventCategory）

8 類，string-literal union。分類**只**驅動內部判斷（inbox 分區、提醒、模板對應、避免誤判），不觸發任何對客回覆。

```ts
export type CustomerEventCategory =
  | 'new_inquiry'                   // 首次詢問、開啟新案
  | 'follow_up_info'                // 補上先前缺的資料（日期/人數/年齡…）
  | 'change_request'                // 已知需求的變更（改日期、加人、換景點）
  | 'price_question'                // 價格指向問題（多少錢、報價是哪間）
  | 'product_or_itinerary_question' // 產品/行程內容問題（哪間大象營、行程含什麼）
  | 'menu_browsing'                 // rich menu postback / 點選瀏覽，非文字需求
  | 'media_or_ocr_needed'          // 圖片/檔案，需 OCR 才能讀內容
  | 'non_actionable'               // 貼圖、寒暄、spam，無商務內容
```

### 3.1 每類定義 + deterministic 訊號 + 範例

| category | 判斷訊號（deterministic） | 範例 | 預設 inbox 去向 |
|----------|--------------------------|------|----------------|
| `new_inquiry` | 案件無歷史訊息 / 首則文字 + 出現行程意圖詞（包車、行程、想去、報價、清邁） | 「想帶小孩去清邁玩，有包車嗎」 | 需回覆 / 需處理 |
| `follow_up_info` | 案件已存在 + 本則含先前 `missingFields` 對應的值（日期、`\d+大\d+小`、年齡、住宿、航班） | 「8/21，2大2小，住古城」 | 重算後：可排行程 / 仍等補 |
| `change_request` | 變更詞（改成、換、加一個、取消、不要、延後）+ 已知需求存在 | 「改成 8/22 出發」 | 需回覆 / 需處理 |
| `price_question` | 價格詞（多少錢、價格、報價、費用、幾錢、1600、NT\$、泰銖）+ 疑問 | 「報價 1600 是哪間？」 | 需回覆 / 需處理（標記：不做報價判斷） |
| `product_or_itinerary_question` | 產品/行程詞（哪間、含不含、幾點、行程、景點）+ 疑問，且非價格 | 「大象體驗含午餐嗎」 | 需回覆 / 需處理 |
| `menu_browsing` | event 為 `postback` 或 rich menu key | （點選選單） | 瀏覽中 / 靜置 |
| `media_or_ocr_needed` | message type ∈ {image, file, pdf} 且無文字 | （傳了一張機票截圖） | 需處理（轉 OCR） |
| `non_actionable` | sticker-only / emoji-only / 純寒暄詞且無商務詞 | 「謝謝」「貼圖」 | 靜置 |

> 訊號優先序：`media_or_ocr_needed`（看 message type）→ `menu_browsing`（看 event type）→ `change_request` → `price_question` → `product_or_itinerary_question` → `follow_up_info` → `new_inquiry` → `non_actionable`（兜底）。
> 多訊號命中時，取優先序最前者；`price_question` 與 `product_question` 同時命中以 price 為準（價格問題對 operator 風險最高，需先看到）。

### 3.2 分類管線（mirror `intent.ts`）

```ts
export interface CustomerEventClassification {
  category: CustomerEventCategory
  confidence: 'high' | 'medium' | 'low'
  source: 'deterministic' | 'llm'
  signals: string[]      // 命中的 pattern 名稱，供稽核/除錯
  classifiedAt: string   // ISO-8601，注入 now，保持決定性
}

export interface CustomerEventClassifier {
  classify(input: ClassifyInput): Promise<CustomerEventClassification>
}

// 安全預設：fallback 一律 → new_inquiry/low（最保守，丟進「需回覆」讓人看，不漏接）
export const safeDefaultCustomerClassifier: CustomerEventClassifier = /* unknown → needs human */
```

- Deterministic pass 先跑（純 regex/keyword，無模型、無金鑰）。
- 命中 → 直接回 `source: 'deterministic'`、`confidence: 'high'`。
- 未命中 → 呼叫注入的 LLM seam；M2 用 safe default（永遠回保守值）。
- **分類結果永遠是 advisory**：它只影響 inbox 呈現與提醒候選，不放寬任何權限、不觸發送出。

---

## 4. Rich Menu / Auto-Reply Mapping Schema（全程 dormant）

定義 schema 供未來啟用與內部模板對應，**M2 一律不送出**。

```ts
export interface AutoReplyMapping {
  key: string                                   // 穩定識別碼
  trigger:
    | { type: 'rich_menu_postback'; value: string }  // 選單區塊 data
    | { type: 'keyword'; value: string }             // 關鍵字（未來用）
  mapsToCategory: CustomerEventCategory          // 對應的事件分類
  draftReplyTemplate: string                     // 建議回覆草稿——M2 絕不自動送
  enabled: false                                 // 型別層級鎖死為 false literal
}

export interface AutoReplyConfig {
  autoReplyEnabled: false        // 全域總開關，M2 ship 為 false
  mappings: AutoReplyMapping[]
}
```

### 設計約束

- `enabled` 與 `autoReplyEnabled` 在 M2 以 `false` **literal type** 釘死——任何想送出的 code 在型別層就過不了。
- schema 的**唯一用途**（你拍板）：
  1. browsing intent 偵測（postback → `menu_browsing`）
  2. 上下文補充（知道客人點了哪個選單）
  3. 模板對應（給 operator 參考的回覆草稿，人工決定要不要用）
  4. 避免 inbox 誤判
- `draftReplyTemplate` 只會出現在 operator 視圖 / case card，**不**進 LINE reply API。
- 未來啟用走獨立 milestone + Eric 明確改規則，不在本規格範圍。

---

## 5. 提醒規則（Reminder Candidate Engine）

**read-time 計算**：`/inbox` 或 reminder 查詢時即時推導，不寫 KV、不送 LINE。

```ts
export interface ReminderCandidate {
  caseId: string
  zone: InboxZone                 // 見 §6
  reason: ReminderReason
  severity: 'info' | 'attention' | 'urgent'
  ageHours: number                // 距觸發條件起算
  suggestedAction: string         // 給 operator 的一句話建議（可作為推播草稿）
  createdAt: string               // 注入 now
}

export type ReminderReason =
  | 'unanswered_question_overdue'   // 有客人提問未回，逾時
  | 'new_inquiry_unhandled'         // 新詢問未處理逾時
  | 'awaiting_customer_stale'       // 等客人補資料太久，可主動 nudge
  | 'quote_review_pending'          // 報價待檢查逾時
  | 'quoted_tracking_followup'      // 已報價未回，可追蹤
```

### 5.1 觸發門檻（初版，皆可調）

| reason | 觸發條件 | severity |
|--------|----------|----------|
| `unanswered_question_overdue` | 最新事件含未回提問 + 距今 > 2hr | urgent |
| `new_inquiry_unhandled` | `new_inquiry` 未處理 + 距今 > 4hr | attention |
| `awaiting_customer_stale` | `needs_info` + 客人最後訊息 > 48hr | info |
| `quote_review_pending` | `quote_review` > 24hr | attention |
| `quoted_tracking_followup` | `quoted_tracking` > 72hr | info |

- 時間以注入的 `now` 計算（決定性、可測）。
- 商務時段 / 假日加權留待後續；初版用絕對時數。

### 5.2 送出政策（你拍板：選 2）

- **預設**：reminder candidate 只進 `/inbox` 分區與旗標，**不**主動 push。
- **operator opt-in**：Eric / operator 明確說「發到夥伴群 / 通知 @Tsai @Chun」才走既有 `send` 權限門（`intent.ts` 的 `send` action + 夥伴群 send intent）。
- **保留半自動化方向**：candidate 已是結構化物件；未來規則成熟可在獨立 milestone 升級為「符合條件自動產生推播草稿 → 再到自動推播」，分階段解鎖，不在 M2 自動化。

---

## 6. `/inbox` 分區輸出（依緊急度 / SLA）

主軸＝**下一步行動**，非 case status、非 event category、非單純時間。zone 由 resolver 從 (latest category + status + missingFields + 時間差 + 是否有未回提問) 推導。

### 6.1 七個 zone

```ts
export type InboxZone =
  | 'need_reply'        // 需回覆 / 需處理
  | 'awaiting_customer' // 等客人補資料
  | 'ready_itinerary'   // 可排行程
  | 'quote_review'      // 報價待檢查
  | 'quoted_tracking'   // 已報價追蹤
  | 'browsing_idle'     // 瀏覽中 / 靜置
  | 'needs_eric'        // 需 Eric 介入
```

### 6.2 zone resolver 規則（由上往下，命中即停）

| 優先 | 條件 | zone |
|------|------|------|
| 1 | escalation 命中（醫療/安全、競品比價、疑似 spam 待判、疑似重複案） | `needs_eric` |
| 2 | 有未回提問 OR category ∈ {change_request, price_question, product_or_itinerary_question, media_or_ocr_needed} OR `new_inquiry` 逾時 | `need_reply` |
| 3 | status = `needs_info` 且已向客人問過、等補資料 | `awaiting_customer` |
| 4 | status = `ready_for_itinerary` | `ready_itinerary` |
| 5 | status ∈ {`quote_review`, `ready_for_quote`} | `quote_review` |
| 6 | status = `quoted_tracking` | `quoted_tracking` |
| 7 | category ∈ {menu_browsing, non_actionable} OR status = `idle` | `browsing_idle` |
| — | 兜底 | `need_reply`（保守，寧可多看一眼） |

### 6.3 zone 內排序

以「下一步行動急迫度」排，非單純最新時間：
1. severity（urgent > attention > info）
2. reminder ageHours（逾越門檻越久越前）
3. 最後客人訊息時間（新者前）

### 6.4 輸出格式（沿用現有 `/inbox` 文字風格）

```text
LINE OA Inbox · 7 區 · 共 N 筆

【需回覆 / 需處理】(2)
#1 Eunice 茜｜price_question｜⚠️未回提問 4.5hr
   「報價1600的是哪間大象體驗營？」
   下一步：對帳 1600 報價來源，回覆營區＋順帶問日期人數（不做報價判斷）
...

【等客人補資料】(1)
...

【需 Eric 介入】(0)
```

每筆顯示：案號、customerDisplayName、category、旗標（逾時/未回）、首句原文、`suggestedAction`。

---

## 7. 資料模型增補

採**最小增補**——zone 與 reminder 皆 read-time 計算，不落 KV。只在 `AgentCase` 存最新分類（供排序/呈現），不存 zone/candidate。

```ts
// case-state.ts 增補（皆 optional，向後相容）
interface AgentCase {
  // …既有欄位…
  /** 最新一則客人訊息的事件分類（呈現/排序用，advisory）。 */
  latestEventCategory?: CustomerEventCategory
  /** 上述分類時間，ISO-8601。 */
  latestClassifiedAt?: string
}
```

- 不新增分類歷史陣列（YAGNI；`customerMessages` 已有原文可重分類）。
- escalation 旗標沿用既有 triage / skill 規則判定，不新增持久欄位。

---

## 8. Escalation（沿用 triage skill，明列於 resolver 優先 1）

- 醫療 / 安全風險 → `needs_eric`，不出行程建議。
- 競品 / 比價訊號 → `needs_eric`，不做任何報價判斷。
- 疑似 spam / bot → `non_actionable` + `needs_eric` 待 Eric 判。
- 疑似重複案（同名 + 同日期 + 7 日內） → `needs_eric` 待確認。

---

## 9. 測試策略

- **分類 contract 測試**：8 類各備 fixture（含邊界：price vs product 同時命中、follow_up 補滿後升級），斷言 category / signals。
- **zone resolver 表測試**：(category × status × 旗標) 組合 → 期望 zone。
- **reminder 門檻測試**：注入 `now`，驗每個 reason 的觸發/未觸發邊界。
- **「絕不送出」守門測試**：跑完整 classify → inbox 流程，斷言 LINE reply/push client **零呼叫**；`autoReplyEnabled` / 所有 `mapping.enabled` 恆為 `false`。
- **零金鑰**：LLM seam 用 stub，全程不實例化真 adapter。
- 沿用既有 `__tests__/case-store-contract.ts`、`case-triage` 既有測試風格。

---

## 10. 實作順序（M2，待批准後另開 plan）

1. `CustomerEventCategory` union + 訊號 pattern 表（純 deterministic）
2. `CustomerEventClassifier` + `safeDefaultCustomerClassifier`
3. `AutoReplyMapping` / `AutoReplyConfig` 型別 + 預設資料（全 false）
4. `InboxZone` resolver 規則表
5. `ReminderCandidate` 產生器（read-time）
6. `/inbox` 分區輸出改寫（沿用現有 operator command）
7. 測試（含守門）

---

## 11. Open Questions（不阻擋本規格，實作前釐清）

- 商務時段 / 假日是否要影響 reminder 時數？（初版用絕對時數）
- `price_question` 的 `suggestedAction` 是否要自動帶出歷史報價提示？（目前：只標記「需對帳，不判斷」）
- rich menu 實際區塊 key 命名待 LINE OA 後台確認後回填 `AutoReplyMapping.trigger.value`。

---

## 12. 邊界自檢（與 CLAUDE.md 對照）

- ✅ 客人訊息不自動回覆：M2 送出 = 0，schema 全 dormant。
- ✅ 夥伴群需 send intent：reminder 預設不推，opt-in 才走 `send` 權限門。
- ✅ 不碰報價自動化：`price_question` 只標記不判斷。
- ✅ 無 secrets / 金鑰進 repo：LLM seam stub，零金鑰測試。
