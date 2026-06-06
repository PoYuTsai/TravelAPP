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

## Smoke — BLOCKED by Notion SDK v5 data-source migration

`npm run agent:notion-rag-dry-run` currently returns:

```
Notion RAG Dry-run · 失敗
錯誤碼：client_error（Notion 連線失敗）
```

Root cause (confirmed by direct, masked probing — no values printed):

- `@notionhq/client` v5 **removed `databases.query`** (`typeof
  notion.databases.query === 'undefined'`) and moved to the Notion **2025-09-03
  data-source model** (`notion.dataSources` is present).
- Our adapter `notion-rag-client.ts` is still a **contract-tested
  `databases.query` adapter**, so the real SDK call hits `undefined` → `TypeError`
  → sanitized `client_error`.

So: **real dry-run wiring landed; smoke blocked by the SDK v5 data-source
migration.** Blocker 1 (URL db id) is resolved; Blocker 2 (SDK v5) is the wall.

## Next knife (not started)

**Notion SDK v5 data-source migration — TDD.** Update the
`notion-rag-client.ts` contract to support the v5 flow:

```
databases.retrieve(database_id) → data_sources[].id → dataSources.query(data_source_id)
```

Open design question to settle first: a database may expose multiple data
sources — query the first, all, or merge? Decide before touching the adapter.
Keep the loader-port `NotionRagClient.listPages(databaseId)` surface stable so
the loader/traverse/command layers above do not change.
