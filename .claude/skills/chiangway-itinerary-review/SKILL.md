---
name: chiangway-itinerary-review
description: Review a pasted itinerary text for parser completeness, family pacing risk, route reasonableness, and quote readiness; output a structured report.
---

## Trigger

Fire when:
- A partner group message contains multi-day itinerary text (days, stops, meals, lodging pattern visible).
- The bot is tagged with: `@清微AI助理 這份行程幫我檢查` or similar.
- An operator DC command includes "parse 行程" / "check itinerary" / "行程有沒有問題".
- The quote-review skill finds an itinerary attachment that has not yet been parser-checked.

## Goal

1. Run the itinerary through the TypeScript parser dry-run and surface what was and was not parsed.
2. Identify travel-quality risks: family pacing, drive time, rest time, young-child suitability.
3. Flag quote-readiness gaps: tickets, meals, guide, vehicle, lodging, included/excluded items.
4. Give the team a concrete list of items to confirm before proceeding to quote review.

Parser completeness is checked FIRST. Travel quality comes second. Quote readiness comes third.

## Inputs

- `rawItineraryText`: the full pasted itinerary string.
- `caseId` (optional): links the review result to the right case.
- `childAges` (optional): array of child ages in years; required for pacing and seat checks.
- `travelDates` (optional): for seasonal / closure checks.

## Output Format

```text
[行程解析檢查]
#{caseId or "未綁定"}

整體：{全部可解析 | 部分可解析 | 無法解析}

已解析：
D1：{stop1}、{stop2}、{meal}、{lodging}
D2：…
…

可能漏 parse：
- {item}: {reason}
…

行程風險：
- {risk description}
…

建議先補（進報價前）：
- {missing item 1}
- {missing item 2}
…
```

If the parser throws an error, output:
```text
[行程解析失敗]
錯誤：{error message}
原始輸入前 200 字：{truncated}
建議：把行程重新貼成純文字，移除特殊符號後再試。
```

## Escalation Rules

- If child age < 3 AND itinerary includes late-night activity (after 21:00) or early-morning flight (before 06:00) → flag as HIGH RISK; do not soft-pedal.
- If same-day schedule includes water park + night safari (兒童體力負荷) → warn proactively even if not tagged.
- If the itinerary spans Chiang Rai and car time would exceed 12 hours without a rest stop → flag as route risk.
- If parser outputs less than 50% of the expected day count → mark as "無法解析" and surface the raw error; do not attempt a fabricated summary.
- Escalate to Eric (not @Tsai/@Chun) if the itinerary includes a medical tour, adventure sport, or any activity that may require travel insurance review.

## Must NOT

- NEVER fabricate parsed stops that do not appear in the TypeScript parser output. If the parser misses something, say "可能漏 parse" — do not invent it as parsed.
- NEVER auto-reply to the LINE OA customer based on an itinerary review result.
- NEVER directly edit parser logic, source code, or Sanity schema from within this skill. Route those requests as bug packets to the DC/CC development lane.
- NEVER post the review result to the LINE partner group from DC without Eric's explicit send command.
- NEVER state "行程 OK" without running the full parser dry-run. Impressionistic OK is not acceptable.
- NEVER claim current attraction hours, ticket prices, or closure rules from memory. Current facts require web search with sources and dates.
- NEVER write API keys or tokens into any repo file.
