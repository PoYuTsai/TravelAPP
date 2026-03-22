# Phase 7：LINE OA AI 客服助理系統 - 完整規格書

**日期**: 2026-03-22
**狀態**: 📋 規格確認完成
**版本**: v2.0（整合所有討論）
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
3. **隱私優先**：所有數據在自己的 Vercel 上，不經過第三方
4. **建在現有架構上**：Next.js + Vercel + Sanity，不引入新框架
5. **手機友善**：主要在 Telegram 上操作，不需要開電腦

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
│  同步：定期抓取    │  用途：           │  用途：                 │
│  用於比對舊客     │  AI 參考行程結構  │  Few-shot + RAG         │
│                   │  報價範圍參考     │  持續優化 Prompt        │
│                   │                   │                         │
└───────────────────┴───────────────────┴─────────────────────────┘
```

---

## 三、Eric 實際工作流程

```
客人 LINE OA 詢問
       │
       ▼
TG Topics 收到通知（獨立對話串，不會混亂）
       │
       ▼
AI 整理需求 + 草稿回覆
       │
       ▼
Eric 操作：✅ 送出 / ✏️ 編輯 / ❌ 自己回
（可用語音：「OK 送出」）
       │
       ▼
多輪對話（每個客人上下文獨立）
       │
       ▼
┌─────────────────────────────────────────┐
│  收單信號（AI 會學習辨識）：             │
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
客人加 Eric 個人 LINE → Eric 私訊導遊確認成本/檔期
       │
       ▼
Eric 手動開 LINE 群組（Eric + 客人 + 導遊）
       │
       ▼
成交確認
       │
       ├── TG 按 [✅ 成交] → 從 TG 移除 + 保留學習資料
       │
       └── Eric 手動加到 Notion（這是 Eric 自己的流程）
```

**注意**：LINE API 無法自動建立群組，群組必須 Eric 手動開。

---

## 四、系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│  客人在 LINE OA 發訊息（文字/圖片/貼圖）                         │
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
│  Vercel API Route: /api/line-webhook                            │
│                                                                 │
│  1. 驗證 LINE Signature（HMAC-SHA256）                          │
│  2. 解析 message event                                          │
│  3. 取得客人 profile（displayName）                              │
│  4. 比對 Notion 是否為舊客                                       │
│  5. 建立/更新客人對話上下文（隔離儲存）                          │
│  6. 呼叫 AI 處理層                                              │
│  7. 回傳 200 OK（LINE 要求 1 秒內）                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI 處理層                                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  助理 1：需求抽取（Claude Haiku）                         │   │
│  │  ├── 輸入：客人原始訊息                                   │   │
│  │  └── 輸出：結構化 JSON（日期、人數、景點、特殊需求）      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  助理 2：草稿生成（Claude Sonnet + RAG）                  │   │
│  │  ├── 輸入：結構化需求 + 該客人的對話上下文                │   │
│  │  ├── 參考：                                               │   │
│  │  │   ├── 學習資料庫（成交對話範例）                       │   │
│  │  │   ├── 報價計算器（行程範本）                           │   │
│  │  │   └── 話術範本（16 筆）                                │   │
│  │  └── 輸出：Eric 風格的回覆草稿                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  助理 3：語音轉文字（Whisper API）- Phase 7.3             │   │
│  │  ├── Eric 在 TG 發語音 → 轉成文字指令                     │   │
│  │  └── 例：「這個 OK 直接送出」→ 執行 ✅                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Telegram Bot（Topics 模式 - 每個客人獨立對話串）               │
│                                                                 │
│  清微旅行 AI 助理（群組）                                       │
│  │                                                              │
│  ├── 📌 總覽                                                    │
│  │   └── 今日：3 新客人，2 等待回覆                             │
│  │                                                              │
│  ├── 👤 #A-王先生（4/12-16 親子）[🟡等待中]                     │
│  │   ├── 客人訊息 + AI 摘要                                     │
│  │   ├── AI 草稿                                                │
│  │   ├── [✅ 送出] [✏️ 編輯] [❌ 自己回]                        │
│  │   ├── [👍 OK] [📏 太長] [🎭 太正式] [❄️ 太冷]（快速回饋）    │
│  │   └── [✅ 成交] [🗑️ 刪除]                                    │
│  │                                                              │
│  ├── 👤 #B-李小姐（詢價中）[🔵已回覆]                           │
│  │                                                              │
│  └── 📦 已結束（7 天無互動自動清理）                            │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                      Eric 按 ✅ 送出
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LINE Messaging API                                             │
│  Push Message → 客人收到回覆（文字或圖片）                       │
│  同時：儲存對話記錄到 Sanity                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、AI 學習機制

**不是 ML/RL，是 Prompt Engineering + RAG**

| 機制 | 說明 | 資料來源 |
|------|------|----------|
| **Few-shot Prompting** | System Prompt 內含 3-5 個成交對話範例 | 學習資料庫（成交對話） |
| **RAG 檢索** | 根據客人需求，動態抓取相似案例 | Notion 成交記錄 + 報價計算器 |
| **人工迴圈優化** | Eric 編輯草稿 → 記錄差異 → 定期更新 Prompt | 編輯記錄 |

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
每週日分析 → 生成建議 → Eric 確認 → 更新 Prompt
```

### Eric 需要做的（最小化）

| 頻率 | 動作 | 耗時 |
|------|------|------|
| 每次 | 按送出/編輯/自己回 | 3-10 秒 |
| 偶爾 | 點回饋按鈕（可選） | 1 秒 |
| 每週 | 看週報，確認調整 | 5 分鐘 |
| 初期 | 匯入 10 組成交對話 | 30 分鐘（一次性） |

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
└── 📦 已結束（7天自動清理）
```

### 6.2 單一客人對話串

```
┌─────────────────────────────────────────────────────────────┐
│  📩 新訊息                                                   │
│                                                             │
│  👤 王先生（⭐ 舊客：2025/12 曾詢問）                         │
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
│  [✅ 成交]  [🗑️ 刪除]                                        │
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

## 七、Housekeeping 規則

```
┌─────────────────────────────────────────────────────────────┐
│                     自動清理規則                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚪ 無下文 > 7 天                                            │
│     → 自動刪除                                               │
│     → 不保留學習資料                                         │
│     → 不問 Eric，直接清掉                                    │
│                                                             │
│  ✅ Eric 按 [成交]                                           │
│     → 從 TG 移除（保持乾淨）                                 │
│     → 資料自動保留給 AI 學習                                 │
│     → TG 提醒：「記得加 Notion 👍」                          │
│                                                             │
│  🗑️ Eric 按 [刪除]                                           │
│     → 直接清掉                                               │
│     → 不保留學習資料                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、資料結構

### 8.1 客人詢問（AI 抽取後）

```typescript
interface CustomerInquiry {
  // 識別
  id: string
  lineUserId: string
  customerName: string
  isReturningCustomer: boolean
  previousInquiryDate?: string

  // 需求
  travelDates: string | null
  duration: string | null
  adults: number | null
  children: number | null
  childrenAges: string | null
  attractions: string[]
  budget: string | null
  accommodation: string | null
  specialNeeds: string[]

  // AI 判斷
  inquiryType: 'new' | 'followup' | 'priceCheck' | 'booking' | 'other'
  urgency: 'high' | 'normal' | 'low'
  conversionSignal: boolean  // 是否接近成交

  // 原始
  rawMessage: string
  timestamp: string
}
```

### 8.2 對話記錄（上下文隔離）

```typescript
interface Conversation {
  id: string
  lineUserId: string
  customerName: string

  // 狀態
  status: 'new' | 'waiting_eric' | 'waiting_customer' | 'cold' | 'converted' | 'deleted'
  lastActivityAt: string

  // 訊息（只有這位客人的）
  messages: {
    role: 'customer' | 'eric'
    content: string
    contentType: 'text' | 'image'
    timestamp: string
    wasAiGenerated?: boolean
    wasEdited?: boolean
    originalDraft?: string
  }[]

  // 最新需求
  latestInquiry: CustomerInquiry

  // TG 顯示
  tgTopicId: string
}
```

### 8.3 學習資料（成交對話）

```typescript
interface LearningConversation {
  id: string
  customerName: string
  notionRecordId?: string

  // 完整對話
  conversation: {
    role: 'customer' | 'eric'
    content: string
    timestamp: string
  }[]

  // AI 分析
  analysis: {
    ericTone: string[]           // ["簡潔", "專業", "親切"]
    responseLength: 'short' | 'medium' | 'long'
    keyPhrases: string[]         // Eric 常用句
    conversionTechniques: string[]
  }

  // 標記
  isGoodExample: boolean
  importedAt: string
}
```

### 8.4 Prompt 版本

```typescript
interface PromptVersion {
  version: number
  createdAt: string

  systemPrompt: string
  fewShotExamples: string[]

  // 來源
  basedOnFeedback: {
    totalDrafts: number
    directSendRate: number
    commonEdits: string[]
  }

  // 效果
  performance: {
    draftsGenerated: number
    directSendRate: number
  }
}
```

### 8.5 行程範本（報價計算器）

```typescript
interface ItineraryTemplate {
  id: string
  name: string                   // "經典清邁 4D3N 親子行程"
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
    perAdult: { min: number, max: number }
    perChild: { min: number, max: number }
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
| Webhook 接收 | LINE 訊息 → 後端處理（不觸發已讀） | 7.1 |
| 簽名驗證 | HMAC-SHA256 + Rate Limiting | 7.1 |
| 需求抽取 | Claude Haiku 結構化客人訊息 | 7.1 |
| TG Topics | 每客人獨立串，上下文隔離 | 7.1 |
| 狀態追蹤 | 🟢新 🟡等待 🔵已回 ⚪冷掉 | 7.1 |
| 草稿生成 | Claude Sonnet + RAG | 7.2 |
| 一鍵送出 | TG 按鈕 → LINE 回覆 | 7.2 |
| 編輯送出 | 修改草稿 + 記錄差異 | 7.2 |
| 圖片發送 | TG 發圖 → 選客人 → LINE 發送 | 7.2 |
| 舊客識別 | 比對 Notion，顯示歷史 | 7.2 |
| 語音輸入 | Whisper 轉文字執行 | 7.3 |
| 收單信號 | AI 建議發 QR Code 時機 | 7.3 |

### 9.2 對話管理

| 功能 | 說明 | Phase |
|------|------|-------|
| 多輪對話 | 同客人訊息自動串接 | 7.2 |
| 成交標記 | [✅ 成交] → 保留學習 | 7.2 |
| 手動刪除 | [🗑️ 刪除] → 清掉 | 7.2 |
| 自動清理 | 7 天無互動自動刪 | 7.2 |
| 每日摘要 | 20:00 推送統計 | 7.2 |
| 快速回饋 | 👍 📏 🎭 ❄️ | 7.2 |
| 週報 | 每週日推送 + 建議 | 7.3 |

### 9.3 內部派單記錄（Phase 7.3，可選）

| 指令 | 說明 |
|------|------|
| /new 王先生 4/12-16 4大2小 | 建立新訂單 |
| /assign Min | 派給 Min 導遊 |
| /cost 12000 | 記錄成本 |
| /list | 查看進行中訂單 |
| /done | 標記完成 |

---

## 十、分階段實作計畫

### Phase 7.1：基礎建設（MVP）

**目標**：客人發訊息 → 5 秒內 TG 對應 Topic 收到結構化摘要

#### 7.1.1 LINE Messaging API 設定

- [ ] 在 LINE Developers Console 確認 Messaging API Channel
- [ ] 取得 Channel Access Token（Long-lived）
- [ ] 取得 Channel Secret
- [ ] 設定 Webhook URL：`https://chiangway-travel.com/api/line-webhook`
- [ ] 關閉 LINE OA 的「自動回覆訊息」

#### 7.1.2 Telegram 設定

- [ ] 透過 @BotFather 建立 Bot，取得 Token
- [ ] 建立 TG 群組，開啟 Topics 功能
- [ ] 取得群組 Chat ID
- [ ] 設定 Bot 為群組管理員

#### 7.1.3 Webhook API Route

**檔案**：`src/app/api/line-webhook/route.ts`

```typescript
// POST /api/line-webhook
// 1. 驗證 X-Line-Signature（HMAC-SHA256）
// 2. 解析 events[]
// 3. 過濾 message event
// 4. 取得 user profile（displayName）
// 5. 建立/更新對話上下文（隔離儲存）
// 6. 呼叫 AI 需求抽取
// 7. 推送到 Telegram（對應 Topic）
// 8. 回傳 200 OK（LINE 要求 1 秒內）
```

#### 7.1.4 AI 需求抽取

**模型**：Claude Haiku（快 + 便宜）

**Prompt 設計重點**：
- 泰國旅遊場景專用（清邁景點名稱辨識）
- 中文繁體客人的表達習慣
- 模糊描述的合理推斷（「帶小孩」→ 親子行程）
- 無法確定的欄位填 null，不要瞎猜

#### 7.1.5 TG Topics 通知

- [ ] 新客人 → 建立新 Topic
- [ ] 舊客人 → 發到現有 Topic
- [ ] 格式化訊息（Markdown）
- [ ] 基本按鈕（✅ ❌）

#### 驗收標準

- [ ] 客人發訊息 → 5 秒內 TG 收到摘要
- [ ] 客人端不顯示已讀
- [ ] 需求抽取準確率 > 80%
- [ ] 每客人獨立 Topic，不會混亂
- [ ] 非文字訊息不會 crash

---

### Phase 7.2：草稿生成 + 完整功能

**目標**：AI 生成 Eric 風格草稿，完整操作流程

#### 7.2.1 學習資料庫建立

- [ ] Sanity Schema：LearningConversation
- [ ] 歷史對話匯入工具
- [ ] Eric 匯入 10 組成交對話

#### 7.2.2 報價計算器「儲存範本」功能

- [ ] Sanity Schema：ItineraryTemplate
- [ ] Studio UI：建立/編輯範本
- [ ] Eric 建立 3-5 個常用範本

#### 7.2.3 Notion 同步

- [ ] Notion Integration 設定
- [ ] 定期抓取成交記錄（用於舊客比對）
- [ ] 同步頻率：每天或手動

#### 7.2.4 草稿生成 AI

**模型**：Claude Sonnet（品質優先）

**System Prompt 核心**：
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

- [ ] ✅ 送出 → LINE Push + 記錄
- [ ] ✏️ 編輯 → 輸入修改 → 送出 + 記錄差異
- [ ] ❌ 自己回 → 標記手動
- [ ] ✅ 成交 → 移除 + 保留學習
- [ ] 🗑️ 刪除 → 清掉

#### 7.2.6 圖片發送

- [ ] TG 收到圖片 → 詢問發給誰
- [ ] 選擇客人 → LINE Push Image
- [ ] 常用照片庫（可選）

#### 7.2.7 Housekeeping

- [ ] 7 天無互動 → 自動刪除
- [ ] 成交 → 保留學習資料
- [ ] 每日摘要（20:00）
- [ ] 快速回饋按鈕

#### 驗收標準

- [ ] 草稿語氣符合 Eric 風格
- [ ] 按 ✅ → 客人 3 秒內收到
- [ ] 圖片可以發送
- [ ] 成交/刪除流程正常
- [ ] 7 天自動清理運作
- [ ] 回覆耗時從 30 分鐘降至 < 5 分鐘

---

### Phase 7.3：進階功能

**目標**：AI 草稿採用率 > 70%

#### 7.3.1 語音輸入

- [ ] Whisper API 整合
- [ ] TG 語音 → 文字 → 執行指令
- [ ] 成本：~$0.006/分鐘

#### 7.3.2 收單信號偵測

- [ ] 分析對話模式
- [ ] 偵測：行程確認 + 報價 + 客人正向
- [ ] 建議：「要發 QR Code 嗎？」

#### 7.3.3 週報 + Prompt 優化

- [ ] 每週日推送分析報告
- [ ] 常見編輯模式
- [ ] 建議調整（Eric 確認後套用）

#### 7.3.4 內部派單記錄（可選）

- [ ] /new /assign /cost /list /done
- [ ] 記錄導遊、成本、利潤

#### 驗收標準

- [ ] 語音指令可執行
- [ ] 週報準確反映使用情況
- [ ] AI 草稿採用率 > 70%

---

## 十一、技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| LINE SDK | `@line/bot-sdk` | 官方 SDK，signature 驗證 + 訊息發送 |
| AI 需求抽取 | Claude Haiku | 快 + 便宜 |
| AI 草稿生成 | Claude Sonnet | 品質優先 |
| 語音轉文字 | Whisper API | OpenAI，準確度高 |
| Telegram | HTTP API 或 `node-telegram-bot-api` | Topics 支援、inline keyboard |
| 暫存 | Vercel KV | 對話上下文 |
| 持久化 | Sanity | 學習資料、範本 |
| 部署 | Vercel | 現有架構 |

---

## 十二、環境變數

```env
# === Phase 7: LINE OA AI Assistant ===

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=     # LINE Developers Console
LINE_CHANNEL_SECRET=           # LINE Developers Console

# Telegram Bot
TELEGRAM_BOT_TOKEN=            # @BotFather
TELEGRAM_GROUP_ID=             # 群組 Chat ID（Topics 模式）

# Claude API
ANTHROPIC_API_KEY=             # 已有

# Whisper API（Phase 7.3）
OPENAI_API_KEY=                # OpenAI

# Notion（同步成交記錄）
NOTION_API_TOKEN=              # Notion Integration
NOTION_DATABASE_ID=            # 2026 客戶記錄 Database ID

# Vercel KV
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

---

## 十三、安全性

| 項目 | 做法 |
|------|------|
| LINE Webhook | HMAC-SHA256 簽名驗證 |
| Rate Limiting | 防 webhook 重放 |
| API Token | 全部 server-side |
| 客人個資 | 只存後端，符合 PDPA |
| TG Bot Token | 不暴露 |

---

## 十四、成本估算

| 項目 | 費用/月 |
|------|---------|
| LINE Messaging API | 免費（500 push/月） |
| Telegram Bot | 免費 |
| Claude Haiku | ~$0.10（100 次） |
| Claude Sonnet | ~$1.00（100 次） |
| Whisper | ~$0.60（100 分鐘） |
| Notion API | 免費 |
| Vercel KV | 現有方案 |
| **總計** | **< $5/月** |

---

## 十五、與現有系統整合

| 現有功能 | 整合方式 |
|----------|----------|
| 報價計算器（Phase 6.8） | Phase 7.2 新增「儲存範本」，AI 參考 |
| 知識庫（Phase 6） | Phase 7.2 串接，AI 參考景點/餐廳/飯店 |
| 話術範本（Notion 16 筆） | Phase 7.2 串接，AI 學習回覆風格 |
| 行程表系統（Phase 3） | Phase 7.3 可串接，需求確認後一鍵生成 |

---

## 十六、Eric 需準備的資料

| 資料 | 用途 | 何時需要 |
|------|------|----------|
| LINE Channel 資訊 | Webhook 設定 | Phase 7.1 |
| TG Bot Token | 通知設定 | Phase 7.1 |
| Notion API Token | 同步成交記錄 | Phase 7.2 |
| 10 組成交對話 | AI 學習範例 | Phase 7.2 |
| 3-5 個行程範本 | AI 參考 | Phase 7.2 |

---

## 十七、驗收標準總覽

### Phase 7.1
- [ ] 客人發訊息 → 5 秒內 TG 對應 Topic 收到摘要
- [ ] 客人端不顯示已讀
- [ ] 需求抽取準確率 > 80%
- [ ] 每客人獨立 Topic
- [ ] 非文字訊息不 crash

### Phase 7.2
- [ ] 草稿語氣符合 Eric 風格（Eric 主觀判斷）
- [ ] 按 ✅ → 客人 3 秒內收到
- [ ] 圖片可發送
- [ ] 成交/刪除/自動清理正常
- [ ] 回覆耗時 < 5 分鐘

### Phase 7.3
- [ ] 語音指令可執行
- [ ] 週報準確
- [ ] AI 草稿採用率 > 70%

---

*規格確認日期：2026-03-22*
*預計開始實作：待 Eric 確認*
*協同開發：Claude Code + Codex*
