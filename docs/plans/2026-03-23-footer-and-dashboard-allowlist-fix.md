# 2026-03-23 Footer and Dashboard Allowlist Fix

## Summary

This maintenance slice removes the public-facing Claude credit from the site footer and guarantees Eric's primary Gmail address can access the protected dashboard and accounting routes.

## What Changed

### Public Footer Cleanup

- Updated `src/components/Footer.tsx`
- Removed the extra footer credit line that linked to Claude Code
- The public footer now ends with the standard copyright line only

### Dashboard / Accounting Access Allowlist

- Updated `src/lib/api-auth.ts`
- Added a built-in default allowlist entry for `eric19921204@gmail.com`
- The email is normalized the same way as env-configured whitelist entries, so uppercase / mixed-case variants still work
- This change applies to all routes that already rely on `isDashboardEmailAllowed()`, including:
  - `/api/auth/session`
  - `/api/dashboard`
  - `/api/accounting`
  - `/api/sign-url`

## Tests Added / Updated

- Added `src/lib/__tests__/api-auth.test.ts`
- Added `src/components/__tests__/Footer.test.tsx`

## Verification

- `npm run test:run` -> passed (`98/98`)
- `npm run lint` -> passed
- `npm run build` -> passed

## Notes

- Build still logs the existing `NOTION_TOKEN` warning path during static generation, but the build completes successfully.

## Commit

- Feature commit: `12b72ca` `fix: remove footer credit and allow eric dashboard access`
