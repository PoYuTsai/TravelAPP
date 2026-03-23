# 2026-03-24 Blog Image Clarity Fix

## Summary

This maintenance slice restores sharp blog imagery on both desktop and mobile without changing the existing public layout or copy.

## Problem

- Blog article images looked visibly soft on desktop.
- The article hero image only requested a `1200px` Sanity source.
- PortableText body images only requested an `800px` Sanity source.
- Those source widths were too small for the rendered article column, especially on higher-density desktop displays.

## What Changed

### Centralized Blog Image Sizing

- Added `src/lib/blog-image.ts`
- Centralized the article image sizing rules so the blog no longer depends on scattered hard-coded widths.
- Current targets:
  - hero image: `1800px`
  - body image: `1600px`
  - lightbox image: `2400px`

### Article Hero Image Upgrade

- Updated `src/app/blog/[slug]/page.tsx`
- The article hero image now uses `getBlogArticleHeroImageUrl()` and aligned responsive `sizes`.
- This keeps desktop hero images crisp while preserving the current layout.

### PortableText Body Image Upgrade

- Updated `src/components/blog/PortableTextRenderer.tsx`
- Body images now use `getBlogArticleBodyImageUrl()` instead of the old `800px` source.
- Lightbox images now use the centralized full-size helper.
- Portrait-image sizing stays responsive and layout-compatible.

## Tests Added

- Added `src/lib/__tests__/blog-image.test.ts`
- Covered:
  - minimum image-width expectations for hero/body/lightbox assets
  - responsive `sizes` strings for desktop/mobile layouts
  - Sanity URL builder behavior for all blog image variants

## Verification

- `npm run test:run -- src/lib/__tests__/blog-image.test.ts` -> passed
- `npx vitest run --exclude ".worktrees/**" src/lib/__tests__/blog-image.test.ts src/lib/__tests__/api-auth.test.ts src/components/__tests__/Footer.test.tsx src/sanity/hooks/__tests__/useSessionToken.test.ts src/lib/__tests__/pdf-template.test.ts src/lib/__tests__/itinerary-parser.test.ts` -> passed
- `npm run lint` -> passed
- `npm run build` -> passed

## Notes

- A full unfiltered `npm run test:run` still picks up duplicate tests inside `.worktrees/`, so root-project verification was rerun with `.worktrees/**` excluded.
- This fix does not alter blog copy, spacing, or public visual structure.

## Commit

- Feature commit: `94edb67` `fix: restore crisp blog article images`
