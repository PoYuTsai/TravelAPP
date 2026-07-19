# Public Pricing, LINE Menu, and Vehicle Video Preview Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the public pricing matrix with three package starting-price anchors, publish the approved four-region LINE menu, and attach a short vehicle-interior video to the new `車輛實拍` reply.

**Architecture:** Keep the internal pricing engine intact while removing only the public full matrix from the charter page. Promote the existing three package anchors as per-person starting-price examples with an explicit six-person basis. Keep the current LINE information architecture (one brand panel plus three bottom actions) and replace only `包車價格` with `車輛實拍`; preserve the other three actions.

**Tech Stack:** Next.js 14, React, Tailwind CSS, Vitest/RTL, ffmpeg, Sharp/Resvg, browser preview

---

## Task 1: Public website pricing preview

**Files:**
- Modify: `src/lib/pricing/public-copy.test.ts`
- Modify: `src/app/services/car-charter/page.tsx`

1. Add a failing assertion that the public page no longer renders `article[data-pricing-plan]` or the A/B price-matrix labels.
2. Assert that all three existing package cards, links, prices, and the six-person pricing basis remain visible.
3. Run the focused tests and confirm the new assertion fails before production code changes.
4. Remove only the `PerPersonPricingTable` import and public render.
5. Promote the package cards into the main pricing content and make the six-person basis visually prominent.
6. Re-run focused tests.

## Task 2: LINE rich-menu preview

**Files:**
- Create: `artifacts/previews/line-rich-menu-original.png`
- Create: `artifacts/previews/line-rich-menu-vehicle-preview.png`

1. Retrieve the exact current 2500 × 1686 rich-menu artwork.
2. Preserve every existing region and the bottom-left Van icon.
3. Replace only the bottom-left text `包車價格` with `車輛實拍` in the same visual style.
4. Export a lossless preview; do not update LINE OA.

## Task 3: Vehicle-interior video preview

**Files:**
- Read: `C:/Users/eric1/OneDrive/Desktop/清微旅行/車/Miya車內裝影片_line展示/806140903.801967.mp4`
- Create: `artifacts/previews/vehicle-interior-contact-sheet.jpg`
- Create: `artifacts/previews/vehicle-interior-20s-preview.mp4`
- Create: `artifacts/previews/vehicle-interior-poster.jpg`

1. Inspect evenly sampled frames and choose the strongest 15–25 second section.
2. Preserve the source audio/music.
3. Apply restrained exposure, contrast, color, and sharpness improvements.
4. Add minimal brand-aligned captions while keeping the vehicle interior unobstructed.
5. Export H.264/AAC with fast start and verify duration, dimensions, and audio.

## Task 4: Browser previews and verification

**Files:**
- Create: `artifacts/previews/website-pricing-desktop.png`
- Create: `artifacts/previews/website-pricing-mobile.png`

1. Run the local site using the isolated preview worktree.
2. Capture the revised package section at desktop and mobile widths.
3. Visually compare all outputs for copy, spacing, cropping, and consistency.
4. Run focused tests and report preview paths.

## Task 5: Approved production rollout

**Approval:** Eric approved website and LINE deployment on 2026-07-19.

1. Run the full Vitest suite, full lint, and a production build.
2. Push the website change to an isolated branch and verify the Vercel Preview before merging to `main`.
3. Verify Production before changing LINE, so the old `包車價格` fallback can safely link to the revised `#pricing` section.
4. Back up the active LINE rich menu, its image, welcome message, and automatic replies outside the repository.
5. Create `車輛實拍` as a text-plus-video keyword reply.
6. Rewrite the old `包車價格` keyword reply to remove both full pricing-matrix images while retaining a safe natural-language fallback.
7. Create and publish a new rich menu using the approved artwork; keep the previous menu for rollback.
8. Verify the active menu and both affected keyword replies in LINE Official Account Manager, then ask for one ordinary-account tap test if no independent test account is available in the browser.

### Approved production assets

- LINE artwork: `artifacts/previews/line-rich-menu-vehicle-final.jpg`
  - 2500 × 1686 JPEG
  - 486,433 bytes
  - SHA-256 `72242954DA6F382419DE312682674F5A27A4229B1CB7CE07744C1AA95C040EDB`
- Vehicle video: `artifacts/previews/vehicle-interior-20s-preview.mp4`
  - 20 seconds, 1080 × 1920, H.264/AAC
  - SHA-256 `B16B996335917841025ADE853C883CF991F23F4182A0853F9C21F6E3DB35800F`

These exports remain untracked local deployment artifacts and must not be included in Git commits.
