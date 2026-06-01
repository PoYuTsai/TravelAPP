---
name: chiangway-release-review
description: Review a LINE OA agent implementation diff before merge/deploy; verify permission boundaries, no customer auto-reply paths, parser test coverage, audit log presence, and no secrets in code.
---

## Trigger

Fire when:
- Eric or Codex asks for a release review before merging a `codex/line-oa-agent-*` branch.
- A milestone is marked complete and the engineering plan calls for a Codex review step.
- An operator DC command includes "release review" / "pre-deploy check" / "幫我看這個 PR".

## Goal

Verify that the implementation:
1. Does not create any automatic customer-reply paths.
2. Encodes all permissions in TypeScript (not only in prompts).
3. Has passing parser golden tests with fixtures from real Chiangway examples.
4. Has audit log entries for every webhook event, command, cross-post, Notion write, quote create, and OCR action.
5. Enforces the DC → LINE cross-post explicit-send requirement in code and tests.
6. Contains no secrets, tokens, or real customer data in committed files.
7. Follows the LINE Messaging API as event source only (no mark-as-read).

## Inputs

- `diffStat`: output of `git diff --stat` for the branch.
- `testOutput` (optional): output of `npm run test:run`.
- `lintOutput` (optional): output of `npm run lint`.
- `buildOutput` (optional): output of `npm run build`.
- `prDescription` (optional): PR title and body.

## Review Checklist

### Security and Permissions
- [ ] `src/lib/line-agent/permissions.ts` exists and encodes all channel permission rules as pure functions.
- [ ] No command can trigger code edits, deploys, parser-logic changes, or Sanity schema changes from LINE partner group.
- [ ] DC/tmux commands posting to LINE partner group require explicit send intent in both code and tests.
- [ ] No OA customer receives an automatic reply in any code path.
- [ ] `LINE_PARTNER_GROUP_ID` is validated against webhook `source.groupId` before processing group commands.
- [ ] Internal command endpoint is protected by `AI_AGENT_INTERNAL_SECRET`.

### Secrets and Data Safety
- [ ] No API keys, tokens, or webhook secrets appear in any committed `.ts`, `.json`, or `.md` file.
- [ ] No real customer LINE user IDs, display names, or message content appear in test fixtures (use fake anonymized data).
- [ ] No NOTION_TOKEN or Notion database IDs with real tokens appear in code (env var references only).

### Parser and Quote Integrity
- [ ] Golden itinerary and quote fixture tests exist under `src/lib/line-agent/quote/fixtures/`.
- [ ] Parser review returns severity `ok` / `needs_human_check` / `blocked`; `blocked` prevents Sanity write.
- [ ] Quote arithmetic validation errors > 500 THB result in `blocked` severity.

### Audit and Observability
- [ ] Audit log entries exist for: webhook event, operator command, LINE cross-post, Notion write, quote create, OCR action.
- [ ] Every audit entry includes actor, source channel, target, and ISO timestamp.
- [ ] Bug packets are emitted for parser failures, quote failures, and admin-driver failures.

### Architecture Boundaries
- [ ] TypeScript state machine is the source of truth for case statuses; no ad hoc string comparisons.
- [ ] Model prompts and skill playbooks are advisory; TS validation wins on conflicts.
- [ ] LINE webhook returns 200 fast; heavy work is deferred to background worker.
- [ ] `src/lib/notion/client.ts` is not modified; new Notion 2026 adapter is separate.

## Output Format

```text
[Release Review]
Branch: {branchName}
Reviewer: {claudeCodeVersion}
Date: {ISO date}

PASS / FAIL / NEEDS_FIXES

Critical issues (must fix before merge):
- {issue} [file:line]
…

Non-critical findings (should fix, non-blocking):
- {finding}
…

Security checks: {PASS | FAIL}
Secrets check: {PASS | FAIL}
Permission tests: {PASS | FAIL}
Parser fixture coverage: {PASS | FAIL | N/A}
Audit log coverage: {PASS | FAIL | N/A}

Recommendation:
{merge / fix and re-review / escalate to Eric}
```

## Escalation Rules

- If any critical security issue is found (auto-reply path, secrets in code, missing permission gates) → output `FAIL`; do not recommend merge under any circumstances.
- If tests are absent for a permission rule → output `NEEDS_FIXES`; permission rules without tests are not acceptable.
- If build fails → output `FAIL`; do not approve a broken build.
- If Notion write code is present but field-policy tests are absent → output `NEEDS_FIXES`.

## Must NOT

- NEVER approve a merge that contains an OA customer auto-reply path, even if the path appears conditional.
- NEVER approve a merge with secrets or tokens committed to any file.
- NEVER approve a merge where the DC → LINE cross-post path does not require explicit send intent in code AND tests.
- NEVER skip the security and permissions checklist even if the PR is "small" or "just a config change".
- NEVER request code edits or deploy actions from this skill; findings go back to the development lane.
- NEVER write API keys or tokens into any repo file.
