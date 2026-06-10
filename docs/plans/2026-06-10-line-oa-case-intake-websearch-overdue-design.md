# LINE Agent 三方向設計 — 客需三分流／web search／OA 超時提醒

> 日期：2026-06-10 · branch `codex/line-oa-agent-mvp` · 狀態：design 已過 Eric 確認
> 核心修正（兩次踩到同一個盲點）：**操作者是夥伴，不是 Eric**。客服／排行程／報價／銷售已外包給夥伴；任何要 Eric 動手輸入的形態（CLI 產品化）都是把工作收回來，一律否決。CLI 只能當 CC 的開發驗證 harness。

## 北極星（Eric 的產品方向）

夥伴丟一段客人需求時，agent 判斷「資訊是否足夠」：
- **不足** → 整理缺哪些關鍵資訊（日期／人數／小孩年齡／航班／住宿地點），給夥伴一段可轉傳客人的建議問法
- **足夠** → 產出可給夥伴判斷的行程／回覆草稿
- **棘手** → 標記需 Eric 確認，不直接承諾

---

## 1. 客需三分流 + parser 可解析行程草稿（優先做）

**產品形態**：夥伴在現有夥伴群 @bot 丟客需 → bot 回三分流之一。Eric 時間成本零。

- **格式閘（核心保證）**：行程草稿輸出前先餵回**真 parser**（`parseBasicInfoText` + `parseItineraryText`，`src/lib/itinerary/parser`）round-trip；解析不乾淨或關鍵欄位缺 → **fail-closed 降級為缺項模式**，絕不輸出貼了會壞的文字。deterministic，零 LLM 信任。
- **格式基準**：Eric 內部整理的行程排版＝golden case 李家 7D6N（`customer-itinerary-golden.ts`）當 round-trip 迴歸基準。
- **復用**：`composeCustomerItineraryDraft`、`lintCustomerItinerary`、leak guard。LLM 涉入（充足度判斷／問法生成）走現有三閘 + daily cost cap；閘關退 deterministic 缺項檢查。
- **leak 邊界釐清**：現有 masked 防線防的是 **Notion 內部案例**（他客 PII／內部價）外洩；三分流草稿內容來自該客人自己的需求＋公開景點知識，不屬被防類別。保留「絕不引用其他客人案例細節／內部價」的閘。
- **CLI 僅為 dev harness**：CC 開發時驗 parser round-trip／缺項偵測／leak，非產品。
- **不做**：報價 URL 產生（肉眼確認＋價格勾選複雜，放最後）、寫 Sanity。

## 2. Web search（operator 工具，不進自動路徑）

- 夥伴群自動路徑**維持 fail-closed**：Notion RAG 查無或信心不足 → 誠實回「內部案例不足」＋建議補問項。**不自動 web search**。
- web search 只做 **operator 明示指令的獨立工具**（Anthropic 原生 `web_search` server tool：同一 API call、cost cap 自動涵蓋、自帶 citation、不引入新 vendor）。
- 若未來開：輸出強制標「網路資料未驗證／非清微內部案例」＋來源 URL，**永不覆蓋自家 RAG 判斷**。

## 3. OA 客人超時未回提醒（P1，刀序定案）

**範圍**：只監控 LINE OA 客人 case；夥伴群 @bot 後續處理不監控（留後）。提醒只送 operator 側，**永不自動回客人**。

**技術死穴（設計前提）**：LINE webhook 看不到 OA 後台手動回覆（官方帳號自己的訊息無 event）→ 系統天然不知道「回了沒」，解除必須顯式 ack。

**狀態閉環**：
- 客人訊息進 case → 計時；超過 X 小時無 handled 標記 → would-remind
- ack＝`@bot done <caseId>`（群內文字指令；CLI 同 handler 供 dev 驗證）→ handled，後續不再列
- 客人再發新訊息 → 重開計時
- 單 case 提醒上限（防無限重複）

**刀序**：
1. **刀 1**：KV 狀態欄位＋dry-run（列 would-remind cases）＋done command。ack 語意**從第一天照群內 @bot 指令設計**（B 系列 permissions 現成），CLI 只是驗證 harness。不做 cron 真推、不做按鈕／reaction。
2. **刀 2**：Vercel cron＋提醒**主動 push 到現有夥伴群**（bot 第一次主動 push，需 Eric 批 standing send intent）＋安靜時段＋每日提醒上限。

**對 Codex 原案的修正**：刀序不算保守（dry-run 先行對、不回客人對），但 CLI-only 閉環的 ack 只有 Eric 能按——實際做客服的是夥伴。閉環對象改為夥伴群。

---

## 建議實作順序

1. §1 客需三分流（群內，含 parser round-trip 閘）— ROI 最高，直接省夥伴／Eric 時間
2. §3 刀 1（狀態機＋dry-run＋done）
3. §3 刀 2（cron＋群內 push）
4. §2 web search operator 工具
5. 報價 URL（最後）
