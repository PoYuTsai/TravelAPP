# Notion RAG · Operator Retrieval Preview Command — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (`5e2ffb6`). Operator-only masked retrieval
preview so Eric can probe real Notion corpus query quality from the CLI. NOT
wired to the LINE live path, NO Sanity, NO scheduler/cache, NO LLM, NO real
secret printed.

## Command

```
npm run agent:notion-rag-search -- "清邁 親子 5天 大象 夜間動物園"
```

Runs via `tsx --env-file=.env.local` (same runner as `agent:notion-rag-dry-run`).
Output is masked by contract — status, parsed query tokens, hit count, and an
operator-safe per-case summary only.

## Layers (mirrors the notion-rag-dry-run seam)

- **TS `notion/notion-rag-search.ts` (pure)**:
  - `toOperatorSafeCaseSummary(record)` — projects ONLY a whitelist of `facts`:
    days / nights / areaHints / themeHints / partySize / vehicleType /
    `itinerarySnippetPreview` (truncated). Never reads `privateContext` or
    `identity` → cost / revenue / profit / private notes / Notion url / db id /
    raw record id / PII structurally cannot appear.
  - `searchRagIndex(index, query, {topN})` — `parseRagQuery` → `retrieveRagCases`
    → slice top-N → project. Zero-signal / no-hit query → `low_confidence` with
    empty results (never the whole corpus).
  - `runNotionRagSearch(env, client, query)` — operator runtime: resolve config +
    `buildNotionRagIndex(config, client)`; config-skip / build-error surface as
    code-only reports; otherwise an operator-safe ranked preview.
- **CLI `scripts/agent-command.mjs`**:
  - `parseAgentCommandArgs` captures the free-text query.
  - `formatNotionRagSearchReport` renders the already-safe summary (masked by
    construction — reads only whitelisted fields).
  - `runNotionRagSearchCommand` — disabled gate → skipped (NOTHING loaded, no
    Notion read); else runtime loader; loader/runner throw → sanitized
    `client_error`; missing runner → `client_not_wired`.
- **Loader `scripts/notion-rag-dry-runner.mjs`**: `loadNotionRagSearchRuntime` +
  `importSearchDefault` — same gates (AI_AGENT_NOTION_RAG_RUNTIME=real +
  NOTION_TOKEN) and the same `NotionRagRuntimeWiringError` leak guard as the
  dry-run loader.

## Masked output shape

```
RAG 檢索預覽 · 完成
查詢 token：區域 [chiangmai] · 主題 [elephant, night_safari] · 人數 -
索引總筆數：90
命中：3（顯示前 3）
  1. 5天4夜 · 區域 chiangmai · 主題 elephant/night_safari · 4人 · 車型- · 行程：Day 1｜清邁古城…
  ...
```

Skipped: `RAG 檢索預覽 · 已略過（AI_AGENT_NOTION_RAG_ENABLED 未開啟…）`.
Low confidence: `RAG 檢索預覽 · 低信心（無足夠訊號或無命中）… 命中：0`.
Error: `RAG 檢索預覽 · 失敗 / 錯誤碼：client_error｜client_not_wired`.

## Verification

- Targeted `notion-rag-search.test.ts` — 10/10 green (arg parse, disabled-skip
  with loader untouched, retrieval+ranking, topN, unknown→low_confidence,
  projection+formatter no-leak against a maximal leaky record, canonical token
  display, sanitized client error, client_not_wired).
- Full `src/lib/line-agent` suite: **56 files / 722 tests green** (no regression
  in the shared agent-command / dry-runner tests).
- `tsc --noEmit` clean for `notion-rag-search.ts`.
- Masked CLI smoke (no `.env.local`, no secrets): disabled env → 已略過 (no Notion
  read); enabled + plain node → sanitized `client_error` (the `.ts` runtime needs
  tsx — same as dry-run).

## Six locked behaviors (the spec)

1. disabled gate → skipped, nothing loaded / no Notion read.
2. enabled + query → build index → retrieve top results.
3. unknown query → empty / low confidence, never the whole corpus.
4. projection + formatter never leak privateContext / PII.
5. query tokens surface as canonical area/theme.
6. Notion client error → sanitized (no token / db id / notion.so url).

## Not done (by design)

- NOT wired to the LINE live path / responder — operator CLI preview only.
- No partySize→vehicleType mapping, no quote, no LLM, no Sanity write, no
  scheduler/cache.
- Real-corpus masked smoke (`AI_AGENT_NOTION_RAG_ENABLED=true` +
  `AI_AGENT_NOTION_RAG_RUNTIME=real` + `NOTION_TOKEN` via tsx) left for Eric to
  run with his token — this cut never reads `.env.local` or prints real data.
- Branch stays as-is (no merge/PR).
