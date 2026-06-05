# Notion RAG Loader — Design (v1, fixture/fake-first)

**Date**: 2026-06-06 · **Branch**: `codex/line-oa-agent-mvp` · **Status**: ✅ loader v1 implemented (commit `43bb7b5`)

## Implementation status (v1)

- **Implemented**: `buildNotionRagIndex` read orchestrator (config + injected port + per-source traversal + aggregate build), as specified below.
- **Commit**: `43bb7b5` — `feat(line-agent): add Notion RAG read orchestrator (loader v1)`.
- **Verification**: line-agent suite **589/589 green**.
- **Still mock/fixture-first**: no real Notion API is touched; the orchestrator only takes an injected `NotionRagClient` fake.

### Not yet done (deferred slices)

- Real `@notionhq/client` adapter implementing `NotionRagClient` (cursor/pagination loop lives there).
- Operator traverse cron / job scheduling.
- `markdown_template` corpus merge (first-layer corpus, merged later by the index builder).
- Live request-path integration (wiring the built index into the running agent).
- Production enablement (`AI_AGENT_NOTION_RAG_ENABLED` stays off; no auto-launch).

## Implementation status (env → NotionRagConfig resolver)

- **Implemented**: `resolveNotionRagConfig(env)` — pure env-record → `NotionRagConfigResolution`
  (`{ config, issues }`), keeping `buildNotionRagIndex` free of `process.env`.
- **File**: `src/lib/line-agent/notion/notion-rag-config.ts` (+ `__tests__/notion-rag-config.test.ts`).
- **Commit**: `e8ab186` — `feat(line-agent): add Notion RAG env config resolver`.
- **Still mock-first**: does **not** call the real Notion API; only shapes typed config.

### Resolver behaviour (locked)

1. **Disabled gate short-circuits parsing.** `AI_AGENT_NOTION_RAG_ENABLED` must be exactly
   `"true"`; anything else ⇒ disabled, empty `activeSources`/`databaseIds`, **no** db-id parsing.
2. **Explicit active-source list.** `AI_AGENT_NOTION_RAG_ACTIVE_SOURCES` is parsed explicitly
   (trim + dedupe, first-seen order). Never "has an id ⇒ auto-enable".
3. **Unknown source is not silently dropped.** An unrecognised token ⇒ `unknown_active_source`
   issue (kept out of `activeSources`, but surfaced, not swallowed).
4. **Known source missing its id stays active.** A known source whose db-id env key is
   empty is **kept** in `activeSources` and reported as a `missing_database_id` issue, so the
   loader still returns its structured `missing_database_id` error rather than silently skipping.
5. **Leak guard.** Issue messages carry the source label only — never a token, db id, or Notion url.

### Resolver deferred (not in this slice)

- `.env.example` `AI_AGENT_NOTION_RAG_ACTIVE_SOURCES` placeholder — added after the
  Discord ai-room WIP env block was merged into the same working copy.
- Live request-path wiring / operator traverse job.

## Implementation status (real-shaped Notion SDK client adapter)

- **Implemented**: `createNotionRagClient(sdk)` — wraps an **injected** Notion-like SDK
  (`databases.query`) and implements the loader port
  `NotionRagClient.listPages(databaseId): Promise<NotionApiPage[]>`.
- **File**: `src/lib/line-agent/notion/notion-rag-client.ts`
  (+ `__tests__/notion-rag-client.test.ts`).
- **Commit**: `bd78574` — `feat(line-agent): add Notion SDK client adapter (cursor loop)`.
- **Verification**: 6 TDD tests; full line-agent suite **603/603 green**.
- **Still mock-first**: no real `@notionhq/client` import, no live API, no real db id.

### Client adapter behaviour (locked)

1. **Injected SDK only.** Wraps a Notion-like `{ databases: { query } }` port; the real
   `@notionhq/client` `Client` is structurally compatible but is **never imported** here
   (tests inject a trivial fake — no real API, no real db id).
2. **Cursor loop lives in this layer.** Pages while `has_more` **AND** `next_cursor` are
   present; `has_more` with a null `next_cursor` terminates (defensive). The orchestrator
   never sees pagination.
3. **Conservative result filtering.** Only page-like results (objects carrying a
   `properties` record) flow on to `flattenNotionPage`; non-page results (incl. `null`,
   strings, `{ object: 'data_source' }`) are dropped.
4. **Sanitized errors.** Any SDK throw is re-surfaced as a fixed `NotionRagClientError`
   (`code: 'notion_query_failed'`); the raw SDK error is swallowed.
5. **Leak guard.** The thrown error's message/stack **never** carries a token, database
   id, or `notion.so` url.

### Client adapter deferred (not in this slice)

- Real production SDK instantiation / env token wiring (`new Client({ auth })`).
- Live request-path wiring (built index into the running agent).
- Operator traverse cron / job scheduling.
- `markdown_template` corpus merge (first-layer corpus, merged by the index builder).

> Next code slice: **live request-path wiring** or **operator traverse job** — both still gated off.

## Goal

A thin **read orchestrator** that turns Notion API pages (delivered by an *injected*
client) into a `RagIndex` via the existing pure pipeline. This is **not** a
production RAG launch — it is the config + traversal + build-helper layer, driven
entirely by fakes in tests.

```
config + client(port)
  └─ for each active source (in activeSources order):
       client.listPages(dbId)            → NotionApiPage[]
       flattenNotionPage                 → NotionPageFixture[]
       notionPagesToRagRecords({source}) → RagIndexRecord[]
  └─ concat all records → buildRagIndex(records) → RagIndex
```

## Hard boundaries (non-negotiable)

- No Sanity. No webhook / router / send gate. No customer auto-reply. No Notion write.
- No real `@notionhq/client` instance wired; the orchestrator only takes an injected port.
- No real database id in the repo. Env keys are placeholders only.
- Production not auto-enabled. An **explicit RAG gate** (`AI_AGENT_NOTION_RAG_ENABLED`) is required.
- Tests never hit the real Notion API — a fake transport/client is injected.

## Contract

### Injected port (pagination hidden — fork ①=A)
```ts
export interface NotionRagClient {
  listPages(databaseId: string): Promise<NotionApiPage[]>
}
```
Cursor/pagination is a *future real-client internal detail*; it never leaks into the
orchestrator, and the fake stays trivial.

### Source enum
`private_2025 | private_2026 | team_2026`.
`markdown_template` is **not** a Notion loader source — it remains a first-layer corpus
merged later by the index builder.

### Config (resolved upstream; the builder is pure of `process.env`)
```ts
export interface NotionRagConfig {
  enabled: boolean                                       // AI_AGENT_NOTION_RAG_ENABLED
  activeSources: NotionRagSourceTable[]                  // v1 default/test: ['private_2025']
  databaseIds: Partial<Record<NotionRagSourceTable, string>>  // resolved from env keys
}
```
Env keys: `NOTION_PRIVATE_2025_DATABASE_ID`, `NOTION_PRIVATE_2026_DATABASE_ID`,
`NOTION_TEAM_2026_DATABASE_ID`.

### Result (three-state discriminated union)
```ts
export interface SourceLoadReport {
  sourceTable: NotionRagSourceTable
  status: 'loaded' | 'skipped' | 'error'
  pageCount?: number
  recordCount?: number
  error?: string            // human-safe; NEVER token / db id / Notion url
}

export interface NotionRagBuildError {
  code: 'missing_database_id' | 'client_error'
  message: string
  failedSources: NotionRagSourceTable[]
}

export type NotionRagBuildResult =
  | { status: 'skipped'; reason: 'disabled'; index: RagIndex; notes: string[] }      // empty index
  | { status: 'ok';      index: RagIndex; sources: SourceLoadReport[]; notes: string[] }
  | { status: 'error';   error: NotionRagBuildError; index: RagIndex; sources: SourceLoadReport[] } // empty index
```

### Entry point
```ts
export async function buildNotionRagIndex(
  config: NotionRagConfig,
  client: NotionRagClient,
): Promise<NotionRagBuildResult>
```

## Behaviour rules

1. **Disabled gate short-circuits FIRST.** If `!config.enabled` → `status:'skipped'`,
   empty index, note. Do **not** check ids, do **not** call the client.
2. **Missing required id** (fork ③=A). For every source in `activeSources`, its
   `databaseIds[source]` must resolve; any missing → `status:'error'`
   (`code:'missing_database_id'`), empty index, no client call for the run.
3. **Fail-aggregate** (fork ②=A). When ids are present, run every active source in
   `activeSources` order (deterministic). Each yields a `SourceLoadReport`. A client
   throw is caught per-source (status `error`); other sources still run so their
   reports are complete — but if **any** source errored the final result is
   `status:'error'` with an **empty** index. Never return a partial/fake-success index.
4. **Success.** All active sources loaded → `status:'ok'` with the merged `RagIndex`
   (`buildRagIndex` already does dedupe/merge) and per-source reports.
5. **Leak guard.** Reports/errors carry counts and the source enum only — never a
   token, db id, or Notion url. Privacy of record bodies stays enforced downstream by
   `toPartnerSafeView`.

## TDD red order (6 failing tests first)

1. disabled gate → `skipped`, empty index, no client call (assert client not invoked)
2. enabled + `private_2025` id + fake pages → `ok`, builds `RagIndex` (records present)
3. enabled + active source missing its id → `error` `missing_database_id`, empty index, no client call
4. fake client throws → `error` `client_error`, empty index, per-source report still produced
5. multiple active sources → source metadata preserved (each report present, deterministic order)
6. partner-safe projection still hides private fields (cost/profit/db id never in `toPartnerSafeView`)

## Out of scope (later slices)

- Real `@notionhq/client` adapter implementing `NotionRagClient` (cursor loop lives there).
- `markdown_template` corpus merge.
- Wiring `resolveNotionRagConfig` into the live request path (the resolver itself is done — see above).
- Any production enablement / operator traverse job scheduling.

## Dry-run traverse entry (DONE — commit `84c0a6f`)

Operator-only glue that turns env + an injected client into one operator-safe
summary. It owns NO new logic — it composes the two already-green units and
projects their result.

### Function
```ts
export async function runNotionRagTraverseDryRun(
  env: Record<string, string | undefined>,
  client: NotionRagClient,
): Promise<NotionRagTraverseReport>
```

### Pipeline
1. `resolveNotionRagConfig(env)` → `{ config, issues }`
2. `buildNotionRagIndex(config, client)` → `NotionRagBuildResult`
3. project into an operator-safe report (counts + enum source tables + codes)

### Report — contains ONLY
- `status`: `skipped` | `ok` | `error`
- `sources[]` (source summaries): `sourceTable` / `status` / `pageCount` / `recordCount`
- `index` (counts): `totalRecords` / `sourceCounts` (records per source table) /
  `areaTokenCount` / `themeTokenCount`
- `issues[]` + `errorCode`: config-resolution + build issue/error **codes** only

### Report — NEVER contains
- token
- database id
- notion.so URL
- customer PII
- cost / profit

### Boundaries
Writes nothing, caches nothing, schedules nothing, calls no real API, does not
touch the live request path. The disabled gate and the missing-id gate both
short-circuit before any client call (guaranteed by `buildNotionRagIndex`). Pure
dry-run return object. Tests: 6/6 green; full line-agent suite 609/609.

## Checkpoint — Operator command wrapper (offline) · commit `1191043`

`scripts/agent-command.mjs` now exposes a **`notion-rag-dry-run`** operator
command. Run it through the existing operator CLI passthrough:

```
npm run agent:command -- notion-rag-dry-run
```

### Behavior
- Operator-only, fully **offline**: no real Notion API, no live HTTP path.
- Disabled gate (`AI_AGENT_NOTION_RAG_ENABLED !== "true"`) → **skipped** summary,
  client never called (gate short-circuits first).
- Enabled but a real client is **not wired** → safe `client_not_wired` error.
- Formats a safe Traditional Chinese operator report; the formatter surfaces only
  `status` / counts / source labels / issue + error **codes**.
- NEVER prints a token, database id, notion.so URL, customer PII, cost, or profit.

### Technical constraint (why the bridge is deferred)
- `scripts/agent-command.mjs` is a **plain Node `.mjs`** run directly by `node`
  (the `agent:command` npm script); there is no build / tsx step.
- A plain `.mjs` **cannot runtime-import the TypeScript traverse**
  (`runNotionRagTraverseDryRun`), so this cut does NOT call it. The command path
  is dependency-injectable (`runDryRun` / `client` options) so the next cut can
  bridge the traverse without this CLI importing TS directly.
- Resolver/loader logic is NOT duplicated: the CLI only mirrors the one-line
  enabled gate (source of truth stays `notion-rag-config.ts`).

Tests: 7 new (`agent-command-notion-rag.test.ts`); full line-agent suite 616/616.

## Checkpoint — mjs ←→ TS traverse bridge strategy · 2026-06-06

Convergence on how the plain-`.mjs` CLI reaches the TypeScript traverse without
wiring a real `@notionhq/client`, touching `package.json`/`.env*`, or hitting a
live path.

### Options weighed
- **A — dynamic import of compiled JS dist.** Needs a build output; unfit for dev. Rejected.
- **B — run the command under `tsx`/a loader.** Adds a dependency / npm script →
  touches `package.json`, currently mid-WIP for the Discord ai-room. Deferred.
- **C — JS-compatible bridge via dependency injection.** Chosen, trimmed (below).
- **D — defer; design note only** until the package WIP settles.

### Decision: **C, trimmed** — two facts collapse most of the work
1. **The injection seam already exists.** `runNotionRagDryRunCommand({ env,
   client, runDryRun })` already accepts `runDryRun` by injection, and its shape
   `(env, client) => Promise<report>` is *exactly* `runNotionRagTraverseDryRun`.
   → No new bridge module (that part of C is YAGNI). The seam **is** the
   `runDryRun` option.
2. **The real traverse already sanitizes its own client errors** (traverse test
   5: throwing client → `client_error`, zero leak). → It never throws raw.

So the minimal valuable cut was:
- **Proof (no new production module):** a TS test injects the **real**
  `runNotionRagTraverseDryRun` + a mock client into the existing JS command and
  asserts it runs offline and leak-free — proving type + runtime shape
  compatibility in one go.
- **One production hardening:** wrap the injected `runDryRun(env, client)` call
  with try-catch. The CLI is the operator boundary; **any** injected runDryRun
  that throws raw (a future bridge, a partial wiring) could carry a token / db
  id / notion.so url in its message. Every throw now collapses to a safe
  `client_error` projection.

Neither pure D (real code + real proof shipped) nor textbook C (no new module).

### What shipped (commit pending this checkpoint)
- `scripts/agent-command.mjs`: try-catch around the injected `runDryRun`; throw →
  sanitized `client_error` report.
- `agent-command-notion-rag.test.ts`: +3 bridge tests — (1) injected runDryRun
  called with `(env, client)` and formatted, (2) the **real**
  `runNotionRagTraverseDryRun` bridges through the command offline + leak-free,
  (3) throwing runDryRun → sanitized `client_error`, no leak.
- Verification: targeted 10/10; full line-agent suite **619/619 green**.
- Constraints honored: no real `@notionhq/client`, no `package.json`/`.env*`
  change, no real API, no live path, operator command stays testable.

### Next knife (not started)
Real-Notion wiring becomes the B-like step: pass a concrete `@notionhq/client`
adapter as the `client` into the **already-proven** seam. The bridge contract
proven here does not change.

## Checkpoint — runtime loader (pluggable real-runner seam) · 2026-06-06

Gave the command a runtime entry point for the real runner, still mock-first /
TDD. No real token, no real Notion call, no package change.

### Resolution order (locked)
`runNotionRagDryRunCommand(options)`:
1. **disabled gate** → `skipped`; nothing loaded or called.
2. **injected** `runDryRun` + `client` → use them (tests / explicit wiring).
3. **runtime loader** `loadRuntime({ env }) → { runDryRun, client }` — called
   only when an explicit runner was not injected. Default = `scripts/
   notion-rag-dry-runner.mjs` `loadNotionRagDryRunRuntime()`, **mock-first**
   (returns `{ runDryRun: null, client: null }`).
4. missing `runDryRun` OR `client` after loading → safe **`client_not_wired`**.

Boundary: a **loader throw** OR a **runner throw** both collapse to a sanitized
**`client_error`** — never propagate a raw, leak-prone message.

### New file — `scripts/notion-rag-dry-runner.mjs`
The single seam a future knife edits to wire the real `@notionhq/client` + the
TS traverse (e.g. via a tsx/dist step). The command layer's resolution order
does NOT change when that lands.

### What shipped
- `scripts/agent-command.mjs`: layered runner resolution + `loadRuntime` option;
  loader/runner throws → `client_error`; `notWiredReport()` helper.
- `scripts/notion-rag-dry-runner.mjs`: mock-first runtime loader stub.
- `agent-command-notion-rag.test.ts`: +5 loader tests (disabled→not loaded,
  enabled→uses loader, loader throw→client_error, empty runtime→client_not_wired,
  default not-wired + no secret-shaped env leak).
- Verification: targeted **15/15**; full line-agent suite **624/624 green**;
  `tsc` clean on changed files. Offline command: disabled→`已略過`,
  enabled+default→`client_not_wired` (through the new loader path).
- Constraints honored: no `package.json`/`package-lock`/`.env*` change, no real
  Notion API, no live path, no cache/scheduler.

### Next knife (not started)
Replace `loadNotionRagDryRunRuntime()`'s body to build the real
`@notionhq/client` (already in `package.json`) + bridge the TS traverse, gated
behind a real token. The command's resolution order is frozen.

## Checkpoint — runtime loader wiring proof (injectable factories) · 2026-06-06

The loader graduated from a constant not-wired stub to a **wiring machine** that
ASSEMBLES `{ runDryRun, client }` from injectable factories — still mock-first,
still no real token / Notion call / package change. The command's resolution
order (above) is unchanged; only the loader body grew.

### New loader contract
`loadNotionRagDryRunRuntime({ env, importTraverse, createClient })`:
1. **off-gate** — `AI_AGENT_NOTION_RAG_RUNTIME !== 'real'` → `{ null, null }`;
   factories are NEVER called.
2. **real gate, missing `NOTION_TOKEN`** → `{ null, null }` (safe not-wired);
   the client factory is NOT called.
3. **real gate + token** → `runDryRun = await importTraverse({env})`,
   `client = await createClient({env, token})`; both present → returned, else
   `{ null, null }`.
4. **factory throw** → caught and re-thrown as a fixed, secret-free
   `NotionRagRuntimeWiringError` (loader-owned leak guard, mirrors
   `notion-rag-client.ts`); the command collapses it to `client_error`.

### Two-layer fail-safe (why production still can't hit the API)
- **Gate layer**: non-`real` short-circuits before any factory.
- **Default-factory layer**: PRODUCTION defaults (`notWiredImportTraverse` /
  `notWiredCreateClient`) return `null`, so even a real gate + token with no
  injected factories yields not-wired — no live import, no SDK, no API. Tests
  inject fakes to prove the wiring SHAPE; the real path stays not-wired.

### What shipped
- `scripts/notion-rag-dry-runner.mjs`: gate + token guard + injectable
  `importTraverse`/`createClient` (default not-wired) + sanitized
  `NotionRagRuntimeWiringError`.
- `src/lib/line-agent/__tests__/notion-rag-dry-runner.test.ts` (new): 8 tests —
  default not-wired, off-gate factories-never-called, real-mode fake-factory
  assembly, missing-token safe not-wired, real-gate default-factory not-wired,
  sanitized factory throw (no token/db/url), command integration (ok report +
  client_error projection).
- Verification: targeted **8/8**; full line-agent suite **632/632 green**.
- Constraints honored: no `package.json`/`package-lock`/`.env*`/README change,
  no real `@notionhq/client`, no real API, no live path, no cache/scheduler,
  Discord WIP untouched.

### Next knife (not started)
Replace the two `notWired*` default factories with real ones — a tsx/dist import
of `runNotionRagTraverseDryRun` and a real `@notionhq/client` wrapped by
`createNotionRagClient` — gated behind the same `real` env + token. The loader
CONTRACT and the command resolution order are both frozen; only the default
factory bodies change.

## Operator runbook — real-runtime env checklist (still not-wired) · 2026-06-06

What an operator MUST set to attempt the `notion-rag-dry-run` real runtime, and
why it currently still stops at `client_not_wired`. This is a checklist only —
no real token / db id lives in the repo, and production default factories return
`null`, so the command reports `client_not_wired` until the real factories land.

### Required env (real runtime)
| Env | Value / shape | Role |
| --- | --- | --- |
| `AI_AGENT_NOTION_RAG_ENABLED` | `true` (exact, trimmed) | Master gate; anything else → `skipped`. |
| `AI_AGENT_NOTION_RAG_ACTIVE_SOURCES` | `private_2025,private_2026,team_2026` | Which corpora to traverse (comma list). |
| `AI_AGENT_NOTION_RAG_RUNTIME` | `real` (exact, trimmed) | Runtime gate; non-`real` → loader stays not-wired, factories never called. |
| `NOTION_TOKEN` | Notion integration secret | Required for real wiring; missing → safe not-wired (client factory NOT called). |
| `NOTION_PRIVATE_2025_DATABASE_ID` | 32-hex db id | Source `private_2025`. |
| `NOTION_PRIVATE_2026_DATABASE_ID` | 32-hex db id | Source `private_2026`. |
| `NOTION_TEAM_2026_DATABASE_ID` | 32-hex db id | Source `team_2026`. |

### Source semantics
- `private_2025` — **frozen historical** corpus (read-only reference, no new writes).
- `private_2026` — **active private** corpus (current bookings / cases).
- `team_2026` — duplicate **subset** of the above; **lower source-priority** in
  dedupe so it never shadows the private corpora.

### Current state (why it still says `client_not_wired`)
Even with every env above set correctly, the PRODUCTION default factories
(`notWiredImportTraverse` / `notWiredCreateClient`) return `null`, so the loader
yields `{ runDryRun: null, client: null }` and the command projects
`client_not_wired`. This is by design for this cut — the env is the only missing
piece a future knife needs; the wiring SHAPE is already proven by injected fakes.

### Pre-flight before real wiring lands
- **Never** commit a real `NOTION_TOKEN` or real database ids to the repo — set
  them only in the operator's local/`.env.local` or the deploy env.
- **Invite the Notion integration** to all three databases first (private_2025,
  private_2026, team_2026) — an un-invited integration returns empty/403 even
  with a valid token.

## Decision — default `importTraverse` TS import strategy (DEFER · D) · 2026-06-06

Scope of this checkpoint: **only** decide how the default `importTraverse`
factory in `scripts/notion-rag-dry-runner.mjs` obtains `runNotionRagTraverseDryRun`
at runtime — or explicitly decide not to, and record why. No real client, no
token wiring, no live path.

### The runtime constraint (re-confirmed by local evidence)
- `package.json` is `"type": "commonjs"` and ships **no** `tsx` / `ts-node` /
  register hook (`grep` clean).
- `scripts/*.mjs` are run directly by `node`; Node ESM **cannot** import a `.ts`
  source. So the default factory has no in-process way to reach the TS traverse
  **without** adding a loader dependency or a build step.

### Options weighed (for the *default factory*, not the injection seam)
- **A — dynamic import of compiled JS** (`.next`/dist). Build output path is
  unstable and not guaranteed to exist for an offline operator command. Rejected.
- **B — run under `tsx` / a loader.** Cleanest real path, but requires a new
  dependency + npm script ⇒ touches `package.json`/`package-lock`, which is
  explicitly out of scope (Discord ai-room WIP also occupies that file). Deferred.
- **C — shell out to existing test/build infra.** Couples the runtime to the test
  harness; too heavy for a not-wired default. Rejected.
- **D — leave the default not-wired; document the decision.** Chosen.
- **E — extract the traverse pipeline into a JS-compatible `.mjs`.** Duplicates
  TS logic with drift risk (two sources of truth). Rejected.

### Decision: **D — default `importTraverse` stays not-wired**
While `package.json`/`tsx` are out of scope, no in-process TS-import path is
clean enough to ship. The default factory therefore keeps returning `null`
(no `.ts` dynamic import, no API). This is a *deliberate* not-wired state, not an
oversight.

Crucially this costs nothing for the future real cut, because:
- **The injection seam already supports it.** `loadNotionRagDryRunRuntime({ env,
  importTraverse, createClient })` takes `importTraverse` by injection; the
  default is just the production fallback. A real cut swaps the default body (or
  injects a real factory) without changing the loader contract or the command's
  resolution order.
- **When the package gate opens, the real wire is one of:** (1) a `tsx` runner
  step (B) whose factory does `await import('…/notion-rag-traverse.ts')`, or
  (2) a build-time JS output (A) imported from a stable dist path. Either lands
  in the default-factory body only.

### Observable consequence (today)
With no injection, the operator command still projects **`client_not_wired`**
(via `{ runDryRun: null, client: null }`) even under a correct `real` gate +
token — exactly as the operator runbook above states. The env is the only
missing piece for a future cut; the wiring SHAPE is already proven by injected
fakes.

### What this checkpoint shipped
- **Test-only** (commit `cbfc351`): a characterization test isolating the default
  `importTraverse` — inject a working `createClient`, leave `importTraverse`
  default ⇒ still not-wired. The pre-existing "default factories" test leaves both
  unset and cannot distinguish *which* default forces not-wired; this one pins the
  invariant to `importTraverse` and to "no TS import". Discrimination verified by
  temporarily wiring the default (new test fails, combined test still passes).
- **No production change.** `scripts/notion-rag-dry-runner.mjs` is unchanged;
  the default factory body stays `return null`.
- Verification: line-agent suite **633/633 green**.
- Constraints honored: no `package.json`/`package-lock`/`.env*`/README change, no
  real `@notionhq/client`, no real API, no live path, Discord ai-room WIP untouched.

## Deferred (still NOT done)

- Real runtime wiring inside `loadNotionRagDryRunRuntime()` (build the real
  `@notionhq/client` + TS traverse; needs a token + a tsx/dist strategy).
- Production SDK instantiation + env token wiring (real `@notionhq/client`).
- Live request-path integration.
- Traverse job scheduling / cache persistence.
- `markdown_template` merge.
