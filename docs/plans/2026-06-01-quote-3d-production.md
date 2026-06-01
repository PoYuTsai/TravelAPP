# 2026-06-01 Quote 3D Production Hero

## Summary

Eric approved the `k8oeyepp` 3D quote hero preview for production. This milestone replaces only the top quote hero experience; the itinerary, photo layout, pricing dashboard, footer, and scroll navigation keep the existing production structure.

## Production Commit

- Commit: `cb04e64`
- Branch: `codex/quote-3d-production`
- Main route changed: `/quote/[slug]`

## Changes

- Added `PopupHybrid` as the production quote hero.
- Added high-resolution Chiang Mai pop-up-book city assets for desktop and mobile.
- Added supporting 3D/day texture assets used by the quote hero.
- Added `three` and `@types/three`.
- Added an e2e smoke test for production quote pages.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Smoke checked 7 quote slugs: `k8oeyepp`, `o8c31aq8`, `5gkztqsl`, `7t2k19ip`, `ih4llds5`, `uao33058`, `lyx5aysy`.
- Each checked page returned `200` and kept the 3D hero, itinerary, and pricing sections.

## Notes

- Preview-only exploration files were intentionally not included.
- The LINE OA agent branch history was kept separate by creating this branch from `main`.
