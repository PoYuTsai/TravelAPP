# Notion RAG · Itinerary Parser Masked Real Smoke — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp`. Operator dry-run masked smoke against the real
`private_2026` database. NO live LINE, NO Sanity, NO scheduler/cache, NO code
change in this step. No secret (token / db id / Notion url / customer name /
cost / revenue / profit) is printed to terminal, code, tests, or docs.

## What ran

`npm run agent:notion-rag-dry-run` (tsx + `--env-file=.env.local`), with the real
gates on: `AI_AGENT_NOTION_RAG_ENABLED=true`, `AI_AGENT_NOTION_RAG_RUNTIME=real`,
`NOTION_TOKEN` present. The CLI formatter is masked-by-contract: it emits only
status / counts — never a db id, token, notion.so url, PII, or money.

## Masked result (verbatim, safe projection)

```
Notion RAG Dry-run · 完成
總筆數：90
來源：
  · 私帳 2026：頁 90 / 筆 90（已載入）
區域 token：7 · 主題 token：2
```

| Metric | Value | Source |
|---|---|---|
| status | ok (完成) | report.status |
| source pageCount | 90 | private_2026 |
| source recordCount | 90 | private_2026 |
| index total records | 90 | `index.records.length` |
| area token count (distinct) | 7 | `index.byArea.size` |
| theme token count (distinct) | 2 | `index.byTheme.size` |

Token *names* are intentionally NOT surfaced by the masked formatter (it prints
counts only). The canonical hints are de-identified (e.g. `chiangmai`), so
exposing names would be safe, but that needs a small formatter change — deferred
(this step is no-code).

## Judgment

- **area/theme token count > 0 → parser is effective on real data.** All 7 area
  aliases (清邁/清萊/芳縣/茵他儂/湄康蓬/南邦/南奔) resolved against live rows; both
  theme aliases (大象/夜間動物園) resolved too. The earlier live symptom
  `區域/主題 token = 0` is cleared.
- **90 pages → 90 records, zero drop → fingerprint/dedupe healthy.** The previous
  "rows merge/drop" symptom (empty facts → identical `computeNaturalFingerprint`
  → `dedupeCaseRecords` collapse) is resolved: real field mapping + derived
  area/theme give every case distinct facts, so no false merges.

## Next knife candidates (not started)

- **Theme vocabulary is thin (2 distinct):** the theme alias table only has
  大象/夜間動物園. Expand with 動物園→zoo, 叢林飛索→zipline, 咖啡廳→cafe,
  藍廟→blue_temple, 按摩→massage, 拍照/網美→photo, 茵他儂→(area already)… driven
  by real-case TDD when needed. Adding 動物園→zoo will exercise the parser's
  longest-alias-first span consumption against 夜間動物園 for real.
- Optional: a masked formatter cut to list de-identified token *names* + counts.
- Still NOT started: formal Sanity build + real `/quote/[slug]` (needs Eric's
  server-side write-token approval). Branch stays as-is (no merge/PR).
