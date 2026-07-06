# Quote Included / Excluded Rules

> **Currency rule**: All Chiangway quotes are in Thai Baht (泰銖, THB). Never use `元` without a qualifier. If a customer pastes a quote in TWD or another currency, flag it immediately.
>
> **Source of truth**: The internal quote calculator (`src/sanity/tools/pricing/`) is the authoritative math engine. This file is advisory context for the AI agent's review checks.

## Standard Included Items

These items are included in standard Chiangway packages unless explicitly noted as excluded:

- 油費 (fuel)
- 停車費 (parking)
- 過路費 (tolls)
- 乘客保險 (passenger insurance) — typically 400 THB/day for standard packages; 需驗證 for exact current rate
- 導遊費 (Chinese-speaking guide fee) — when guide is requested; stated as N-day total

## Standard Excluded Items

These items are ALWAYS excluded unless the quote explicitly includes them with a price:

- 餐費 (all meals) — customers pay on-site unless a specific meal is listed with a price
- 其餘景點門票 (all attraction tickets not itemized in the quote)
- 小費 (tips) — separate from guide fee
- 超時費 (overtime) — charged after included car time ends
- 個人消費 (personal shopping, souvenirs)

## Ticket Inclusion Rules

Tickets that appear in the quote total are INCLUDED. All others must appear in the excluded section.

Commonly included tickets (when listed with price):
- 夜間動物園 (Night Safari) — adults and children; child pricing varies by age/height (needs web-search for current)
- 大象保護營 / 大象自然公園 (Elephant camps) — adults and children
- 流水樂園 (Water park / Stream park) — check current operating season
- 蘭納古城博物館 (historical museums, when included)

Formula for tickets with child pricing:
- Always ask for child ages before including ticket items in a quote.
- If "其餘門票現場買" appears → list those tickets explicitly in excluded items.

## Guide Fee Rules

- Chinese-speaking guide is a separate daily fee from vehicle/driver.
- Guide fee is stated as: 導遊費 N 天 X THB/day = total.
- If guide fee appears in both the day-by-day breakdown AND as a separate total line, flag as possible double-count.
- Guide fee is included in the quote TOTAL only if explicitly listed.

## Insurance Policy

- Standard passenger insurance is mandatory for all packages.
- Rate is per vehicle per day (not per person).
- Confirm current rate with Eric or web-search before quoting.
- Insurance amount must appear in the quote breakdown; do not omit.

## Payment Terms (standard)

Three-stage payment is the standard Chiangway policy:
1. Deposit (訂金) to confirm booking.
2. Balance before departure or first service day.
3. Any on-site extras settled directly.

Exact percentages are set per case by Eric. Do not invent percentages from this file.

## Currency Ambiguity Flag

When reviewing a quote, flag any of the following as `needs_human_check`:
- `元` without a currency qualifier (could be TWD, THB, or CNY).
- Mixed currencies in the same quote.
- A total that is implausibly low for a multi-day itinerary (e.g., total < 5,000 for a 5-day trip may indicate currency confusion).

## Validation Thresholds

These are heuristic warnings, not hard rules. Flag for human review:
- Total arithmetic error > 500 THB → severity `blocked`.
- Day fee sum differs from stated sub-total by > 100 THB → flag.
- Guide fee listed as "included" but not in the included-items list → flag as incomplete disclosure.
- "其餘門票現場買" appears but excluded items section does not list them → flag as missing exclusion.
