# M3.1 — RAG-Assisted Answer Composer (Design)

**Date:** 2026-06-06
**Branch:** `codex/line-oa-agent-mvp` (tip `09d6241`)
**Status:** IMPLEMENTED (commit `2bd30ac`). TDD complete — 13 contract tests green,
full line-agent suite 750/750. Single module `notion-rag-answer-composer.ts` holds
both `composeAnswer` + `transportationAssessment` (helper co-located, not split into
`transportation-assessment.ts` — kept one file per task scope).
**Scope:** Pure deterministic composer that turns operator-safe retrieval results
into a **partner-group draft answer**. No LLM, no CLI, no LINE live path, no
Sanity, no Notion API, no scheduler/cache this slice.

---

## Goal

Turn `NotionRagSearchResult` (already operator-safe) into a concise, Eric-style
**partner-group draft** that an operator can review and (later, separately) send.
The composer decides *how to say it safely* — separating "internal past-case
tendency" from "needs confirmation", never faking price/availability, never
leaking private fields.

This is the smallest safe step after M3 readiness: lock the **answer contract**
before any trigger wiring, CLI preview, or LLM phrasing.

---

## What this slice does / does NOT do

Does:
- `notion-rag-answer-composer.ts` — pure function: retrieval result + question →
  composed partner-group draft.
- `transportation-assessment.ts` — pure deterministic helper: party/luggage/
  airport signals → vehicle **direction** (never a promise) + `mustConfirm`.
- Contract tests (RED-first) pinning tone, confidence behavior, `mustConfirm`,
  vehicle assessment, and privacy.

Does NOT (explicitly out of scope):
- No LLM call. `refine` hook exists but defaults `false` and is never invoked.
- No operator CLI (`agent:notion-rag-answer` is a **later** slice).
- No trigger wiring (tag/quote detection), no partner-group send, no OA reply.
- No Sanity write, no formal quote, no web search, no Notion API, no scheduler.

---

## Output target (decided)

- **Partner group only.** The draft is phrased for the partner LINE group.
- **Not customer OA.** Nothing here replies to a customer; no auto-reply.
- **Not a formal quote.** No price, no vehicle/headcount commitment.

---

## Upstream safety is inherited, not re-litigated

The composer consumes `NotionRagSearchResult` from `notion-rag-search.ts`:

```ts
interface NotionRagSearchResult {
  status: 'ok' | 'low_confidence'
  parsedQuery: { areas: string[]; themes: string[]; partySize?: number }
  totalRecords: number
  resultCount: number
  results: OperatorSafeCaseSummary[]   // days/nights/areaHints/themeHints/partySize/vehicleType
}
```

`OperatorSafeCaseSummary` is a whitelist projection; `itinerarySnippetPreview` is
pinned to `never` (GAP-1). So **customer name / cost / revenue / profit / Notion
URL / db id / raw itinerary cannot structurally enter the composer input.** The
composer's only privacy duty is: do not *fabricate* such strings itself, and do
not echo the raw question back unsanitized if it contains PII (the question is
operator-typed in this slice, but tests still assert no money/id tokens leak).

---

## Composer contract

```ts
interface ComposeAnswerInput {
  userQuestion: string
  search: NotionRagSearchResult           // upstream operator-safe result
  transportation?: TransportationAssessmentInput  // optional, see helper
  options?: { refine?: false }            // LLM hook; default false, never called
}

interface ComposedAnswer {
  text: string                            // the partner-group draft
  confidence: 'high' | 'medium' | 'low'
  usedInternalReferences: boolean
  mustConfirm: string[]
  safetyNotes?: string[]
}
```

Confidence mapping (deterministic):
- `search.status === 'ok'` with ≥1 result → `high` (or `medium` if only weak
  signal, e.g. partySize-only filter with no area/theme) → `usedInternalReferences: true`.
- `search.status === 'low_confidence'` / empty → `low` →
  `usedInternalReferences: false`.

---

## Tone & source wording (fixed phrases)

Allowed framing:
- 「內部過往案例傾向…」 / 「可以先往這個方向抓」 / 「可參考」
- 「需要再確認…」
- Low confidence: 「目前沒有強內部參考案例，建議先確認…再評估」

Forbidden framing:
- 「資料庫顯示某客人…」 / 「某客人…」 (never name or imply a specific customer)
- Any exact price, any availability promise, any final vehicle/headcount commit.

When `usedInternalReferences`, cite only safe structured facts from the top 1–3
summaries: area / theme / days / partySize / vehicleType. Never a raw itinerary
snippet.

---

## transportationAssessment helper

Mirrors back-office quote logic: **party size is only a starting point**; real
decisions also depend on luggage, vehicle count, guide, and actual arrangement.
So this helper outputs a *direction*, never a commitment.

```ts
interface TransportationAssessmentInput {
  partySize?: number
  adults?: number
  children?: number
  vehicleTypeFromCases?: string[]   // from retrieved cases' vehicleType
  luggageCount?: number
  airportTransfer?: boolean
  childSeatSignal?: boolean
}

interface TransportationAssessment {
  vehicleHint?: string
  mustConfirm: string[]
  safetyNotes: string[]
}
```

Rules:
1. If retrieved cases carry `vehicleType` → may say 「內部相似案例多以
   Toyota Commuter 10 人座 Van / 大車方向評估」 — never 「一定派這台」.
2. If `partySize >= 6` → hint 「建議往 Toyota Commuter 10 人座 Van 或多車配置方向
   評估」; add to `mustConfirm`: 行李件數與尺寸、是否有兒童座椅、是否需要導遊、
   上車地點/住宿.
3. Airport transfer + luggage ≥ 6 → `mustConfirm` MUST include 「行李件數與尺寸」;
   `safetyNotes` notes 可能需行李車或第二台車.
4. Never output a formal quote.
5. Never commit final vehicle type / count.
6. Never treat `partySize > 1` as `family`.
7. If data insufficient → only 「需再確認人數與行李後評估車型」.

---

## TDD contract (RED-first, ≥8 cases)

1. high confidence + results → text contains 「內部過往案例傾向」;
   `usedInternalReferences === true`.
2. empty / low_confidence → text contains 「目前沒有強內部參考」;
   `usedInternalReferences === false`; `confidence === 'low'`.
3. output never contains customer name / cost / revenue / profit / db id /
   Notion URL (assert against a forbidden-token list).
4. `6人包車` → vehicleHint includes 「Toyota Commuter 10 人座 Van / 大車方向評估」;
   `mustConfirm` includes 行李件數與尺寸 + 導遊/兒童座椅/上車地點; NO price; NO final
   commitment.
5. airport transfer + many luggage → `mustConfirm` includes 行李件數與尺寸;
   `safetyNotes` mentions 行李車 / 第二台車.
6. base `mustConfirm` always covers: 日期、人數、小孩年齡/身高、航班、住宿/上車地點.
7. `options.refine` defaults `false`; test asserts no LLM hook is invoked (inject
   a spy hook, assert call count 0).
8. output target is a partner-group draft (assert phrasing markers), NOT a
   customer-facing reply (assert it does not address the customer directly / no
   auto-reply opener).

---

## Hard boundaries (restated)

- No OA auto-reply. No untagged partner reply (trigger not wired here anyway).
- No Sanity write. No formal quote. No web search (no gated tool this slice).
- No Notion private fields in output. No LLM. No CLI. No Notion API.

---

## File layout

- `src/lib/line-agent/notion/notion-rag-answer-composer.ts`
- `src/lib/line-agent/notion/transportation-assessment.ts`
- `src/lib/line-agent/__tests__/notion-rag-answer-composer.test.ts`
- `src/lib/line-agent/__tests__/transportation-assessment.test.ts`

Composer sits next to `notion-rag-search.ts` and reuses its exported types; it
adds no new dependency and no new env.

---

## Next slices (not now)

- **M3.1b** — ✅ DONE (commit `4a7dad1`). operator CLI preview
  `npm run agent:notion-rag-answer -- "..."` (masked, operator-only). 11 command
  tests, line-agent 761/761, live masked smoke on real 90-record corpus. See
  `docs/plans/2026-06-06-line-oa-m3-1b-cli-answer-preview-checkpoint.md`.
- **M3.2** — partner-group RAG-assisted draft surfacing (explicit send intent;
  no auto-send).
- **M3.3** — DK review / approval loop.
- **later** — optional gated LLM `refine` hook wired through the M3-0 tool gate.

---

## Implementation checkpoint (2026-06-06)

- Files: `src/lib/line-agent/notion/notion-rag-answer-composer.ts` +
  `src/lib/line-agent/__tests__/notion-rag-answer-composer.test.ts`.
- `transportationAssessment` co-located in the composer module (not a separate
  `transportation-assessment.ts`) — one module per task scope.
- All 8 design contracts pinned by tests, plus guardrails (medium-confidence
  partySize-only path, `partySize > 1` ≠ family, insufficient-data rule 7).
- Confidence: `ok`+results & area/theme signal → `high`; `ok`+results but
  partySize-only → `medium`; `low_confidence`/empty → `low`.
- `refineHook` seam present, asserted never invoked (call count 0).
- Verified: `vitest run src/lib/line-agent` → 58 files / 750 tests green;
  `tsc --noEmit` clean for the new module.

## Not done (by design)

- No CLI (`agent:notion-rag-answer` = M3.1b, later), no trigger wiring, no
  partner-group send, no OA auto-reply, no LLM refine, no Sanity write.
- Branch stays as-is (no merge/PR).
