# M3.2 — Partner-Group RAG Answer-Source Call-Site / Deployment Wiring (Design)

**Date:** 2026-06-07
**Branch:** `codex/line-oa-agent-mvp` (tip `1de8aaf`)
**Status:** DESIGN ONLY. No code this slice. Defines WHERE/WHEN the bootstrap is
called and HOW it is rolled out. **Flips no env gate.**

---

## 0. Where we are

The pieces exist but are **not connected to any runtime entry point**:

- `line/install-default-partner-rag.ts` → `installDefaultPartnerRagAnswerSource({env?, ttlMs?, createSdkClient?})`
  builds the real `@notionhq/client` adapter and installs the cached source
  through the seam. Side-effect free at import; fail-closed; leak-safe.
- `webhook-runtime.getPartnerGroupResponder()` (line 304-319) is the dispatcher.
  Its `answerSource` thunk (line 315) is
  `(input) => getPartnerRagAnswerSource()(input)`.
- `getPartnerRagAnswerSource()` (line 345-354) returns the **not-wired throwing
  default** (`partner_rag_answer_source_not_wired`) until something installs.
- The dispatcher calls the `answerSource` thunk **only** when
  `shouldUsePartnerRagDraft` holds: partner group + botDirected + explicit intent
  + BOTH gates on (`AI_AGENT_NOTION_RAG_ENABLED` && `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED`).
  Gate off ⇒ `base` stub ⇒ thunk never runs (locked by
  `partner-rag-webhook-wiring.test.ts` item 1).

**Missing:** a call site for `installDefaultPartnerRagAnswerSource`. The moment one
exists AND both gates are on, the partner-group runtime can perform a real Notion
read. So this slice decides the call site and the rollout, and **stops before
flipping the partner gate**.

## 1. Runtime facts that constrain the choice

- Entry point: `src/app/api/line/webhook/route.ts` — a Next.js App Router route
  handler that snapshots seams per request via getters; reads gate env from
  `process.env`.
- **No `instrumentation.ts` exists** in the repo today.
- The installed source is a **module-level singleton** (`_partnerRagAnswerSource`),
  so it lives **per function instance** on Vercel Fluid Compute (reused across
  requests, rebuilt on cold start).
- The source is already cached behind TTL + single-flight, so building it once per
  instance is enough; repeated installs would just re-wrap the same deps.
- Gate is **env-based**; changing it on Vercel requires a redeploy/new instance.

## 2. Options considered

### A. Auto-install at `webhook-runtime` module import
Install as a side effect when the module loads.
- ❌ **Rejected.** Import-time side effect (constructs the SDK, reads env) — the
  exact property the bootstrap was built to avoid. Breaks the "import is inert"
  invariant; every test importing `webhook-runtime` would drag in the SDK; impossible
  to keep default-off truly zero-cost.

### B. Explicit bootstrap at server startup (`instrumentation.ts`)
Add `instrumentation.ts` `register()` and call the bootstrap there, gate-aware.
- ➖ **Workable but adds surface area.** Requires a NEW Next.js startup hook that
  runs in **both** node and edge runtimes and on **every** cold start, gate-off
  included (need an internal env guard to no-op). On an env-based gate where
  changing the gate already forces a redeploy, the "centralised at boot" benefit is
  marginal. More moving parts, weaker fail-safe than C.

### C. Lazy install on the first RAG-eligible request  ✅ RECOMMENDED
Install inside the dispatcher's `answerSource` thunk — which only runs once the
dispatcher has already confirmed gate on + partner + botDirected + explicit intent.
- ✅ **Zero side effect** on the default-off path and on every non-eligible request
  (the thunk is structurally gate-guarded — no extra gate check needed).
- ✅ No new runtime hook, no edge/node duality, no import-time cost.
- ✅ Idempotent + the source is cached, so the lazy cost is one-time per instance.
- ✅ Fail-closed already wired: a missing token or a Notion error degrades to
  `PARTNER_RAG_UNAVAILABLE_REPLY` via the existing rag-responder try/catch.
- ➖ Puts a (tiny, idempotent) wiring step in the request path — must be written so a
  re-entrant/concurrent first request cannot double-install or throw.

### Decision

**Pick C. Reject the B+C hybrid as over-engineering.** B+C would add an
`instrumentation.ts` *and* a lazy guard to do one job; C alone already delivers the
two properties we want (default-off = zero side effect; centralised + observable).
B stays documented as the fallback only if a future need arises to warm the index
*before* the first eligible message (it does not today — the first partner draft
tolerating one cold build is acceptable and is covered by single-flight).

## 3. Design of C

### 3.1 Install timing & call site
A new idempotent guard `ensureDefaultPartnerRagInstalled(env)` (future code) is
invoked from the dispatcher thunk:

```
// getPartnerGroupResponder(), webhook-runtime.ts
answerSource: (input) => {
  ensureDefaultPartnerRagInstalled(process.env) // idempotent; only reached on the rag path
  return getPartnerRagAnswerSource()(input)
}
```

Because `createPartnerGroupResponderWithRagDraft` calls `answerSource` **only** on
the rag path, `ensure` is reached **only** when both gates are on + explicit intent.
No extra gate read is required for correctness; the structural guard is the gate.

### 3.2 Idempotency
`ensure` must install at most once per instance and never throw:
- Module-level `_partnerRagInstallAttempted: boolean` flag (or reuse the existing
  singleton: if it is no longer the not-wired default, skip). On first call:
  set the flag, call `installDefaultPartnerRagAnswerSource(env)`, log the result
  code once.
- If `installed === false` (`missing_notion_token` / `notion_client_init_failed`):
  leave the seam at the not-wired default. The dispatcher's try/catch then yields
  `PARTNER_RAG_UNAVAILABLE_REPLY` — fail-closed, no fabricated draft.
- Concurrency: route handler awaits sequentially per event; within one instance the
  flag check is synchronous before any await, so no double-install. Cross-instance
  installs are independent and harmless (each instance owns its singleton).

### 3.3 Env requirements (preview first)
For an install to succeed AND the source to build a usable index, ALL of:
- `NOTION_TOKEN` — Notion integration token (required to construct the SDK).
- `AI_AGENT_NOTION_RAG_ENABLED=true` — loader-level gate (config resolution).
- `AI_AGENT_NOTION_RAG_ACTIVE_SOURCES` — e.g. `private_2026`.
- `NOTION_<SOURCE>_DATABASE_ID` for each active source.
- `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED=true` — partner-draft gate (the LAST switch).

Missing `NOTION_TOKEN` ⇒ `ensure` no-ops to fail-closed. Missing RAG config (id) ⇒
install succeeds but the first build throws `NotionRagIndexUnavailableError` →
unavailable reply (not cached, retries next call).

### 3.4 Gate toggle ordering (safe enable sequence)
1. Set `NOTION_TOKEN`, `NOTION_*_DATABASE_ID`, `AI_AGENT_NOTION_RAG_ACTIVE_SOURCES`
   in **preview** env.
2. Set `AI_AGENT_NOTION_RAG_ENABLED=true` (preview). Partner path still inert
   (partner gate off).
3. Run the **preview-only smoke command** (§3.5) to confirm retrieval/compose works
   with **no LINE involvement**.
4. Only then set `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED=true` in **preview**.
5. Exercise in a **preview/test partner group** (never the live production group)
   with a tagged + explicit-intent message; confirm `夥伴內部草稿` banner + no leak.
6. Promote env to production only after preview is validated; the production partner
   group still requires Eric's explicit send intent (OA ban + sendTarget unchanged).

### 3.5 Preview-only smoke command
Reuse the existing operator-masked CLIs (no LINE path, no send):
- `npm run agent:notion-rag-search -- "清邁 親子 大象"` — retrieval projection.
- `npm run agent:notion-rag-answer -- "清邁 親子 大象"` — full compose, operator-safe.
These exercise the SAME loader + adapter + compose used by the installed source, so
a green run proves the call-site path will work once gates flip — without touching
LINE. (Optional later: a `--check-install` flag that asserts
`installDefaultPartnerRagAnswerSource(process.env).installed === true`.)

### 3.6 Rollback
No code rollback needed — the call site is gate-guarded and install is lazy:
- **Fast:** unset/`false` `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED` → next instance routes
  to `base` stub; the RAG source is never reached. (Within a warm instance the gate
  is read per-respond, so it takes effect on the next message.)
- **Full:** also unset `AI_AGENT_NOTION_RAG_ENABLED`.
- The installed singleton is inert when the gate is off, so leaving it installed is
  harmless; no redeploy required beyond the env change Vercel already needs.

### 3.7 Observability (NO secrets)
- One install-attempt log per instance: `[line-agent] partner-rag install: <code>`
  where `<code>` ∈ `installed | missing_notion_token | notion_client_init_failed`.
  Never the token / db id / Notion url.
- Existing degradation log stays: the rag responder logs a non-minified reason on
  `NotionRagIndexUnavailableError` before returning the unavailable reply.
- Optional counter (future): rag-path hits vs degradations, for cost/health.
- All logs route codes/labels only — reuse the sanitization already enforced by
  `NotionRagClientError` / `NotionRagIndexUnavailableError` / config issue messages.

### 3.8 Timeout / fail-closed behavior
- **Gap to close in the implementation slice:** the Notion build
  (`listPages` → paginated `dataSources.query`) has no timeout. A hung call would
  hold the reply-token window. Wrap the index build in a bounded timeout (e.g.
  `Promise.race` with a configurable `AI_AGENT_NOTION_RAG_TIMEOUT_MS`, default a few
  seconds). On timeout ⇒ throw `NotionRagIndexUnavailableError('timeout')` ⇒
  unavailable reply; **not cached**, so the next eligible message retries.
- Everything else is already fail-closed: disabled/missing-id/client-error/throw all
  collapse to the unavailable reply; the cache never stores a failure.

## 4. Hard boundaries (restated)
- Do **not** flip `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED` (this slice or in code).
- Do **not** wire the live production partner group; preview/test group only.
- Do **not** change the OA auto-reply ban or `sendTarget`.
- Do **not** print secrets; codes/labels only.
- Do **not** write Sanity; do **not** call the LLM.

## 5. Test plan (for the future code slice — TDD)
1. `ensure` is idempotent: N calls ⇒ exactly one `installDefaultPartnerRagAnswerSource`.
2. `ensure` never throws on `missing_notion_token` ⇒ seam stays not-wired ⇒ dispatcher
   yields `PARTNER_RAG_UNAVAILABLE_REPLY`.
3. Dispatcher gate off ⇒ `ensure` never called ⇒ 0 installs, 0 Notion (extend the
   existing wiring test with a counting fake).
4. Both gates on + intent ⇒ `ensure` installs once, real (fake-SDK) source runs,
   `夥伴內部草稿` banner, no leak.
5. Timeout ⇒ unavailable reply, not cached, retried next call.
6. Install log emits the code only (spy console; assert no token/id/url).

## 6. NOT in this session
- No code. No call site added yet. No gate flipped. No deploy.
- Deliverable is this design doc + its commit. Implementation (the `ensure` guard,
  the thunk hook, the timeout, the logs, the tests) is the next slice, pending
  Eric's go.
