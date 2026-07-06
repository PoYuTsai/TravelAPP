# Notion RAG · GAP-1 Itinerary PII Sanitize — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (feature `9ea2a51`). Fixes GAP-1 found in the
real-corpus masked smoke (`2026-06-06-notion-rag-search-real-corpus-masked-smoke-checkpoint.md`):
the operator-safe RAG search output leaked itinerary free text.

Fixture-first TDD. No real Notion at start, no LINE live path, no Sanity, no LLM,
no `.env.local` / secret printed. Only the operator projection + formatter were
changed; ingestion / raw records were untouched.

## Root cause

`toOperatorSafeCaseSummary` whitelisted a truncated `itinerarySnippetPreview`
built from `facts.itinerarySnippet`. The whitelist treated the *field* as safe,
but the *content* is free 行程框架 text. On real records that line carries
customer names, flight numbers, phone numbers, URLs, and amounts — e.g. the live
smoke surfaced `… 機場接機 王小明一家 (長榮 BR257 …) …`.

## Fix (conservative first cut — drop, don't sanitize)

Eric's call: drop the raw snippet rather than risk an unreliable sanitizer
mis-judging text as safe. Re-introducing a snippet later would need a dedicated
sanitizer + leaky fixtures.

- `notion/notion-rag-search.ts`:
  - `OperatorSafeCaseSummary.itinerarySnippetPreview` retyped `?: never` — any
    code that sets it is now a **type error**, not a silent re-leak.
  - `toOperatorSafeCaseSummary` no longer reads `facts.itinerarySnippet`; removed
    the `previewSnippet` helper, `DEFAULT_SNIPPET_CHARS`, and the
    `snippetPreviewChars` opt from `searchRagIndex` / `runNotionRagSearch`.
- `scripts/agent-command.mjs`:
  - `formatSafeCaseLine` drops the `行程：…` segment; lines now end at `車型-`.

Output now carries only structured facts:
`days / nights / areaHints / themeHints / partySize / vehicleType`.

## TDD

RED → GREEN. New fixture `piiSnippetRecord` seeds the itinerary line with
`王小明` + `BR257/TG130/FD243` + phone `0912345678` + `example.com` URL + `42000`.

New `describe('operator-safe projection — itinerary snippet dropped (GAP-1)')`,
6 specs:
1. customer name dropped from summary
2. flight numbers dropped
3. phone + URL dropped
4. monetary amount dropped
5. structured facts kept (area/theme/partySize/vehicleType/days/nights);
   `itinerarySnippetPreview` is `undefined`
6. rendered report carries no raw itinerary text, structured facts still shown

Existing leaky-record spec updated: `itinerarySnippetPreview` now asserted
`undefined` (was `toContain('清邁古城')`).

## Verification

- Watched RED: 6 failing specs, failure message showed the snippet leaking
  `王小明 / BR257 / 0912345678 / 42000`.
- GREEN: target file 16/16; full `src/lib/line-agent` suite **728/728** (was 722,
  +6); `tsc --noEmit` clean for `notion-rag-search.ts`; no lingering references to
  the removed field/opt outside tests.
- Masked real-corpus smoke (`清邁 親子 大象 夜間動物園`): all 5 result lines now end
  at `車型-` — no names, flights, phone, or amounts.

## Not done (by design)

- No sanitizer / re-introduced snippet — that is a later cut if a structured,
  PII-free itinerary summary is ever wanted.
- GAP-2 (親子/family theme not parsed into a token) still open — next cut.
- Operator CLI preview only; not wired to LINE live path; no Sanity, no quote, no
  LLM. Branch stays as-is (no merge/PR).
