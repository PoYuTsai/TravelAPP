# Mandatory Airport Luggage Van Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use test-driven-development and verification-before-completion task-by-task.

**Goal:** For airport pickup or drop-off, automatically include exactly one THB 500 luggage Van only when the passenger allocation puts 8 or more guests in one Van.

**Architecture:** Keep passenger transfer pricing unchanged at sedan THB 500 and Van THB 700 per vehicle per trip. Allocate passengers to the normal fleet first, then add one luggage Van only if the busiest passenger Van carries 8 or more guests: 6–7 none, 8–9 one, 10–14 none after the two-Van split, and 15–18 one. Put that rule and the THB 500 fee in the shared pricing module, then make the calculator, fixed packages, public copy, LINE agent knowledge, generated cards, and operating notes consume it; 19+ remains manual.

**Tech Stack:** Next.js 14, TypeScript, React, Vitest, Sanity CMS, deterministic Pillow artwork renderer.

---

### Task 1: Lock the pricing rule with failing tests

**Files:**
- Modify: `src/lib/pricing/perPersonRates.test.ts`
- Modify: `src/sanity/tools/pricing/__tests__/perPersonAdapter.test.ts`
- Modify: `src/sanity/tools/pricing/__tests__/packageQuotePricing.test.ts`

1. Assert the fleet-aware ranges: 6–7 zero, 8–9 one, 10–14 zero, 15–18 one.
2. Assert the fee is THB 500 per airport pickup/drop-off.
3. Assert an 8-person single-Van transfer totals THB 1,200 per trip and a 10–18-person two-Van transfer totals THB 1,900 per trip.
4. Assert fixed packages with airport pickup and drop-off add THB 1,000 when occupancy is 8+.
5. Run the focused tests and confirm they fail against the old 7-seat/manual/THB 700 behavior.

### Task 2: Implement the shared pricing behavior

**Files:**
- Modify: `src/lib/pricing/perPersonRates.ts`
- Modify: `src/sanity/tools/pricing/perPersonAdapter.ts`
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`
- Modify: `src/sanity/tools/pricing/packageQuotePricing.ts`

1. Set the luggage-Van fee to THB 500 and the group threshold to 8 occupied seats.
2. Automatically derive exactly one luggage Van for airport service when occupancy is 8–18.
3. Preserve sedan/Van passenger transfer prices and all guide, child, room, insurance, overtime, and Tier prices.
4. Replace the calculator's manual luggage selector with a read-only operational rule.
5. Run the focused tests and confirm green.

### Task 3: Align customer and partner wording

**Files:**
- Modify: `src/lib/pricing/publicCopy.ts`
- Modify: `src/components/cms/PerPersonPricingTable.tsx`
- Modify: `src/lib/line-agent/partner-group/system-prompt.ts`
- Modify: `docs/reference/chiangmai-flights-and-charter-pricing.md`
- Modify: `docs/operations/customer-line-quote-template.md`
- Modify: `docs/ai-agent-knowledge/rules/itinerary-template-and-parser-format.md`
- Modify: `docs/ai-agent-knowledge/cases/production-packages.md`
- Modify: `docs/plans/2026-07-10-per-person-pricing-framework.md`
- Modify: `docs/plans/2026-07-10-line-rich-menu-production-spec.md`
- Modify: `README.md`

Use one exact rule everywhere: allocate the passenger Vans first; 6–7 guests add none, 8–9 add one, 10–14 add none after splitting across two Vans, 15–18 add one, and 19+ is manual. The luggage Van is THB 500 per airport pickup/drop-off.

### Task 4: Refresh package data, cards, and LINE notes

**Files:**
- Modify: `scripts/refresh-package-quotes.mjs`
- Modify: `artifacts/render_internal_package_cards.py`
- Modify: `C:/Users/eric1/OneDrive/Desktop/清微旅行/新版人頭定價規則/*.md`
- Regenerate: applicable package lookup PNGs in the same desktop directory.

1. Make fixed-package snapshots add the mandatory luggage item for each airport pickup/drop-off when occupancy is 8+.
2. Keep the 6-person Chiang Mai and 3-person Chiang Rai public examples unchanged.
3. Update the 8-person northern package example by THB 1,000 for its pickup and drop-off.
4. Regenerate internal cards with the new fixed rule and THB 500 fee.
5. Prepare the exact LINE OA auto-response text; update the logged-in OA Manager only if the existing browser session is available.

### Task 5: Verify and publish

1. Run all affected Vitest suites.
2. Run the full Vitest suite and `npm run build`.
3. Dry-run the public package refresh script, then apply with revision guards.
4. Verify the three live package URLs, the charter pricing page, and the exchange rate.
5. Review `git diff` to confirm no unrelated rule or user-owned file changed.
