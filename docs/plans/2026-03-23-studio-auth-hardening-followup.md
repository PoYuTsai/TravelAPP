# 2026-03-23 Studio Auth Hardening Follow-up

## Summary

This follow-up maintenance slice further hardens Studio auth recovery after the first session-token fallback fix was still not sufficient for production access.

## Problem

- Dashboard / Accounting could still show:
  - `目前登入：未知`
  - `Sanity Studio token unavailable. Please refresh Studio and sign in again.`
- The earlier fix covered storage fallbacks, but production Studio auth could still fail if the token arrived through a nested auth-state shape or if Studio defaulted away from the expected stamped-token path.

## What Changed

### Stronger Token Extraction

- Updated `src/sanity/hooks/useSessionToken.ts`
- Token recovery now checks:
  - `authState.token`
  - nested `authState.authState.token`
  - `workspace.auth.token`
  - localStorage fallback keys

### Explicit Studio Auth Mode

- Updated `sanity.config.ts`
- Added:
  - `auth.loginMethod = 'dual'`
- This makes the Studio auth flow explicitly compatible with stamped-token based flows instead of relying on environment defaults

### Tests Updated

- Updated `src/sanity/hooks/__tests__/useSessionToken.test.ts`
- Added coverage for nested auth-state token extraction

## Verification

- `npx vitest run --exclude ".worktrees/**" src/sanity/hooks/__tests__/useSessionToken.test.ts` -> passed
- `npm run lint` -> passed
- `npm run build` -> passed

## Operator Note

- After deployment, Studio should be refreshed and, if the old session still behaves incorrectly, signed out / signed back in once so the `dual` auth flow can establish the expected token state.

## Commit

- Feature commit: `80e3cf8` `fix: harden studio auth token recovery`
- Docs commit: pending
