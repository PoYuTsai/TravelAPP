# LINE OA Internal AI Assistant for Partner Operations — Event Model & UX（M2 設計）

- 日期：2026-06-03
- Branch：`codex/line-oa-agent-mvp`
- 狀態：**第一批已實作（客人事件分類 / inbox SLA 分區 / reminder 候選 / 守門測試）**。未做（後續 milestone）：夥伴群回答、postback normalizer、quote gate 等級常數。實作對應 `docs/plans/2026-06-03-line-oa-m2-implementation-plan.md`。
- 關係文件（重疊細節引用，不重複）：
  - `docs/plans/2026-06-03-line-oa-m2-case-intelligence-design.md`（客人事件分類 / auto-reply schema / inbox zone resolver / reminder 機制細節）
  - `docs/plans/2026-06-01-line-oa-agent-m2-durable-persistence.md`（case store）
  - `docs/plans/2026-06-02-line-oa-phase-c-quote-url-dryrun-design.md`（報價 dry-run）
- 相依 code：`intent.ts`、`case-state.ts`、`case-triage.ts`、`permissions.ts`、`operator/operator-command.ts`

---

## 0. 這份 doc 的定位

前一份（Case Intelligence）講「**客人訊息怎麼分類、inbox 怎麼排**」的機制。
這一份是**傘狀的 Event Model & UX**：定義整個 bot 作為**營運夥伴**的角色、三個 actor 的事件平面、夥伴群與 Eric 的互動規則、報價 gate。把所有事件來源收進同一個模型。

---

## 1. 核心原則（Operating Philosophy）

> **bot 是清微旅行的第三位營運夥伴，服務 @Tsai / @Chun——不是監工，不增加她們的 loading。**

四條落地原則，貫穿後面所有設計：

| 原則 | 設計含義 |
|------|----------|
| **第三位夥伴，非監工** | 預設**安靜**：不主動催、不在群裡刷存在感、不對夥伴績效下評斷。只在被需要時出現。 |
| **不增 loading** | 把「整理客人說了什麼 / 缺什麼 / 下一步」做掉，讓夥伴**少讀原始訊息**。提醒是溫和候選，非待辦轟炸。 |
| **對客人不自動回覆** | 客人自由文字訊息**零自動回覆**（CLAUDE.md 硬規則）。bot 只整理、不對客發話。 |
| **對夥伴群像 GPT** | 被 tag（`@清微AI助理`）才回答；可問行程、客需、研究、OCR、草稿。沒被 tag → 靜默觀察。 |
| **Eric 三介入點** | Eric 只在 ①夥伴主動問 ②tough case ③收單確認 時介入。其餘日常不打擾 Eric。 |

設計北極星：**「夥伴打開 LINE，5 秒內知道現在該做哪件事」**，而且不必先讀 bot 的長篇大論。

---

## 2. Actor × Plane 事件模型

三個 actor、三條事件來源，匯入同一個 case 狀態機。

```
┌────────────┐   客人事件        ┌──────────────────┐
│  客人(LINE  │ ───────────────▶ │                  │
│   OA 1:1)  │                   │   Case State     │
└────────────┘                   │   Machine        │
┌────────────┐   夥伴群事件       │  (12 statuses)   │
│ @Tsai @Chun│ ───────────────▶ │                  │ ──▶ /inbox UX
│ (夥伴群)    │   (tag→答 / 指令)  │                  │ ──▶ reminder candidates
└────────────┘                   │                  │ ──▶ needs_eric 旗標
┌────────────┐   Eric 介入事件   │                  │
│   Eric     │ ───────────────▶ │                  │
│ (operator) │  (批准/收單/judge) └──────────────────┘
└────────────┘
```

| Plane | 來源 | bot 角色 | 分類器 |
|-------|------|----------|--------|
| Customer plane | 客人 1:1 訊息 | 整理、分類、never reply | `CustomerEventCategory`（§3） |
| Partner plane | 夥伴群訊息 | 被 tag→答；指令→執行；否則靜默 | `PartnerGroupEvent`（§4） |
| Eric plane | Eric 操作 | 等待批准 / 收單 / judge | `EricInterventionEvent`（§5） |

---

## 3. 客人 LINE OA 事件分類（摘要，細節見 Case Intelligence doc）

8 類，deterministic-first，只驅動內部判斷，**永不對客回覆**：

`new_inquiry`、`follow_up_info`、`change_request`、`price_question`、`product_or_itinerary_question`、`menu_browsing`、`media_or_ocr_needed`、`non_actionable`。

> 完整訊號表、優先序、分類管線見 `2026-06-03-line-oa-m2-case-intelligence-design.md` §3。

---

## 4. 夥伴群事件分類（PartnerGroupEvent）

夥伴群裡的訊息也是事件。分類決定 bot 是「回答 / 執行 / 靜默」。

```ts
export type PartnerGroupEventType =
  | 'bot_question'      // 被 tag，像 GPT 問答（客需、行程、研究、OCR、草稿）
  | 'operator_command'  // 明確指令（parse / draft / inbox / ocr…）→ intent.ts
  | 'send_intent'       // 明確要 bot 對外/對群發（「發到夥伴群」「通知 @Tsai」）
  | 'case_discussion'   // 夥伴彼此討論某案，bot 靜默觀察（可被動更新 case 註記）
  | 'casual_chat'       // 閒聊，bot 完全靜默
```

### 4.1 判斷規則（由上往下）

| 優先 | 訊號 | type | bot 行為 |
|------|------|------|----------|
| 1 | 含 bot tag（`@清微AI助理`）+ 疑問/請求 | `bot_question` | 回答（§10 規則） |
| 2 | 命中 `intent.ts` deterministic 指令 pattern | `operator_command` | 經 permissions 後執行 |
| 3 | 含送出意圖詞（發到、通知、貼到群、send to） | `send_intent` | 走 `send` 權限門，需明確才送 |
| 4 | 含案號 / 客人名 + 商務詞，但無 tag/指令 | `case_discussion` | 靜默；可更新 `lastGroupDiscussionAt` |
| 5 | 其餘 | `casual_chat` | 完全靜默 |

### 4.2 邊界

- `bot_question` 回答**沿用既有權限**：邏輯上可 analyze / web_search / ocr / draft，但**不能** code_edit / deploy / schema_change（`intent.ts` 已將 dev action 對夥伴群 deny）。
- `case_discussion` 的被動更新**只**寫內部註記（時間戳），不對群發話。
- 任何 type 都**不會**觸發對客人回覆。

> **目前階段（current phase）= 夥伴群 tagged reply = text-only model response。**
> 上面列的 `web_search` / `ocr` / Notion RAG / 長行程或報價 review / 報價 `draft` 是**設計藍圖能力**，目前**全部 deferred behind 後續 explicit gate**（見 `2026-06-03-partner-group-reply-gate-billing-design.md` §2「Higher-cost LLM/tool use requires an explicit later gate」與 `2026-06-03-partner-group-responder-model-adapter-design.md` §0 非目標）。
> **被夥伴 tag bot 不會自動跑任何外部工具**——當前 responder 只回傳純文字模型回覆。本節描述的是目標角色，不是已解鎖能力。

---

## 5. Eric 介入事件（EricInterventionEvent）

Eric 不在日常迴圈裡。只有三類事件把案子升到 `needs_eric`。

```ts
export type EricInterventionTrigger =
  | 'partner_asked_eric'    // 夥伴主動 @Eric 或說「問 Eric / 給老闆看」
  | 'tough_case'            // 高風險/複雜，bot 不自行判斷
  | 'booking_confirmation'  // 收單 / 訂金 / 報價對外確認
```

### 5.1 tough_case 細目

- 醫療 / 安全 / 受傷 / 行動不便風險
- 競品比價、價格爭議（bot **不做**報價判斷）
- 疑似重複案（同名＋同日期＋7 日內）
- 疑似 spam / bot，需人判
- 客需超出標準包車/行程模板，需 Eric 拍板

### 5.2 介入 UX

- 升到 `/inbox` 的 **`needs_eric`** 區（§8），附 bot 整理好的 case card + 原因。
- **預設不自動 DM Eric**；Eric 自己看 inbox，或夥伴明確 `send_intent` 通知時才推。
- 收單確認（booking_confirmation）＝報價 gate 的人工關卡（§11）。

---

## 6. Case 狀態事件（12-status 生命週期）

沿用 `case-state.ts` 的 12 status，視為事件驅動的狀態機。**狀態多由人或事件推進，bot 只建議下一步、不擅自跳轉終態。**

```
new_inquiry ─(補齊核心欄位)→ ready_for_itinerary ─→ itinerary_in_progress
   │  ▲                                                      │
   │  │(缺欄位)                                               ▼
   ▼  │                                            itinerary_review
needs_info ◀───────────────(客人未補)                         │
                                                              ▼
                                              ready_for_quote ─→ quote_review
                                                                    │
                                                                    ▼
                                                            quoted_tracking
                                                              │        │
                                                       (加 Eric)│        │(成交/流失)
                                                              ▼        ▼
                                                        added_eric  converted / lost
                                          (任何長期無互動) ─────────────▶ idle
```

### 6.1 轉移事件表（節錄）

| from | 觸發事件 | to | 由誰 |
|------|----------|-----|------|
| `new_inquiry` | 核心欄位（日期+人數+…）補齊 | `ready_for_itinerary` | bot 建議、人確認 |
| `new_inquiry` | 仍缺欄位 | `needs_info` | bot 自動 |
| `needs_info` | `follow_up_info` 補滿 | `ready_for_itinerary` | bot 重算 |
| `ready_for_quote` | 報價 dry-run 產出待檢 | `quote_review` | bot（dry-run）+ 人檢 |
| `quote_review` | Eric/夥伴核可 | `quoted_tracking` | 人 |
| `quoted_tracking` | 客人成交 | `converted` | 人（收單確認） |
| `quoted_tracking` | 客人流失 | `lost`(+lostReason) | 人 |
| 任一非終態 | 長期無互動 | `idle` | bot（housekeeping） |

- **終態**（`converted` / `lost`）只由人推進，bot 不自動下。
- `added_eric`：夥伴把 Eric 拉進該案時標記，連動 `needs_eric` 呈現。

---

## 7. Rich Menu / Auto-Reply Browsing 判斷（dormant，摘要）

- rich menu postback → `menu_browsing`，用於 browsing intent 偵測與上下文補充。
- `AutoReplyMapping` / `AutoReplyConfig` schema **全程 dormant**（`enabled: false` literal），M2 零送出。
- 唯一用途：內部判斷、模板對應、避免 inbox 誤判。**客人自由文字仍不自動回覆。**

> 完整 schema 見 Case Intelligence doc §4。

---

## 8. `/inbox` 分區 UX

以**緊急度 / SLA「下一步行動」**為主軸，七區（zone resolver 規則見 Case Intelligence doc §6）：

`need_reply`（需回覆/需處理）、`awaiting_customer`（等客人補資料）、`ready_itinerary`（可排行程）、`quote_review`（報價待檢查）、`quoted_tracking`（已報價追蹤）、`browsing_idle`（瀏覽中/靜置）、`needs_eric`（需 Eric 介入）。

### 8.1 UX 原則（呼應「不增 loading」）

- **行動優先，非時間優先**：排序看下一步急迫度，不是單純最新訊息。
- **一眼掃完**：每筆一句話下一步 + 旗標（逾時/未回提問），不堆原文。
- **零空區噪音**：空 zone 顯示 `(0)` 收合，不佔視覺。
- **夥伴視角措辭**：用「下一步」「需回覆」這種行動語言，不用 status enum 術語。
- **needs_eric 永遠在最上**：tough case 不被一般案淹沒。

---

## 9. 主動提醒規則（Proactive Reminder）

呼應「夥伴不是被監工」：提醒是**溫和候選**，預設**只進 inbox 旗標**，不主動轟炸。

- reminder candidate = read-time 計算（reason / severity / ageHours / suggestedAction），見 Case Intelligence doc §5。
- 觸發後**預設不 push**；只進 `/inbox` 對應 zone 顯示旗標。
- **operator opt-in 才推**：Eric/夥伴明確 send intent → 走 `send` 權限門推夥伴群。
- 語氣準則：提醒是「這案等你補一句就能往前」，不是「你還沒處理」。
- 保留半自動化升級路線（candidate → 草稿 → 未來自動推），分階段、需 Eric 改規則。

---

## 10. Partner Group 回覆規則

bot 在夥伴群＝**被 tag 才出現的 GPT 同事**。

### 10.1 何時回

| 情境 | bot |
|------|-----|
| 被 tag + 問題/請求（`bot_question`） | **回答** |
| 明確指令（`operator_command`） | 執行（經 permissions） |
| 明確 send intent | 走 `send` 門才送 |
| 夥伴彼此討論（`case_discussion`） | **靜默**（最多被動記時間戳） |
| 閒聊（`casual_chat`） | **完全靜默** |

### 10.2 能答什麼

> **能力分層（current phase vs deferred）：** 目前**已解鎖 = text-only model response**。下列只有純文字整理/建議是現階段能力；標 *(deferred gate)* 者皆需後續 explicit gate 才解鎖（見 reply-gate §2、responder-adapter §0），**被 tag 不會自動觸發外部工具**。

- ✅ 某案客需整理、缺什麼、下一步建議（純文字，現階段）
- 🔒 行程 / 景點 / 票務 / 時段查詢（走 web_search，附來源）*(deferred gate)*
- 🔒 圖片 OCR（機票、護照、訂單截圖）抽欄位 *(deferred gate)*
- 🔒 報價/行程**草稿**（draft，人工決定用不用）*(deferred gate)*
- 🔒 類似案查詢（已確認的 Notion 案，權限內）*(deferred gate)*

### 10.3 絕不做

- ❌ 對客人發任何訊息
- ❌ 監工/催夥伴/評績效
- ❌ 報價對外確認、報價金額判斷（→ Eric 收單）
- ❌ code_edit / deploy / schema_change（dev plane，dev 由 CC/tmux 做）
- ❌ 未經 send intent 主動貼群或 @人
- ❌ 洩漏 Eric 私註記 / 私 Notion 表

---

## 11. 後台報價 Automation Gate

報價自動化採**分級 gate**，目前**凍結在最低級**（Eric 指示）。

```ts
export type QuoteAutomationLevel =
  | 'L0_dry_run_only'   // ← 目前。只產 DRAFT-<caseId>、isOfficial:false，零 Sanity import
  | 'L1_draft_for_review' // 產正式草稿待 Eric 檢，仍不對外
  | 'L2_assisted_send'   // Eric 逐案核可後送出
  // L3 全自動：不在規劃範圍
```

| Gate | 解鎖條件 | 現況 |
|------|----------|------|
| L0 → L1 | Eric 批准 **server-side Sanity write token** | **未解鎖（凍結）** |
| L1 → L2 | L1 穩定 + Eric 明確逐案核可流程 | 未規劃 |

- **收單確認永遠是人工關卡**：`booking_confirmation`（§5）由 Eric 拍板，bot 不自動成交。
- 任何級別都**不**改變「客人不自動回覆」邊界。
- 現階段 bot 對報價只做 **L0 dry-run + 草稿給人看**，不寫正式 Sanity、不對外送。

---

## 12. 邊界自檢（對照 CLAUDE.md / Operating Boundaries）

- ✅ CC/tmux 是 operator，bot 只是 LINE 執行通道。
- ✅ 客人訊息不自動回覆（M2 對客送出 = 0）。
- ✅ 貼夥伴群需明確 send intent。
- ✅ 報價 dry-run only，待 Eric 批 write token。
- ✅ 檔案編輯/測試/commit/deploy 由 CC/tmux，非 bot。
- ✅ 無 secrets 進 repo；LLM seam stub、零金鑰測試。

---

## 13. Open Questions（不阻擋規格，實作前釐清）

- bot tag 的實際 mention id / 顯示名（`@清微AI助理`）需從 LINE OA 後台確認後回填。
- `case_discussion` 被動更新要記到多細？（初版只記 `lastGroupDiscussionAt`）
- `bot_question` 回答長度上限與引用格式（避免群裡洗版）。
- 商務時段是否影響 reminder / SLA 時數（初版用絕對時數）。
- L1 解鎖後，正式 `/quote/[slug]` 與 Notion 建檔的連動細節（另開 plan）。

---

## 14. 實作順序（M2，待批准後另開 plan）

1. 客人事件分類器（Case Intelligence doc §3 + 管線）
2. 夥伴群事件分類 `PartnerGroupEvent` + 判斷規則（接 `intent.ts`）
3. Eric 介入旗標 + `needs_eric` zone 整合
4. case 狀態事件轉移表（補強 `case-reducer`）
5. `/inbox` 七區 UX 輸出
6. reminder candidate 產生器（read-time）
7. partner group 回覆規則接線（tag→answer、permissions 守門）
8. 報價 gate 等級常數 + L0 凍結守門
9. 測試（含「對客零送出」「未 tag 不回」守門）
