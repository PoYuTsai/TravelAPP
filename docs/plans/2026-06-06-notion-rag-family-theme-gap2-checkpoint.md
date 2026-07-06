# Notion RAG · GAP-2 Family/Kids Theme Signal — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (feature `e93a450`). Closes GAP-2 noted at the
end of the GAP-1 checkpoint (`2026-06-06-notion-rag-search-gap1-itinerary-pii-fix-checkpoint.md`):
親子/family was never parsed into a retrieval token, so a family query only hit
family cases via their activity themes — unstable.

Fixture-first TDD. No real Notion at start, no LINE live path, no Sanity, no LLM,
no scheduler/cache, no `.env.local` / secret printed.

## Root cause

v1 deliberately treated "family/kids" as a STRUCTURAL-only fact (children /
partySize) and kept it out of the theme vocab ("不亂補"). But retrieval matching
is exact (`normalizeText` then equality), so a query token `親子` and a corpus
record were never on the same axis: `親子` ≠ any theme, and a real family case
whose 行程框架 lacked 親子 (signal lived in 旅遊人數 `成人2 小朋友2`) carried no
family-ish theme at all. Family queries therefore leaned on activity words only.

## Fix — family/kids becomes a canonical `family` theme

- `notion/itinerary-parser.ts`:
  - `THEME_ALIASES` += `小朋友 / 親子 / 小孩 / 兒童 / family / kids → family`
    (`小朋友` longest-first so the `小孩` substring can't re-match the span).
  - `AREA_ALIASES` += english `chiangmai → chiangmai` (some queries write it).
- `notion/notion-rag-adapter.ts`:
  - After the itinerary fallback, derive `family` when there is an explicit child
    count (`facts.children > 0` from the 旅遊人數 split) OR a family/child word in
    the itinerary / party free-text.
  - Guarded by `hasFamilyTheme()`: if themeHints already carries family — raw
    (`親子`) or canonical (`family`) — it is not double-added, so every existing
    explicit `行程類型: 親子` fixture stays a clean passthrough.
  - **partySize alone never triggers it**: a bare `6人` or adults-only `成人9`
    stays non-family (the "不要把所有 partySize > 1 都標 family" rule).
- `notion/rag-query.ts`: parser bridge needs no logic change — it inherits the
  new vocab through `parseItineraryHints`; only the locked-discipline doc comment
  was inverted to reflect the new contract.

Query and corpus now line up on the same `family` token.

## TDD

RED → GREEN. New `__tests__/notion-rag-family-theme.test.ts`, 9 cases:
1–3. `parseRagQuery`: `清邁 親子 5天 大象` → family+elephant; `小朋友 夜間動物園`
   → `[family, night_safari]`; `family kids chiangmai` → `[family]` (deduped) +
   area `chiangmai`.
4. ingestion: 行程框架 含 親子 → family; 旅遊人數 含 小朋友 → family (activity
   themes elephant/night_safari preserved, children=2).
6. adults-only: 純 `6人` and `成人9` → NOT family.
5. retrieval: `清邁 親子` ranks the family-ish CM case (area + family theme, 2
   dims) above a same-area honeymoon distractor (area only).
7. privacy: partner-safe view exposes `family` theme but drops cost / guest name.

Three existing assertions updated for the reversal (expected): the
`real-family-cm-5d` themeHints now lead with `family` in
`notion-itinerary-parser.test.ts` and `notion-rag-real-schema.test.ts`, and
`notion-rag-retrieval-quality.test.ts`'s `parseRagQuery` spec now expects
`[family, elephant, night_safari]`; its inverted "family is structural" header /
scenario comments were rewritten.

## Verification

- Watched RED: 7 of 9 new cases failed on "expected […] to include 'family'";
  6a/6b (adults-only) passed from the start (correctly never family).
- GREEN: new suite 9/9; full `src/lib/line-agent` suite **737/737** (was 728,
  +9); `tsc --noEmit` clean for the four changed `notion/` + test files (the
  remaining repo-wide tsc noise is pre-existing test-file `any`/iteration/NODE_ENV
  errors, unrelated to this cut).

## Not done (by design)

- Masked real-corpus smoke skipped this cut to honor the "不打真 Notion 起手"
  constraint; can be run later via `npm run agent:notion-rag-search -- "清邁 親子 大象"`.
- Explicit `行程類型` columns stay RAW passthrough (not canonicalized to
  `family`) — the real private_2026 corpus has no such column, so the
  itinerary/party-derived path is the one that matters.
- Operator CLI / index only; not wired to LINE live path; no Sanity, no quote, no
  LLM, no scheduler. Branch stays as-is (no merge/PR).
