# Notion RAG · Retrieval Quality Tests + Free-text Query Bridge — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (`11f0baa`). Fixture-first cut: instead of
adding more alias vocab, this knife verifies *retrieval quality* — does a
customer-style free-text need retrieve the right CASE TYPE? NO LLM, NO real
Notion, NO live LINE, NO Sanity, NO scheduler/cache. No secret or PII printed.

## Why this cut (not more aliases)

Prior smoke (`40f6158`) confirmed the live corpus has area=7 / theme=11 distinct
tokens — the vocab is no longer the bottleneck. The open risk moved downstream:
the corpus stores **canonical snake_case** hints (`chiangmai`, `night_safari`),
but customers type free text (`清邁 親子 5天 大象 夜間動物園`). Nothing yet proved
the query side resolves into the *same* tokens, or that an out-of-scope ask
doesn't bleed into the whole corpus. This cut closes that gap with tests.

## What changed (code)

- **`notion/rag-query.ts` (new)** — free-text → `RagIndexQuery` bridge.
  - `parseRagQuery(text)` reuses `parseItineraryHints` so query tokens come from
    the SAME alias table the corpus was ingested with. Only in-vocab tokens
    survive; `親子 / 5天 / 金三角 / 包車 / 東京` resolve to nothing (Eric's 不亂補).
  - `partySize` parsed from a bare `N人`; `包車` is intentionally NOT mapped to a
    vehicleType — retrieval never commits to a vehicle or a quote.
  - `retrieveRagCases(index, text)` returns **EMPTY** when the parsed query has
    zero usable signal (no area, no theme, no partySize), so an out-of-scope ask
    never returns the whole corpus.
- **`notion/rag-index.ts`** — `queryRagIndex` now accepts `areas[]` (multi-area
  OR-gate). Each area hit counts as a matched dimension, so a case covering more
  asked areas ranks first. Single `area` path unchanged. Ingestion untouched.

## What changed (tests)

`__tests__/notion-rag-retrieval-quality.test.ts` (11 tests), fixture corpus of 8
private_2026 cases with canonical snake_case hints (mirrors real post-ingestion
records). The 7 locked scenarios:

| # | Query | Expect (top / membership) |
|---|---|---|
| 1 | 清邁 親子 5天 大象 夜間動物園 | CM family elephant+night_safari first; `親子`/`5天` ignored; family is structural |
| 2 | 清萊 芳縣 金三角 | chiangrai+fang combo first, chiangrai-only included; `金三角` ignored |
| 3 | 湄康蓬 飛索 咖啡 | mae_kampong zipline+cafe first |
| 4 | 南邦 一日 | lampang case; `一日` ignored (not over-constrained) |
| 5 | 茵他儂 親子 | inthanon family case |
| 6 | 6人 包車 | large-party case via partySize; NO vehicle assertion |
| 7 | unknown (東京 滑雪 / lone 金三角) | EMPTY — no bleed into unrelated cases |

Plus `parseRagQuery` vocab-boundary units and a multi-area ranking unit.

## Verification

- Targeted: `notion-rag-retrieval-quality.test.ts` 11/11 green.
- Regression: builder test (single-`area` path) still green.
- Full `src/lib/line-agent` suite: **55 files / 712 tests green**.
- `tsc --noEmit` clean for the three touched files (pre-existing errors in
  unrelated test files left as-is — out of scope).

## Design rules locked

- "family/kids" is a STRUCTURAL fact (`children`/`partySize`), never a parsed
  theme — `親子` stays out of the 11-theme vocab. Retrieval surfaces the family
  case via its activity themes; the bot layer (not retrieval) reasons about who
  it is for.
- Retrieval ranks by source priority → matched dimensions → stable tiebreak.
  Still NO weighted scorer, NO fuzzy matching.
- Retrieval output is internal ranking only — not wired to any outward reply.

## Not done (by design)

- Not wired to the LINE live path / responder; this is the internal ranking
  contract only.
- partySize→vehicleType mapping and any quote logic deliberately NOT added at the
  retrieval layer.
- Still NOT started: formal Sanity build + real `/quote/[slug]` (needs Eric's
  server-side write-token approval). Branch stays as-is (no merge/PR).
