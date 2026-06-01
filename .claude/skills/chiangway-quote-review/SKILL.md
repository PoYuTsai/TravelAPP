---
name: chiangway-quote-review
description: Parse and validate a pasted quote text; verify day fees, guide fee, insurance, ticket math, included/excluded items, and totals; output a structured review + backend-fill draft.
---

## Trigger

Fire when:
- A partner group message contains a quote block (day prices, guide fee, totals visible).
- The bot is tagged with: `@清微AI助理 這個報價有沒有漏？` or similar.
- An operator DC command includes "check quote" / "報價有沒有問題" / "幫我驗報價".
- The quote-automation flow requests a pre-flight review before writing to Sanity.

## Goal

1. Extract all quote line items: day-by-day vehicle prices, guide fee, insurance, ticket items and formulas, included items, excluded items, total price, currency, car usage time, overtime fee, tip policy, notes.
2. Validate arithmetic: day fee sum, guide fee, ticket math, subtotal, final total.
3. Flag semantic risks: currency ambiguity (元 vs 泰銖), duplicate guide fee, missing exclusion disclosures, on-site-only tickets not marked as excluded.
4. Produce a backend-fill draft ready to paste into the internal quote calculator.

Validation must be forgiving in input style and strict in output correctness.

## Inputs

- `rawQuoteText`: the full pasted quote string.
- `caseId` (optional): links review to the right case.
- `currency` (optional): if customer / team stated a currency explicitly.
- `travelDates` (optional): for year-contradiction check.

## Output Format

```text
[報價解析檢查]
#{caseId or "未綁定"}

整體判斷：
{全部可解析，數字正確 | 部分可解析，建議先補 N 個資訊 | 無法解析}

加總檢查：
- Day 車資：{sum breakdown}
- 導遊費：{amount}
- 保險：{amount}
- 小計：{amount}，{正確 | 差異 X}
- 票項：{items}
- 總計：{amount}，{正確 | 差異 X}

疑似問題：
- {issue 1}
- {issue 2}
…

[後台填寫草稿]

包含：
✅ {included item 1}
✅ {included item 2}
…

不包含：
- {excluded item 1}
- {excluded item 2}
…

價格項目：
- Day 1 包車：{amount}
- Day 2 包車：{amount}
…
- 導遊 {N} 天：{amount}
- 保險：{amount}
- {ticket item}：{amount}
…

總價：
{total} 泰銖
```

## Escalation Rules

- If total arithmetic error > 500 THB → mark severity `blocked`; do not let the quote proceed to Sanity write until human resolves.
- If currency is ambiguous (e.g., 元 without a qualifier near the total) → mark severity `needs_human_check` and ask partner group to confirm.
- If guide fee appears both in the day breakdown AND as a separate line (possible double-count) → flag as `blocked`.
- If the quote total is 0 or negative after parsing → flag as parser failure; output a bug packet request.
- If ticket items reference night safari or elephant camp and no child ticket formula is visible for child ages under 12 → flag as `needs_human_check`.

## Must NOT

- NEVER auto-reply to the LINE OA customer with a quote review result.
- NEVER write a Sanity quote document based solely on this skill's output. Writing requires the TypeScript validation report to pass at `ok` or `needs_human_check` with team confirmation.
- NEVER change parser logic, quote calculator code, or Sanity schema from this skill. File a bug packet via the DC/CC lane instead.
- NEVER post a draft quote to the LINE partner group from DC without Eric's explicit send command.
- NEVER claim that the quote is "ready to send to customer" from this skill. That is Eric's judgment call.
- NEVER omit the exclusions section even if the raw text does not mention it — flag it as "未列明，需補充".
- NEVER write API keys or tokens into any repo file.
