# M3-0 — External Tool / Billing Gate Contract

**Date:** 2026-06-05
**Branch:** `codex/line-oa-agent-mvp`
**Feature commit:** `d018ca4`
**Scope:** Pure policy + config for high-cost external tools. No real provider wired.

## Goal

Lock the hard gate for high-cost tools (web search, OCR, Notion RAG) **before**
any provider is integrated, so billing risk and the customer-no-auto-reply rule
are enforced by a deterministic last-word function — not by hope.

## What this slice does / does NOT do

Does:
- `src/lib/line-agent/tools/tool-config.ts` — parse env into a typed policy.
  Every tool defaults OFF; a cost cap (USD) defaults to 0 (no budget).
- `src/lib/line-agent/tools/tool-gate.ts` — `canUseExternalTool(request, config)`,
  a pure synchronous `PermissionResult` gate (mirrors `permissions.ts`).
- `src/lib/line-agent/__tests__/tool-gate.test.ts` — 8 RED-first tests.

Does NOT (explicitly out of scope this slice):
- No real web search / OCR / Notion RAG provider call.
- No webhook / router / send gate / Sanity write changes.
- No production env enabled.

## The three invariants pinned

1. **Default OFF.** Absent env → tool denied, with an operator-readable
   `billing/tool gate disabled` reason. A flag is ON only when env is exactly
   `"true"` (`"1"`, `"yes"`, empty → OFF). Billing-safe default = do not run.
2. **OA plane never.** `line_oa` is denied even when the env gate is enabled and
   the proposed intent is web_search — the reason names the customer plane, not
   billing. This is the billing + customer-no-auto-reply double insurance.
3. **Partner-group AND-gate.** Allow only when ALL hold: source is
   `line_partner_group`, the tool is env-enabled, `botDirected` is true, the user
   explicitly requested external/realtime data, and `costSpentUsd < costCapUsd`.
   Flipping any single condition → denied, each with its own specific reason.

Decision order is "first failing check wins" so the returned reason is always the
most specific applicable defense. Any source other than `line_oa` /
`line_partner_group` is denied by default (safe-by-default).

## Env interface (see `.env.example`)

- `AI_AGENT_WEB_SEARCH_ENABLED` (default `false`)
- `AI_AGENT_OCR_ENABLED` (default `false`)
- `AI_AGENT_NOTION_RAG_ENABLED` (default `false`)
- `AI_AGENT_TOOL_COST_CAP_USD` (default `0` — no budget until set)

## Verification

- `npm run test:run -- src/lib/line-agent` → 40 files / 533 tests green
  (was 525; +8 from this slice).

## Next (not started)

- Wire a real web-search provider behind this gate (still Preview-only first).
- Per-turn cost accounting to populate `costSpentUsd`.
- Neither starts before Eric approves enabling the env gate on Preview.
