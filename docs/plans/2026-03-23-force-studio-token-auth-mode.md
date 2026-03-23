# 2026-03-23 Force Studio Token Auth Mode

## Summary

This maintenance slice forces Sanity Studio to use token-based authentication instead of `dual` mode so the protected Dashboard / Accounting flow can reliably receive a bearer token for session issuance.

## Why This Was Needed

- `dual` mode prefers cookies where possible
- The project's protected Studio tools depend on a usable Sanity bearer token so `/api/auth/session` can verify the current user with `/users/me`
- If Studio signs in through the cookie path, the UI may still know the current user but no usable token reaches the dashboard session flow

## What Changed

- Updated `sanity.config.ts`
- Changed:
  - `auth.loginMethod: 'dual'`
  - to `auth.loginMethod: 'token'`

## Verification

- `npm run lint` -> passed
- `npm run build` -> passed

## Operator Note

- After deployment, sign out of Studio once and sign back in so the auth flow can establish the expected token-based session locally.

## Commit

- Feature commit: `c91e325` `fix: force studio token auth mode`
- Docs commit: pending
