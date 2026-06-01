# CC Handoff: LINE OA Agent Milestone 1

You are implementing the Chiangway Travel internal LINE OA AI agent MVP.

Read these files first:

1. `AGENTS.md`
2. `docs/plans/2026-06-01-line-oa-travel-agent-mvp.md`
3. `docs/plans/2026-06-01-line-oa-agent-engineering-plan.md`

## Mission

Implement Milestone 1 only:

1. Chiangway CC skills and AI knowledge skeleton
2. Agent config/types/env validation
3. Case state machine and storage interface
4. LINE webhook adapter
5. DC/internal command bridge
6. Command router and permission policy
7. Itinerary/quote parser review harness

Do not implement official quote creation, Sanity writes, browser automation, Notion writes, deployments, or customer auto-replies in this milestone.

## Non-Negotiable Constraints

- No automatic replies to LINE OA customers.
- LINE OA webhook receives future events only; do not claim it can crawl historical unread OA chats.
- Partner LINE group can ask the bot to analyze, OCR, search, parse, and create bug packets.
- Partner LINE group cannot directly edit code, deploy, change parser logic, or modify Sanity schema.
- DC/tmux is Eric's private operator plane.
- DC can post to LINE partner group only with explicit send intent.
- The bot must answer when tagged in the partner group and stay silent for casual chat.
- Use deterministic TypeScript logic for permissions, state transitions, parser validation, and quote math checks.
- Do not put API keys, LINE tokens, Notion tokens, or model keys in committed files.
- Current repo has unrelated dirty/untracked files. Do not stage or modify unrelated work.

## Recommended Branch

Create or switch to:

```bash
git checkout -b codex/line-oa-agent-mvp
```

If the branch already exists, inspect it first instead of overwriting anything.

## Existing Repo Anchors

Use existing code where possible:

- `src/lib/itinerary/parser.ts`
- `src/lib/itinerary/activity-matcher.ts`
- `src/lib/itinerary/types.ts`
- `src/sanity/tools/pricing/*`
- `src/sanity/tools/pricing/__tests__/*`
- `src/sanity/schemas/itinerary.ts`
- `src/lib/api-auth.ts`

Do not rewrite the existing itinerary parser in this milestone. Wrap it, test it, and report gaps.

## First Task Order

Follow `docs/plans/2026-06-01-line-oa-agent-engineering-plan.md` in this order:

1. Task 0: protect the worktree
2. Task 1: skills and knowledge skeleton
3. Task 2: config/types/env validation
4. Task 3: case state machine and storage interface
5. Task 4: LINE webhook adapter
6. Task 5: DC/internal command bridge
7. Task 6: command router and permission policy
8. Task 9: itinerary and quote review harness

Skip Tasks 7, 8, 10, 11, 12, and 13 unless Eric explicitly approves expanding scope.

## Test Discipline

Use TDD for each task:

1. Write the failing test.
2. Run the targeted test and confirm it fails for the expected reason.
3. Implement the minimal code.
4. Run the targeted test again.
5. Commit that task only.

Targeted commands:

```bash
npm run test:run -- src/lib/line-agent/__tests__/config.test.ts
npm run test:run -- src/lib/line-agent/__tests__/case-reducer.test.ts src/lib/line-agent/__tests__/memory-store.test.ts
npm run test:run -- src/lib/line-agent/__tests__/line-signature.test.ts src/lib/line-agent/__tests__/line-event-normalizer.test.ts
npm run test:run -- src/lib/line-agent/__tests__/operator-auth.test.ts src/lib/line-agent/__tests__/operator-command.test.ts
npm run test:run -- src/lib/line-agent/__tests__/permissions.test.ts src/lib/line-agent/__tests__/command-router.test.ts
npm run test:run -- src/lib/line-agent/__tests__/parse-review.test.ts src/lib/line-agent/__tests__/quote-validation-report.test.ts
```

Milestone verification:

```bash
npm run test:run
npm run lint
npm run build
git status --short
git diff --stat
```

If a full command fails because of unrelated existing repo issues, report the exact failure and prove targeted tests for this milestone pass.

## Expected Milestone 1 Output

At the end, provide:

- Branch name
- Commit list
- Files changed
- Test commands run and results
- Any blocked items or known parser gaps
- Any required env vars Eric must configure
- A short "Codex review checklist" for the reviewer

## Codex Review Checklist

Ask Codex to review:

- Permission policy cannot auto-reply to customers.
- DC-to-LINE posting requires explicit send intent.
- LINE partner group commands cannot trigger code/deploy/parser/schema changes.
- Case reducer does not mix multiple customers.
- Parser review harness wraps existing parser instead of rewriting it.
- Tests cover policy boundaries and messy itinerary/quote examples.
- No tokens/secrets were committed.

