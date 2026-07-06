# Tough QA 外部佐證刀 — web search evidence design

> 日期：2026-06-13 · branch `codex/line-oa-agent-mvp` · 狀態：design 已過 Eric 確認（四段逐段 OK）
>
> 一句話：夥伴群 tag bot 的實質問題（文字或客人對話截圖），bot 讀懂語義後自動 web search
> 找外部佐證，貼回「結論＋來源連結＋待導遊確認」——讓 Eric 問導遊前先有底。
> Eric 拍板：billing 可接受；搜尋優先給 Google 式的公開網頁佐證。

## 0. 政策變更（supersede 2026-06-10 設計 §2）

正式推翻兩條舊規，其餘原則全保留：

1. ~~「web search 只做 operator 明示指令工具，不進自動路徑」~~ →
   **tag 即授權**：tag bot（或引用 bot）本身就是 explicit intent；LLM 讀懂語義、
   判定是實質問題就必須搜。夥伴零學習成本，不需要「查證」之類關鍵詞。
   背景：目前 Notion RAG 大多是排好的行程，五花八門的 tough QA 絕對檢索不到
   （Eric 原話），等 RAG miss 再搜沒有意義。
2. ~~tool-gate 第 5 關「用戶必須明說要查外部資料」~~ → 對 `web_search` 改為
   botDirected＝已授權。**OCR／notion_rag 的第 5 關不動。**

保留不變：

- OA 客人面（line_oa）永遠 deny，任何 env 都救不回來。
- 僅夥伴群可授權外部工具；env 閘 default off；daily cost cap fail-closed。
- 內部知識（沉澱 QA）永遠優先注入，web 結果只佐證不覆蓋。
- 誠實條款：搜不到就明說，絕不腦補來源。

vendor：Anthropic 原生 `web_search` server tool — 同一個 Messages API call 內完成，
不引新服務不加 key，自帶 citation（標題＋URL），$10/千次搜尋＋tokens，
現有 daily cost cap 直接涵蓋。注意：搜尋後端是 Anthropic 的，不是字面 Google；
驗收若品質不足再考慮 SerpAPI（YAGNI，本刀不做）。

## 1. 架構接線（文字路）

改動集中三檔：

1. **`tools/tool-gate.ts`** — web_search 分支移除第 5 關（`userRequestedExternalData`）。
   四關放行：partner group ＋ botDirected ＋ `AI_AGENT_WEB_SEARCH_ENABLED=true` ＋ cost cap 未滿。
2. **`partner-group/anthropic-responder.ts`** —
   - deps 新增 `webSearchEnabled: boolean`（factory 判定後注入；responder 不讀 env 鐵律不破）。
   - 開閘時 body 加 `tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]`。
   - 回應解析升級：content 多 block（`server_tool_use` → `web_search_tool_result` →
     帶 citations 的 text）→ 串接所有 text block，citations 抽 1–3 個來源 URL 附文末。
   - 計費補項：`usage.server_tool_use.web_search_requests × $0.01` 加進 recordSpend。
3. **`partner-group/system-prompt.ts`** — 開閘時注入搜證條款：實質問題必搜；
   回覆格式「結論 → 來源 → 網路資料供參考，重要細節建議再與導遊確認」；
   內部案例優先、web 只佐證；搜無結果誠實說。

fail 行為：search 任何錯誤＝既有 degraded 路徑（stub），永不 500 webhook。
閘關時 request body 必須 byte-identical 於現行（每把刀的 default-off 驗法）。

## 2. 截圖路（一條龍）

觸發：tag bot（或引用 bot）＋（引用一張圖 或 群內 30 分鐘內最近一張圖，
重用刀B `putPartnerGroupImageMsg` 與 freshness 窗）→ 零關鍵詞自動串：

```
tag＋圖 → OCR 閘（AI_AGENT_OCR_ENABLED）→ content-client 抓圖（api-data.line.me）
       → vision-intake-adapter（Haiku 誠實抽取客人問題）
       → 抽出文字＋夥伴附言 合併餵 partner-respond（知識注入＋web search）
       → 一則回覆貼群
```

與刀B差別只在最後一步：抽完字改餵回答路徑，不再只走 triage 呈報。
原「@bot 讀取這張圖」關鍵詞指令保留不動（純抽字場合用）。

邊界：圖抽不出問題 → 誠實回「讀不到圖內問題，請直接貼文字」，不搜不花錢；
兩次 LLM call（Haiku 看圖＋responder 搜證）都過同一 daily cost cap，cap 到整條龍熄火。

## 3. 刀序與驗收

| 刀 | 內容 | 驗法 |
|---|------|------|
| 刀1 | tool-gate 第5關移除（僅 web_search）＋responder 掛 tool＋多 block 解析＋搜尋費記帳 | 單元測試：閘關 body byte-identical；開閘含 tools；citations 抽 URL |
| 刀2 | system prompt 搜證條款＋回覆格式 | tripwire：條款只在開閘時出現 |
| 刀3 | CLI 黑箱驗收 `agent:partner-respond` 真打 | tough 題（如「清邁11月天燈節確切日期」）：關閘→誠實不知道；開閘→日期＋來源 URL |
| 刀4 | 截圖一條龍（vision → respond 接線） | CLI 餵測試截圖走全程 |

啟用：CLI 驗收過 → Vercel preview 補 `AI_AGENT_WEB_SEARCH_ENABLED=true` → redeploy
→ 等真群 tough case（同檢索閉環刀流程）。

成本：每題上限 3 次搜尋 ≈ $0.03＋tokens ≈ 單題 < $0.10，現有 cap 不用調。

## 4. 明確不做（YAGNI）

- 字面 Google／SerpAPI（驗收不夠好再說）。
- OA 客人面任何搜尋（永遠 deny）。
- 搜尋結果自動寫回 Notion 知識庫（沉澱刀職責，等 Eric 按「沉澱」才入庫）。
