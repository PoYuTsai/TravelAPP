# Studio Hard Access Guard Record

- **Completed:** 2026-04-09
- **Goal:** make collaborator sessions safe even if the Studio navbar still shows internal tool names.
- **Code commit:** `5e00579` `fix: harden studio tool access`

## What Changed

- tightened `src/sanity/studio-access.ts` so only the owner allowlist keeps full Studio access
- changed the default fallback for unknown or missing emails to `structure` + `pricing-formal`
- added `canAccessStudioTool()` so individual tools can hard-check access, not just rely on navbar filtering
- hard-gated `DashboardTool` and `AccountingTool` with the verified Studio session email
- hard-gated legacy `pricing` so collaborators who click `報價計算測試v1` now land on an explicit `無權限存取` screen
- kept `Structure` and `報價計算(正式版)` available for collaborator and restricted sessions

## Security Outcome

- Owner email: full access to all 5 Studio tools
- Collaborator emails: usable access to `Structure` and `報價計算(正式版)` only
- Unknown / fallback sessions: also reduced to `Structure` and `報價計算(正式版)` instead of accidentally getting the full tool list
- Direct-click attempts into `Dashboard` / `Calculate` / `報價計算測試v1` are blocked at the tool level

## Verification

- `npm.cmd run test:run -- src/sanity/__tests__/studio-access.test.ts`
- `npm.cmd run build`
