# Pricing, Website, and LINE Production Calibration Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task, with `test-driven-development` for every behavior change.

**Goal:** Make one tested pricing source support family discounts, minimum group fares, optional guides, and two-van groups, then align the public website, day-tour content, image specification, and LINE production runbook to that source.

**Architecture:** `src/lib/pricing/perPersonRates.ts` remains the canonical pure pricing engine. Sanity pricing tools adapt its typed quote result; public React components render the same constants and rules. Day tours store only a `pricingTier`, not a second price system. LINE rich-menu actions deep-link to canonical website sections; production LINE changes remain a supervised external handoff.

**Tech Stack:** TypeScript, Vitest, React 18, Next.js 14, Sanity v3, Tailwind CSS, Markdown operational docs.

---

## Task 1: Protect the canonical pricing engine

**Files:**

- Modify: `src/lib/pricing/perPersonRates.test.ts`
- Modify: `src/lib/pricing/perPersonRates.ts`

**Step 1: Write failing fleet and guide tests**

Add tests that require:

- `resolveFleet(9)` → one Van, `resolveFleet(10|18)` → two Vans.
- `resolveFleet(19|27)` → three Vans and manual quote.
- `resolveFleet(28)` → four Vans and manual quote.
- No fleet automatically sets `guideRequired` because of passenger count.
- `resolveGuidePricing(1, true)` → cost 1,500, sell 2,500.
- `resolveGuidePricing(2, true)` → cost 2,000, sell 2,500.
- `resolveGuidePricing(3, true)` → cost 2,500 and manual quote because the sell anchor is unset.
- A guided 2–3-person request is manual vehicle confirmation rather than a Chinese-driver fallback.

**Step 2: Run the targeted test and confirm RED**

Run:

```powershell
npm.cmd test -- --run src/lib/pricing/perPersonRates.test.ts
```

Expected: failures for the new APIs and old forced-guide behavior.

**Step 3: Implement fleet and guide separation**

Add typed constants and results:

- `VAN_GUEST_CAPACITY = 9`
- `MAX_VANS_PER_GUIDE = 3`
- `GUIDE_PRICING`
- `manualQuoteRequired` and `manualQuoteReason`
- `resolveGuidePricing(carCount, withGuide)`

Delete automatic 8–9 guide forcing. Keep actual guide cost internal and the sell anchor in pricing calculations.

**Step 4: Write failing fare-protection tests**

Cover at minimum:

- T2, 10 adults, guided → THB 1,600/person and THB 16,000 total.
- T2, 18 adults, guided → THB 950/person and THB 17,100 total.
- T2 guided, `2A+2C+2I` → provisional THB 7,130, core floor THB 8,300, final THB 8,300.
- T2 guided, two Vans, `3A+4C+3I` → floor THB 14,100.
- Adding one adult, child, or infant never lowers the core group fare for every T1–T4, guided/unguided, valid 2–18-person combination with at least one adult.
- Child seat and insurance remain fully additive after protection.

**Step 5: Run tests and confirm RED**

Use the same targeted command. Expected: failures from missing `FareProtection` and old direct age multiplication.

**Step 6: Implement protected group fare**

Add:

```ts
interface FareProtection {
  provisionalThb: number
  coreFloorThb: number
  monotonicFloorThb: number
  finalThb: number
  appliedRule: 'provisional' | 'core-floor' | 'monotonic-floor'
}
```

Implement a memoized monotonic envelope over `(adults, children, infants)` for the trip core. Require at least one adult and two total occupied seats. Keep luggage, room, child seats, and insurance outside the protected core.

When protection applies, emit one public-safe item labeled `親子包車團費（家庭優惠後）`; retain the internal protection fields on `TripQuote`.

**Step 7: Run targeted tests and confirm GREEN**

Run the Task 1 command, then:

```powershell
npm.cmd test -- --run src/lib/pricing/perPersonRates.test.ts src/sanity/tools/pricing/__tests__/perPersonAdapter.test.ts
```

**Step 8: Commit**

```powershell
git add src/lib/pricing/perPersonRates.ts src/lib/pricing/perPersonRates.test.ts
git commit -m "feat: protect family per-person pricing"
```

## Task 2: Adapt the Sanity quote calculator for two Vans

**Files:**

- Modify: `src/sanity/tools/pricing/__tests__/perPersonAdapter.test.ts`
- Modify: `src/sanity/tools/pricing/perPersonAdapter.ts`
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`
- Modify: relevant calculator tests under `src/sanity/tools/pricing/__tests__/`

**Step 1: Write failing adapter tests**

Require:

- 10 and 18 passengers produce a real trip and a positive group price.
- T2, 10 guided adults → THB 16,000.
- 19 passengers return `manualQuoteRequired: true` without pretending an automatic total is final.
- 8–9 passengers respect the user's guide toggle.
- The public breakdown never shows guide cost.

**Step 2: Run tests and confirm RED**

```powershell
npm.cmd test -- --run src/sanity/tools/pricing/__tests__/perPersonAdapter.test.ts
```

**Step 3: Implement the adapter**

Map the new fleet, guide, fare-protection, and manual-quote fields. Remove `splitOrderRequired` and the 10-person hard stop. Preserve add-ons outside protected group fare.

**Step 4: Update calculator guardrails**

- Allow 10–18 passengers to calculate, save, preview, and download.
- Show two-Van configuration and one shared guide when selected.
- Stop presenting 8–9 as legally guided.
- Block finalization for 19+ with an explicit Eric/manual-quote message.
- Keep guide actual cost in internal profitability state only.

**Step 5: Run targeted calculator tests and confirm GREEN**

```powershell
npm.cmd test -- --run src/sanity/tools/pricing/__tests__/perPersonAdapter.test.ts src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/savedQuoteState.test.ts
```

**Step 6: Commit**

```powershell
git add src/sanity/tools/pricing
git commit -m "feat: support protected two-van quotes"
```

## Task 3: Replace the public pricing rules

**Files:**

- Modify: `src/components/cms/__tests__/PerPersonPricingTable.test.tsx`
- Modify: `src/components/cms/PerPersonPricingTable.tsx`
- Modify: `src/app/services/car-charter/page.tsx`
- Add: `src/lib/pricing/public-copy.test.ts`

**Step 1: Write failing public-content tests**

Assert that rendered pricing/service copy:

- Does not contain `8 人以上依泰國法規`, `必配導遊`, `拆兩張單`, or a positive `中文司機` promise.
- Says the standard arrangement is a Thai driver and a Chinese guide is optional.
- Shows 4–9 and 10–18 configurations.
- Says infants occupy seats and family discounts are subject to a minimum group fare.
- Shows THB 300/hour/car overtime and THB 500/day/seat child seat.

**Step 2: Run tests and confirm RED**

```powershell
npm.cmd test -- --run src/components/cms/__tests__/PerPersonPricingTable.test.tsx src/lib/pricing/public-copy.test.ts
```

**Step 3: Implement public tables and anchors**

- Render guided and unguided tables without legal claims.
- Present 10–18 as a two-Van group; keep 19+ as LINE/manual.
- Add `id="pricing"` and `id="faq"` on canonical sections.
- Rewrite metadata and fallback FAQ to standard Thai driver, optional guide, occupied-seat children, and paid child seats.

**Step 4: Run tests and commit**

```powershell
npm.cmd test -- --run src/components/cms/__tests__/PerPersonPricingTable.test.tsx src/lib/pricing/public-copy.test.ts
git add src/components/cms src/app/services/car-charter src/lib/pricing/public-copy.test.ts
git commit -m "fix: align public charter pricing copy"
```

## Task 4: Remove old day-tour prices from the public website

**Files:**

- Modify: `src/sanity/schemas/dayTour.ts`
- Modify: `src/app/tours/page.tsx`
- Modify: `src/app/tours/ToursPageClient.tsx`
- Modify: `src/components/tours/DayTourCard.tsx`
- Modify: `src/app/tours/[slug]/page.tsx`
- Modify: `src/components/schema/ToursPageSchema.tsx`
- Add or modify focused tests for day-tour card/detail structured data
- Add: a dry-run migration script under `scripts/` if needed

**Step 1: Write failing presentation tests**

Require day-tour cards and details to:

- Show `私家半客製一日遊｜依總佔位人數計價`.
- Never show old `$3,200–4,500 起/團` or a fixed THB 2,500 guide add-on.
- Avoid Product offers based on stale `basePrice`.
- Expose `pricingTier` values T1/T2/T3.

**Step 2: Run tests and confirm RED**

Run the smallest new test file(s).

**Step 3: Implement schema and rendering**

- Add required `pricingTier` enum to `dayTour`.
- Keep legacy fields hidden/read-only temporarily for data compatibility, but stop querying/rendering them publicly.
- Add `id="day-tours"` and `id="packages"` to the two `/tours` sections.
- Render recommended-template, tickets/meals-extra, optional-guide copy.
- Remove stale price offers from JSON-LD.

**Step 4: Prepare production data safely**

Create a dry-run mapping for the six known documents:

- Thai dress → T1.
- Elephant, Inthanon, Lampang, Lamphun → T2.
- Chiang Rai → T3.

Do not mutate production Sanity in this task. Print document id/title/current fields/proposed tier for Eric review.

**Step 5: Run tests and commit**

```powershell
npm.cmd test -- --run <focused-day-tour-tests>
git add src/sanity/schemas/dayTour.ts src/app/tours src/components/tours src/components/schema scripts
git commit -m "fix: make day tours use pricing tiers"
```

## Task 5: Calibrate policy and SEO copy

**Files:**

- Modify: `src/app/cancellation/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/components/quote/QuoteCostDashboard.tsx`
- Modify: `src/app/layout.tsx`
- Modify: production-safe local fallback copy discovered by the audit
- Add: `src/lib/pricing/production-copy-tripwire.test.ts`

**Step 1: Write a failing tripwire**

Scan public source files and fail on:

- Positive promises of `中文司機` (allow explicit negative education such as `不是中文司機`).
- `8 人以上` near `泰國法規` or `依法`.
- Old overtime `各 200` or total `400` wording.
- Child seat listed as included/free in current public policy.
- New public pricing metadata using NT$.

**Step 2: Run the tripwire and confirm RED**

```powershell
npm.cmd test -- --run src/lib/pricing/production-copy-tripwire.test.ts
```

**Step 3: Update public policy and metadata**

- Overtime: city 10 hours, Chiang Rai/Golden Triangle 12 hours, THB 300/hour/car, no separate guide overtime, 30-minute flexibility.
- Child seat: THB 500/day/seat and occupies one seat.
- Standard Thai driver, optional Chinese guide.
- LocalBusiness price range in THB.

Do not rewrite historical customer quotes; add context only when a quote could be mistaken for a current service promise.

**Step 4: Run tests and commit**

```powershell
npm.cmd test -- --run src/lib/pricing/production-copy-tripwire.test.ts src/components/quote/__tests__/QuoteCostDashboard.test.tsx
git add src/app src/components/quote src/lib/pricing/production-copy-tripwire.test.ts
git commit -m "fix: unify charter policy and currency copy"
```

## Task 6: Rewrite the share-image and LINE operating specs

**Files:**

- Modify: `docs/plans/2026-07-10-per-person-pricing-framework.md`
- Modify: `docs/plans/2026-07-10-dao5-day-tour-price-image-spec.md`
- Add: `docs/plans/2026-07-10-line-rich-menu-production-spec.md`
- Archive or label superseded sections in:
  - `docs/line-oa-rich-menu-documentation.md`
  - `docs/line-oa-mop-execution-plan.md`
  - `docs/line-oa-quick-guide.md`

**Step 1: Update framework and quick-reference text**

- Thai driver, never Chinese-driver default.
- Guide optional by service; no unsupported law claim.
- 4–9 unguided table includes 8–9.
- Two-Van guided/unguided logic and guide actual costs.
- Child discount + occupied seat + minimum group fare + monotonic protection.
- 19+ manual.

**Step 2: Replace §2.1 with a production-safe image specification**

Do not ask an image model to typeset Chinese prices. Define:

- 4:5 master artwork and deterministic text overlay.
- Three pricing cards and six route names, without dense stop lists.
- Correct 2–3 Thai-driver/no-guide and 4–9 guided-one-day-plan labels.
- Child/floor disclaimer, add-ons, hours, and 10+ LINE CTA.

**Step 3: Add LINE six-grid production spec**

Document exact labels, URLs/actions, artwork dimensions, welcome message, inquiry intake message, rollback/backup steps, and ordinary-account acceptance tests.

Mark all old NT$/`$`, ticket, homestay, and fixed 5/7/9-day replies as superseded; do not delete historical docs.

**Step 4: Validate and commit**

```powershell
git diff --check
rg -n "中文司機|8 人.*泰國法規|NT\$|各 200" docs/plans/2026-07-10-* docs/line-oa-*.md
git add docs
git commit -m "docs: align price image and LINE production runbook"
```

## Task 7: Full verification and visual review

**Files:**

- Modify only files required by failures caused by this branch.

**Step 1: Run focused suites**

Run every test file touched in Tasks 1–5.

**Step 2: Run the full test suite**

```powershell
npm.cmd test -- --run
```

Expected: all tests pass. Restore any test-generated snapshot line-ending noise with `git checkout-index -f -- <path>` only after confirming there is no content diff.

**Step 3: Run static checks**

```powershell
npx.cmd tsc --noEmit
git diff --check
git status --short
```

If the existing Windows install cannot run a platform-specific dependency, report that separately and do not disguise it as a feature failure.

**Step 4: Run local responsive review**

Review at least:

- `/services/car-charter#pricing`
- `/services/car-charter#faq`
- `/tours#day-tours`
- One day-tour detail page

Check mobile and desktop hierarchy, table overflow, readable child/floor copy, anchors, and absence of stale prices.

**Step 5: Request code review and fix verified findings**

Use `requesting-code-review`; apply feedback with `receiving-code-review` discipline and rerun affected tests.

## Task 8: Produce artifacts and supervised production handoff

**Files:**

- Add final share artwork under `public/images/pricing/`.
- Add final LINE rich-menu artwork under `public/images/line/`.
- Update asset references in the production spec.

**Step 1: Generate only the visual layer**

Use the image-generation skill for warm, parent-friendly decorative illustration/background assets. Keep all Chinese text and prices out of the generated pixels.

**Step 2: Typeset exact content deterministically**

Compose the final artwork with code/HTML using the canonical pricing data. Render, inspect, and verify every number against automated output.

**Step 3: Present previews for Eric approval**

Do not publish or mutate external systems yet.

**Step 4: LINE OA handoff**

After Eric logs into the retained LINE Business ID tab:

- Read and back up the live menu/welcome/keyword state.
- Show the exact planned diffs.
- Request action-time confirmation immediately before uploading/publishing or disabling live replies.
- Test from an ordinary LINE account and retain rollback assets.

**Step 5: Sanity handoff**

Show the six-document dry-run. Request action-time confirmation immediately before production mutation, then verify all six public pages.

**Step 6: Final documentation commit**

Update the relevant README/docs with actual asset paths, migration status, LINE version/date, and verification evidence.
