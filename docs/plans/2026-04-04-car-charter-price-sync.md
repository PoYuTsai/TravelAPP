# Car Charter Price Sync Log

**Date:** 2026-04-04

**Goal:** Sync the confirmed car charter price increase across the public website, Sanity helper inputs, and LINE OA internal documentation.

## Updated Price Baseline

- VIP / family charter pricing:
  - 清邁市區 `NT$3,700`
  - 清邁郊區 `NT$4,300`
  - 南邦 / 南奔 `NT$4,500`
  - 茵他儂一日 `NT$4,500`
  - 清萊一日 `NT$5,300`
  - 金三角一日 `NT$6,300`
  - 接送機 `NT$700`
- Small car pricing:
  - 清邁市區 `NT$3,000`
  - 清邁郊區 `NT$3,300`
  - 南邦 / 南奔 `NT$3,500`
  - 茵他儂一日 `NT$3,500`
  - 清萊一日 `NT$4,300`
  - 金三角一日 `NT$4,800`
  - 接送機 `NT$500`

## Synced Files

- `docs/line-oa-mop-execution-plan.md`
- `docs/line-oa-quick-guide.md`
- `docs/line-oa-rich-menu-documentation.md`
- `src/app/layout.tsx`
- `src/app/services/car-charter/page.tsx`
- `src/components/sections/Services.tsx`
- `src/lib/site-settings.ts`
- `src/sanity/components/QuickStartInput.tsx`
- `src/sanity/components/structured-editor/StructuredQuotationTable.tsx`

## Commits

- `d09ea5e` `feat: add formal pricing studio access`
- `71b040b` `chore: sync car charter price updates`

## Verification

- `npm.cmd run build`
