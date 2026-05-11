# Quote Deposit Payment MVP Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let each customer-specific `/quote/[slug]` page collect a merchant-defined service deposit through ECPay, so payment success becomes the formal reservation step and customers no longer transfer money directly to personal bank accounts.

**Architecture:** Reuse the existing Sanity `pricingExample` document and `/quote/[slug]` public page. Add a small payment state model to each quote, render a payment card on the quote page, and create server routes that generate one active ECPay payment link per quote and accept signed callbacks. Phase A intentionally excludes lodging, tickets, and any other third-party pass-through money.

**Tech Stack:** Next.js 14 App Router, Sanity CMS, Vitest, ECPay payment link / checkout integration, Tailwind CSS

---

## Implementation Status (2026-05-11)

### Completed in this MVP skeleton
- Added quote-level payment fields to Sanity `pricingExample`
- Added quote payment normalization helpers and typed quote data access
- Rendered a customer-facing payment card on `/quote/[slug]`
- Added ECPay helper utilities for order numbers, CheckMacValue generation, and callback verification
- Added quote payment routes:
  - `POST/GET /api/quote/[slug]/payment-link`
  - `GET /api/quote/[slug]/payment-status`
  - `POST /api/quote/[slug]/expire-payment`
  - `POST /api/payments/ecpay/callback`
- Added Studio-side operator helpers for `pricingExample`:
  - `開啟客戶頁`
  - `開啟訂金付款`
  - `標記付款已過期`
- Reorganized `pricingExample` schema into grouped fieldsets so payment controls and system fields are easier to manage
- Added tests for helpers, routes, and payment card states
- Verified the current branch with:
  - `npm.cmd run test:run`
  - `npm.cmd run lint`
  - `npm.cmd run build`

### Still intentionally excluded
- Lodging collection
- Ticket collection
- Notion write-back
- Merchant-side Studio controls for payment state editing
- Automated refund flows
- ATM / CVS payment methods
- Apple Pay / LINE Pay surfaced payment methods

### Current merchant assumption
This branch assumes the merchant will still decide these values manually inside the quote document:
- whether the quote is `payment_ready`
- the `depositLabel`
- the `depositAmountTWD`
- the `paymentExpiresAt`

The public quote page only consumes and displays those values.

### Current Studio UX
Operators no longer need to hunt through scattered raw fields just to start deposit collection.

Inside a `pricingExample` document:
- payment-related merchant inputs are grouped under `Payment Controls / 付款控制`
- provider-generated fields are grouped under `Payment System Fields / 系統欄位`
- document actions now let the operator:
  - open the customer quote page
  - move a quote into `payment_ready`
  - manually mark a stale payment as `expired`

## Scope Guardrails

### In scope
- Customer-specific quote pages can show a service deposit amount.
- Merchant can decide whether a quote is payment-ready.
- Merchant can define a flexible deposit amount per quote.
- Customer pays via ECPay instead of direct bank transfer.
- One quote can have only one active payment link at a time.
- Payment success updates quote status to `paid`.
- Quote page shows payment state and reservation messaging.

### Out of scope for Phase A
- Lodging collection
- Ticket collection
- Notion schema changes
- Automated accounting sync
- Multiple installment payments
- Apple Pay / LINE Pay UI exposure
- ATM / CVS payment methods
- Automatic refund orchestration

## Business Rules

1. Phase A only collects **our own service deposit**.
2. Customer cannot input arbitrary payment amounts.
3. Payment amount is decided by the merchant in Sanity.
4. Payment success is required before the date is formally reserved.
5. A quote in `paid` state must not expose a second active payment link.
6. Lodging and ticket money stay out of this flow for now.
7. Payment methods are limited to card-family methods that are easier to refund and dispute.

## Payment State Model

Use these five states on each quote:

- `draft`
  - Informational quote only
  - No payment link is available
- `payment_ready`
  - Merchant has enabled payment and set amount / expiry
  - Customer can request or open the current payment link
- `payment_pending`
  - ECPay order exists and is awaiting payment result
- `paid`
  - ECPay callback verified and deposit recorded
  - Reservation is now formally held
- `expired`
  - Payment deadline passed before completion
  - Merchant must intentionally reopen payment if needed

## Security Rules

1. Never expose personal or family bank account details on quote pages.
2. Every payment must map back to exactly one quote slug and one order number.
3. Every payment link must carry an expiry time.
4. Every ECPay callback must be signature-verified.
5. Callback handling must be idempotent.
6. Old payment links must become inactive once a newer one is created.
7. Phase A must only allow fixed merchant-defined amounts.

## ECPay Integration Rules

### Allowed methods in Phase A
- Credit card

> Implementation note: the first MVP will submit to ECPay with `ChoosePayment=Credit`. Apple Pay can be evaluated later as a separate surfaced payment option once the base flow is stable.

### Not allowed in Phase A
- ATM virtual account
- CVS barcode / code
- Any method that pushes refunds back into manual bank-transfer handling

### Refund handling for Phase A
- If we cannot fulfil the service:
  - Try to remediate first
  - If remediation fails, refund all or unused service value
- Customer cancellation continues to follow the existing cancellation policy page
- Phase A only uses ECPay methods that support cleaner merchant-side refund handling

## Data Model Changes

### Task 1: Extend `pricingExample` payment fields

**Files:**
- Modify: `src/sanity/schemas/pricingExample.ts`
- Modify: `src/lib/quote/types.ts`
- Modify: `src/lib/quote/fetchQuote.ts`

**Step 1: Write failing tests for quote payment typing**

Create tests that expect quote data to expose payment state, amount, label, expiry, and order number.

**Step 2: Run tests to verify failure**

Run:

```bash
npm.cmd run test:run -- src/lib/quote/__tests__/paymentState.test.ts
```

Expected:
- Fails because payment fields do not yet exist.

**Step 3: Add payment fields to Sanity schema**

Add fields:
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

Recommended defaults:
- `paymentState`: `draft`
- `paymentProvider`: `ecpay`

**Step 4: Extend quote data types and fetch logic**

Expose the above fields in `QuoteData`, and fetch them from Sanity so the page can render status without reading raw payload JSON.

**Step 5: Run tests to verify green**

Run:

```bash
npm.cmd run test:run -- src/lib/quote/__tests__/paymentState.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add src/sanity/schemas/pricingExample.ts src/lib/quote/types.ts src/lib/quote/fetchQuote.ts src/lib/quote/__tests__/paymentState.test.ts
git commit -m "feat: add quote payment state fields"
```

### Task 2: Render payment card on `/quote/[slug]`

**Files:**
- Modify: `src/app/quote/[slug]/QuotePageClient.tsx`
- Modify: `src/components/quote/QuoteCostDashboard.tsx`
- Create: `src/components/quote/QuotePaymentCard.tsx`
- Test: `src/components/__tests__/QuotePaymentCard.test.tsx`

**Step 1: Write failing UI tests**

Cover:
- `draft` shows informational text only
- `payment_ready` shows amount, deadline, and pay button
- `payment_pending` shows waiting state
- `paid` shows confirmation and hides pay button
- `expired` shows expiry message

**Step 2: Run tests to verify failure**

Run:

```bash
npm.cmd run test:run -- src/components/__tests__/QuotePaymentCard.test.tsx
```

Expected:
- Fails because component does not exist yet.

**Step 3: Implement `QuotePaymentCard`**

Display:
- `depositLabel`
- `depositAmountTWD`
- `paymentExpiresAt`
- State badge
- Reservation copy:
  - unpaid / ready: payment required to reserve date
  - paid: deposit received, date reserved
  - expired: reservation window expired

**Step 4: Mount payment card into quote flow**

Place the card after the price dashboard or inside the pricing section so the quote reading flow stays intact and the frontend layout stays familiar.

**Step 5: Run tests to verify green**

Run:

```bash
npm.cmd run test:run -- src/components/__tests__/QuotePaymentCard.test.tsx
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add src/app/quote/[slug]/QuotePageClient.tsx src/components/quote/QuoteCostDashboard.tsx src/components/quote/QuotePaymentCard.tsx src/components/__tests__/QuotePaymentCard.test.tsx
git commit -m "feat: show quote deposit payment card"
```

### Task 3: Create payment-link server route

**Files:**
- Create: `src/app/api/quote/[slug]/payment-link/route.ts`
- Create: `src/lib/payments/ecpay.ts`
- Test: `src/app/api/quote/[slug]/payment-link/__tests__/route.test.ts`

**Step 1: Write failing route tests**

Cover:
- rejects quote with no `depositAmountTWD`
- rejects quote that is not `payment_ready`
- creates a payment link for a valid quote
- overwrites / invalidates previous active link metadata when a new one is created

**Step 2: Run tests to verify failure**

Run:

```bash
npm.cmd run test:run -- src/app/api/quote/[slug]/payment-link/__tests__/route.test.ts
```

Expected:
- Fails because route does not yet exist.

**Step 3: Implement ECPay helper abstraction**

Create a helper that:
- builds merchant order data
- limits methods to Phase A whitelist
- accepts quote slug, order number, amount, label, expiry
- returns a checkout URL / form payload abstraction

Use env placeholders for:
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_CHECKOUT_BASE_URL`
- `ECPAY_RETURN_URL`

**Step 4: Implement payment-link route**

Flow:
- load quote by slug
- validate state is `payment_ready`
- validate amount > 0
- generate / reuse order number
- create payment link via helper
- patch Sanity:
  - `paymentState = payment_pending`
  - `paymentTradeNo`
  - `paymentUrl`
  - `paymentCreatedAt`
- return safe payload for frontend use

**Step 5: Run tests to verify green**

Run:

```bash
npm.cmd run test:run -- src/app/api/quote/[slug]/payment-link/__tests__/route.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add src/app/api/quote/[slug]/payment-link/route.ts src/lib/payments/ecpay.ts src/app/api/quote/[slug]/payment-link/__tests__/route.test.ts
git commit -m "feat: create quote payment link route"
```

### Task 4: Create ECPay callback route

**Files:**
- Create: `src/app/api/payments/ecpay/callback/route.ts`
- Test: `src/app/api/payments/ecpay/callback/__tests__/route.test.ts`

**Step 1: Write failing callback tests**

Cover:
- rejects invalid signature
- marks matching quote `paid` on valid success callback
- ignores duplicate success callback without double-updating
- leaves quote non-paid on non-success callback

**Step 2: Run tests to verify failure**

Run:

```bash
npm.cmd run test:run -- src/app/api/payments/ecpay/callback/__tests__/route.test.ts
```

Expected:
- Fails because route does not yet exist.

**Step 3: Implement callback verification + patching**

Flow:
- verify ECPay signature / checksum
- read merchant trade number
- find matching quote
- if already `paid`, return success immediately
- otherwise patch:
  - `paymentState = paid`
  - `paymentPaidAt`
- respond with provider-required acknowledgement

**Step 4: Run tests to verify green**

Run:

```bash
npm.cmd run test:run -- src/app/api/payments/ecpay/callback/__tests__/route.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/app/api/payments/ecpay/callback/route.ts src/app/api/payments/ecpay/callback/__tests__/route.test.ts
git commit -m "feat: handle ecpay payment callbacks"
```

### Task 5: Refresh / poll payment status on quote page

**Files:**
- Create: `src/app/api/quote/[slug]/payment-status/route.ts`
- Modify: `src/components/quote/QuotePaymentCard.tsx`
- Test: `src/app/api/quote/[slug]/payment-status/__tests__/route.test.ts`

**Step 1: Write failing tests**

Cover:
- returns current payment state for quote
- hides internal-only fields

**Step 2: Run tests to verify failure**

Run:

```bash
npm.cmd run test:run -- src/app/api/quote/[slug]/payment-status/__tests__/route.test.ts
```

Expected:
- Fails because route does not exist yet.

**Step 3: Implement payment status route**

Return only:
- `paymentState`
- `depositAmountTWD`
- `depositLabel`
- `paymentExpiresAt`
- `paymentPaidAt`

**Step 4: Update client card refresh behavior**

Allow:
- open payment link
- optionally poll or re-fetch status after return
- show updated `paid` state without requiring deep manual refresh steps

**Step 5: Run tests to verify green**

Run:

```bash
npm.cmd run test:run -- src/app/api/quote/[slug]/payment-status/__tests__/route.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add src/app/api/quote/[slug]/payment-status/route.ts src/components/quote/QuotePaymentCard.tsx src/app/api/quote/[slug]/payment-status/__tests__/route.test.ts
git commit -m "feat: expose quote payment status"
```

### Task 6: Expiry handling

**Files:**
- Create: `src/app/api/quote/[slug]/expire-payment/route.ts`
- Test: `src/app/api/quote/[slug]/expire-payment/__tests__/route.test.ts`

**Step 1: Write failing tests**

Cover:
- converts `payment_ready` or `payment_pending` to `expired` if deadline passed
- leaves `paid` quotes unchanged

**Step 2: Run tests to verify failure**

Run:

```bash
npm.cmd run test:run -- src/app/api/quote/[slug]/expire-payment/__tests__/route.test.ts
```

Expected:
- Fails because route does not exist yet.

**Step 3: Implement expiry route**

This route can be called manually or by a future cron. For MVP it just needs to:
- load quote
- compare `paymentExpiresAt` to current time
- patch `paymentState = expired` when appropriate

**Step 4: Run tests to verify green**

Run:

```bash
npm.cmd run test:run -- src/app/api/quote/[slug]/expire-payment/__tests__/route.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/app/api/quote/[slug]/expire-payment/route.ts src/app/api/quote/[slug]/expire-payment/__tests__/route.test.ts
git commit -m "feat: expire stale quote payment links"
```

### Task 7: Docs, env, and verification

**Files:**
- Modify: `README.md`
- Create: `docs/plans/2026-05-11-quote-deposit-payment-mvp-implementation.md`
- Update: `CLAUDE` / handoff doc only if needed for continuity

**Step 1: Add env documentation**

Document required variables:
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_CHECKOUT_BASE_URL`
- `ECPAY_RETURN_URL`

**Step 2: Run verification suite**

Run:

```bash
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

Expected:
- All pass

**Step 3: Record implementation progress**

Document:
- scope implemented
- scope intentionally excluded
- current manual steps for merchant use
- known next-step work for Phase B

**Step 4: Commit**

```bash
git add README.md docs/plans/2026-05-11-quote-deposit-payment-mvp*.md
git commit -m "docs: record quote deposit payment mvp"
```

## Merchant Workflow After Phase A

1. Build / update customer quote in Sanity.
2. Set quote payment state to `payment_ready`.
3. Set:
   - order number
   - deposit label
   - deposit amount
   - expiry time
4. Share `/quote/[slug]`.
5. Customer pays through ECPay.
6. Callback marks quote `paid`.
7. Merchant treats the date as formally reserved.

## Phase B Candidates

- Controlled ticket collection whitelist
- Partial / manual refund admin actions
- Notion sync
- Back-office merchant payment controls in Studio UI
- Second-payment / balance payment support

## Summary

This MVP does not try to build a full booking system. It builds one safe lane:

- one quote
- one merchant-defined deposit
- one active payment link
- one provider callback
- one reservation confirmation state

That is enough to remove direct stranger-to-bank-account transfers from the retail customer flow and materially reduce future third-party scam exposure.
