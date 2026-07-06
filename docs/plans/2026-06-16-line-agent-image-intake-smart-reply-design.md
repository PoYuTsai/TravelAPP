# LINE OA Agent — 截圖智慧回覆設計（image intake → smart reply）

> 狀態：brainstorm 定案（2026-06-16），待下個 session 進 writing-plans / 實作
> 分支：`codex/line-oa-agent-mvp`（branch as-is，暫不 merge/PR）
> 前情：本設計取代「圖→排行程」窄版理解，升級為「圖→看懂任何開放問題→自主查資料→回覆」。

## 1. 背景與現況斷點

日常情境：Eric/夥伴**截一張客人需求或提問的圖**，貼進夥伴群、tag bot，期望 bot 讀懂後**直接回一段可用內容**。

實測（2026-06-16）確認三段零件都能動、但**中間沒接起來**：

- **看懂圖**：vision adapter 存在（`claude-haiku-4-5`），但 prompt 是「只轉錄截圖文字」＝抄字，不理解語義。`AI_AGENT_OCR_ENABLED` 預設關。
- **翻舊案例（RAG）**：`itineraryReferenceSource` 能撈 92 筆真 Notion（實測 family+大象 命中 5/92、信心 high）。
- **寫內容（LLM）**：anthropic-responder 能寫完整逐日行程；web_search 工具已內建（每題上限 3 次），由 `AI_AGENT_WEB_SEARCH_ENABLED` + `AI_AGENT_TOOL_COST_CAP_USD` 控。

**斷點**：
1. `responder-factory.ts:207-217` — 圖一進來就 early-return 給 deterministic triage，永遠到不了 RAG / web / LLM 寫手。
2. `vision-intake-adapter.ts` — prompt 只轉錄，不抽語義 need。
3. `anthropic-responder.ts:172` — RAG 只在 `intent.action==='draft'` 觸發；CLI `partner-respond` 還根本沒把 `itineraryReferenceSource` 傳進去（所以實測那份漂亮行程是 LLM 憑空想的，出現「象園混溫泉」錯）。

## 2. 目標

讓 AI agent 真的當「智慧 LLM 客服助手」：看懂截圖裡的開放式問題（複雜度不一）→ **自主判斷**要查自家案例（RAG）、上網查（web search）、或都不查 → 自我判讀整理 → 回貼夥伴群。RAG/排行程只是其中一種能力，不是全部。

## 3. 六項定案（brainstorm）

| # | 決策 | 選定 |
|---|------|------|
| 1 | 入口 | 貼圖 + tag bot（沿用 webhook 現路） |
| 2 | 看懂圖 | vision 從「轉錄」升級成「語義理解」，抽結構化 need/問題＋標缺漏 |
| 3 | 範圍 | 通用智慧回覆，不限排行程；多數開放問題以 web search 為主 |
| 4 | 工具驅動 | **LLM 自主選** RAG / web_search / 兩者 / 皆不。不寫死規則 |
| 5 | 輸出格式 | 兩段：①乾淨對外、可直接複製給客人（無 LLM 贅述）②內部佐證/待確認（只列真缺、可省） |
| 6 | 出口 | 直接回夥伴群（tag = 送出意圖）；bot 絕不自動回客人 OA |

不全 / 信心低時（沿用 #5）：照出 best-effort 內容，缺的放第二段「待確認」，**只列真的缺**（不要複問圖裡已有的）。

## 4. 資料流

```
webhook image + tag
  └→ vision-intake responder
       ① vision adapter：圖 → 語義理解
            output = {需求/問題摘要, 結構化欄位(dates/party/kids/prefs…), 缺漏[]}
       ② 交給 anthropic-responder，掛兩個工具：
            - itineraryReferenceSource（RAG，翻 92 筆 Notion）
            - web_search（公開網路，≤3 次/題）
          LLM 自主決定呼叫哪個 / 都呼叫 / 都不呼叫
       ③ LLM 產兩段輸出（見 §5）
  └→ 貼回夥伴群
```

## 5. 輸出格式

- **第一段（對外）**：乾淨、可直接複製給客人。無「我幫你整理」「以上若需修正」這類 meta 贅述。
- **第二段（內部、可省）**：
  - 哪些內容 **有案例佐證**（RAG）vs **網路查的（標「網路資料・待確認」）** vs **LLM 補充**
  - **待確認項**：只列圖裡真的沒提到的（如航班/住宿/上車點）

## 6. 護欄

- 成本：沿用 `AI_AGENT_TOOL_COST_CAP_USD` / `AI_AGENT_DAILY_COST_CAP_USD`（cost cap 未設＝靜默 disabled，不可當過關）。
- 可信度分層：RAG（你的真案例）優先當主幹；web 補不足且必標「待確認」。
- Boundary：bot 只回夥伴群；客人 OA 永不自動回（CLAUDE.md Operating Boundaries）。

## 7. 要焊的點（實作清單，下個 session）

1. `vision-intake-adapter.ts`：prompt 改語義抽 need + 標缺漏（保留純轉錄為 fallback？待定）。
2. `responder-factory.ts:207-217`：圖路抽完 need 後，改接進 anthropic-responder（掛 RAG + web_search 工具），不再 early-return 給 triage。
3. `anthropic-responder.ts`：讓圖路也能觸發工具（不綁死 `action==='draft'`）；確實把 `itineraryReferenceSource` 注進 prompt；輸出兩段格式。
4. 閘：開 `AI_AGENT_OCR_ENABLED`、`AI_AGENT_WEB_SEARCH_ENABLED`（＋ tool cost cap）；preview 與 deploy scope 都要設。

## 8. 測試

- 驗收人：Eric 看「圖 vs bot 回的內容」主觀判斷品質（這張 思思 case：7/1-7/5、4大2小、4&6歲、大象/玩水/動物/美食）。
- TDD：vision 語義抽取（fixture 圖→need）、工具路由（給定 need → 是否合理選 RAG/web）、兩段輸出格式、gate-off byte-identical。
- 黑箱：CLI 補一支能掛 RAG+web 的 image→reply 驗收入口（現有 `partner-respond` 沒接 itineraryReferenceSource，需補）。

## 9. Open items / 技術債

- ✅ vision 抽 need 的 schema 細節（欄位、缺漏判定）→ **定案**：`VisionNeedBrief { isConversation, summary, knownFacts[], gaps[] }`，fail-closed parse（壞 JSON ⇒ 原文當 summary）。見 `vision-need-extraction.ts`。
- ✅ 「對外段」如何確保零贅述（system prompt 規範 or 後處理）→ **定案**：以 system prompt 規範為主（`SMART_REPLY_SYSTEM_PROMPT`），後處理 `ensureTwoSegments` 只驗格式存在、不重寫內容。
- web search 來源品質/競品過濾規則 → 待定（沿用 Anthropic web_search server tool 預設，尚未加競品過濾）。
- 開放問題太發散時的 fallback（連 web 都答不好）→ 待定（目前靠 system prompt「不腦補」+ 兩段「待確認」標註）。
- vision triage dead-end responder（`createVisionIntakeResponder`）已於實作 Phase 7 移除；轉錄層 adapter（`createAnthropicVisionIntakeSource`）保留供 need 抽取與 transcript OCR 複用。

## 10. 實作狀態（2026-06-16）

**程式完工，待 Eric 開閘真群驗收。** 對應實作計畫 `2026-06-16-line-agent-image-smart-reply-implementation-plan.md`，Phase 1–7 全數完成（subagent-driven + 兩段 review）：圖 → 語義抽 need → agentic tool_use 迴圈（RAG client tool + web server tool，雙 cost-cap fail-closed）→ 兩段輸出 → composition root 接線（受三閘控，gate-off byte-identical）→ CLI 黑箱入口 `agent:partner-image-respond`。全套測試綠、lint 乾淨、型別零新錯。開閘步驟（flip `AI_AGENT_OCR/WEB_SEARCH/NOTION_RAG_ENABLED` + 兩個 cost cap）需 Eric 親自操作 `.env.local`。
