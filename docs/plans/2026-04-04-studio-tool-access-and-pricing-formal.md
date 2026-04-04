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

## Shared Pricing Examples And Mobile UX Record

- **Completed:** 2026-04-04
- **Goal:** make saved pricing examples shared across all logged-in collaborators and improve the calculator's phone layout.
- **Changes:**
  - added `pricingExample` documents in Sanity so saved examples live in the project dataset instead of only localStorage
  - merged remote and local examples on load, added auto-refresh on focus/visibility, and exposed a manual `同步案例` action
  - added variant-specific draft storage keys so legacy and formal drafts do not overwrite each other
  - added mobile-responsive layout helpers for tabs, car-fee rows, internal table overflow, and the external quote card
  - added top quick links to `Structure` and the active pricing tool so collaborators can jump tools more easily on mobile
- **Code commit:** `d48d229` `feat: sync shared pricing examples`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts src/sanity/tools/pricing/__tests__/server-import.test.ts`
  - `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts`
  - `npm.cmd run build`

## Guide Days And Mobile Polish Record

- **Completed:** 2026-04-04
- **Goal:** let pricing quotes include guide service for only part of the itinerary and make the phone layout feel steadier during editing.
- **Changes:**
  - added a guide-day selector under `含導遊` so users can charge guide service for fewer days than the full car itinerary
  - saved guide days inside shared pricing examples so reloading a case preserves the custom guide count
  - separated child-seat billing days from guide days, keeping seat charges tied to car days
  - refined the phone layout for saved-case controls, option toggles, and horizontal scroll containers
- **Code commit:** `3d70755` `feat: add configurable guide days`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/serviceDays.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts`
  - `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/serviceDays.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts src/sanity/tools/pricing/__tests__/server-import.test.ts`
  - `npm.cmd run build`

## Thai Dress Photographer Pricing Record

- **Completed:** 2026-04-04
- **Goal:** clarify the photographer wording and stop auto-charging a second photographer for groups above ten unless explicitly selected.
- **Changes:**
  - changed the UI copy from ambiguous `2,500/位` wording to `攝影師 1 小時` with a per-photographer capacity note
  - added an extra photographer checkbox that only appears when the group is over 10 people
  - updated pricing, internal details, external quote copy, and exported quote HTML to use the explicit photographer count
  - preserved the extra photographer choice in saved/shared pricing examples
- **Code commit:** `a66aa98` `feat: refine thai dress photographer pricing`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/thaiDress.test.ts`
  - `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/serviceDays.test.ts src/sanity/tools/pricing/__tests__/thaiDress.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts src/sanity/tools/pricing/__tests__/server-import.test.ts`
  - `npm.cmd run build`

## Manual Insurance Toggle Record

- **Completed:** 2026-04-04
- **Goal:** decouple travel insurance from the ticket toggle so users can manually decide whether to include it.
- **Changes:**
  - added a dedicated `含保險` checkbox in the base settings area
  - changed insurance pricing to follow the manual toggle only, regardless of whether tickets are included
  - preserved the insurance selection in saved/shared pricing examples and added a legacy fallback for older saved cases
  - updated phone layout spacing to accommodate the extra service toggle column
- **Code commit:** `3938d53` `feat: add manual pricing insurance toggle`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/insurance.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts`
  - `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts src/sanity/tools/pricing/__tests__/insurance.test.ts src/sanity/tools/pricing/__tests__/serviceDays.test.ts src/sanity/tools/pricing/__tests__/thaiDress.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/variants.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts src/sanity/tools/pricing/__tests__/server-import.test.ts`
  - `npm.cmd run build`

## External Quote Simplification Record

- **Completed:** 2026-04-05
- **Goal:** make the public-facing quote tab and PDF directly mirror the input selections, remove the auto-generated 30/70 payment split logic, and ensure the TWD total uses the real quote total instead of `per-person * people`.
- **Changes:**
  - added `src/sanity/tools/pricing/externalQuote.ts` to define one shared external-quote breakdown from the base calculator state
  - replaced the external quote tab with a simpler itemized layout driven by the same input toggles and totals
  - switched the PDF export to the same simplified breakdown so the page and downloaded quote stay aligned
  - added `src/sanity/tools/pricing/__tests__/externalQuote.test.ts` to lock the new mapping and total behavior
  - added payment policy reference docs for customer-facing wording, partner scripts, and the internal SOP
- **Code commit:** `7940794` `feat: simplify external pricing quote flow`
- **Verification:**
  - `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/server-import.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts`
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
