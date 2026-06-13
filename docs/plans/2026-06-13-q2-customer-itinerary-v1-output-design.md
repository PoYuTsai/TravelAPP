# Q2 排行程輸出改為 customer_itinerary_v1（報價器可解析）設計

> 2026-06-13 · branch `codex/line-oa-agent-mvp` · 定案：**Option B**（persona 直吐 v1 ＋ tripwire）
> 議題不擋上線（web search 已開閘上真群 preview）

## 問題

partner persona 被要求排行程時（system-prompt.ts:30）輸出**自由 markdown 散文**，
報價器（`src/lib/itinerary/parser`）解析不了。需改為輸出 `customer_itinerary_v1` 格式，
golden = `customer-itinerary-golden.ts` 李家 7D6N。

## 既有資產（已造好、未接線）

- `composeCustomerItineraryDraft`（notion/customer-itinerary-composer.ts）：結構輸入→渲染 v1→lint→fail-closed
- `checkCustomerItineraryRoundTrip`（notion/customer-itinerary-roundtrip.ts）：餵回**真 parser** round-trip
- `lintCustomerItinerary`（notion/customer-itinerary-lint.ts）：v1 格式／結構／禁詞規則
- 三者只活在 `notion/` 與 `__tests__`，**未接進 partner responder 流**。anthropic-responder 直接回 LLM 原文。

## 為何 B 而非 A

- A（路由到 composeCustomerItineraryDraft）需從鬆散夥伴對話抽出**完整** `constraints`（行動力／航班／住宿政策）＋每日結構欄位才能 lint，抽取脆、且砍掉剛拍板的「標假設＋文末問修正」persona UX（75efd83）。
- 報價器消費的合約是 v1 **文字**；round-trip 閘已 deterministic 證明「文字→parser」可通，與 persona 無關。
- **關鍵可行性**：`lintCustomerItinerary` 只有 `days`＋`customerVersion` 是必要 constraints，其餘全被 `if (constraints.X)` 守著，缺了不觸發那條 → B 不需結構抽取也能跑「格式／結構／禁詞」這組與 case profile 無關的規則。

## 設計

### ① tripwire 閘 `gateCustomerItineraryDraft(draftText)`（新檔 notion/）
1. 從草稿推導 `days`（掃最大 `Day N` 標題）；推不出 → fail
2. `checkCustomerItineraryRoundTrip(draft, {days})` 必須 ok
3. `lintCustomerItinerary(draft, {days, customerVersion:true})` 不得有 `error` 級 issue（`warn` 放行）
4. 回 `{ ok, problems[] }`。Deterministic、零 LLM 信任。

### ② responder 接線＋降級（anthropic-responder）
intent=排行程草稿時，LLM 出 `finalText` 後：
- ok → 原樣回
- fail → **重產 1 次**（prompt 末尾追加 problems 要 LLM 修正）
- 再 fail → **降級**：回原文＋追加 ⚠️「此草稿格式未過自動檢查，報價器可能無法直接解析，請 Eric 確認」
- 真群永遠有回覆。

### ③ system-prompt 改寫＋假設註記相容（system-prompt.ts:30）
- 排行程時要求 persona 直接輸出 `customer_itinerary_v1` 格式（附 golden 形狀範本）
- 「標假設」放進**人數 header 自由文字**（golden 本身就有「需確認輪椅…」且 lint PASS）＋**結構區塊之後**再問「哪些要修正」
- TDD 驗 parser/lint 容忍 header 假設註記＋trailing 散文（不破 round-trip）
- system-prompt.test.ts byte-identical 凍結斷言一併更新；補 tripwire 測試

## 失敗模式 UX（拍板）
v1 草稿過不了 tripwire → 重產 1 次 → 再失敗降級為自由初稿＋註明未過檢。

## 驗收
- gate 對 golden 李家 7D6N PASS；對自由 markdown 散文 fail
- responder：模擬 LLM 吐壞格式 → 重產 → 降級路徑有 ⚠️ 註記
- system-prompt 含 v1 範本、凍結斷言更新、line-agent 測試全綠
