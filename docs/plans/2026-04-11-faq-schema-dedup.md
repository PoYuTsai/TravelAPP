# FAQ Structured Data Dedup Fix

- **Completed:** 2026-04-11
- **Goal:** resolve Google Search Console `FAQPage` duplicate-field errors by ensuring each page emits at most one FAQPage schema.

## Root Cause

- The root layout injected a global `FAQPage` schema on every page.
- Pages such as `/services/car-charter`, `/contact`, and `/homestay` also emitted their own FAQPage schema.
- `FAQSection` additionally defaulted to generating another FAQPage schema block.

That created duplicate FAQPage structured data on the same URL, which Google Search Console reported as `FAQPage` duplicate fields.

## Changes

- kept homepage FAQ structured data in a new homepage-only component:
  - `src/components/schema/HomePageFaqSchema.tsx`
- removed the global FAQPage payload from:
  - `src/app/layout.tsx`
- changed `FAQSection` to default to visual-only output unless a page explicitly asks it to emit FAQ schema:
  - `src/components/cms/FAQSection.tsx`
- mounted the homepage-only FAQ schema in:
  - `src/app/page.tsx`
- added regression coverage:
  - `src/components/__tests__/faq-structured-data.test.tsx`

## Verification

- `npm.cmd run test:run -- src/components/__tests__/faq-structured-data.test.tsx`
- `npm.cmd run build`
