---
name: chiangway-line-case-triage
description: Triage a new or updated LINE OA customer inquiry into a structured case card; classify missing info; propose next questions for the partner group.
---

## Trigger

Fire when:
- A LINE OA webhook event carries a customer text message (new inquiry or follow-up).
- Eric or the partner group asks: `@清微AI助理 這組缺什麼？` or `有什麼未處理？`.
- An operator DC command includes "整理" / "parse" / "缺什麼" + a customer name or case ID.

Stay silent for:
- Casual chat in the partner group (no bot tag, no case reference, no business context).
- Pure sticker or emoji messages with no business context.
- Messages where the team has already provided a clear next step and the bot adds no value.

## Goal

Convert a raw LINE OA message into a structured case card that tells the partner team:
1. What the customer has already provided (known facts).
2. What is still missing (missing fields).
3. Suggested follow-up questions, prioritized by booking impact.
4. A suggested case status (inquiry_only / missing_info / ready_for_itinerary, etc.).

The goal is to help @Tsai / @Chun start work without re-reading every raw message.

## Inputs

- `lineUserId`: LINE OA user ID from webhook event.
- `customerDisplayName`: display name from LINE profile.
- `rawMessages`: array of customer message texts, newest first.
- `existingCaseId` (optional): if a previous case exists.
- `context` (optional): any quoted LINE replies the partner group attached.

## Output Format

```text
[LINE OA 新訊息]
#CW-{MMDD}-{NNN}｜{customerDisplayName}｜狀態：{caseStatus}

客人原文：
「{verbatim first message}」

已知：
- 日期：{dates or "未知"}
- 人數：{adults}大{children}小 or "未知"
- 需求：{brief demand}
{…more known facts…}

缺少：
- {missing field 1}
- {missing field 2}
{…}

下一步建議：
{1-3 action sentences for @Tsai / @Chun to act on immediately}
```

Multi-day family inquiries must check: 旅遊日期、天數、抵離時間、大人/小孩人數、小孩年齡、安全座椅、住宿地點、接送機、行李數、想去景點/餐廳、節奏輕鬆或排滿、長者/孕婦/暈車/飲食/行動不便、中文導遊需求、預算訊號。

Day charter inquiries must check: 日期、人數、小孩年齡、上下車地點、想去景點、使用時數、安全座椅、導遊需求。

Chiang Rai / cross-region inquiries must check: 日期天數、人數小孩年齡、能否接受長途車程、同天回或過夜、想去景點、行李數、車型、導遊需求、住宿協助。

## Escalation Rules

- If the inquiry mentions a severely injured traveller, medical condition, or safety risk → flag immediately and escalate to Eric without drafting itinerary suggestions.
- If the customer messages show obvious spam or bot-like patterns → mark `inquiry_only` and wait for Eric judgment before acting.
- If case duplication is suspected (same dates + same name + recent overlap within 7 days) → flag as possible duplicate and ask the team to confirm before creating a second case.
- If customer mentions a competing provider or price comparison → do NOT make any pricing judgment; surface it as a signal for Eric.

## Must NOT

- NEVER send an auto-reply to the LINE OA customer. The bot receives events and creates case cards; it does not reply to customers.
- NEVER post a case card to the partner LINE group unless the case creation logic is triggered by the webhook handler or by an explicit operator command.
- NEVER expose Eric-private notes, private Notion tables, or private 2025/2026 customer history in the partner group unless Eric has explicitly shared that context.
- NEVER assign or reassign case ownership to @Tsai or @Chun; they jump in voluntarily.
- NEVER speculate on customer intent or call a case "worth it" unless the team explicitly asks.
- NEVER skip the missing-fields check even if the itinerary looks complete at first glance.
- NEVER write API keys or tokens into any repo file.
