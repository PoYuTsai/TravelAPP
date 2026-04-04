# Studio Tool Access And Formal Pricing Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email-based Studio tool visibility for collaborators and ship a cloned formal pricing calculator with zero rebate sharing and 70/15/15 profit distribution.

**Architecture:** Keep the existing pricing calculator as the legacy test tool, add a second formal pricing tool backed by the same component with a variant config, and centralize Studio tool visibility in a small helper keyed by current user email. Variant helpers will control storage keys, rebate behavior, and profit-share presentation so the legacy tool stays unchanged.

**Tech Stack:** Next.js 14, Sanity Studio 3, React 18, TypeScript, Vitest

---

### Task 1: Lock The Expected Studio Access Rules In Tests

**Files:**
- Create: `src/sanity/__tests__/studio-access.test.ts`
- Create: `src/sanity/studio-access.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `lyc32580@gmail.com` only sees `structure` and `pricing-formal`
- `moon12sun20@yahoo.com.tw` only sees `structure` and `pricing-formal`
- unrestricted users keep `structure`, `dashboard`, `accounting`, `pricing`, and `pricing-formal`
- renamed tool titles match the requested labels

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts`

Expected: FAIL because the helper module does not exist yet.

**Step 3: Write minimal implementation**

Create `src/sanity/studio-access.ts` with:
- collaborator email allowlist
- email normalization helper
- visible tool names helper
- tool title mapping helper
- tool filtering helper for `sanity.config.ts`

**Step 4: Run test to verify it passes**

Run: `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts`

Expected: PASS

---

## Implementation Record

- **Completed:** 2026-04-04
- **Shipped changes:** collaborator-only Studio tool filtering, renamed tools, cloned `報價計算(正式版)`, formal pricing variant with zero rebate sharing and 70/15/15 profit summary
- **Commit:** `d09ea5e` `feat: add formal pricing studio access`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts`
  - `npm.cmd run build`

## Studio SSR Hotfix Record

- **Completed:** 2026-04-04
- **Root cause:** `src/sanity/tools/pricing/PricingCalculator.tsx` imported `html2pdf.js` at module scope, so the embedded Next.js Studio route evaluated a browser-only package during production SSR and crashed with `ReferenceError: self is not defined`.
- **Fix:** moved `html2pdf.js` to a lazy runtime import inside the PDF download flow and added `src/sanity/tools/pricing/__tests__/server-import.test.ts` to lock the server import behavior.
- **Code commit:** `d7eb5cf` `fix: restore studio pricing route SSR`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/server-import.test.ts src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts`
  - `npm.cmd run build`

## Collaborator Email Update Record

- **Completed:** 2026-04-04
- **Change:** replaced Lulu's restricted Studio login email from `moon12sun20@gmail.com` to `moon12sun20@yahoo.com.tw`.
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/server-import.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts`
  - `npm.cmd run build`

### Task 2: Lock The Formal Pricing Variant Rules In Tests

**Files:**
- Create: `src/sanity/tools/pricing/__tests__/variants.test.ts`
- Create: `src/sanity/tools/pricing/variants.ts`

**Step 1: Write the failing test**

Add tests that assert:
- legacy tickets keep rebate and split values
- formal tickets reset rebate to `0` and split to `false`
- formal Thai dress pricing removes rebate values
- formal profit distribution returns `柏裕 70%`, `Lulu 15%`, `彥君 15%`

**Step 2: Run test to verify it fails**

Run: `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/variants.test.ts`

Expected: FAIL because the variant helper module does not exist yet.

**Step 3: Write minimal implementation**

Create `src/sanity/tools/pricing/variants.ts` with:
- pricing variant type
- variant-specific storage keys
- ticket and Thai dress normalization helpers
- formal profit-share helper
- UI feature flags for legacy vs formal rendering

**Step 4: Run test to verify it passes**

Run: `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/variants.test.ts`

Expected: PASS

### Task 3: Wire Studio Tools To The Access Helper

**Files:**
- Modify: `sanity.config.ts`
- Modify: `src/sanity/tools/dashboard/index.tsx`
- Modify: `src/sanity/tools/accounting/index.tsx`
- Modify: `src/sanity/tools/pricing/index.tsx`

**Step 1: Update plugin exports**

Allow the pricing plugin module to register both:
- legacy `pricing`
- formal `pricing-formal`

Preserve the existing calculator as the legacy tool.

**Step 2: Filter and retitle tools in Studio config**

Use the `tools` callback with `currentUser` to:
- rename all tool titles
- hide `dashboard`, `accounting`, and legacy `pricing` for the two collaborator emails

**Step 3: Run focused tests**

Run: `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts`

Expected: PASS

### Task 4: Add The Formal Pricing Variant Behavior

**Files:**
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`
- Modify: `src/sanity/tools/pricing/index.tsx`
- Use: `src/sanity/tools/pricing/variants.ts`

**Step 1: Add a `variant` prop**

Default the calculator to legacy behavior and add a formal wrapper component for the cloned tool.

**Step 2: Separate formal storage**

Use variant-specific localStorage keys so the formal tool does not overwrite the legacy test tool.

**Step 3: Apply formal ticket behavior**

For the formal variant:
- remove rebate and split controls from the ticket manager
- remove refund split note and star markers
- make ticket and Thai dress cost equal price
- remove ticket split profit rows from internal details
- replace the bottom profit distribution with `柏裕 70% / Lulu 15% / 彥君 15%`

**Step 4: Keep legacy behavior untouched**

Legacy `pricing` remains the old test calculator so both tools can coexist.

### Task 5: Verify End-To-End

**Files:**
- Verify only

**Step 1: Run targeted tests**

Run:
- `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/variants.test.ts`

**Step 2: Run a broader safety check if the targeted tests pass**

Run: `npm.cmd run test:run -- src/lib/__tests__/api-auth.test.ts src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts`

Expected: PASS
