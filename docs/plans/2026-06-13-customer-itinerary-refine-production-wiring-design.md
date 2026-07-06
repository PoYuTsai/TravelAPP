# Customer Itinerary Refine — Production Wiring Design

> 日期：2026-06-13 · branch `codex/line-oa-agent-mvp` · 狀態：設計定稿，待 writing-plans → TDD

## 問題

`refineCustomerItineraryDraft` + 三道 deterministic guard（lint / structuralDiff / leak）
與真實 LLM adapter（`llm-refine-adapter.ts`，primary Haiku + rescue Sonnet）早已完成，
但 **production 零呼叫**——只有 offline `agent:refine-smoke` CLI 可達。本刀把它接進真實
LINE 路徑，讓「正式行程輸出」這件交付物在**事實逐字鎖死**的前提下被 LLM 暖化措辭。

## 戰略前提（brainstorming 結論）

- refine 的 `structuralDiffGuard` 是**逐字 diff**，需要一份 deterministic draft + `constraints`
  當事實基準。production 只有 **客需三分流 sufficient→draft**（`case-intake-enrichment.ts`）
  這條同時產出 `composed.draft` + `plan.constraints`，persona 直吐 v1 那條沒有基準可 diff。
- 「正式行程是要變報價的交付物，事實不能漂移」→ Eric 拍板走 **composer + refine**（事實鎖死優先），
  接受多一次 LLM 潤飾呼叫換事實保證。persona 留給 Q&A / tough / web_search 對話，兩者互斥不打架。
- **範圍＝窄**：只把 refine 接進現有 sufficient→draft seam。把「出正式行程」從 persona 改路由、
  以及累積跨訊息狀態，是另一個 feature，不在本刀。

## 接點（唯一）

`case-intake-enrichment.ts` 的 sufficient→draft 分支（現 line ~400），於 leak 閘通過後：

```
composer → roundtrip 閘 → leak 閘            (現況，全過才到這)
  → [新] sources.refineSource 有注入？
       是 → refineCustomerItineraryDraft({ deterministicDraft: composed.draft,
                                           constraints, source, rescueSource })
            ├ 三 guard 全過 → 採用 result.draft（暖化版）
            └ 任何 tier 失敗 / 超 cost cap → harness 自身 fail-closed 退 composed.draft
       否 → 用 composed.draft（byte-identical 現況）
  → renderDraftReply(採用的 draft)
```

`refineCustomerItineraryDraft` 本身已 fail-closed（source throw / 空輸出 / guard 打回 →
回 deterministicDraft），所以接線層不需再兜錯。

## 接線方式（沿用既有 optional-source 慣例）

- `CaseIntakeEnrichmentSources` 加 optional `refineSource?: RefineDraftSource` +
  `rescueRefineSource?: RefineDraftSource`。
- gate `AI_AGENT_CASE_INTAKE_REFINE_ENABLED`（exactly `"true"`，default off），由
  **composition root（webhook-runtime）** 判定：關 → 不注入 refineSource →
  `enrichCaseIntakeReply` 走原路 → 與本刀落地前 **byte-identical**。
- `enrichCaseIntakeReply`：`if (sources.refineSource)` 才跑 refine，採用 `result.draft`；
  否則維持 `composed.draft`。決策邏輯留在 enrichment 模組，env 判定留在 composition root
  （照 `knowledgeSource` / `webSearchEnabled` 的慣例，模組不讀 env）。

## 硬邊界

1. **cost cap**：refineSource 的 `callModel`（`.mjs` loader 內）包一層 daily-cost-cap——
   超預算 throw，被 `attemptTier` 接成 `source_error` → 退 deterministic。primary 與 rescue
   兩次呼叫**各自**受 cap。fail-closed 零風險，因為 deterministic draft 本來就是安全交付物。
2. **不洩漏內部欄位**：已由設計保證，本刀**不需再加**——
   `buildRefinePrompt` 結構上只吃 draft string（不收任何結構物，operatorNotes /
   retrievalApplications / provenance / themeTag / constraints 進不了 prompt）；
   輸入 `scanRefinePromptLeak` tripwire；輸出 `scanCustomerForbiddenTerms`（三 guard 之一）。
3. **gate default off**：關閘 = 不注入 = byte-identical，可暗著上線、真群再開。

## 觀測

`route_decision` log（case-intake-surfacing / enrichment 回傳）增：
`refine: 'refined' | 'deterministic'`、`tier: 'primary' | 'rescue' | null`、
masked `rejectionReasons`（結構碼為 fact 類別、本來就 mask-safe，永不含值/名/日期/金額）。

## 測試（TDD，全用既有 fixtures：`customer-refine-scenarios` / `refine-smoke-cases`）

1. refineSource 採用 → replyText 用暖化版。
2. refineSource 被 guard 打回 → 退 deterministic，與無 refine **byte-identical**。
3. refineSource 缺席（gate off）→ 與現況 **byte-identical**（regression 鎖）。
4. cost cap 超額 → refineSource throw → deterministic。
5. primary 打回、rescue 過 → 用 rescue 版。

## 明確排除（YAGNI）

- 「出正式行程」從 persona 改路由到 composer。
- 跨訊息累積客需狀態。
- 為 persona 直吐 v1 補 deterministic 基準（那條沒有基準，不在 refine 適用範圍）。
