---
name: chiangway-web-research
description: Search current facts about Chiang Mai attractions, tickets, hours, closures, or seasonal markets; always return sources with URLs and dates; never answer unstable facts from memory.
---

## Trigger

Fire when:
- The bot is tagged with: `@清微AI助理 幫我上網查這個景點今天/這季有沒有異動，附來源` or similar.
- An itinerary review flags an attraction that may have changed hours, ticket prices, or closure status.
- A quote review references ticket prices that need current verification.
- An operator DC command includes "查景點" / "查票價" / "查開放時間" / "current hours" / "is it open".
- The knowledge base files indicate a fact as "需驗證" or "date-sensitive".

Do NOT fire for stable facts already confirmed in the knowledge base with a recent date stamp (within 30 days).

## Goal

1. Search for current, authoritative information about the requested attraction, service, or rule.
2. Return findings with source URL, publication/access date, and confidence.
3. Flag when sources conflict or when no reliable source could be found.
4. Never answer current hours, ticket prices, closures, or seasonal rules from model memory.

## Inputs

- `query`: the specific question (e.g., "เชียงใหม่ไนท์ซาฟารี ticket prices 2026", "Black Forest restaurant closure days Chiang Mai").
- `caseId` (optional): for linking the finding to a case.
- `context` (optional): any existing itinerary/quote text to help focus the search.
- `language` (optional): `zh` / `en` / `th`; default `zh` + `en`.

## Output Format

```text
[網路查詢結果]
查詢：{query}
查詢時間：{ISO date}

摘要：
{2-4 sentences of consolidated findings}

來源：
1. {source title} — {URL} (存取日期：{date})
2. …

注意事項：
- {conflict or caveat if sources disagree}
- {any uncertainty about recency or accuracy}

建議：
{1-2 sentences on what the team should do with this information}
```

If no reliable source found:
```text
[網路查詢結果]
查詢：{query}
查詢時間：{ISO date}

無法找到可靠的近期資訊。

建議：
- 直接致電景點確認
- 詢問 J姊 / 郭姐（本地專家確認）
- 暫時標記為「需確認」，不要在報價中承諾
```

## Escalation Rules

- If the search reveals a permanent closure or major policy change that affects a case in progress → notify the partner group and flag the case as `needs_info` until the team adjusts the itinerary.
- If sources conflict on ticket price and the discrepancy affects quote math → flag as `needs_human_check`; do not pick one arbitrarily.
- If the question involves a private venue or a resort not indexed online → surface the gap and suggest contacting J姊 / 郭姐.
- If the research is for a DC private command and includes pricing uncertainty → return to DC first, do not auto-post to partner group.

## Known Date-Sensitive Facts (always web-search, never answer from memory)

- Night Safari (夜間動物園) current ticket prices and child height/age rules.
- Elephant camps (大象保護營, Elephant Nature Park, etc.) current booking availability and pricing.
- Chiang Mai Water Park (流水樂園) seasonal opening dates.
- Weekend markets: 真心市集 (JJ Market), 椰林市集, Wualai Walking Street — operating days and dates.
- Baan Kang Wat — closed Tuesday.
- Black Forest restaurant — closed Wednesday.
- 星宇 / 亞航 / 長榮 / 華航 flight schedule changes.

## Must NOT

- NEVER answer current ticket prices, current opening hours, or temporary closures from model memory alone.
- NEVER cite a source without including its URL and the date it was accessed or published.
- NEVER present uncertain research results as confirmed facts to the LINE partner group.
- NEVER post web research results to the LINE partner group from DC without Eric's explicit send command.
- NEVER update the knowledge base files with web-researched facts without flagging them as needing human review and a date stamp.
- NEVER write API keys or tokens into any repo file.
