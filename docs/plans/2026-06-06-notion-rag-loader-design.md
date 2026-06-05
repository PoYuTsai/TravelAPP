# Notion RAG Loader — Design (v1, fixture/fake-first)

**Date**: 2026-06-06 · **Branch**: `codex/line-oa-agent-mvp` · **Status**: ✅ loader v1 implemented (commit `43bb7b5`)

## Implementation status (v1)

- **Implemented**: `buildNotionRagIndex` read orchestrator (config + injected port + per-source traversal + aggregate build), as specified below.
- **Commit**: `43bb7b5` — `feat(line-agent): add Notion RAG read orchestrator (loader v1)`.
- **Verification**: line-agent suite **589/589 green**.
- **Still mock/fixture-first**: no real Notion API is touched; the orchestrator only takes an injected `NotionRagClient` fake.

### Not yet done (deferred slices)

- Real `@notionhq/client` adapter implementing `NotionRagClient` (cursor/pagination loop lives there).
- Env → `NotionRagConfig` resolver (env keys → typed config; keeps the builder pure of `process.env`).
- Operator traverse cron / job scheduling.
- `markdown_template` corpus merge (first-layer corpus, merged later by the index builder).
- Live request-path integration (wiring the built index into the running agent).
- Production enablement (`AI_AGENT_NOTION_RAG_ENABLED` stays off; no auto-launch).

> Next code slice: **env → `NotionRagConfig` resolver** — still mock-first, does **not** call the real Notion API.

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
- Env → `NotionRagConfig` resolver wiring into the live request path.
- Any production enablement / operator traverse job scheduling.
