---
name: chiangway-notion-fill
description: Write allowed fields to the Notion 2026 team collaboration database after permission check, confidence scoring, and audit log; read confirmed-case data for similar-case search.
---

## Trigger

Fire when:
- The bot is tagged with: `@清微AI助理 把這組已確認資料填到 Notion` or similar.
- An operator DC command specifies "填 Notion" / "update Notion" with a case ID and target fields.
- A case transitions to `added_eric` / `converted` and the team confirms writing confirmed-case data.
- A quote review result is approved and the team asks to write the quote summary to Notion.

Do NOT fire for casual Notion reads initiated from partner group without explicit fill intent.

## Goal

1. Classify the target Notion fields as `read_only`, `draft_write`, `confirmed_write`, or `manual_only`.
2. For allowed fields, construct the Notion API payload with source message ID, actor, and timestamp.
3. Write the fields with audit log entries.
4. Return a summary of what was written, what was skipped, and what needs manual attention.
5. For similar-case search: query the 2026 team collaboration database for cases with matching trip type/duration/group size and return a reference summary.

Notion 2026 team collaboration is confirmed-case / reference data. It is NOT the unprocessed inbox.

## Inputs

- `caseId`: the KV case ID to link the Notion write to.
- `targetDatabaseId`: must match `NOTION_TEAM_2026_DATABASE_ID` env var; refuse other databases.
- `fields`: key-value pairs of fields to write, each with a confidence score (0-1).
- `sourceMessageId`: LINE or DC message ID that originated the data.
- `actor`: `eric` / `tsai` / `chun` / `ai-agent`.
- `caseStatus`: current case status from KV; some fields require specific statuses.

## Field Write Policy

| Field category | Write allowed when | Notes |
|---|---|---|
| Draft/working fields (notes, tags, missing info) | Case status is any active status + actor is team member | AI agent may fill with confidence ≥ 0.8 |
| Customer basics (name, dates, group size) | Case is confirmed / added_eric or above | Require team member confirmation |
| Quote amount, itinerary link | Case is quoted / converted | Require eric confirmation |
| Formula, rollup, relation fields | Never | Read-only outputs |
| Private customer history (2025/2026 private tables) | Never from this skill | Eric-private, not exposed to partner group |

Human confirmation is required when:
- Confidence < 0.8 on any field that affects price, safety, or confirmed booking data.
- The write would affect a case already marked `converted` or `lost`.
- The `actor` is `ai-agent` and the target field is customer-facing.

## Output Format

```text
[Notion 填寫結果]
#{caseId}

已寫入：
- {field}: {value} (信心度 {score}, 來源 msg #{sourceMessageId})
…

跳過（需人工）：
- {field}: {reason}
…

唯讀（不寫）：
- {field}: formula/rollup
…

審計記錄：actor={actor}, 時間={ISO timestamp}
```

## Escalation Rules

- If any field write returns a Notion 404 → check that both the database AND the `Chiangway AI Agent` integration share is active; surface the exact Notion error to the team.
- If confidence < 0.5 on a required field → skip the write, return it in "跳過（需人工）", and ask the team to supply the correct value.
- If a Relation field's related database is not shared with the integration → skip and explain; do not attempt to create orphan pages.
- If the case status does not permit a field write → skip and explain the required status transition.

## Must NOT

- NEVER read or write private 2025/2026 Notion customer tables from this skill; those are Eric-private and must not be exposed to the partner group.
- NEVER display raw Notion page IDs or raw database IDs in partner-group replies; use human-readable case IDs.
- NEVER auto-fill Notion without the explicit command from the partner group or a confirmed DC command with explicit send intent.
- NEVER modify formula, rollup, or read-only Notion fields.
- NEVER paste or write Notion API tokens or NOTION_TOKEN values into any repo file or chat response.
- NEVER trigger Notion writes from casual chat or untagged partner-group messages.
- NEVER write API keys or tokens into any repo file.
