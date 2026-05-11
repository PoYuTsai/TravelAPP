# Quote Deposit MVP Handoff

## Branch / Workspace
- Branch: `codex/quote-deposit-payment-mvp`
- Worktree: `C:\Users\eric1\OneDrive\Desktop\TravelAPP\.worktrees\codex-quote-deposit-payment-mvp`

## Goal
Move retail customers away from direct bank transfer and into a safer `/quote/[slug]` deposit-payment flow backed by ECPay.

## What is implemented
- `pricingExample` now stores quote-level payment metadata:
  - `orderNo`
  - `paymentState`
  - `depositLabel`
  - `depositAmountTWD`
  - `paymentProvider`
  - `paymentTradeNo`
  - `paymentUrl`
  - `paymentCreatedAt`
  - `paymentExpiresAt`
  - `paymentPaidAt`
- `/quote/[slug]` now shows a payment card with:
  - draft / ready / pending / paid / expired states
  - merchant-defined deposit amount
  - reservation copy
- ECPay helper layer exists for:
  - merchant trade numbers
  - order numbers
  - CheckMacValue generation
  - callback verification
- Quote payment routes exist:
  - `POST/GET /api/quote/[slug]/payment-link`
  - `GET /api/quote/[slug]/payment-status`
  - `POST /api/quote/[slug]/expire-payment`
  - `POST /api/payments/ecpay/callback`
- Studio-side document actions now exist for `pricingExample`:
  - `開啟客戶頁`
  - `開啟訂金付款`
  - `標記付款已過期`
- `pricingExample` schema is grouped into clearer fieldsets so payment inputs are easier to manage in Studio

## Current business guardrails
- Phase A only collects **our own service deposit**
- No lodging collection
- No ticket collection
- No customer-entered arbitrary amount
- One quote should only have one active payment link at a time
- Payment success is the formal reservation step

## Important implementation note
Current MVP is wired to ECPay with:
- `ChoosePayment=Credit`

So this branch is **credit-card-first**.
Apple Pay / LINE Pay exposure is not part of the current MVP implementation yet.

## Env vars expected
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_CHECKOUT_BASE_URL`
- `ECPAY_RETURN_URL`
- `SANITY_API_TOKEN`

## Verification status
Verified on 2026-05-11:
- `npm.cmd run test:run` -> PASS (`41 files / 212 tests`)
- `npm.cmd run lint` -> PASS
- `npm.cmd run build` -> PASS

## Known next steps
1. Decide whether Phase B should add a controlled ticket whitelist
2. Decide whether to add customer-side status refresh / return UX polish beyond current skeleton
3. Decide whether to add partial / manual refund tracking fields
4. Decide whether to add a more guided Studio input panel beyond the current document actions + grouped fields
