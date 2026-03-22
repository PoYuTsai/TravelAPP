# Claude Code Handoff - 2026-03-22 Phase 7

## 目前狀態

這一輪沒有開始寫 Phase 7 功能碼，先把規格補到可安全實作的程度，並且另外拆出真正可執行的 implementation plan。

目前建議的閱讀順序：

1. `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md`
2. `docs/plans/2026-03-22-phase7-line-oa-ai-assistant-implementation-plan.md`
3. `docs/plans/2026-03-22-phase7-line-oa-ai-assistant-review.md`

## 這次已完成

### 1. 主規格已升級成可實作版本

原本的 Phase 7 spec 已補完這幾塊：

- webhook fast-ack + async processor 架構
- LINE event / Telegram action 的 idempotency 規則
- 對話狀態機
- draft lifecycle
- 舊客識別分層：`lineUserId` 主識別 + Notion confidence hint
- 資料生命週期：48h cold、7d archive、30d prune、manual delete
- 測試策略
- code review / rollout gate

### 2. Implementation plan 已建立

已新增一份真正可執行的實作計畫：

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant-implementation-plan.md`

這份 plan 已經把工作拆成 9 個主要 task，包含：

- config / dependency / store abstraction
- conversation domain model
- LINE webhook ingestion
- async processor + Telegram topic mapping
- inquiry extraction + Notion hint
- draft generation
- Telegram callback + safe outbound send
- housekeeping / daily summary / weekly report
- Sanity schemas / migration / rollout checklist

## 實作時不可退讓的設計決策

1. `/api/line-webhook` 不能直接做完整 AI 流程，只能 fast-ack
2. replay protection 不能只靠 in-memory rate limit
3. Topic mapping 只能靠 `lineUserId -> tgTopicId`，不能靠標題字串
4. Notion matching 只能是 hint，不是 identity truth
5. draft 必須可被 `superseded`，避免客人新訊息來了還送舊草稿
6. 所有 outbound LINE send 都要有 audit log
7. Prompt 更新只能人工批准，不能自動套用

## 和現有 codebase 的銜接提醒

### 已知相容點

- 現有 auth / token / logging pattern 可以參考：
  - `src/app/api/auth/session/route.ts`
  - `src/lib/api-auth.ts`
  - `src/lib/logger.ts`

### 已知差異點

- Phase 7 spec 現在統一改成沿用 `NOTION_TOKEN`
- 舊 spec 的 `NOTION_API_TOKEN` 已不建議採用
- 若後續要把既有 Notion 年度 DB mapping 從 code 移到 env，可用：
  - `NOTION_CUSTOMER_DATABASE_IDS_JSON`

## 測試期待

實作時至少要補：

- signature / callback / reducer / draft lifecycle 單元測試
- line webhook / telegram callback 整合測試
- housekeeping / weekly report 測試
- build / lint / full test run

## Code Review 期待

即使功能做完，也要至少過這幾關：

1. Security
2. Data governance
3. Prompt / tone
4. Failure modes
5. Quota / cost
6. Limited pilot rollout

## 這次沒有做的事

- 沒有開始實作 `/api/line-webhook`
- 沒有新增任何 npm dependency
- 沒有改 Sanity schema
- 沒有改 public frontend

## 建議下一步

直接照 implementation plan 的 Task 1 開始做，不要跳過 domain model / storage abstraction，否則 route 很快會失控變大。
