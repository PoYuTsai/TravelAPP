# 排行程 RAG 參考設計 — 真 Notion corpus → sanitizer → LLM 套參數出 v1

> 定案日期：2026-06-14 · branch `codex/line-oa-agent-mvp`
> 來源：brainstorming session（Eric 三題拍板 + 三件 handoff 歸位）
> 狀態：design 定稿，待開新 session 轉 implementation plan

---

## 0. 一句話

新客需 → 從**真 Notion 全部過往案例**撈最像的 → **sanitizer 刷掉別人個資** → 當骨架範本注入 persona → **LLM 套本案參數**產 customer_itinerary_v1 → **per-case lint 把關**。不是 composer 從零，也不是只查單一 golden。

---

## 1. 三個核心拍板（brainstorming 結論）

| 分叉 | Eric 決定 |
|------|-----------|
| 套參數機制 | **A：LLM 套參考 + lint 把關**（非確定性 composer 從零） |
| golden 儲存位 | **真 Notion corpus**——目的是串設定好的 Notion，**所有過往案例都可 traverse**，不限單一 golden case |
| 過往案例給 LLM 看什麼 | **活動骨架 + sanitizer 刷 PII**（GAP-1 點名的 dedicated sanitizer） |

---

## 2. 重用 vs 新建

**直接重用（已存在、已測）：**
- `notion-rag-client.ts`：真 @notionhq v5 連線（databases.retrieve → dataSources.query），traverse corpus
- `notion-rag-loader.ts`：閘 `AI_AGENT_NOTION_RAG_ENABLED`＋per-source db id＋fail-aggregate
- `rag-index.ts` `RagCaseFacts.itinerarySnippet`：每筆案例本就帶行程框架文字
- `rag-query.ts` `retrieveRagCases`：靠 area/theme/partySize 排序匹配
- `customer-itinerary-lint.ts`：v1 格式 + 約束把關
- `partner-group/system-prompt.ts`：persona 已會吐 customer_itinerary_v1

**新建（這次的工，四塊）：**
1. **itinerary-reference sanitizer**（見 §3）
2. **itinerary-reference 投影**：平行於 `OperatorSafeCaseSummary`（notion-rag-search.ts）的新 view，**保留** sanitized snippet，專供 LLM 參考。注意：**絕不**走夥伴問答 surfacing 那條（那條故意丟 snippet，GAP-1）。
3. **reference 注入 persona**：把「檢索 top-1 + sanitize 後」的舊案例接進產 v1 的 LLM 呼叫。
4. **per-case lint 約束**：lint 現釘死李家 constraints（`LI_FAMILY_..._CONSTRAINTS`）；改成從本案推導（5D4N、兒童座椅、無長輩、早班機）。

---

## 3. sanitizer 設計（最核心，確定性正則）

**目標**：`itinerarySnippet`（真 Notion 原文，帶別人個資）→ 刷乾淨的活動骨架。

**兩刀 + fail-closed：**

**第一刀——整行刪開頭三行**（個資集中處，對參考零價值，新案自帶這些）：
- 標題行 `<X先生一家套餐訂製> ...`（姓名）
- 人數行 `👨‍👩‍👧‍👦 人數：...`
- 日期行 `📅 日期：...`

**第二刀——day body 逐行正則刷**（高精度 pattern）：
- 航班 `/[A-Z]{2}\d{2,4}/` + `華航/長榮 + 時間`
- 金額 `NT$ / THB / 泰銖 / 萬 / 分潤`（雙保險，金額本應在 privateContext）
- 電話、`http / notion.so`

**保留**：活動名、餐廳名、出發時間、節奏備註（可複用知識）。

**fail-closed**：刷完跑 assertion，殘留任何 PII pattern → **整筆 record 丟出 reference**（寧缺勿漏），記 log。配專屬 fixtures（拿真實會漏的輸入釘住——GAP-1 的明確要求）。

**手法定案**：確定性正則，**不用 LLM 刷**（可測、可 fail-closed、零成本零延遲）。

---

## 4. 匹配 + 注入（§3 brainstorming）

- **挑案例**：重用 `retrieveRagCases`，新客需抓特徵（5天/親子/大象-水上樂園）→ 排序。
- **餵幾個**：**top-1 當主骨架**（多餵易拼貼錯亂）。
- **沒夠像的**（low_confidence）：**退回手工「清邁親子5天4夜經典套餐」** markdown 當預設骨架（已無個資）。有真案例優先；沒有用定稿範本墊底；**絕不**讓 LLM 從零亂編。

---

## 5. 三件 handoff 歸位（較具體，已給建議）

### 5a. triage 兩小改（`partner-group/case-intake-triage.ts:51-57`）
- `CASE_INTAKE_CRITICAL_FIELDS` 移出 `flightOrPickupInfo` + `hotelOrPickupLocation`（物流非「排程」必要，缺了仍可先出骨架行程）。改後 CRITICAL = `travelDates` / `partySize` / `childAges`。
- 兒童座椅：只在**有小孩且年齡 < 4** 才問（範例 4&6 歲不需）。

### 5b. 航班預設
- 客人沒給航班 → 預設**華航 CI851/852** 或**長榮 BR257/258** 早班，行程裡標「**待確認**」。
- 背景知識來源：航班時刻表（見 5c）。

### 5c. 兩張表落地（航班時刻表 + 包車價目表）
- **航班時刻表 → Notion RAG 背景知識**（markdown/Notion），給 5b 航班預設邏輯查。
- **包車價目表 → 報價計算器**（結構化價目，需計算、THB/NT$ 換算）。
- 理由：背景參考 vs 結構化計算分流；價目要算、時刻表只要查。
- THB/NT$：價目表統一存原幣 + 換算欄，報價計算器負責換算顯示。

---

## 6. 閘 / 安全 / 驗收

- 真 Notion 連線受 `AI_AGENT_NOTION_RAG_ENABLED` 控（default off，待真群驗收）。真連線前**先檢查 `.env.local` 三閘 + key + SDK**（CLI 會載 .env.local，齊了就實打真 API）。
- sanitizer fail-closed + 專屬 fixtures 是上線前硬門檻。
- per-case lint 必須對新生成 v1 綠燈才出，否則降級/重產。

---

## 7. 下一步（新 session 從這裡接）

1. 轉 implementation plan（superpowers:writing-plans），TDD：sanitizer fixtures 先行。
2. 刀序建議：sanitizer + fixtures → reference 投影 → per-case lint 約束 → persona 注入 → triage 兩小改 → 航班預設 → 兩張表。
3. branch `codex/line-oa-agent-mvp` as-is，不 merge/PR。
