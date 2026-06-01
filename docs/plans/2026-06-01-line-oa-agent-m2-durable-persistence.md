# LINE OA Agent M2 — Durable Case Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> Start in a fresh **green** session on branch `codex/line-oa-agent-mvp` (the M1 branch, tip `7de84ee` or later). Run `git status --short` and `git diff --name-only HEAD` to get the live state — do **not** trust any injected git snapshot. As of 2026-06-01 the quote-3d/three+rollup dirty batch has been cleaned; only line-agent plan docs are untracked. Still stage only files this plan touches.

**Goal:** Turn the M1 agent from "receives and routes events but forgets everything" into a durably-persisted case pipeline: real KV-backed `CaseStore`, webhook events that actually persist cases through the reducer, and a durable processing seam — without any customer auto-reply.

**Architecture:** M1 already wired `POST /api/line/webhook` → normalize → `routeCommand`. The gaps are: (1) the default store is `MemoryStore`, which resets every serverless invocation; (2) `KvStore` has a stubbed client (`kv-store.ts:98` always returns `null`); (3) the router's command handlers are stubs that don't persist case state. This milestone closes those three gaps, then sequences into the already-specified Notion read (eng-plan Task 8) and quote URL creation (eng-plan Task 10).

**Tech Stack:** Next.js 14 route handlers, TypeScript, `@upstash/redis` (Vercel KV is deprecated — new projects use Marketplace Redis / Upstash; `.env` already uses the Upstash REST shape), Vitest. No new model APIs and **no queue** in this milestone.

## Hard Rule — Webhook delivery is at-least-once (read before A1)

LINE retries on any non-2xx response. We rely on that instead of building a queue:

- **OA case persistence failure → return HTTP 500, do NOT ack 200.** Swallowing the error and returning 200 turns "durable persistence" into "silently dropped cases". Persist-failure must propagate so LINE retries.
- Non-critical event errors (e.g. an unsupported casual message) may still return 200 — but they must be *distinguished in code* from persistence failures, not lumped into one catch-all.
- This is the reason a queue is unnecessary for M2: LINE's retry is the durable buffer.

---

## ⚠️ Task Numbering Reconciliation (read this first)

There are **two divergent numbering schemes**. Do not trust the labels — trust this table.

| Label in chat / code comments | Engineering-plan Task # | What it actually is |
|---|---|---|
| "Task 7/9" (Discord + `webhook-runtime.ts:16,72`) | *(not a real eng-plan task)* | **This milestone**: durable case persistence + KvStore production wiring + handler wiring |
| "Task 8 Notion read/traverse" | eng-plan **Task 8** | Notion 2026 team-collaboration adapter (read path first) |
| "Task 10 quote URL" | eng-plan **Task 10** | Official quote creation API |
| eng-plan Task 7 | eng-plan **Task 7** | AI model gateway / web research / OCR — **NOT** part of "Task 7/9" label; deferred |
| eng-plan Task 9 | eng-plan **Task 9** | Parser review harness — **already done in M1** |

The string "Task 7/9" is an informal in-code bucket name for the durable-persistence follow-up. It is **not** eng-plan Task 7 or Task 9. This plan calls it **M2 Phase A** to stop the collision.

---

## Current State Anchors (verified 2026-06-01 against tip `7de84ee`)

- `src/lib/line-agent/storage/store.ts` — `CaseStore` interface (put/get/getByLineUserId/listAll/listByStatus/delete/appendAudit/getAudit). **Complete, do not change the interface.**
- `src/lib/line-agent/storage/memory-store.ts` — in-memory impl for tests/local. Keep.
- `src/lib/line-agent/storage/kv-store.ts` — KvStore impl against an injected `KvClient`. **Logic complete BUT** line ~98 (`this.client = hasEnv ? null : null`) never constructs a real client → every method throws `KvNotConfiguredError` even when env is set. This is the core stub to fix.
- `src/lib/line-agent/line/webhook-runtime.ts` — default handler `await routeCommand(...)` (line 47) DOES route; default store is `new MemoryStore()` (line 74). `setStore`/`setEventHandler` seams exist for a "future bootstrap".
- `src/lib/line-agent/commands/router.ts` + `commands/handlers.ts` — handlers are M1 stubs; they route but do not persist case state via the reducer.
- `src/lib/line-agent/cases/case-reducer.ts` + `cases/case-state.ts` — reducer + statuses exist and are tested. Read the reducer's exact exported signature before wiring (do not assume).
- `.env.example` — already lists `AGENT_KV_URL`, `AGENT_KV_TOKEN`, `AGENT_RETENTION_DAYS=90`.

**Before writing any code, read:** `cases/case-reducer.ts`, `commands/handlers.ts`, `commands/router.ts`, `storage/memory-store.ts`, and the existing tests `__tests__/case-reducer.test.ts` + `__tests__/memory-store.test.ts` to match the established test style.

---

## Phase A — Durable Case Persistence ("Task 7/9")

### Task A1: Real KvStore client construction

**Files:**
- Modify: `package.json`, `package-lock.json` (add `@upstash/redis`)
- Modify: `src/lib/line-agent/storage/kv-store.ts` (replace the line ~98 stub **and** fix the terminal-index contract bug)
- Create: `src/lib/line-agent/__tests__/case-store-contract.ts` (shared contract suite, run against BOTH MemoryStore and KvStore)
- Modify/Create: `src/lib/line-agent/__tests__/kv-store.test.ts`

**KV decision (settled — do not re-litigate):** use `@upstash/redis`, **not** `@vercel/kv`. Vercel KV is deprecated; new projects use Marketplace Redis / Upstash, and `.env` already uses the Upstash REST env shape (`AGENT_KV_URL`/`AGENT_KV_TOKEN`).

**Steps:**
1. Write a **shared contract suite** (`case-store-contract.ts`) parameterized over a `CaseStore` factory, and run it against both `MemoryStore` and `KvStore` (mock `KvClient`). This stops the two implementations from silently diverging. Cover put/get/getByLineUserId/listAll/listByStatus/delete/appendAudit/getAudit.
2. **Contract test for the terminal-index bug (Codex review point C):** after `put`ting a case whose status is terminal (`converted`/`lost`), `getByLineUserId` MUST return `null`. `MemoryStore` already excludes terminal cases; `KvStore` currently leaves the `lineUser:{id}:activeCase` index pointing at the terminal case → it must `del` that index (or skip writing it) when the case is terminal.
3. Write a failing test: `new KvStore()` with **no** client and **no** `AGENT_KV_URL`/`AGENT_KV_TOKEN` env → methods throw `KvNotConfiguredError` (preserve fail-closed behavior).
4. Run targeted tests, confirm they fail for the expected reason.
5. Add `@upstash/redis` dependency (lockfile updates — stage **only** `package.json`/`package-lock.json` for this; the earlier unrelated three+rollup churn has been cleaned by Eric, so the tree should be clean — verify with `git status --short`).
6. Replace the `kv-store.ts:98` stub: when env vars are present and no client injected, construct `new Redis({ url: AGENT_KV_URL, token: AGENT_KV_TOKEN })`. Guard the import so env-less test runs never touch the network. Fix `put()` to delete the lineUser active index when the case status is terminal.
7. Run targeted tests, confirm pass.
8. Commit: `feat(line-agent): wire real Upstash KV client + fix terminal-index contract`.

**Verification:** `npm run test:run -- src/lib/line-agent/__tests__/kv-store.test.ts src/lib/line-agent/__tests__/memory-store.test.ts`

### Task A2: Production store bootstrap

**Files:**
- Create: `src/lib/line-agent/storage/select-store.ts`
- Create: `src/lib/line-agent/__tests__/select-store.test.ts`
- Modify: `src/lib/line-agent/line/webhook-runtime.ts` (default store via selector)

**Production must FAIL CLOSED (Codex review point A).** Do **not** fall back to `MemoryStore` in production when KV env is missing — a serverless instance would look healthy while forgetting every case. `MemoryStore` is for local/test only.

**Steps:**
1. Write failing tests for a `selectStore()` factory:
   - KV env present → returns `KvStore`.
   - No KV env **and** `NODE_ENV !== 'production'` (local/test) → returns `MemoryStore`.
   - No KV env **and** production (`NODE_ENV === 'production'` or `VERCEL` set) → **throws** (fail closed). Assert the throw; do not assert a fallback.
2. Implement `selectStore()`.
3. Change `webhook-runtime.ts` default `_store` initialization to use `selectStore()` instead of unconditional `new MemoryStore()`.
4. Run tests; confirm webhook-route tests still pass (the seam `setStore` must still override for tests).
5. Commit: `feat(line-agent): select KvStore in prod, fail closed when KV missing`.

**Verification:** `npm run test:run -- src/lib/line-agent/__tests__/select-store.test.ts src/lib/line-agent/__tests__/line-webhook-route.test.ts`

### Task A3: Thread the store through the router and persist via the reducer

Codex review point D — the seams exist but the store is not actually threaded through. Today `defaultEventHandler(event, store)` ignores `store`, and `routeCommand` takes no store.

**Files:**
- Modify: `src/lib/line-agent/commands/router.ts` (`routeCommand` input gains `store`)
- Modify: `src/lib/line-agent/commands/handlers.ts` (`handleCreateOrUpdateCase(event, store, deps)`)
- Modify: `src/lib/line-agent/line/webhook-runtime.ts` (pass `store` into `routeCommand`)
- Modify/Create: relevant `__tests__` for router + handler

**Steps:**
1. Write a failing test: a normalized OA user message → `routeCommand({ event, store, ... })` → `handleCreateOrUpdateCase` loads-or-creates via `getByLineUserId`, applies the reducer for "new inquiry", `put`s it back, appends an audit entry. (Use `MemoryStore`.)
2. Write a failing test: a second message from the same `lineUserId` updates the existing case (no duplicate) — exercises the reducer's duplicate-detection.
3. **caseId generation (point D):** do **not** use `listAll().length + 1` (race condition under concurrent invocations). Use a **deterministic id seam** injected via `deps` (default: messageId-based or a ulid-style generator), so tests are deterministic and production is collision-safe.
4. **customerDisplayName (point D):** use a fallback value now; do **not** call the LINE profile API on the webhook path for MVP — a profile fetch must never block or fail the webhook. Mark "enrich displayName via profile fetch" as a later follow-up.
5. Thread `store` into `routeCommand` and the handler signature. **Reuse** the existing reducer; do not reimplement transitions.
6. Confirm no path produces a customer-facing reply (assert handler returns void, no message-client send).
7. Run tests; confirm pass.
8. Commit: `feat(line-agent): thread store through router, persist cases via reducer`.

**Verification:** `npm run test:run -- src/lib/line-agent/__tests__/command-router.test.ts src/lib/line-agent/__tests__/case-reducer.test.ts`

### Task A4: Webhook error semantics — fail loud on persist failure (Codex review point B)

Today `route.ts` has a per-event catch that swallows errors and still acks. Per the Hard Rule, persistence failure must NOT ack.

**Files:**
- Modify: `src/app/api/line/webhook/route.ts`
- Modify/Create: `src/lib/line-agent/__tests__/line-webhook-route.test.ts`

**Steps:**
1. Write a failing test: when the handler throws a **persistence** error, the webhook responds **500** (so LINE retries) and does not ack 200.
2. Write a test: a non-critical event error (e.g. unsupported casual message that the normalizer/router intentionally ignores) still responds 200 — proving the two error classes are distinguished, not lumped.
3. Implement: introduce a typed persistence-failure error (reuse `errors.ts`) so the route can tell the two apart. Persist-failure → 500; benign no-op → 200.
4. Keep the fast-200 path for successfully-persisted events (synchronous-within-200; no queue — see Hard Rule).
5. Run tests; confirm pass.
6. Commit: `fix(line-agent): return 500 on case-persist failure so LINE retries`.

**Verification:** `npm run test:run -- src/lib/line-agent/__tests__/line-webhook-route.test.ts`

### Queue — explicitly out of scope for M2 (decided)

A durable queue (Vercel Queues / Upstash QStash) is **not** built in M2. The webhook path only does normalize → route → KV persist — no LLM/Notion/quote/OCR slow work — so synchronous-within-200 plus LINE's at-least-once retry (Hard Rule) is sufficient. Revisit only when a slow async step is added.

---

## Phase B — Notion Read/Traverse (eng-plan Task 8)

**Do not expand here.** This phase is already fully specified in
`docs/plans/2026-06-01-line-oa-agent-engineering-plan.md` → **Task 8** (field-policy classification, mapper, read path for similar-case search, write only for allowed fields with audit).

**Dependency:** Phase A must land first — Notion case-reference summaries attach to persisted cases. Start Task 8 only after A1–A3 are merged and green.

**Scope reminder from constraints:** read path first; writes only to `draft_write`/`confirmed_write` fields with audit log; private 2025/2026 tables are Eric-only reference, never exposed to the partner group.

---

## Phase C — Official Quote Creation (eng-plan Task 10)

**Do not expand here.** Fully specified in the engineering plan → **Task 10** (parser dry-run → block on `blocked` severity → Sanity write with `source=ai-agent`/`reviewStatus=needs_review` → return URL + validation report, else bug packet).

**Dependency:** Phases A + B should land first. Quote creation reads case state (Phase A) and may reference Notion confirmed-case data (Phase B). **Also depends on the open parser gap below.**

---

## Open Loops Carried From M1 (must address before / during Phase C)

1. **Parser bracketed-ticket gap:** `（大人）950*4` is dropped by the current parser → quote math undercounts. This touches `src/lib/itinerary/parser.ts` core logic. Eric must approve before changing the parser. Add a golden fixture reproducing the miss **first** (TDD), then fix. This blocks trustworthy Phase C quote totals.
2. ~~Second uncommitted line (three+rollup + quote-3d batch).~~ **Resolved 2026-06-01** — Eric cleaned the quote/preview dirty tree. Only the line-agent plan docs remain untracked. No special isolation needed beyond not staging stray files.

---

## Milestone Verification (end of Phase A)

```bash
npm run test:run            # all line-agent tests green
npm run lint
npm run build               # or rely on Vercel preview cloud build as the authoritative gate
git status --short          # only intended files touched
git diff --cached --stat     # no unrelated three/quote-3d churn staged
```

Then push and confirm the Vercel preview commit status is green:
```bash
gh api repos/{owner}/{repo}/commits/<sha>/status --jq '.state'
```

Ask Codex (bobotsai) for a diff review before merge — use the `chiangway-release-review` skill checklist (permission boundaries, no customer auto-reply, audit log present, no secrets).
