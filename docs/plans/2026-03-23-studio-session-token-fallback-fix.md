# 2026-03-23 Studio Session Token Fallback Fix

## Summary

This maintenance slice restores production access to the Sanity Dashboard and Accounting tools by making the Studio session-token hook compatible with multiple Sanity auth-storage patterns.

## Problem

- Dashboard and Accounting showed:
  - `目前登入：未知`
  - `Sanity Studio token unavailable. Please refresh Studio and sign in again.`
- The allowlist was already correct, but the Studio client could fail before session issuance because `useSessionToken()` only trusted one token source.

## What Changed

### More Resilient Studio Token Detection

- Updated `src/sanity/hooks/useSessionToken.ts`
- The hook now:
  - reads `workspace.auth.state` instead of relying only on `workspace.auth.token`
  - extracts a bearer token from auth-state objects when present
  - falls back to both storage keys:
    - `__studio_auth_token_${projectId}`
    - `__sanity_auth_token`

### Tests Added

- Added `src/sanity/hooks/__tests__/useSessionToken.test.ts`
- Covered:
  - auth-state token extraction
  - project-scoped Studio storage key
  - legacy Sanity auth storage key

## Verification

- `npx vitest run --exclude ".worktrees/**" src/sanity/hooks/__tests__/useSessionToken.test.ts src/lib/__tests__/api-auth.test.ts src/components/__tests__/Footer.test.tsx` -> passed
- `npm run lint` -> passed
- `npm run build` -> passed

## Commit

- Feature commit: `3680984` `fix: recover studio session token fallback`
- Docs commit: pending
