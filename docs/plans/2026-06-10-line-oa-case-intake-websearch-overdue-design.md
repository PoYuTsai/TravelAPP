# LINE Agent 三方向設計 — 客需三分流／web search／OA 超時提醒

> 日期：2026-06-10 · branch `codex/line-oa-agent-mvp` · 狀態：design 已過 Eric 確認
>
> **實作進度（2026-06-10）**：§1 deterministic 刀已完成（commits `38c3dab` 刀1 核心三模組、`e7f47ef` 刀2 接線+CLI）。
> - 已上：三分流核心（`case-intake-triage`）、parser round-trip 閘（`customer-itinerary-roundtrip`，golden 7D6N 迴歸基準）、surfacing（`case-intake-surfacing`，觸發詞=客需/客人需求/整理需求/需求整理）、dispatcher 接線、`npm run agent:case-intake` dev harness。
> - 閘：`AI_AGENT_CASE_INTAKE_ENABLED=true` 才會觸發，**default off，尚未開**。
> - Spike 結論：`parseItineraryText` 對 golden 完美 round-trip；`parseBasicInfoText` 行首錨定吃不到 emoji header → 閘內前置剝 emoji，共用 parser 未動。
> - 已知 v1 瑕疵（deterministic extractor，未修）：日期摘要挑迄日、住宿地名誤入興趣清單。
>
> **實作進度（2026-06-11）**：§1 LLM enrichment 刀已完成（commit `ec9c3e7`）。
> - 已上：`case-intake-enrichment.ts`（純函式 guards：insufficient→問法潤飾走 coverage/format/leak 閘、sufficient→草稿閘鏈 schema→composer/lint→真 parser round-trip→leak、tricky 零 LLM）；`case-intake-llm-adapter.ts`（transport 注入無 SDK、cost cap 前 check 後 record、fixed-code error）；`createCaseIntakeResponder({enrichment})` + webhook 接線（與 base responder 共用 daily cost cap）；CLI 三閘（`AI_AGENT_CASE_INTAKE_LLM_ENABLED` + `AI_AGENT_CASE_INTAKE_LLM_RUNTIME=real` + `ANTHROPIC_API_KEY`）。
> - 閘：webhook 路徑 `AI_AGENT_CASE_INTAKE_LLM_ENABLED=true` 每次 respond 重讀，**default off，尚未開**；潤飾問句只能替換模板編號區，骨架（缺項行/已知行/Eric boundary）永遠 deterministic。
> - 模型：Haiku default（`AI_AGENT_CASE_INTAKE_LLM_MODEL` 可換）；問句 1024 tokens、草稿 2048。
>
> **實作進度（2026-06-11）**：§3 刀1 已完成（commit `691e360`）。
> - 已上：`AgentCase` 新欄位 handledAt/handledBy/reminderCount/lastReminderAt（handled 是 derived：`handledAt >= lastCustomerMessageAt`，客人再發訊息自動失效＋reducer 把 reminderCount 歸零）；reducer event `case_handled`；`overdue-reminder.ts` 純函式狀態機（門檻預設 2h、單案上限 3 次、瀏覽寒暄/terminal/idle 不催）＋dry-run 報告；群內 `@bot done <caseId>`（B1 tagged 路徑、router `mark_handled`、send gate 放行 ack）；CLI `agent:overdue-dry-run`（read-only）/`agent:case-done`（同 handler）。
> - 邊界守住：dry-run 永不主動送出、ack 回覆只回夥伴群、OA 客人訊息結構上進不了 done 路徑。
> - 未做：§3 刀2（cron 真推＋安靜時段＋每日上限，需 Eric 批 standing send intent）、§1 real smoke（夥伴群實測）、§2 web search。
>
> **實作進度（2026-06-11）**：圖片刀A＋刀B 已完成（commits `10b33f9` 刀A、`2f0ce93` 刀B）。
> - 背景：正式群實測 Chun 傳客人對話截圖 @bot → bot 讀不到，且先前亂承諾「可以上傳圖片給我」＝誠實性漏洞（同台北夜市/web_search 類型）。
> - 刀A：system prompt 圖片誠實條款（明說讀不到圖片、請貼客人文字）＋tripwire 雙向鎖（`not.toContain('上傳圖片給我')`）。
> - 刀B：「@bot 讀取這張圖」（Eric 拍板：夥伴零學習成本）→ `content-client`（**api-data.line.me**，host 與 api.line.me 不同）→ `vision-intake-adapter`（Haiku 看截圖抽客人文字；checkBudget→打→recordSpend、fixed-code、誠實抽取 prompt 不腦補）→ `triageCaseIntake` 三分流（與 §1 直接接軌）。
> - 「這張圖」解析：引用圖片優先 → 群內最近一張（webhook 記 `putPartnerGroupImageMsg`，30 分鐘 freshness 窗由讀取端判斷、KV TTL 當 GC、舊 timestamp 永不回退）。
> - 閘：M3-0 ocr tool-gate **第一個真消費者** — `AI_AGENT_OCR_ENABLED=true` ＋ `AI_AGENT_TOOL_COST_CAP_USD>0` 雙閘，**default off，尚未開**；與 enrichment 共用同一個 daily cost cap。模型 `AI_AGENT_VISION_INTAKE_MODEL`（default Haiku）。
> - dispatch 順序：quoted_draft → vision_intake → case_intake → rag → base（「客需 讀取這張圖」走 vision，抽完文字本來就進三分流）。
> - fail-closed：找不到圖／content 404／vision 失敗 → 固定誠實回覆；store 壞掉視同沒圖；OA 永不入 vision 路徑。測試 1477 全綠（本刀 ~60 新測）。
> 核心修正（兩次踩到同一個盲點）：**操作者是夥伴，不是 Eric**。客服／排行程／報價／銷售已外包給夥伴；任何要 Eric 動手輸入的形態（CLI 產品化）都是把工作收回來，一律否決。CLI 只能當 CC 的開發驗證 harness。
>
> **實作進度（2026-06-11 深夜，真機煙測後兩刀）**：
> - **case-triage 三 bug 修復**（commit `020a518`）：煙測截圖揪出 ①「30-50分鐘」誤當日期（修法：月日合理性＋尾隨單位 guard）②「2人」裸人數不認（新增 `partySize` 欄位，「10人座」「10-15人」不誤取）③ 含「住宿」字即當已知（改逐句判斷，問句／還沒訂／求推薦不算）。煙測場景入 fixture `case-triage-extraction.test.ts`。
> - **圖片刀B 觸發改版**（commit `b8d72bf`）：Eric 拍板「引用圖＋tag 即觸發、去關鍵詞」。觸發詞 lexicon 與「最近一張圖」30 分鐘窗 fallback 除役；store 改 per-message image marker（`isPartnerGroupImageMsg`，KV TTL 7 天對齊 bot-authored marker）；`quotedImage` 沿 `quotedBotContent` 同路徑線入 respondInput。引用非圖訊息／marker 過期／store 壞 → 一律不觸發（fail-closed），base 刀A 誠實條款收尾。
> - **RAG 加 2027**（commit `0d29c8e`）：`private_2027`/`team_2027` 來源＋env keys；排序鎖定 private_2026 > private_2025 > private_2027 > team_2026 > team_2027（2025 已發生實績 > 2027 未來預訂；private 永遠壓過 team）。

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
