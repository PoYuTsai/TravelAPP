# LINE OA Agent MVP — Preview / Real-Env-Shape Smoke Report

- **Date:** 2026-06-03
- **Branch:** `codex/line-oa-agent-mvp`
- **Goal:** Verify the MVP works in deployed-preview / real env shape *before* opening the Sanity write-token gate.
- **Scope honored:** parser untouched, Sanity schema untouched, no write token added, no formal quote write implemented. Inspection + tests only.

## Verdict

| # | Smoke item | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Vercel preview build passes | ✅ **PASS (live)** | Preview deploy succeeded: `https://travel-camxoix6t-poyutsais-projects.vercel.app`. |
| 2 | Required env vars documented/checked | ✅ **PASS** | Cross-checked code `process.env.*` usage against `.env.example` (table below). |
| 3 | `/api/line/webhook` behavior | ✅ **PASS (contract)** | `line-webhook-route.test.ts` 8/8. |
| 4 | `/api/agent/commands` dry-run + auth | ✅ **PASS (contract + live)** | Contract tests pass; live `vercel curl` smoke returns `MISSING_SECRET` without auth and `action:"draft"` with `AI_AGENT_INTERNAL_SECRET`. |
| 5 | No Sanity client import on dry-run path | ✅ **PASS** | grep + read of `quote/` (below). |
| 6 | Smoke report produced | ✅ this file | — |

**Test evidence (fresh, this session):** `npm run test:run` over the four targeted files → **29/29 passed** (`quote-url` 8, `create-quote` 8, `agent-commands-route` 5, `line-webhook-route` 8), duration 5.03s.

> "Contract" = verified at the unit/integration-test layer against the real route handlers. "Live" = verified against the protected Vercel Preview deployment using `vercel curl`, which handles Deployment Protection.

**Live evidence (2026-06-03 update):**

- Preview deployment: `https://travel-camxoix6t-poyutsais-projects.vercel.app`
- First deploy attempt failed because `.next/` was uploaded and Vercel cloud build consumed stale webpack artifacts. Added `.vercelignore` to exclude `.next`, `node_modules`, local env files, and test/cache output.
- `vercel --yes --force` then built successfully on Vercel.
- `vercel curl /api/agent/commands` without `x-agent-secret` → `{"error":"Missing operator secret","code":"MISSING_SECRET"}`.
- `vercel curl /api/agent/commands` with `AI_AGENT_INTERNAL_SECRET` → `{"action":"draft","source":"discord_private",...}`.

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

Current Vercel Preview state:

- Present: `AI_AGENT_INTERNAL_SECRET`, `NOTION_TEAM_2026_DATABASE_ID`, existing `NOTION_TOKEN`, existing Sanity read envs.
- Still needed before live LINE webhook smoke: `LINE_CHANNEL_SECRET`, `LINE_PARTNER_GROUP_ID`, `AGENT_KV_URL`, `AGENT_KV_TOKEN`.

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

Live Preview smoke:

- Missing `x-agent-secret` reaches the route and returns `MISSING_SECRET`.
- Valid `x-agent-secret` reaches the router and returns `action:"draft"`.
- Preview protection was bypassed via `vercel curl`; direct browser/curl access may show Vercel Authentication.

## Item 5 — No Sanity client on dry-run path

`grep` over `src/lib/line-agent/quote/` finds only: the string literal `'no_sanity_document_written'`, the local module name `sanity-write.ts`, and `create-quote.ts` importing from `./sanity-write` (the local stub). **No `@sanity/*`, `next-sanity`, or `createClient` import.** `sanity-write.ts` is contract-only: `dryRunQuoteWriter.write()` returns `{written:false}`; `liveQuoteWriter.write()` throws (inert placeholder, not wired).

## Remaining blockers (require Eric / next session)

1. **Live LINE webhook smoke not run** — still needs `LINE_CHANNEL_SECRET`, `LINE_PARTNER_GROUP_ID`, `AGENT_KV_URL`, and `AGENT_KV_TOKEN` in Vercel Preview.
2. **Formal quote write remains gated** — no `SANITY_QUOTE_WRITE_TOKEN` or live Sanity writer is configured. Do not open this gate without Eric's explicit approval.

## Bottom line

Code-level contracts for the webhook, the command auth boundary, the dry-run quote flow, and the no-Sanity-import / no-auto-reply boundaries all **pass**. Vercel Preview build and live `/api/agent/commands` smoke now also **pass**. Remaining live coverage is the LINE webhook path after LINE + KV env vars are configured. The write-token gate remains closed.
