# LINE OA Agent MVP — Preview / Real-Env-Shape Smoke Report

- **Date:** 2026-06-03
- **Branch:** `codex/line-oa-agent-mvp`
- **Goal:** Verify the MVP works in deployed-preview / real env shape *before* opening the Sanity write-token gate.
- **Scope honored:** parser untouched, Sanity schema untouched, no write token added, no formal quote write implemented. Inspection + tests only.

## Verdict

| # | Smoke item | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Vercel preview build passes | ✅ **PASS (live)** | Preview deploy succeeded: `https://travel-dojdluhr6-poyutsais-projects.vercel.app`. |
| 2 | Required env vars documented/checked | ✅ **PASS** | Cross-checked code `process.env.*` usage against `.env.example` (table below). |
| 3 | `/api/line/webhook` behavior | ✅ **PASS (contract + live OA)** | `line-webhook-route.test.ts` 8/8; LINE Developers Verify success; real OA private message persisted to Upstash. |
| 4 | `/api/agent/commands` dry-run + auth | ✅ **PASS (contract + live)** | Contract tests pass; live `vercel curl` smoke returns `MISSING_SECRET` without auth and `action:"draft"` with `AI_AGENT_INTERNAL_SECRET`. |
| 5 | No Sanity client import on dry-run path | ✅ **PASS** | grep + read of `quote/` (below). |
| 6 | Smoke report produced | ✅ this file | — |

**Test evidence (fresh, this session):** `npm run test:run` over the four targeted files → **29/29 passed** (`quote-url` 8, `create-quote` 8, `agent-commands-route` 5, `line-webhook-route` 8), duration 5.03s.

> "Contract" = verified at the unit/integration-test layer against the real route handlers. "Live" = verified against the protected Vercel Preview deployment using `vercel curl`, which handles Deployment Protection.

**Live evidence (2026-06-03 update):**

- Preview deployment: `https://travel-dojdluhr6-poyutsais-projects.vercel.app`
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
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | `line/profile.ts` via private `/api/agent/commands` inbox reads | **Profile lookup only** — used to read customer `displayName`; still no LINE push/reply path and no customer auto-reply. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | ❌ not read in line-agent/api | — | **Not wired yet** — no model call on the current dry-run path. Not needed for this smoke. |

Current Vercel Preview state:

- Present: `AI_AGENT_INTERNAL_SECRET`, `NOTION_TEAM_2026_DATABASE_ID`, `AGENT_KV_URL`, `AGENT_KV_TOKEN`, `LINE_CHANNEL_SECRET`, existing `NOTION_TOKEN`, existing Sanity read envs.
- `AGENT_KV_URL` / `AGENT_KV_TOKEN` were sourced from Upstash Redis REST credentials and verified locally with REST `PING` → `PONG`.
- `LINE_PARTNER_GROUP_ID` is still not set. It is not needed for OA private-message smoke; it is required before partner-group routing tests.

## Live LINE OA private-message smoke (2026-06-03 update)

Result: ✅ **PASS**

- LINE Developers `Use webhook` enabled and `Verify` succeeded against the protected Preview URL using Vercel Deployment Protection bypass.
- Eric sent a real personal LINE message to the official OA: `測試 webhook：2026/8/21`.
- Upstash contained one active case after delivery:
  - `caseCount: 1`
  - `activeLineUserIndexCount: 1`
  - status `new_inquiry`
  - one `line_oa_message` audit entry
- Follow-up implementation now stores recent raw OA customer text in `AgentCase.customerMessages[]` and adds an operator-only `list_cases` command path. This closes the earlier "received but cannot summarize what the customer asked" gap at the storage layer.
- Post-implementation smoke against the latest Preview returned `200 ok`, persisted one smoke case with `customerMessages[{ messageId, text, receivedAt, source }]`, then removed the smoke keys from Upstash.
- `/api/agent/commands` now wires deterministic `list_cases` commands through the bootstrapped CaseStore, so CC/tmux can query recent active OA cases via the operator endpoint without touching LINE outbound or Sanity write paths.

## Live Production OA smoke (2026-06-03 update)

Result: ✅ **PASS**

- Production env now includes the required LINE agent variables: `LINE_CHANNEL_SECRET`, `AGENT_KV_URL`, `AGENT_KV_TOKEN`, `AI_AGENT_INTERNAL_SECRET`, and `NOTION_TEAM_2026_DATABASE_ID`.
- Production deploy succeeded and `https://chiangway-travel.com` was aliased to the latest deployment.
- LINE Developers webhook can use the fixed Production URL: `https://chiangway-travel.com/api/line/webhook`.
- Eric sent multiple real LINE OA private messages after switching to Production. The same LINE user stayed on one case and `messageCount` incremented from 1 → 2 → 3.
- Operator `inbox` on Production returns active cases from Upstash through `/api/agent/commands` with `x-agent-secret`.
- New deterministic inbox triage now adds:
  - `triage.summaryText` — compact human-readable customer need summary.
  - `triage.knownFacts` — extracted facts such as travel date, adults/children, child ages, charter days, and interests.
  - `triage.missingFields` — obvious follow-up fields such as child seat need, flight/pickup info, and hotel/pickup location.
- Boundaries still hold: no customer auto-reply, no LINE push/reply usage, no Sanity write token, and no formal quote write. `LINE_CHANNEL_ACCESS_TOKEN` is used only for private operator profile-name lookup in `/inbox`.

## Item 3 — `/api/line/webhook` (contract verified)

- Invalid signature → **401**, no routing. (`line-webhook-route.test.ts:109`)
- Valid normalized OA event → routing handler invoked and **awaited before the 200 resolves** (no fire-and-forget). (`:120`)
- Non-actionable `room` source → **200 skip**, no routing. (`:184`) Wrong/other group is rejected fail-closed by the normalizer (covered in normalize-layer tests; only the partner group + 1:1 user pass).
- Persist failure → 500 so LINE retries (durable buffer); benign non-persistence error → still 200. (`:166`)
- **No customer auto-reply:** structurally guaranteed — `LINE_CHANNEL_ACCESS_TOKEN` is used only by private operator inbox profile lookup; no outbound push/reply code path exists.
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

1. **Partner-group live smoke not run** — still needs `LINE_PARTNER_GROUP_ID` in Vercel Preview.
   - `LINE_PARTNER_GROUP_ID` should be captured from a LINE group webhook payload (`source.type === "group"`, `source.groupId`).
   - Eric paused this step because the real OA has teammates with OA access; temporary webhook/group-id tests can create noisy OA notifications.
   - Next attempt: choose a low-disruption time, temporarily point the OA webhook to Webhook.site, send one message in the intended test/partner group, copy `source.groupId`, then restore the webhook URL.
   - The OA was removed from the temporary test group after this pause.
2. **Formal quote write remains gated** — no `SANITY_QUOTE_WRITE_TOKEN` or live Sanity writer is configured. Do not open this gate without Eric's explicit approval.
3. **LINE outbound token hygiene** — `LINE_CHANNEL_ACCESS_TOKEN` appeared in a screenshot during setup. Current code uses it only for profile display-name lookup, not for push/reply. Before enabling outbound LINE push/reply, reissue the long-lived channel access token and set the fresh value only in deployment secrets.

## Bottom line

Code-level contracts for the webhook, the command auth boundary, the dry-run quote flow, and the no-Sanity-import / no-auto-reply boundaries all **pass**. Vercel Preview build, live `/api/agent/commands` smoke, and real LINE OA private-message webhook smoke now also **pass**. Upstash KV is configured and PING-verified. Remaining live coverage is the partner-group route after `LINE_PARTNER_GROUP_ID` is captured and configured. The write-token gate remains closed.
