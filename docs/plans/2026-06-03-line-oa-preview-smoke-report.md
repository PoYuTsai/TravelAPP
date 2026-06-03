# LINE OA Agent MVP — Preview / Real-Env-Shape Smoke Report

- **Date:** 2026-06-03
- **Branch / tip:** `codex/line-oa-agent-mvp` @ `9682c9b`
- **Goal:** Verify the MVP works in deployed-preview / real env shape *before* opening the Sanity write-token gate.
- **Scope honored:** parser untouched, Sanity schema untouched, no write token added, no formal quote write implemented. Inspection + tests only.

## Verdict

| # | Smoke item | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Vercel preview build passes | ⛔ **BLOCKED** | Vercel CLI not authenticated in this session (`No existing credentials found`). Cannot trigger/inspect a preview deploy here. |
| 2 | Required env vars documented/checked | ✅ **PASS** | Cross-checked code `process.env.*` usage against `.env.example` (table below). |
| 3 | `/api/line/webhook` behavior | ✅ **PASS (contract)** | `line-webhook-route.test.ts` 8/8. |
| 4 | `/api/agent/commands` dry-run + auth | ✅ **PASS (contract)** | `agent-commands-route.test.ts` 5/5, `create-quote.test.ts` 8/8, `quote-url.test.ts` 8/8. |
| 5 | No Sanity client import on dry-run path | ✅ **PASS** | grep + read of `quote/` (below). |
| 6 | Smoke report produced | ✅ this file | — |

**Test evidence (fresh, this session):** `npm run test:run` over the four targeted files → **29/29 passed** (`quote-url` 8, `create-quote` 8, `agent-commands-route` 5, `line-webhook-route` 8), duration 5.03s.

> "Contract" = verified at the unit/integration-test layer against the real route handlers, not against a live deployed URL. The deployed-env smoke (live HTTP calls) is gated on item 1 (Vercel auth) — see Blockers.

## Item 2 — Env var requirements

Derived from actual `process.env.*` reads in `src/lib/line-agent` + `src/app/api` (not just `.env.example`).

| Env var | Read by code? | Where | Needed for MVP? |
|---------|---------------|-------|-----------------|
| `LINE_CHANNEL_SECRET` | ✅ | `api/line/webhook/route.ts:66` (HMAC verify) | **Required** |
| `LINE_PARTNER_GROUP_ID` | ✅ | `api/line/webhook/route.ts:83` (group filter) | **Required** |
| `AI_AGENT_INTERNAL_SECRET` | ✅ | `api/agent/commands/route.ts:38` (auth) | **Required** |
| `AGENT_KV_URL` / `AGENT_KV_TOKEN` | ✅ | `storage/kv-store.ts`, `storage/select-store.ts` | **Required in prod** (prod fail-closed throws if missing) |
| `NOTION_TEAM_2026_DATABASE_ID` | ✅ | `notion/team-collaboration.ts:238` | **Required** for Phase B Notion read path |
| `LINE_CHANNEL_ACCESS_TOKEN` | ❌ **not read anywhere** | — | **Not used yet** — there is no outbound LINE push path. Consistent with the no-customer-auto-reply boundary. Keep documented for a future reply phase. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | ❌ not read in line-agent/api | — | **Not wired yet** — no model call on the current dry-run path. Not needed for this smoke. |

Action for Vercel preview: set the five **Required** vars (`LINE_CHANNEL_SECRET`, `LINE_PARTNER_GROUP_ID`, `AI_AGENT_INTERNAL_SECRET`, `AGENT_KV_URL`, `AGENT_KV_TOKEN`, plus `NOTION_TEAM_2026_DATABASE_ID` if exercising the Notion read path) in the Vercel project env before live smoke.

## Item 3 — `/api/line/webhook` (contract verified)

- Invalid signature → **401**, no routing. (`line-webhook-route.test.ts:109`)
- Valid normalized OA event → routing handler invoked and **awaited before the 200 resolves** (no fire-and-forget). (`:120`)
- Non-actionable `room` source → **200 skip**, no routing. (`:184`) Wrong/other group is rejected fail-closed by the normalizer (covered in normalize-layer tests; only the partner group + 1:1 user pass).
- Persist failure → 500 so LINE retries (durable buffer); benign non-persistence error → still 200. (`:166`)
- **No customer auto-reply:** structurally guaranteed — `LINE_CHANNEL_ACCESS_TOKEN` is never read; no outbound push/reply code path exists.
- **Dedupe** (`processedMessageIds`, FIFO 200) is enforced at the router/reducer layer (separate tests), not the route handler.

## Item 4 — `/api/agent/commands` (contract verified)

- Missing/invalid `x-agent-secret` → **401**. (`agent-commands-route.test.ts:55`)
- Valid create_quote with no sendTarget → `action: 'draft'`. (`:70`)
- Dry-run quote contract (`create-quote.test.ts`):
  - `blocked` → `draft`, `wouldBeUrl`, `writeResult` all **null**. (`:76`)
  - `ok` / `needs_human_check` → draft built; `wouldBeUrl.isOfficial === false`, reason `no_sanity_document_written`. (`:110`, `:147`)
  - slug always `DRAFT-<caseId>` → e.g. `DRAFT-CW-0601-001`, URL `/quote/DRAFT-CW-0601-001`. (`:144`)
  - dry-run writer **never** reports `written:true`. (`:164`, `:175`)
  - dependency throws → `status:'error'` with raw input preserved. (`:198`)

## Item 5 — No Sanity client on dry-run path

`grep` over `src/lib/line-agent/quote/` finds only: the string literal `'no_sanity_document_written'`, the local module name `sanity-write.ts`, and `create-quote.ts` importing from `./sanity-write` (the local stub). **No `@sanity/*`, `next-sanity`, or `createClient` import.** `sanity-write.ts` is contract-only: `dryRunQuoteWriter.write()` returns `{written:false}`; `liveQuoteWriter.write()` throws (inert placeholder, not wired).

## Blockers (require Eric / next session)

1. **Vercel preview deploy + live HTTP smoke not run** — this session's Vercel CLI is unauthenticated. To finish item 1 and live items 3/4:
   - Eric runs `vercel login` (interactive) in tmux, **or** check the Vercel dashboard — branch `9682c9b` is already pushed to `origin`, so the Git-integration preview for `travel-app` (project `prj_KyEb…`) may already be built.
   - Then set the Required env vars (above) for the Preview scope and re-run live curl smoke against the preview URL.
   - Local `next build` is **not** a valid substitute here — the OneDrive+WSL tree hits the known RSC-manifest prerender bug; the real build gate is Vercel.

## Bottom line

Code-level contracts for the webhook, the command auth boundary, the dry-run quote flow, and the no-Sanity-import / no-auto-reply boundaries all **pass**. The only unverified piece is the **deployed preview build + live HTTP smoke**, blocked solely on Vercel auth. No code changes were made or needed; the write-token gate remains closed.
