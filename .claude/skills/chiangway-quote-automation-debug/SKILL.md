---
name: chiangway-quote-automation-debug
description: Generate a structured bug packet when quote creation automation fails at any stage; surface raw input, parser JSON, errors, and reproduction steps for the DC/CC development lane.
---

## Trigger

Fire when:
- The quote review skill returns severity `blocked` and automation cannot proceed.
- Quote creation returns a non-200 response or throws an exception.
- The admin UI driver (CUA/Puppeteer) fails, times out, or produces a blank/unexpected result.
- The validation report shows arithmetic errors > 500 THB or total discrepancy after Sanity write.
- Eric or the partner group asks: `@清微AI助理 這個報價為什麼建立失敗？` or similar.
- An operator DC command includes "debug quote" / "debug automation" / "幫我看失敗原因".

## Goal

Produce a complete, self-contained bug packet that a developer (CC/Codex) can use to reproduce and fix the failure — without needing to access the live customer case or re-run the broken workflow.

The bug packet goes to the DC/CC development lane, NOT to the LINE OA customer.

## Inputs

- `caseId`: the affected case.
- `failureStage`: one of `itinerary_parse`, `quote_parse`, `admin_fill`, `save`, `validation`, `notion_write`, `ocr_extract`.
- `rawInput`: the original pasted text or message content that triggered the automation.
- `parserOutput` (optional): the JSON from the parser dry-run.
- `validationReport` (optional): the full validation report object.
- `errorMessages`: array of error strings from the failed step.
- `screenshots` (optional): file paths or asset references from a driver run.
- `stepLog` (optional): ordered list of automation steps attempted.
- `sourceChannel`: `line_partner_group` / `discord_private` / `internal_worker`.
- `actor`: who triggered the automation.
- `executionPath`: `line_api_llm` / `discord_cc` / `backend_worker_llm` / `deterministic`.

## Output Format

```text
[報價自動化失敗]
#{caseId}｜{customerDisplayName or "未知"}

失敗階段：
{failureStage}

錯誤摘要：
- {error 1}
- {error 2}
…

已取得：
- parser JSON：{存在 | 不存在}
- 後台錯誤訊息：{存在 | 不存在}
- 截圖 / step log：{存在 N 張 | 不存在}
- 原始 LINE 貼文：{有 | 無}

觸發條件：
- 來源：{sourceChannel}
- 執行路徑：{executionPath}
- 操作者：{actor}
- 觸發時間：{ISO timestamp}

建議（操作層面）：
- {human action suggestion 1}
- {human action suggestion 2}
…

開發修復建議（CC/Codex 車道）：
- {parser/code issue description if identifiable}
- 重現步驟：1. {step} 2. {step} …
```

## Escalation Rules

- If the bug is in the Sanity write step and an incomplete quote document was already created → flag this FIRST; the team must manually delete or fix the partial document before a retry.
- If driver screenshots show an unexpected UI state (login screen, 404, unexpected modal) → include the screenshot reference and flag as `infrastructure` issue, not a parser issue.
- If the same failure repeats on 3+ consecutive cases → escalate the pattern to Eric via DC as a systemic bug, not individual bug packets.
- If the raw input contains customer personal data → redact it before including it in the bug packet that will be viewed in developer context.

## Must NOT

- NEVER post a bug packet to the LINE partner group automatically. Bug packets go to the DC/CC development lane only.
- NEVER attempt to retry the failed automation automatically. Retries require explicit instruction.
- NEVER modify parser logic, Sanity schema, or quote calculation code from within this skill. That is the DC/CC Codex development lane.
- NEVER auto-reply to the LINE OA customer about quote creation failures.
- NEVER hide or soft-pedal errors. Full error messages must appear in the bug packet.
- NEVER write API keys or tokens into any repo file.
