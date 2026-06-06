# Notion RAG · Theme Vocab Expansion Masked Real Smoke — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (`3b3c8e5`). Operator dry-run masked smoke
against the real `private_2026` database, verifying the theme vocab expansion
(`8e83f30`) on live data. NO code change in this step. NO live LINE, NO Sanity,
NO scheduler/cache. No secret (token / db id / Notion url / customer name /
cost / revenue / profit) is printed to terminal, code, tests, or docs.

## What ran

`npm run agent:notion-rag-dry-run` (tsx + `--env-file=.env.local`), real gates
on: `AI_AGENT_NOTION_RAG_ENABLED=true`, `AI_AGENT_NOTION_RAG_RUNTIME=real`,
`NOTION_TOKEN` present. The CLI formatter is masked-by-contract — status / counts
only, never a db id, token, notion.so url, PII, or money.

## Masked result (verbatim, safe projection)

```
Notion RAG Dry-run · 完成
總筆數：90
來源：
  · 私帳 2026：頁 90 / 筆 90（已載入）
區域 token：7 · 主題 token：11
```

| Metric | Value | Δ vs prev smoke (`d7579c0`) |
|---|---|---|
| status | ok (完成) | = |
| source pageCount | 90 | = |
| source recordCount | 90 | = |
| index total records | 90 | = |
| area token distinct | 7 | = |
| theme token distinct | **11** | **2 → 11** |

## Judgment

- **theme distinct 2 → 11 (> 2) → new vocab is effective on real data.** The
  expanded alias table (zoo/zipline/cafe/temple/market/massage/photo/shopping/
  adventure) resolves against live 行程框架 rows, not just fixtures. Real distinct
  (11) even exceeds the fixture corpus (8) — the live data exercises more of the
  new aliases than the 3 fixture pages do. The "theme 詞庫偏薄" bottleneck is
  cleared.
- **90 pages → 90 records, zero drop → dedupe/fingerprint still healthy.** Richer
  per-case theme facts did not cause false merges; every case keeps a distinct
  fingerprint.
- area distinct unchanged at 7 (area aliases were not touched this knife).

## Not done (by design)

- Token *names* still NOT surfaced (masked formatter prints counts only). A
  de-identified name+count cut remains an optional deferred formatter change.
- Still NOT started: formal Sanity build + real `/quote/[slug]` (needs Eric's
  server-side write-token approval). Branch stays as-is (no merge/PR).
