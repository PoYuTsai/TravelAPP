# Phase 7：LINE OA AI 客服助理系統 - 完整規格書

**日期**: 2026-03-22
**狀態**: ✅ 規格完善完成（可進入實作規劃）
**版本**: v2.1（補完風險控管、測試與 rollout）
**優先級**: 高（直接影響日常營運效率）

---

## 一、系統目標

將現有 LINE OA 客人詢問流程從「純手動回覆」升級為「AI 輔助 + 人工決策」模式。
**不是取代 Eric 回覆客人，而是幫 Eric 更快地回覆。**

| 指標 | 現況 | 目標 |
|------|------|------|
| 初次回覆時間 | 30-60 分鐘 | 5-10 分鐘 |
| 每天 LINE 回覆耗時 | 2-3 小時 | 30-60 分鐘 |
| 回覆模式 | 純手動 | AI 草稿 + 人工決策 |
| 客人體驗 | 已讀後才開始想 | 未讀狀態下已備好草稿 |

### 核心設計原則

1. **人機協作，不是全自動**：AI 準備草稿，Eric 決定是否送出
2. **不觸發已讀**：透過 Webhook 後端接收，客人看不到已讀
3. **隱私優先**：所有數據在自己的 Vercel 上，營運資料與學習資料分層管理
4. **建在現有架構上**：Next.js + Vercel + Sanity，不引入新後端框架
5. **手機友善**：主要在 Telegram 上操作，不需要開電腦
6. **先保證可控，再追求聰明**：idempotency、audit log、失敗復原優先於 AI 華麗功能
7. **Webhook 快進快出**：LINE webhook 只做驗簽、去重、落地、快速回 200
8. **舊客提示不是唯一真相**：Notion 比對只提供輔助訊號，不直接覆蓋主識別

---

## 二、資料來源架構

```
┌─────────────────────────────────────────────────────────────────┐
│                           資料層                                 │
├───────────────────┬───────────────────┬─────────────────────────┤
│                   │                   │                         │
│  📓 Notion        │  🧮 報價計算器     │  📚 學習資料庫          │
│  （Eric 手動維護） │  （Sanity）        │  （Sanity）             │
│                   │                   │                         │
│  ├── 成交客戶     │  ├── 行程範本     │  ├── 成交對話記錄       │
│  ├── 日期/天數    │  ├── 景點門票     │  ├── Eric 風格分析      │
│  ├── 人數組成     │  ├── 車導成本     │  ├── 常用句型           │
│  ├── 行程內容     │  └── 話術範本     │  ├── Prompt 版本        │
│  ├── 導遊/成本    │      （16 筆）     │  └── 修改記錄           │
│  ├── 報價/成交價  │                   │                         │
│  └── 備註        │                   │                         │
│                   │                   │                         │
│  用途：           │  用途：           │  用途：                 │
│  舊客提示         │  AI 參考行程結構  │  Few-shot + RAG         │
│  歷史需求線索     │  報價範圍參考     │  Prompt 人工優化        │
│                   │                   │                         │
└───────────────────┴───────────────────┴─────────────────────────┘
```

### 資料分層原則

- **營運資料**：即時對話、草稿、Topic 狀態、callback action、每日摘要
- **輔助資料**：Notion 成交記錄、報價範本、話術範本
- **學習資料**：經過人工確認可保留的成交對話、編輯差異、Prompt 版本

---

## 三、Eric 實際工作流程

```
客人 LINE OA 詢問
       │
       ▼
LINE Webhook 收到事件（不會觸發已讀）
       │
       ▼
系統建立 / 更新該客人的對話上下文
       │
       ▼
TG Topics 收到通知（獨立對話串，不會混亂）
       │
       ▼
AI 整理需求 + 草稿回覆
       │
       ▼
Eric 操作：✅ 送出 / ✏️ 編輯 / ❌ 自己回
（Phase 7.3 可用語音：「OK 送出」）
       │
       ▼
多輪對話（每個客人上下文獨立）
       │
       ▼
┌─────────────────────────────────────────┐
│  收單信號（AI 只做建議，不自動執行）：   │
│  ✓ 行程排好了                            │
│  ✓ 報價給了                              │
│  ✓ 客人沒什麼問題                         │
│  → AI 建議：「要發 QR Code 嗎？」         │
└─────────────────────────────────────────┘
       │
       ▼
Eric 發送個人 LINE QR Code
「再麻煩你加我一下，我安排好會開群組」
       │
       ▼
客人加 Eric 個人 LINE → Eric 私訊導遊確認成本 / 檔期
       │
       ▼
Eric 手動開 LINE 群組（Eric + 客人 + 導遊）
       │
       ▼
成交確認
       │
       ├── TG 按 [✅ 成交] → 從活躍 Topics 移除 + 保留可學習資料
       │
       └── Eric 手動加到 Notion（這是 Eric 自己的流程）
```

**注意**：LINE API 無法自動建立群組，群組必須 Eric 手動開。

---

## 四、系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│  客人在 LINE OA 發訊息（文字 / 圖片 / 貼圖）                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LINE Messaging API                                             │
│  Webhook POST → /api/line-webhook                               │
│  ⚠️ Webhook 接收 ≠ 已讀                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ingestion Route: /api/line-webhook                             │
│                                                                 │
│  1. 驗證 LINE Signature（HMAC-SHA256）                          │
│  2. 解析 events[]                                               │
│  3. 過濾可處理的 message event                                   │
│  4. 檢查 idempotency store（防 retry / replay）                  │
│  5. 寫入 inbound event 記錄                                      │
│  6. 觸發 async processor                                         │
│  7. 回傳 200 OK（快速結束）                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Async Processor                                                 │
│                                                                 │
│  1. 取得客人 profile（displayName）                              │
│  2. 建立 / 更新 Conversation                                     │
│  3. 查詢 Notion 舊客提示                                          │
│  4. Claude Haiku 需求抽取                                        │
│  5. Topic 建立 / 對應                                             │
│  6. 發送摘要到 Telegram                                           │
│  7. Phase 7.2 起：Claude Sonnet 生成草稿                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Telegram Bot（Topics 模式 - 每個客人獨立對話串）               │
│                                                                 │
│  清微旅行 AI 助理（群組）                                       │
│  ├── 📌 總覽                                                    │
│  ├── 👤 #A-王先生（4/12-16 親子）[🟡等待中]                     │
│  ├── 👤 #B-李小姐（詢價中）[🔵已回覆]                           │
│  └── 📦 已結束（封存 / 已成交）                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                      Eric 按 inline button
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Telegram Callback Route: /api/telegram-callback                 │
│                                                                 │
│  1. 驗證 Telegram secret / callback 來源                         │
│  2. 檢查 action idempotency                                      │
│  3. 執行：送出 / 編輯 / 自己回 / 成交 / 刪除                     │
│  4. 寫入 audit log                                               │
│  5. 更新 Conversation / Draft 狀態                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LINE Messaging API                                              │
│  Push Message / Reply Message（依情境選擇）                      │
│  同時：儲存對話記錄與 action audit                              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 實作約束

- `/api/line-webhook` 不直接做重計算，不在 request path 等待 AI 完成
- 所有對外送出動作都必須有 `actionId` 和 audit log
- 所有 callback 都必須可重試，但不可重複送出
- Topic 對應只認 `lineUserId -> tgTopicId` 映射，不靠標題文字

### 4.2 對話狀態機

| 狀態 | 說明 | 進入條件 | 離開條件 |
|------|------|----------|----------|
| `new` | 新建立對話 | 首次訊息 | 完成摘要 |
| `waiting_eric` | 已有新訊息待 Eric 處理 | 客人新訊息 / 新草稿 | Eric 送出 / 自己回 |
| `waiting_customer` | Eric 已回覆，等待客人 | ✅ 送出 / 手動回覆 | 客人再回 |
| `cold` | 超過 48 小時無互動 | 排程掃描 | 客人再回 / 轉 archive |
| `archived` | 7 天無互動，自活躍區移除 | 排程掃描 | 客人再回（自動恢復） |
| `converted` | Eric 按成交 | ✅ 成交 | 僅人工更正 |
| `deleted` | Eric 主動刪除 | 🗑️ 刪除 | 不可恢復 |

### 4.3 草稿生命週期

1. 客人新訊息進來後建立 `pending` draft
2. Eric 可 `send` / `edit_then_send` / `dismiss`
3. 若 draft 尚未處理前客人又送新訊息：
   - 舊 draft 標記 `superseded`
   - 系統基於新上下文產生新 draft
4. 已 `sent` draft 不可再次送出
5. 所有 edit 行為都要保留 `originalDraft` 與 `editedDraft`

### 4.4 舊客識別規則

舊客識別分成兩層：

1. **系統內識別**
   - 主鍵是 `lineUserId`
   - 若同一 `lineUserId` 曾在系統內出現，直接視為已知對話來源

2. **Notion 輔助提示**
   - 根據姓名、日期、同團人數等做 fuzzy match
   - 只給 `notionMatchConfidence` 和 `matchedNotionRecordIds`
   - 不直接覆蓋 `lineUserId` 主識別

---

## 五、AI 學習機制

**不是 ML / RL，是 Prompt Engineering + RAG + 人工批准**

| 機制 | 說明 | 資料來源 |
|------|------|----------|
| **Few-shot Prompting** | System Prompt 內含 3-5 個成交對話範例 | 學習資料庫（成交對話） |
| **RAG 檢索** | 根據客人需求，動態抓取相似案例 | Notion 成交記錄 + 報價計算器 |
| **人工迴圈優化** | Eric 編輯草稿 → 記錄差異 → 產出建議 → Eric 確認後更新 Prompt | 編輯記錄 |

### 學習流程

```
資料累積（背景自動）
       │
       ├── 直接送出 → 標記「品質 OK」
       ├── 編輯送出 → 記錄差異
       ├── 按「太長」→ 標記「需精簡」
       └── 自己回 → 標記「AI 不適用」
       │
       ▼
每週分析 → 生成建議 → Eric 確認 → 新 Prompt Version → benchmark 驗證後才上線
```

### 學習機制限制

- Prompt 變更**不可自動套用**
- 只有成交對話或人工標記「可學習」的對話，才可進入 few-shot / RAG
- 涉及精準價格、個資、敏感旅遊資訊的片段應先降敏再進入學習資料

### Eric 需要做的（最小化）

| 頻率 | 動作 | 耗時 |
|------|------|------|
| 每次 | 按送出 / 編輯 / 自己回 | 3-10 秒 |
| 偶爾 | 點回饋按鈕（可選） | 1 秒 |
| 每週 | 看週報，確認是否要調 Prompt | 5 分鐘 |
| 初期 | 匯入 10 組成交對話 + 5 組 benchmark cases | 30-45 分鐘（一次性） |

---

## 六、TG 介面設計

### 6.1 Topics 結構

```
清微旅行 AI 助理（群組）
│
├── 📌 總覽
│   └── 即時統計 + 每日摘要
│
├── 👤 #A-王先生（4/12-16 親子）[🟡]
├── 👤 #B-李小姐（詢價中）[🔵]
├── 👤 #C-陳先生（6人團）[🟢]
│
└── 📦 已結束（成交 / 封存）
```

### 6.2 單一客人對話串

```
┌─────────────────────────────────────────────────────────────┐
│  📩 新訊息                                                   │
│                                                             │
│  👤 王先生                                                   │
│  ⭐ Notion 提示：中高信心（2025/12 曾詢問）                   │
│  📅 2026/4/12-16（5天4夜）                                   │
│  👨‍👩‍👧‍👦 2大2小（3歲、6歲）                                      │
│  📍 大象營、夜間動物園                                        │
│  📝 特殊：需要兩張汽座                                        │
│                                                             │
│  ── 原始訊息 ──                                              │
│  「你好，我們4月中想去清邁玩5天⋯⋯」                          │
│                                                             │
│  ── 建議回覆 ──                                              │
│  「王大哥你好！我是清微旅行的 Eric⋯⋯」                       │
│                                                             │
│  [✅ 送出]  [✏️ 編輯]  [❌ 自己回]                            │
│                                                             │
│  ── 快速回饋（可選）──                                       │
│  [👍 OK]  [📏 太長]  [🎭 太正式]  [❄️ 太冷]                  │
│                                                             │
│  ── 對話管理 ──                                              │
│  [✅ 成交]  [🗂️ 封存]  [🗑️ 刪除]                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 圖片發送

```
Eric 在 TG 發送一張車子照片

Bot 回覆：
┌─────────────────────────────────────────┐
│  📷 收到照片，要發給誰？                 │
│                                         │
│  [王先生]  [李小姐]  [陳先生]            │
│  [儲存為「車子」常用照片]                │
└─────────────────────────────────────────┘
```

### 6.4 語音輸入（Phase 7.3）

```
Eric 發送語音：「王先生那個 OK 直接送出」

Bot 回覆：
┌─────────────────────────────────────────┐
│  🎤 聽到：「王先生那個 OK 直接送出」      │
│  → 執行：送出王先生的草稿                │
│  ✅ 已發送                               │
└─────────────────────────────────────────┘
```

### 6.5 每日摘要（20:00）

```
┌─────────────────────────────────────────────────────────────┐
│  📋 今日摘要                                                 │
│                                                             │
│  🟡 等待你回覆：2 位                                         │
│     • 王先生（等了 3 小時）                                  │
│     • 李小姐（等了 1 小時）                                  │
│                                                             │
│  🔵 等客人回覆：1 位                                         │
│     • 陳先生                                                │
│                                                             │
│  ⚪ 可能冷掉：1 位                                           │
│     • 張太太（48 小時無互動）                                │
│                                                             │
│  今日統計：                                                 │
│  • 新詢問：3 位                                              │
│  • 已回覆：5 則                                              │
│  • AI 草稿採用率：70%                                        │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 週報（每週日）

```
┌─────────────────────────────────────────────────────────────┐
│  📊 本週 AI 助理報告                                         │
│                                                             │
│  草稿數：23                                                  │
│  直接送出：16（70%）                                         │
│  編輯後送出：5（22%）                                        │
│  自己回：2（8%）                                             │
│                                                             │
│  📝 常見編輯：                                               │
│  • 刪掉開頭「謝謝您的詢問」                                   │
│  • 把「我們會為您安排」改成「我幫你安排」                     │
│  • 縮短景點介紹                                              │
│                                                             │
│  🔧 建議調整：                                               │
│  1. 開頭直接進入主題，不用寒暄                               │
│  2. 用「我」不用「我們」                                     │
│  3. 景點介紹一句話帶過                                       │
│                                                             │
│  [✅ 套用調整]  [👀 看範例]  [⏭️ 下週再說]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 七、Housekeeping 與資料生命週期

| 情境 | 系統動作 | 資料處理 |
|------|----------|----------|
| 48 小時無互動 | 標記 `cold` | 保留完整對話 |
| 7 天無互動 | 移到 `archived`，Topic 自活躍區移除 | 保留營運資料，可被新訊息喚回 |
| 30 天無互動且未成交 | 清除原始訊息 / 草稿，只保留極簡 metadata | 不進學習資料 |
| Eric 按 `✅ 成交` | 標記 `converted`，移出活躍區 | 完整對話保留為營運資料，另由人工挑選可學習片段 |
| Eric 按 `🗑️ 刪除` | 標記 `deleted`，立即自 TG 移除 | 24 小時內硬刪營運資料，不保留學習資料 |

### Housekeeping 原則

- **封存不等於刪除**：先降低活躍區噪音，再做延後刪除
- **學習資料不可默默擴張**：只有成交或人工確認樣本可進學習庫
- **刪除優先尊重營運決策**：Eric 明確刪除的對話，不應保留可還原內容

---

## 八、資料結構

### 8.1 客人詢問（AI 抽取後）

```typescript
interface CustomerInquiry {
  id: string
  sourceEventId: string
  lineUserId: string
  customerName: string
  hasSeenBeforeInSystem: boolean
  notionMatchConfidence: 'none' | 'low' | 'medium' | 'high'
  matchedNotionRecordIds: string[]
  previousInquiryDate?: string
  travelDates: string | null
  duration: string | null
  adults: number | null
  children: number | null
  childrenAges: string | null
  attractions: string[]
  budget: string | null
  accommodation: string | null
  specialNeeds: string[]
  inquiryType: 'new' | 'followup' | 'priceCheck' | 'booking' | 'other'
  urgency: 'high' | 'normal' | 'low'
  conversionSignal: boolean
  rawMessage: string
  rawMessagePreview: string
  timestamp: string
}
```

### 8.2 對話記錄（上下文隔離）

```typescript
interface Conversation {
  id: string
  lineUserId: string
  customerName: string
  status:
    | 'new'
    | 'waiting_eric'
    | 'waiting_customer'
    | 'cold'
    | 'archived'
    | 'converted'
    | 'deleted'
  lastActivityAt: string
  lastProcessedLineEventId: string | null
  pendingDraftId: string | null
  latestInquiry: CustomerInquiry
  tgTopicId: string | null
  messages: ConversationMessage[]
  metadata: {
    archivedAt?: string
    convertedAt?: string
    deletedAt?: string
    cleanupReason?: 'stale_archive' | 'stale_prune' | 'manual_delete'
  }
}
```

### 8.3 對話訊息

```typescript
interface ConversationMessage {
  id: string
  source: 'line' | 'telegram' | 'system'
  role: 'customer' | 'eric' | 'assistant' | 'system'
  content: string
  contentType: 'text' | 'image' | 'sticker' | 'audio' | 'system'
  timestamp: string
  wasAiGenerated?: boolean
  wasEdited?: boolean
  originalDraft?: string
  lineMessageId?: string
  telegramMessageId?: string
  sourceEventId?: string
}
```

### 8.4 草稿資料

```typescript
interface ConversationDraft {
  id: string
  conversationId: string
  createdAt: string
  createdFromEventId: string
  status: 'pending' | 'sent' | 'edited_then_sent' | 'dismissed' | 'superseded' | 'failed'
  originalDraft: string
  editedDraft?: string
  sentAt?: string
  actionId?: string
  feedbackTags?: Array<'ok' | 'too_long' | 'too_formal' | 'too_cold'>
}
```

### 8.5 Inbound Event 記錄

```typescript
interface InboundLineEventRecord {
  id: string
  lineEventId: string
  lineUserId: string
  eventType: 'message' | 'follow' | 'other'
  receivedAt: string
  processedAt?: string
  status: 'received' | 'processing' | 'processed' | 'ignored' | 'failed'
  failureReason?: string
}
```

### 8.6 學習資料（成交對話）

```typescript
interface LearningConversation {
  id: string
  customerName: string
  notionRecordId?: string
  importedAt: string
  isGoodExample: boolean
  conversation: {
    role: 'customer' | 'eric'
    content: string
    timestamp: string
  }[]
  analysis: {
    ericTone: string[]
    responseLength: 'short' | 'medium' | 'long'
    keyPhrases: string[]
    conversionTechniques: string[]
  }
}
```

### 8.7 Prompt 版本

```typescript
interface PromptVersion {
  version: number
  createdAt: string
  approvedBy: string
  systemPrompt: string
  fewShotExamples: string[]
  basedOnFeedback: {
    totalDrafts: number
    directSendRate: number
    commonEdits: string[]
  }
  performance: {
    draftsGenerated: number
    directSendRate: number
    benchmarkPassRate: number
  }
  rollbackToVersion?: number
}
```

### 8.8 行程範本（報價計算器）

```typescript
interface ItineraryTemplate {
  id: string
  name: string
  slug: string
  days: number
  targetAudience: 'family' | 'couple' | 'group' | 'solo'
  highlights: string[]
  dailySchedule: {
    day: number
    title: string
    activities: string[]
  }[]
  estimatedCost: {
    perAdult: { min: number; max: number }
    perChild: { min: number; max: number }
  }
  suitableFor: string
  usageCount: number
}
```

---

## 九、功能清單

### 9.1 客服功能（LINE OA → TG）

| 功能 | 說明 | Phase |
|------|------|-------|
| Webhook 接收 | LINE 訊息 → 後端 ingestion（不觸發已讀） | 7.1 |
| 簽名驗證 + 冪等 | HMAC-SHA256 + idempotency store | 7.1 |
| 需求抽取 | Claude Haiku 結構化客人訊息 | 7.1 |
| TG Topics | 每客人獨立串，上下文隔離 | 7.1 |
| 狀態追蹤 | `waiting_eric` / `waiting_customer` / `cold` / `archived` | 7.1 |
| 草稿生成 | Claude Sonnet + RAG | 7.2 |
| 一鍵送出 | TG 按鈕 → LINE 發送 + audit log | 7.2 |
| 編輯送出 | 修改草稿 + 記錄差異 | 7.2 |
| 圖片發送 | TG 發圖 → 選客人 → LINE 發送 | 7.2 |
| 舊客提示 | 比對 Notion，顯示信心分級 | 7.2 |
| 語音輸入 | Whisper 轉文字執行 | 7.3 |
| 收單信號 | AI 建議發 QR Code 時機 | 7.3 |

### 9.2 對話管理

| 功能 | 說明 | Phase |
|------|------|-------|
| 多輪對話 | 同客人訊息自動串接 | 7.2 |
| 成交標記 | [✅ 成交] → 保留營運資料 + 選樣學習 | 7.2 |
| 手動刪除 | [🗑️ 刪除] → 硬刪 | 7.2 |
| 自動封存 | 7 天無互動自動轉 `archived` | 7.2 |
| 30 天降敏 | 未成交且長期無互動 → 清內容只留 metadata | 7.2 |
| 每日摘要 | 20:00 推送統計 | 7.2 |
| 快速回饋 | 👍 📏 🎭 ❄️ | 7.2 |
| 週報 | 每週推送 + Prompt 建議 | 7.3 |

### 9.3 內部派單記錄（Phase 7.3，可選）

| 指令 | 說明 |
|------|------|
| `/new 王先生 4/12-16 4大2小` | 建立新訂單 |
| `/assign Min` | 派給 Min 導遊 |
| `/cost 12000` | 記錄成本 |
| `/list` | 查看進行中訂單 |
| `/done` | 標記完成 |

---

## 十、分階段實作計畫（規格層）

### Phase 7.1：基礎建設（MVP）

**目標**：客人發訊息 → 5 秒內 TG 對應 Topic 收到結構化摘要

#### 7.1.1 LINE Messaging API 設定

- [ ] 在 LINE Developers Console 確認 Messaging API Channel
- [ ] 取得 Channel Access Token
- [ ] 取得 Channel Secret
- [ ] 設定 Webhook URL：`https://chiangway-travel.com/api/line-webhook`
- [ ] 關閉 LINE OA 的自動回覆訊息

#### 7.1.2 Telegram 設定

- [ ] 透過 @BotFather 建立 Bot，取得 Token
- [ ] 建立 TG 群組，開啟 Topics 功能
- [ ] 取得群組 Chat ID
- [ ] 設定 Bot 為群組管理員
- [ ] 設定 Telegram callback / webhook secret

#### 7.1.3 Ingestion 與儲存基礎

**檔案**

- `src/app/api/line-webhook/route.ts`
- `src/lib/line-assistant/config.ts`
- `src/lib/line-assistant/storage/*`
- `src/lib/line-assistant/idempotency.ts`

**工作內容**

- [ ] 驗證 `X-Line-Signature`
- [ ] 正規化 events[]
- [ ] 過濾非 message event
- [ ] 以 durable store 做 idempotency
- [ ] 寫入 inbound event 記錄
- [ ] 快速回傳 200

#### 7.1.4 Async Processor

- [ ] 建立 event processor
- [ ] 取得 LINE profile
- [ ] 建立 / 更新 Conversation
- [ ] 需求抽取（Claude Haiku）
- [ ] 建立 / 映射 TG Topic
- [ ] 發送摘要到 Telegram

#### 7.1.5 驗收標準

- [ ] LINE webhook 在正常流量下快速回 200
- [ ] 客人發訊息 → 5 秒內 TG 收到摘要
- [ ] 客人端不顯示已讀
- [ ] 需求抽取準確率 > 80%
- [ ] 每客人獨立 Topic，不會混亂
- [ ] 非文字訊息不會 crash

---

### Phase 7.2：草稿生成 + 完整操作

**目標**：AI 生成 Eric 風格草稿，完整操作流程

#### 7.2.1 學習資料庫建立

- [ ] Sanity Schema：LearningConversation
- [ ] Sanity Schema：PromptVersion
- [ ] 歷史對話匯入工具
- [ ] Eric 匯入 10 組成交對話
- [ ] 建立 5 組固定 benchmark cases

#### 7.2.2 報價計算器「儲存範本」功能

- [ ] Sanity Schema：ItineraryTemplate
- [ ] Studio UI：建立 / 編輯範本
- [ ] Eric 建立 3-5 個常用範本

#### 7.2.3 Notion 舊客提示

- [ ] 重用現有 Notion integration
- [ ] 定期抓取成交記錄
- [ ] 回傳 `notionMatchConfidence`
- [ ] 不以 Notion 覆蓋 `lineUserId`

#### 7.2.4 草稿生成 AI

**模型**：Claude Sonnet（品質優先）

**System Prompt 核心**

```
你是「清微旅行」的客服助理，幫 Eric 生成回覆草稿。

品牌定位：
- 台灣爸爸（Eric）+ 泰國媽媽（Min）
- 專為親子家庭設計的包車服務
- 司機（泰文）+ 導遊（中文）專業分工

回覆風格：
- 簡潔、不拖沓
- 親切、專業、有溫度
- 像朋友推薦，不像業者推銷
- 主動提供有用資訊
- 用繁體中文

⚠️ 不要：
- 不要開頭寒暄太多
- 不要給精確報價
- 不要承諾具體日期
- 價格說「大致範圍」或「幫你算好再報」
```

#### 7.2.5 Telegram Callback 處理

**檔案**：`src/app/api/telegram-callback/route.ts`

- [ ] ✅ 送出 → LINE 發送 + audit log
- [ ] ✏️ 編輯 → 送出 + 記錄差異
- [ ] ❌ 自己回 → 標記手動
- [ ] ✅ 成交 → 轉 `converted`
- [ ] 🗂️ 封存 → 轉 `archived`
- [ ] 🗑️ 刪除 → 轉 `deleted`
- [ ] callback action 做 idempotency

#### 7.2.6 圖片發送

- [ ] TG 收到圖片 → 詢問發給誰
- [ ] 選擇客人 → LINE Push Image
- [ ] 驗證 MIME type / 檔案大小
- [ ] 常用照片庫（可選）

#### 7.2.7 Housekeeping

- [ ] 48 小時 → `cold`
- [ ] 7 天 → `archived`
- [ ] 30 天未成交 → 降敏 / 清內容
- [ ] 每日摘要（20:00）
- [ ] 快速回饋按鈕

#### 7.2.8 驗收標準

- [ ] 草稿語氣符合 Eric 風格
- [ ] 按 ✅ → 客人 3 秒內收到
- [ ] 圖片可以發送
- [ ] 成交 / 刪除 / 封存 / 自動清理流程正常
- [ ] 回覆耗時從 30 分鐘降至 < 5 分鐘

---

### Phase 7.3：進階功能

**目標**：AI 草稿採用率 > 70%

#### 7.3.1 語音輸入

- [ ] Whisper API 整合
- [ ] TG 語音 → 文字 → 執行指令
- [ ] 明確 action confirmation，避免誤操作

#### 7.3.2 收單信號偵測

- [ ] 分析對話模式
- [ ] 偵測：行程確認 + 報價 + 客人正向
- [ ] 建議：「要發 QR Code 嗎？」

#### 7.3.3 週報 + Prompt 優化

- [ ] 每週推送分析報告
- [ ] 常見編輯模式統計
- [ ] 建議調整
- [ ] Eric 確認後才建立新 Prompt Version
- [ ] benchmark pass 後才切換正式版本

#### 7.3.4 內部派單記錄（可選）

- [ ] `/new` `/assign` `/cost` `/list` `/done`
- [ ] 記錄導遊、成本、利潤

#### 7.3.5 驗收標準

- [ ] 語音指令可執行
- [ ] 週報準確反映使用情況
- [ ] AI 草稿採用率 > 70%

---

## 十一、技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| LINE SDK | `@line/bot-sdk` | 官方 SDK，signature 驗證 + profile / message |
| Telegram | Bot HTTP API（先用 `fetch`） | 降低依賴、控制 callback payload |
| AI 需求抽取 | Claude Haiku | 快 + 便宜 |
| AI 草稿生成 | Claude Sonnet | 品質優先 |
| 語音轉文字 | Whisper API | Phase 7.3 |
| 暫存 / 冪等 | Vercel KV | 適合 event / action 去重與短期上下文 |
| 持久化 | Sanity | 學習資料、Prompt、範本 |
| 舊客提示 | 重用現有 Notion client | 避免雙軌整合 |
| 排程 | 受保護的 cron route | 每日摘要、每週報告、housekeeping |
| 部署 | Vercel | 現有架構 |

---

## 十二、環境變數

```env
# === Phase 7: LINE OA AI Assistant ===

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_ID=
TELEGRAM_WEBHOOK_SECRET=

# Claude API
ANTHROPIC_API_KEY=

# Whisper API（Phase 7.3）
OPENAI_API_KEY=

# Notion（沿用既有 integration）
NOTION_TOKEN=
# 可選：若要把既有 notion database id 從 code 移到 env
NOTION_CUSTOMER_DATABASE_IDS_JSON={"2025":"xxx","2026":"yyy"}

# Vercel KV / Upstash
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Protected internal routes（daily summary / weekly report / housekeeping）
LINE_ASSISTANT_CRON_SECRET=
```

### 環境變數原則

- Phase 7 **沿用現有 `NOTION_TOKEN` 命名**
- 若短期內先重用 `src/lib/notion/client.ts`，允許保留既有年度 DB 對應
- 後續若抽象成新 shared config，再把 DB mapping 移到 env

---

## 十三、安全性與資料治理

| 項目 | 做法 |
|------|------|
| LINE Webhook | HMAC-SHA256 簽名驗證 |
| Replay / Retry | event idempotency store，不只靠 rate limit |
| Telegram Callback | secret 驗證 + action idempotency |
| API Token | 全部 server-side |
| 客人個資 | 營運資料與學習資料分層，限制 Telegram 顯示內容 |
| Logs | 不記完整個資、不記 access token |
| Prompt 更新 | 必須人工批准 |
| 刪除政策 | `deleted` 對話 24 小時內硬刪 |

### 額外安全要求

- 不在 Telegram 顯示不必要的精準個資
- 圖片 / 音訊處理要限制大小與檔案類型
- 所有送出到 LINE 的內容都要有 audit log
- `checkRateLimit()` 可作開發期保護，但正式 replay 保護必須靠 durable store

---

## 十四、成本估算

| 項目 | 備註 |
|------|------|
| LINE Messaging API | 依實際 OA 方案與 push / reply 使用量複核 |
| Telegram Bot | 免費 |
| Claude Haiku | 低成本，適合抽取 |
| Claude Sonnet | 主要成本來源之一 |
| Whisper | 視 Phase 7.3 語音用量 |
| Notion API | 免費 |
| Vercel KV | 依現有方案 |

**注意**：LINE 配額與價格會變動，正式上線前必須再依官方當下方案複核，不把本節當固定保證值。

---

## 十五、與現有系統整合

| 現有功能 | 整合方式 |
|----------|----------|
| 報價計算器（Phase 6.8） | Phase 7.2 新增「儲存範本」，AI 參考 |
| 知識庫（Phase 6） | Phase 7.2 串接，AI 參考景點 / 餐廳 / 飯店 |
| 話術範本（Notion 16 筆） | Phase 7.2 串接，AI 學習回覆風格 |
| 行程表系統（Phase 3） | Phase 7.3 可串接，需求確認後一鍵生成 |
| Notion Dashboard 資料層 | 先重用既有 client，再逐步抽 shared abstraction |

---

## 十六、Eric 需準備的資料

| 資料 | 用途 | 何時需要 |
|------|------|----------|
| LINE Channel 資訊 | Webhook 設定 | Phase 7.1 |
| TG Bot Token / Group ID | 通知設定 | Phase 7.1 |
| Telegram callback secret | Webhook 驗證 | Phase 7.1 |
| Notion Token | 舊客提示 | Phase 7.2 |
| 10 組成交對話 | AI 學習範例 | Phase 7.2 |
| 5 組 benchmark 對話 | Prompt 回歸檢查 | Phase 7.2 |
| 3-5 個行程範本 | AI 參考 | Phase 7.2 |

---

## 十七、測試策略

### 17.1 單元測試

- LINE signature 驗證
- webhook event 正規化與過濾
- conversation state transition
- draft lifecycle 與 supersede 規則
- Telegram callback action parser
- returning-customer matcher
- housekeeping 規則判定
- prompt input builder

### 17.2 整合測試

- LINE webhook → event store → async processor → TG push
- TG callback → LINE send → audit log
- Notion sync → old customer hint
- KV idempotency store 在 retry 下不重複建 Topic / draft
- 圖片流程：TG 上傳 → 選客人 → LINE image push

### 17.3 手動 / 端對端驗收

- 新客首訊息
- 舊客再詢問
- 同客人連續多則訊息
- 舊 draft 尚未處理前客人再送新訊息
- Eric 送出 / 編輯 / 自己回 / 成交 / 封存 / 刪除
- 7 天封存、30 天降敏
- TG 或 LINE 暫時失敗時的補救流程

---

## 十八、Code Review 與 Rollout Gate

### 18.1 必做 Code Review 檢查

1. **Security review**
   - 驗簽是否正確
   - idempotency 是否真的防重複送出
   - callback 是否有 secret 保護
   - token / PII 是否沒有被 log 出去

2. **Data governance review**
   - 哪些欄位進 Telegram
   - 哪些欄位進學習資料
   - retention / delete policy 是否有實作

3. **Prompt / tone review**
   - 語氣是否真的像 Eric
   - 是否避免過度承諾日期 / 價格 / 服務範圍

4. **Failure mode review**
   - LINE 失敗
   - Telegram 失敗
   - AI timeout
   - Notion timeout
   - retry 是否造成雙送

5. **Quota / cost review**
   - LINE push 使用量
   - Claude token 使用量
   - 圖片 / 語音額外成本

### 18.2 Rollout Gate

1. 本機與測試環境驗證
2. staging webhook / sandbox 群組驗證
3. limited pilot（只處理少量真實對話）
4. 正式切主流程
5. 保留「完全人工回覆」 fallback

---

## 十九、驗收標準總覽

### Phase 7.1

- [ ] 客人發訊息 → 5 秒內 TG 對應 Topic 收到摘要
- [ ] 客人端不顯示已讀
- [ ] 需求抽取準確率 > 80%
- [ ] 每客人獨立 Topic
- [ ] LINE retry 不會重複建 Topic / draft
- [ ] 非文字訊息不 crash

### Phase 7.2

- [ ] 草稿語氣符合 Eric 風格（Eric 主觀判斷）
- [ ] 按 ✅ → 客人 3 秒內收到
- [ ] 編輯送出會正確保留差異
- [ ] 圖片可發送
- [ ] 成交 / 刪除 / 封存 / 自動清理正常
- [ ] 回覆耗時 < 5 分鐘

### Phase 7.3

- [ ] 語音指令可執行
- [ ] 週報準確
- [ ] Prompt 更新需人工批准
- [ ] AI 草稿採用率 > 70%

---

*規格完善日期：2026-03-22*
*預計開始實作：待 Eric 確認*
*協同開發：Claude Code + Codex*
