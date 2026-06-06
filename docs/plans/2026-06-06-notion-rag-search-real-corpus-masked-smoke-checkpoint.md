# Notion RAG · Operator Retrieval Preview — Real-Corpus Masked Smoke (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (`8e57623`). Closes the "Not done" item from
`2026-06-06-notion-rag-search-preview-checkpoint.md`: the real-Notion masked
smoke that needed Eric's `.env.local`
(`AI_AGENT_NOTION_RAG_ENABLED=true` + `AI_AGENT_NOTION_RAG_RUNTIME=real` +
`NOTION_TOKEN`, via `tsx --env-file=.env.local`).

No code changed. No `.env.local` / token / db id / Notion url / customer name /
cost / revenue / profit reproduced in this report. Itinerary free-text snippets
were stripped before anything was written down (see GAP-1).

## Smoke matrix (90-record live index)

| # | Query | Parsed tokens | Hits | Verdict |
|---|-------|---------------|------|---------|
| 1 | 清邁 親子 5天 大象 夜間動物園 | area `chiangmai` · theme `elephant,night_safari` | 5 | ✅ top-5 all chiangmai + elephant + night_safari |
| 2 | 清萊 芳縣 金三角 | area `chiangrai,fang` | 5 | ✅ top result carries `fang/chiangrai`; 金三角 has no theme token (acceptable) |
| 3 | 湄康蓬 飛索 咖啡 | area `mae_kampong` · theme `zipline,cafe` | 5 | ✅ top = `mae_kampong` + `zipline` + `cafe` |
| 4 | 南邦 一日 | area `lampang` | 1 | ✅ sole hit is `lampang`; corpus is thin on lampang, retrieval found the right one |
| 5 | 茵他儂 親子 | area `inthanon` | 5 | ✅ top result carries `inthanon` |
| 6 | 6人 包車 | partySize `6` | 5 | ✅ top result partySize 6; no vehicleType committed (retrieval-only, as designed) |
| 7 | 完全不相關測試字串 | (all empty) | 0 | ✅ `low_confidence`, empty results — never returns the whole corpus |

All seven met the expected behavior. Area parsing (chiangmai / chiangrai / fang /
mae_kampong / lampang / inthanon), theme parsing (elephant / night_safari /
zipline / cafe), partySize parsing (6), and the zero-signal `low_confidence`
guard all hold against the real 2026 corpus.

## Locked behaviors confirmed live

1. enabled + query → builds the real index (90 records) and ranks top-N.
2. unknown query → `low_confidence`, 0 hits, not the whole corpus.
3. query tokens surface as canonical area/theme/partySize.
4. structured projection (area/theme/partySize/vehicleType) is operator-safe.

## Gaps found (record-only; fix next cut with fixture TDD, no code this round)

- **GAP-1 (privacy — `itinerarySnippetPreview`)**: the whitelisted
  `itinerarySnippetPreview` field is free itinerary text, and on real records it
  contains **customer names and flight numbers** (e.g. a guest name fragment and
  an airline flight code appeared in the Day-1 line). The projection whitelist
  treats the snippet as safe, but the *content* of the snippet is not. Next cut:
  either drop the snippet from the operator-safe projection, or sanitize it
  (strip names / flight codes / phone-like tokens) before it leaves
  `toOperatorSafeCaseSummary`. Add a fixture with a leaky itinerary line and a
  no-PII assertion.
- **GAP-2 (retrieval quality — 親子/family theme)**: 親子 is the brand's core
  segment but does not parse into any theme token (queries 1 and 5 both show
  empty/elephant-only themes, no `family`). Consider adding a `family` theme to
  the vocabulary + parser and tagging family-friendly records, so 親子 queries
  rank family cases first. Fixture: 親子 query → expect `family` token + a
  family-tagged top result.

Neither gap blocks the operator preview; both are queued for the next
fixture-driven cut. Ranking/parser stays untouched this round per the
"don't rush the fix" rule.

## Not changed (by design)

- Operator CLI preview only — still NOT wired to the LINE live path / responder.
- No partySize→vehicleType mapping, no quote, no LLM, no Sanity write, no
  scheduler/cache.
- Branch stays as-is (no merge/PR).
