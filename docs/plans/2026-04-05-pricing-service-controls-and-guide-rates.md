# Pricing Service Controls And Guide Rates

- **Completed:** 2026-04-05
- **Feature commit:** `5589e06` `feat: add flexible pricing service controls`

## Goal

Make the pricing calculator easier to use for real-world custom trips by letting the team control service days and internal transport margins without adding too much UI complexity.

## Shipped Changes

- Added adjustable `mealDays` so `含餐費` no longer has to follow the full trip length.
- Added adjustable `childSeatDays` so child seat billing can match actual usage days instead of always following the car days.
- Added editable `guideCostPerDay` and `guidePricePerDay` alongside the existing guide-day selector.
- Added editable daily car `cost` and `price` inputs in the transport section.
- Updated shared quote persistence so meal days, child seat days, and guide rates survive save/load across collaborators.
- Updated the external quote breakdown and PDF wording so meal-day and child-seat-day selections are reflected more clearly.
- Expanded responsive layout rules for the wider daily car-fee editor.

## Files

- `src/sanity/tools/pricing/PricingCalculator.tsx`
- `src/sanity/tools/pricing/serviceDays.ts`
- `src/sanity/tools/pricing/externalQuote.ts`
- `src/sanity/tools/pricing/ui.ts`
- `src/sanity/tools/pricing/guideRate.ts`
- `src/sanity/tools/pricing/__tests__/serviceDays.test.ts`
- `src/sanity/tools/pricing/__tests__/externalQuote.test.ts`
- `src/sanity/tools/pricing/__tests__/ui.test.ts`
- `src/sanity/tools/pricing/__tests__/guideRate.test.ts`

## Verification

- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/guideRate.test.ts src/sanity/tools/pricing/__tests__/serviceDays.test.ts src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts`
- `npm.cmd run build`
