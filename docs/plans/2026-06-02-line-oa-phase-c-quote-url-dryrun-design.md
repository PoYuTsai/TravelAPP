# Phase C — Quote URL Automation (Dry-Run) Design

- **Status:** ✅ implemented (TDD, 2026-06-02, commit `8067e18` on `codex/line-oa-agent-mvp`). 16 tests green (quote-url 8 + create-quote 8), lint clean, parser untouched, no Sanity client imported.
- **Date:** 2026-06-02
- **Branch:** `codex/line-oa-agent-mvp`
- **Engineering plan task:** Task 10 (`docs/plans/2026-06-01-line-oa-agent-engineering-plan.md:418`)
- **Scope decision:** **A — dry-run only** (Eric, 2026-06-02 on Discord)

## Scope (locked)

This round is **dry-run only**. Hard boundaries, all confirmed by Eric:

- ❌ No Sanity write / mutation of any kind.
- ❌ No new server-side Sanity write token / credential.
- ❌ No official, usable `/quote/[slug]` URL produced.
- ❌ Do **not** rebuild the parser — bracket-ticket parsing was already patched by Codex; Phase C reuses parser/review/validation as-is.
- ✅ Build the deterministic, fully unit-testable pieces only.
- ✅ Any URL the flow emits is a **would-be URL**, explicitly flagged as *not official* because no Sanity document was written.

Official document creation + a real `/quote/[slug]` URL are deferred to a **later phase**, gated on Eric explicitly approving a server-side Sanity write token.

## Reuse — existing anchors (do not reinvent)

| Need | Existing anchor |
|------|-----------------|
| Parse itinerary text | `parseItineraryText(text, year?)` — `src/lib/itinerary/parser.ts:214` |
| Parse quotation text | `parseQuotationText(text, year?)` — `src/lib/itinerary/parser.ts:551` |
| Itinerary review | `reviewItinerary(text, year?)` → `ItineraryReview` — `src/lib/line-agent/quote/parse-review.ts:93` |
| Quotation review | `reviewQuotation(text, year?)` → `QuotationReview` — `src/lib/line-agent/quote/parse-review.ts:123` |
| Validation + severity | `generateValidationReport(text, year?)` → `ValidationReport { severity }` — `src/lib/line-agent/quote/validation-report.ts:53` |
| Severity contract | `'ok' | 'needs_human_check' | 'blocked'` — `validation-report.ts:28` |
| Target doc shape | Sanity `itinerary` schema — `src/sanity/schemas/itinerary.ts` (clientName, startDate, endDate, adults, children, childrenAges, totalPeople, rawItineraryText, days, quotation, publicSlug) |
| Audit log | `src/lib/line-agent/audit/audit-log.ts` |

> Note: `generateShortSlug` currently lives **inline + unexported** inside `PricingCalculator.tsx`. Phase C `quote-url.ts` owns a clean, pure, reusable slug/URL builder; the future real-write path can later adopt it.

## Files

| File | Responsibility |
|------|----------------|
| `src/lib/line-agent/quote/quote-url.ts` | Pure slug + URL builder. No I/O. |
| `src/lib/line-agent/quote/create-quote.ts` | Orchestrate: raw inputs → parser/review dry-run → validation report → severity gate → ready-to-write draft payload + would-be URL (flagged). |
| `src/lib/line-agent/quote/sanity-write.ts` | **Interface/stub only.** Defines the write contract; the dry-run implementation never mutates — returns a "not written" result. |
| `src/lib/line-agent/__tests__/quote-url.test.ts` | Unit tests for slug/URL builder. |
| `src/lib/line-agent/__tests__/create-quote.test.ts` | Unit tests for orchestration + severity gating + dry-run flagging. |

No API route this round (`/api/agent/quote/create` is deferred — it's the live-write surface). Phase C is library-only so it stays a pure, testable unit with no auth/token surface.

## Data flow

```
raw itinerary text ─┐
raw quote text      ├─► create-quote.ts
caseId, actor,      │      1. parseItineraryText + reviewItinerary
sourceChannel       ┘      2. parseQuotationText + reviewQuotation
                           3. generateValidationReport(quoteText) → severity
                           4. severity gate:
                                'blocked'           → return { status: 'blocked', report, draft: null, url: null }
                                'ok'|'needs_human'  → build draft payload (projection onto itinerary schema)
                                                    → quote-url.buildWouldBeQuoteUrl({origin,caseId}) → /quote/DRAFT-<caseId>, isOfficial:false
                                                    → sanity-write stub: assertNotWritten() (no mutation)
                                                    → return { status, report, draft, wouldBeUrl }
                           5. audit-log append: 'quote.dryrun' entry (no write performed)
```

## Decisions (confirmed by Eric, 2026-06-02)

1. **Would-be URL representation — CONFIRMED.** `quote-url.ts` stays pure: `buildWouldBeQuoteUrl({ origin, caseId })`. The dry-run flagging is the return shape itself:
   ```ts
   interface WouldBeQuoteUrl {
     wouldBeUrl: string            // e.g. https://chiangway-travel.com/quote/DRAFT-<caseId>
     isOfficial: false             // always false this phase
     reason: 'no_sanity_document_written'
     note: string                  // 繁中: 「尚未建檔，此為預覽用網址，非正式連結，不可傳給客戶」
   }
   ```
   **Hard contract:** every consumer / display surface (command router, LINE/DC relay, logs) must treat this as **non-official preview only** — never render it as a sendable link. Encode this expectation in `create-quote.test.ts` and in the router-facing summary text.

2. **Slug in dry-run — CONFIRMED (Eric override → placeholder, NOT random).** Use a fixed `DRAFT-<caseId>` placeholder slug. **Do not** mint a real-format random 8-char slug this phase. Rationale (Eric): with no Sanity write, any real-looking `/quote/<8char>` URL risks Eric/partners accidentally treating it as a sendable public quote link; the `DRAFT-` prefix makes it structurally impossible to mistake for a live link. The random-slug generator belongs to the future real-write phase, not here.

3. **`sanity-write.ts` stub shape — CONFIRMED.** Define the real interface now so the next phase only swaps the impl:
   ```ts
   interface QuoteWriteResult { written: boolean; documentId?: string; publicSlug?: string }
   interface QuoteWriter { write(payload: ReadyToWriteQuoteDraft): Promise<QuoteWriteResult> }
   ```
   Dry-run export: `dryRunQuoteWriter` whose `write()` returns `{ written: false }` and **never** imports or calls a Sanity client. `liveQuoteWriter` may exist **only as an inert placeholder** — not wired into the flow, no Sanity client import, no mutation path this phase.

## Error handling

- `blocked` severity is a **normal control-flow result**, not an exception — returns a structured blocked result the command router can relay to LINE/DC (consistent with the bug-packet philosophy; full bug packet is Task 12).
- Parser/review throwing on malformed input → caught, surfaced as `status: 'error'` with the raw input echoed, never swallowed (global rule: external/parse errors must not be silently dropped).
- The dry-run writer is structurally incapable of mutating Sanity — there is no client wired in this phase.

## Testing (TDD, no parser re-test)

- `quote-url.test.ts`: `DRAFT-<caseId>` slug composition, URL composition, origin handling, and an assertion that the slug **always** carries the `DRAFT-` prefix (no random 8-char slug path exists).
- `create-quote.test.ts`:
  - `blocked` report → no draft, no URL, audit entry says no write.
  - `needs_human_check` → draft built + would-be URL flagged `isOfficial: false`.
  - `ok` → draft built + would-be URL flagged `isOfficial: false` (still not official — dry-run).
  - dry-run writer asserted to never report `written: true`.
  - malformed input → `status: 'error'`, raw input preserved.
- Reuse existing quote fixtures in `src/lib/line-agent/quote/fixtures/`. **Do not** add new parser golden cases — parser is frozen for Phase C.
- Verify: `npm run test:run -- src/lib/line-agent/__tests__/quote-url.test.ts src/lib/line-agent/__tests__/create-quote.test.ts`, then `npm run lint`.

## Out of scope (deferred to next phase)

- `/api/agent/quote/create/route.ts` (live write surface).
- Real `client.createOrReplace` / `patch` Sanity mutation + `liveQuoteWriter`.
- Server-side Sanity write token / credential.
- `source = ai-agent` / `reviewStatus = needs_review` schema fields (Task 10 step 6/8 — defer, no schema churn).
- Official, persisted `/quote/[slug]` URL.

## Done criteria for the implementation session

1. Three source files + two test files created, all tests green, lint clean.
2. No Sanity client imported anywhere in the Phase C files.
3. Every emitted URL carries `isOfficial: false` and a `DRAFT-<caseId>` slug — no random real-format slug path.
4. Do **not** touch `src/lib/itinerary/parser.ts` unless a test proves a new parser regression (Eric, 2026-06-02).
5. Commit on `codex/line-oa-agent-mvp` (branch stays as-is — no merge / no PR).
