# Family Pricing Copy And LINE Images Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the website clearly separate all-adult per-person reference prices from family total quotes, then replace the dense LINE price sheet with two readable route-based images.

**Architecture:** Keep `perPersonRates.ts` as the only pricing source. The public website renders all-adult reference tables and a family-total explanation without exposing child unit-price arithmetic. The deterministic SVG renderer produces two 2160 × 2700 LINE images: Chiang Mai city/nearby and Chiang Rai/Golden Triangle.

**Tech Stack:** Next.js 14, React, Tailwind CSS, Vitest, SVG, `@resvg/resvg-js`, Sharp.

---

### Task 1: Website family-pricing copy

**Files:**
- Modify: `src/components/cms/__tests__/PerPersonPricingTable.test.tsx`
- Modify: `src/components/cms/PerPersonPricingTable.tsx`
- Modify: `src/app/services/car-charter/page.tsx`

**Step 1: Write the failing tests**

Require the rendered pricing section to say that the table is for all-adult travelers and every amount is `THB／人／日`. Require a family callout that says parents do not need to split the bill, asks for adult count and child ages, and promises one family total. Reject public `8 折`, `半價`, and `最低成團價` wording.

**Step 2: Run the test to verify RED**

Run: `npm.cmd run test:run -- src/components/cms/__tests__/PerPersonPricingTable.test.tsx`

Expected: FAIL because the current component still exposes child discount percentages and minimum-group-price language.

**Step 3: Implement the minimal website copy**

- Change the section subtitle to `全成人同行參考；以下金額皆為每人每日價`.
- Reorganize the same canonical prices into two complete public plans: `方案 A｜泰國司機包車` and `方案 B｜泰國司機＋中文導遊同行`.
- Keep 2–3 travelers eligible for the guided sedan plan, and mark the guided plan as recommended for families and groups of 8 or more.
- Describe the 8-person threshold as a service recommendation only; never attach a legal or mandatory claim.
- Replace the three child-rate cards with one calm family-total callout.
- Say every passenger occupies one seat, family discounts are included in the final family total, and child seats remain paid add-ons.
- Ask customers to send adult count, child ages, and child-seat needs through LINE.

**Step 4: Run the test to verify GREEN**

Run the same targeted Vitest command and expect all tests to pass.

### Task 2: Two route-based LINE price images

**Files:**
- Modify: `src/lib/artifacts/productionArtwork.test.ts`
- Modify: `src/lib/artifacts/productionArtworkRenderer.ts`
- Modify: `scripts/artifacts/render-pricing-line-assets.ts`

**Step 1: Write the failing renderer tests**

Require two 4:5 SVG layouts rendered to 2160 × 2700 PNGs:

- Chiang Mai image: city and nearby columns.
- Chiang Rai image: Chiang Rai and Golden Triangle columns.

Each image must prominently say `全成人同行參考` and `以下皆為 THB／人／日`, show both `泰國司機` and `另含中文導遊` rows for 2–9 travelers, omit child discount arithmetic and large-group rules, and contain no SUV or mandatory-guide wording.

**Step 2: Run the test to verify RED**

Run: `npm.cmd run test:run -- src/lib/artifacts/productionArtwork.test.ts`

Expected: FAIL because only the old single 1080 × 1920 renderer exists.

**Step 3: Implement the minimal deterministic renderers**

- Share one route-sheet builder with route-column configuration.
- Use large high-contrast headings and two price cards per image.
- Retain the 2–3 sedan / 4–9 Van divider.
- Keep non-price rules in the accompanying LINE text instead of the images.

**Step 4: Update the output script**

Generate:

- `public/images/line/charter-price-chiang-mai-v2026-07-11-v2.png`
- `public/images/line/charter-price-chiang-rai-v2026-07-11-v2.png`
- 375 px preview files for both images.

Stop generating the superseded single-sheet filenames.

**Step 5: Run the renderer tests to verify GREEN**

Run the targeted artwork test and expect all tests to pass.

### Task 3: Visual and regression verification

**Files:**
- Modify: `docs/plans/2026-07-11-line-oa-charter-price-image.md`
- Regenerate: `public/fonts/ChiangwayArtworkSans-*-subset.ttf` only if the new copy adds glyphs.

**Step 1: Generate images**

Run the project artifact renderer with `--line-only`.

**Step 2: Inspect both full-size images and both mobile previews**

Verify no clipping, tofu glyphs, cramped columns, or ambiguous units. Confirm prices match `calcPerPersonDay()` for all 2–9 rows.

**Step 3: Run focused verification**

Run:

- `npm.cmd run test:run -- src/components/cms/__tests__/PerPersonPricingTable.test.tsx src/lib/artifacts/productionArtwork.test.ts`
- ESLint on the touched TypeScript files.
- `git diff --check`

**Step 4: Report the handoff**

Provide clickable links to the website component, the two upload-ready images, and their previews. State that no calculator and no live LINE OA mutation were performed.
