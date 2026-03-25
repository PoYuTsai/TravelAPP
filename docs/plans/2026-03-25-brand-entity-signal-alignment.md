# Brand Entity Signal Alignment (2026-03-25)

## Summary

This pass strengthens the site's brand-entity signal without changing the public layout or redesigning page structure.

The goal is to help Google understand:

- `清微旅行 Chiangway Travel` = the official brand
- `清邁親子包車` = the core commercial service

Scope was intentionally limited to:

- homepage content signal
- `/services/car-charter` content signal
- existing blog author / recommended-tour internal links

No layout redesign, section restructuring, or visual refresh was included in this pass.

## What Changed

### 1. Shared brand-entity helper

Added:

- `src/lib/brand-entity.ts`

This helper centralizes the default entity statements and appends them only when the required brand/service terms are missing.

### 2. Homepage signal alignment

Updated:

- `src/app/page.tsx`

Changes:

- strengthened homepage hero description fallback
- aligned homepage metadata description / Open Graph / Twitter description to include:
  - `清微旅行`
  - `清邁親子包車`

### 3. Car-charter service signal alignment

Updated:

- `src/app/services/car-charter/page.tsx`

Changes:

- strengthened hero subtitle fallback
- aligned metadata description / Open Graph / Twitter description to the same brand/service query pair

### 4. Blog trust + internal linking alignment

Updated:

- `src/components/blog/AuthorCard.tsx`
- `src/components/blog/PortableTextRenderer.tsx`

Changes:

- author card now reinforces `清微旅行` and `清邁親子包車`
- author name links back to `/`
- recommended tours now link to canonical `/tours/[slug]` detail pages instead of `#/slug` anchors

## Tests Added

Added:

- `src/lib/__tests__/brand-entity.test.ts`
- `src/components/__tests__/AuthorCard.test.tsx`
- `src/components/__tests__/PortableTextRenderer.test.tsx`

Coverage included:

- entity sentence append / no-duplicate behavior
- homepage / service metadata alignment
- author card brand signal
- recommended tour canonical link behavior

## Verification

Passed:

- `npx vitest run --exclude ".worktrees/**" src/lib/__tests__/brand-entity.test.ts src/components/__tests__/AuthorCard.test.tsx src/components/__tests__/PortableTextRenderer.test.tsx`
- `npm run lint`
- `npm run build`

Note:

- targeted test output still prints the existing `NOTION_TOKEN` warning in test logs, but tests pass

## Related Strategy Docs

These supporting docs were also prepared for follow-up SEO / indexing work:

- `docs/plans/2026-03-25-brand-entity-and-indexing-plan.md`
- `docs/plans/2026-03-25-homepage-car-charter-about-entity-brief.md`
- `docs/plans/2026-03-25-search-console-exclusion-triage-worksheet.md`

## Commit Reference

- Code commit: `f06b27d` `feat: strengthen brand entity signals`
