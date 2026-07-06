# Payment / Booking Risk Policy

- Date: 2026-06-03
- Branch: `codex/line-oa-agent-mvp`
- Status: hard operational boundary; no implementation yet
- Related:
  - `2026-06-03-partner-group-reply-gate-billing-design.md`
  - `2026-06-03-partner-group-mention-design.md`

## 0. This Is a Hard Boundary, Not Advice

Based on risk-control and operating policy, the rules below are **hard operational boundaries**. They are not suggestions the bot may weigh against convenience. The AI assistant must treat them as constraints it cannot relax — in partner-group answers, in quote/itinerary review, and in any future customer-reply draft.

Detailed background for these rules is **operator-only**. It must not be written into formal docs, partner-facing summaries, or customer summaries. Where a reason is needed, the only phrasing that goes into docs or any generated text is: **"based on risk-control and operating policy."**

## 1. No Paying-on-Behalf, No Booking-on-Behalf (Hotels / B&B)

Chiangway Travel currently does **not** pay on a customer's behalf and does **not** book hotels / B&B on a customer's behalf.

- The bot must **never** suggest — in a partner-group message or in any future customer-reply draft — that "we can front the accommodation payment for the customer" or anything equivalent.
- If a customer asks us to book a hotel / B&B for them, the case is flagged `risk_policy_review` / `needs_eric`.
- The correct partner-facing framing is: switch to **recommending hotels, helping compare options, and giving suggestions** — but **not** paying on their behalf and **not** booking on their behalf.

Forbidden language anywhere the bot generates text: 代付 / 幫忙刷卡 / 先墊款 / 民宿代付 / 飯店代訂.

## 2. Ticket Booking — Allowed Scope

Booking tickets on a customer's behalf is allowed **only** for:

- Night Safari (夜間動物園)
- Elephant experience / elephant camp (大象體驗 / 大象營)
- Items handled through a **trusted agent that Eric knows and regularly uses**

For any other ticket / activity:

- Default: **do not** book on their behalf.
- May suggest: buy on-site, buy through the official channel, or have the guide assist on-site.
- If the partner is unsure whether an item is in scope, flag `needs_eric` rather than guessing.

## 3. Quote / Itinerary Review — Risk Checks

When the bot reviews an itinerary or a quote, it must check for and surface these as **risk-control flags** (internal only):

- Accommodation accidentally written as **"included"**.
- An unknown / out-of-scope ticket accidentally written as **"booked-on-behalf / included"**.
- Presence of any of: 代付 / 幫忙刷卡 / 先墊款 / 民宿代付 / 飯店代訂.

If any of these appear, the item **must** be listed as a risk-control reminder. This applies equally to the visible quote text and to any backend "included / booked-on-behalf" checkbox state that would be filled.

## 4. Outbound Messaging Direction

The bot only produces **internal suggestions**; it does **not** auto-reply the customer (this stays consistent with the customer-OA boundary in the reply-gate design).

If a customer-reply draft is generated in the future, the direction must be:

- We can **recommend** suitable hotels / accommodation areas.
- We can **assist** with itinerary and charter (包車) arrangements.
- Hotels / B&B should be **booked by the customer themselves** via official or hotel-booking platforms.
- Designated tickets may be assisted per policy (§2); everything else is on-site / official-channel purchase.

## 5. Document Privacy

- Do **not** write the full personal data / incident details behind this policy into any doc.
- Docs state only: **"based on risk-control and operating policy."**
- Detailed background lives, at most, in an **operator-only private note** — never in a partner-facing summary and never in a customer summary.

## 6. Non-Goals

This document defines policy boundaries only. It does **not**:

- Implement any code, gate, or check.
- Change the customer-OA no-LLM / no-auto-reply boundary.
- Authorize any send to customers.

Enforcement (parser checks, quote-review flags, case flags `risk_policy_review` / `needs_eric`) is specified and built separately, under the dual-AI workflow in the reply-gate design doc.
