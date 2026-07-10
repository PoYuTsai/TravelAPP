# Quote Included / Excluded Rules

> **Currency rule**: All Chiangway quotes are in Thai Baht (泰銖, THB). Never use `元` without a qualifier. If a customer pastes a quote in TWD or another currency, flag it immediately.
>
> **Source of truth**: The internal quote calculator (`src/sanity/tools/pricing/`) is the authoritative math engine. This file is advisory context for the AI agent's review checks.

## Standard Included Items

These items are included in standard Chiangway packages unless explicitly noted as excluded:

- Vehicle(s) selected by total occupied seats and professional Thai driver(s)
- 油費 (fuel)
- 停車費 (parking)
- 過路費 (tolls)
- 行程事先確認與 LINE 中文支援

## Optional / Quote-Specific Items

These are not standard inclusions. Add them only when the customer selects them or the formal quote explicitly includes them:

- 中文導遊：一台或兩台車目前對客售價錨點為 THB 2,500／服務日；2–3 人也可正常選配，且不因人數強制。
- 旅遊保險：THB 100／人／趟，自由加購；投保時成人、兒童與嬰幼兒都計入。
- 兒童安全座椅：THB 500／日／張；安裝在該孩子已佔用的乘客座位，不另增加一位旅客。

## Standard Excluded Items

These items are ALWAYS excluded unless the quote explicitly includes them with a price:

- 餐費 (all meals) — customers pay on-site unless a specific meal is listed with a price
- 其餘景點門票 (all attraction tickets not itemized in the quote)
- 小費 (tips) — separate from guide fee
- 超時費 (overtime) — 清邁 10 小時、清萊／金三角 12 小時，另有 30 分鐘現場彈性；超過後 THB 300／小時／台，不另收導遊超時費
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
- For one or two cars, the current sell anchor is THB 2,500 per confirmed non-transfer service day. Two Vans share one guide and one sell anchor.
- A 2–3-person sedan request may select a guide through the automatic quote path. Passenger count never creates a mandatory-guide rule.
- Pure airport-transfer days do not automatically add guide service; a partial-trip guide request requires manual confirmation.
- If guide fee appears in both the day-by-day breakdown AND as a separate total line, flag as possible double-count.
- Guide fee is included in the quote TOTAL only if explicitly listed.

## Insurance Policy

- Passenger insurance is optional, not mandatory.
- The locked rate is THB 100 per person per trip, not per vehicle or per day.
- Include it in the breakdown only when selected; count infants and children when insurance is purchased.

## Airport-Only Transfer and Fleet Rules

- Airport-only one-way transfer: sedan THB 500／trip or Van THB 700／trip. Do not charge a full-day charter merely because it is an arrival or departure day.
- If the same day contains meaningful touring, price the service as a charter day instead of stacking a cheap airport-only transfer onto touring.
- Fleet follows total occupied seats: 2–3 use one sedan, 4–9 one Van, 10–18 two Vans, and 19+ manual. A four-person family uses Van pricing even when some passengers are children.
- SUV is never a public vehicle or price promise. Operations may use it only as an availability-based, same-price internal dispatch/upgrade; a requested SUV or special luggage/seating layout is manual.

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
