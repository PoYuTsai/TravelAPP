# Notion RAG · Real Operator Dry-run Wiring — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp`. Operator-only, offline-by-default. No live
path / webhook / Sanity touched. No secret (token / db id / Notion url) is
written to code, tests, docs, or terminal output anywhere in this work.

## What landed this knife

### 1. Real `createClient` default (feature `7d5449e`)
`scripts/notion-rag-dry-runner.mjs` → `createClientDefault` now assembles a real
client instead of returning null:

- dynamic-import `@notionhq/client` → `Client`
- dynamic-import the TS adapter `notion-rag-client.ts` → `createNotionRagClient`
- `new Client({ auth: token })` (construction touches **no** Notion API — the API
  is first hit only when `runDryRun` later calls `listPages`)
- returns `createNotionRagClient(notion)` as the loader-port `NotionRagClient`

Both default factories need a TS-capable runtime (the adapter is `.ts`), so the
operator runs it via a dedicated script:

```
npm run agent:notion-rag-dry-run     # tsx --env-file=.env.local …
```

`agent:command` / `/inbox` are byte-for-byte unchanged (smallest blast radius).
`tsx` added as a devDependency.

Gates unchanged and all required: `AI_AGENT_NOTION_RAG_ENABLED=true` +
`AI_AGENT_NOTION_RAG_RUNTIME=real` + `NOTION_TOKEN` + active source + db id.

Leak guard: a raw import/construction error may carry a token/db id/notion.so
url, so `createClientDefault` re-throws a fixed sanitized error (defense in depth
over the loader's own guard).

### 2. Database id normalisation (feature `c948055`)
`resolveNotionRagConfig` (`notion-rag-config.ts`) now normalises each
`NOTION_*_DATABASE_ID` before use. Accepts: bare 32-hex, dashed UUID, a full
Notion database URL, and a URL carrying a `?v=<viewId>` query (query dropped
first so the view id is never mistaken for the database id). Unparseable ⇒
`missing_database_id` (no throw); the issue message carries only the source
label, never the raw value.

Motivation: the first real smoke failed because the configured db id was a full
Notion URL (`databases.retrieve` → `invalid_request_url 400`). Normalisation
resolves that **Blocker 1**.

## Tests
- `notion-rag-dry-runner.test.ts`: `createClientDefault` assembly +
  sanitized-throw specs; loader "fully wired under TS runtime" replaces the old
  "client half unwired".
- `notion-rag-config.test.ts`: 6 normalisation specs (bare/dashed/URL/`?v=`/
  unparseable/leak-free message).
- **line-agent suite: 643/643 green.**

## SDK v5 data-source migration — DONE (feature `14f2e5a`)

The first smoke was blocked because `@notionhq/client` v5 **removed
`databases.query`** (confirmed by direct masked probing: `typeof
notion.databases.query === 'undefined'`, `notion.dataSources` present) — Notion
API 2025-09-03 moved rows under DATA SOURCES.

The adapter `notion-rag-client.ts` now runs the v5 flow, public port unchanged:

```
databases.retrieve(database_id) → data_sources[] → dataSources.query(each, paged) → merge page-like
```

Design decision (multiple data sources): **query every data source in the order
retrieve returns them and merge the page-like results** (not first-only). A
database with no data sources, or a malformed retrieve, is a structural failure
→ sanitized `NotionRagClientError`. Pagination, conservative page-like filtering,
and the leak guard are all preserved. `NotionLikeSdkClient` structural interface
updated to `{ databases.retrieve, dataSources.query }`; the real v5 `Client`
satisfies it.

TDD specs: retrieve→query, pagination, multi-data-source merge-in-order,
missing/malformed sources, retrieve/query throw sanitization, non-page-like
filtering. **line-agent 647/647.**

## Smoke — PASSED (masked)

`npm run agent:notion-rag-dry-run` now completes with counts only (no token / db
id / notion.so url / customer name / cost / profit):

```
Notion RAG Dry-run · 完成
總筆數：<n>
來源：
  · 私帳 2026：頁 <n> / 筆 <n>（已載入）
區域 token：<n> · 主題 token：<n>
```

## Follow-up (not started, out of this knife's scope)

Observed in the live smoke: `區域/主題 token` came back at 0 and the merged
record count was slightly below the loaded page count — i.e. the real 2026
Notion column names don't fully line up with what `notion-mapper.ts` expects, so
area/theme tokens aren't being extracted and some rows merge/drop. This is a
field-mapping (data-quality) follow-up, NOT a wiring issue: `listPages` via the
data-source flow is verified working. Next knife: reconcile the mapper field
policy against the real `private_2026` schema.
