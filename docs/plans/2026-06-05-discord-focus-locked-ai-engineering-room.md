# Discord Focus-Locked AI Engineering Room Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Eric's private Discord AI engineering room where `@cc` and `@codex` share one project focus, write only to the active `rc-*` tmux session, coordinate implementation and review, and avoid collisions with existing `dc-*` project channels.

**Architecture:** Run a local Node worker on Eric's machine as the Discord bridge. The worker stores a small focus state, maps each project to one writable `rc-*` session and one read-only legacy `dc-*` session, sends approved prompts into tmux, captures output back to Discord, and manages Claude Code lifecycle commands such as `/round`, `/clear`, and `/rebind`. Discord is the remote command room; tmux remains the source of truth for Claude Code execution.

**Tech Stack:** Node.js ESM scripts, Discord bot API, WSL/tmux command adapter, local JSON/NDJSON state under `tmp/ai-room`, Vitest unit tests, optional Next.js route reuse only after the local bridge is stable.

---

## Final Product Decisions

- Platform is Discord only. Do not add LINE or Telegram variants to this implementation.
- The new Discord channel is Eric's private AI Engineering Room.
- The room has two agent identities:
  - `@codex`: requirements, scope, architecture, review, edge cases, tests, verification judgment.
  - `@cc`: implementation runner through the active `rc-*` tmux session.
- The whole room has one shared project focus at a time.
- Project switching changes both agents together.
- Private room writes only to `rc-*` sessions by default.
- Existing `dc-*` sessions belong to legacy project channels, partner collaboration, or monitoring.
- Writing to any `dc-*` session requires an explicit unlock, warning, and Eric confirmation.

## Project Mapping

```text
TravelAPP
- private active session: rc-travel
- legacy/reserved session: dc-travel
- workspace: C:/Users/eric1/OneDrive/Desktop/TravelAPP

VibeSync
- private active session: rc-vibesync
- legacy/partner session: dc-vibesync
- workspace: C:/Users/eric1/OneDrive/Desktop/VibeSync
```

`dc-vibesync` is especially sensitive because the existing VibeSync Discord channel may monitor or control it for partner requests and bug fixes. The private room must warn before any attempted write to `dc-vibesync`.

## Operating Modes

```text
supervised
- default for risky operations
- large steps are reported
- commit and push wait for Eric

autopilot_dev
- default development mode
- same-focus rc-only edit/test/review/fix can continue autonomously
- hard gates stop and ask Eric
- no automatic commit or push

autopilot_ship
- review and verification can lead to commit/push
- requires Eric's explicit mode change or task-level authorization
- still cannot deploy, write secrets, write dc-*, or send external messages
```

Recommended default:

```text
mode = autopilot_dev
shipMode = manual
```

## Hard Gates

Always stop and ask Eric before:

- switching focus between TravelAPP and VibeSync
- writing to any `dc-*` session
- cross-project reads that become writes
- commit or push, unless task-level authorization says `review OK then commit+push`
- deploy or production change
- editing secrets, `.env*`, tokens, or credentials
- deleting many files, `git reset --hard`, force push, or destructive git commands
- writing real Sanity, Notion, customer, LINE OA, partner-channel, or external-channel data
- killing/relaunching/rebinding a Claude Code session
- continuing after repeated unexplained test failures

## Shared State

Runtime state must stay short. Do not put this into `AGENTS.md`, `CLAUDE.md`, or long chat history.

```text
tmp/ai-room/current-state.json
tmp/ai-room/rounds/YYYY-MM-DD-HHMMSS-<project>.md
tmp/ai-room/events.ndjson
tmp/ai-room/locks.json
```

Example `current-state.json`:

```json
{
  "focus": "travel",
  "project": "TravelAPP",
  "workspace": "C:/Users/eric1/OneDrive/Desktop/TravelAPP",
  "activeSession": "rc-travel",
  "legacySession": "dc-travel",
  "mode": "autopilot_dev",
  "shipMode": "manual",
  "sessionHealth": "healthy",
  "currentGoal": "LINE agent MVP review loop",
  "lastRoundPath": "tmp/ai-room/rounds/2026-06-05-1315-travel.md",
  "lastActor": "cc",
  "nextAction": "codex review diff",
  "blockers": []
}
```

If state and reality disagree, reality wins:

- `tmux list-sessions`
- `pwd`
- `git status --short --branch`
- latest Claude Code output
- current workspace path

## Discord Commands

Support both mentions and slash commands.

Slash commands:

```text
/sessions
/focus travel
/focus vibesync
/focus status
/health
/chat-mode casual
/chat-mode balanced
/chat-mode work
/codex <prompt>
/cc <prompt>
/round
/clear
/clear force
/chat-clear count:100
/interrupt
/rebind
/mode supervised
/mode autopilot_dev
/mode autopilot_ship
```

Natural-language examples:

```text
@codex help me scope this feature and hand the plan to @cc
@cc implement the plan, then ask @codex to review
@cc finish the stage autonomously unless there is a hard gate
@codex review current diff and tell @cc what to fix
```

`Codex` and `Claude Code` may be visible through Discord webhooks instead of
real Discord member accounts. In that setup, the user cannot pick them from the
Discord mention UI. Treat `/codex` and `/cc` as first-class routing commands;
plain text `@codex` and `@cc` remain local aliases.

The router should reduce natural language to a small set of intents:

```text
plan
implement
review
fix
verify
round
clear
focus_switch
health_check
rebind
ship
```

## Claude Code / tmux Lifecycle

The active `rc-*` session can be:

```text
healthy
- tmux exists
- cwd and project match focus
- recent output looks like an active Claude Code session
- desktop Claude Code bind has been confirmed

tmux_only
- tmux exists and may be usable
- desktop app bind is unknown
- long autonomous tasks should warn first

context_hot
- session is usable, but should run /round then /clear soon

needs_rebind
- session is stale, app update/relaunch likely broke binding, or URL/bind confirmation is missing

manual_repair
- rebind retry failed and Eric must fix from the desktop
```

Guarded `/round`:

1. Send `/round` to the active `rc-*` session.
2. Capture output.
3. Post summary to Discord.
4. Write `tmp/ai-room/rounds/*.md`.
5. Update `current-state.json`.

Guarded `/clear`:

1. Check whether a recent round exists.
2. If not, run `/round` first unless Eric used `/clear force`.
3. Send `/clear` to the active `rc-*` session.
4. Capture the new prompt/state.
5. Mark `context_cleared_at`.

Discord `/chat-clear`:

1. Treat `/chat-clear` as Discord channel cleanup, not Claude Code context cleanup.
2. Allow it only inside `AI_ROOM_PRIVATE_CHANNEL_ID`.
3. Delete recent unpinned messages from the same channel; do not clone, rotate, or recreate the channel.
4. Use bulk delete for 2-100 recent messages within Discord's 14-day bulk-delete window.
5. Use single-message delete when only one recent message is eligible.
6. Skip pinned messages and messages older than the bulk-delete window.
7. Require confirmation when `count` is greater than 100.
8. Reply ephemerally and append a short `chat_clear` event to `tmp/ai-room/events.ndjson`.

Guarded `/rebind`:

1. Acquire exclusive lock on the active `rc-*` session.
2. Run `/round` if the session can still respond.
3. Ask Eric for confirmation.
4. Kill the stale tmux session.
5. Create a new tmux session with the same name and focus workspace.
6. Start Claude Code.
7. Wait for Eric to confirm the desktop app bind/session URL.
8. Retry once if the first bind fails.
9. Mark `healthy` or `manual_repair`.
10. Release lock.

## MVP Tasks

### Task 0: Protect Worktree And Current Sessions

**Files:**

- No source changes.

**Steps:**

1. Run `git status --short --branch`.
2. Run `wsl tmux list-sessions`.
3. Confirm current sessions include the expected active project sessions.
4. Confirm no unrelated files are staged.

**Verification:**

```powershell
git status --short --branch
wsl tmux list-sessions
```

Expected:

- branch is known
- staged diff is empty before implementation
- `rc-travel` and `dc-travel` exist for TravelAPP once the room plan is being implemented
- `rc-vibesync` may need to be created or detected before VibeSync focus is enabled

### Task 1: Add Local AI Room State And Project Mapping

**Files:**

- Create: `tools/ai-room/projects.mjs`
- Create: `tools/ai-room/state-store.mjs`
- Create: `tools/ai-room/events.mjs`
- Create: `tools/ai-room/vitest.config.ts`
- Create: `tools/ai-room/__tests__/projects.test.mjs`
- Create: `tools/ai-room/__tests__/state-store.test.mjs`

**Steps:**

1. Write failing tests for project mapping:
   - `travel` maps to `rc-travel` and `dc-travel`.
   - `vibesync` maps to `rc-vibesync` and `dc-vibesync`.
   - both projects mark `rc-*` as private-room writable.
   - both projects mark `dc-*` as private-room read-only.
   - `dc-vibesync` has a collision warning.
2. Add `projects.mjs` with a frozen `PROJECTS` object.
3. Write failing tests for state initialization and focus switching.
4. Add `state-store.mjs` that reads/writes `tmp/ai-room/current-state.json`.
5. Add `events.mjs` that appends NDJSON records.
6. Run targeted tests.

**Verification:**

```powershell
npx vitest run --config tools/ai-room/vitest.config.ts
```

Expected: all ai-room unit tests pass.

### Task 2: Add tmux Adapter And Session Inventory

**Files:**

- Create: `tools/ai-room/tmux-adapter.mjs`
- Create: `tools/ai-room/session-inventory.mjs`
- Create: `tools/ai-room/__tests__/tmux-adapter.test.mjs`
- Create: `tools/ai-room/__tests__/session-inventory.test.mjs`

**Steps:**

1. Test command composition for Windows mode:
   - default tmux command is `wsl tmux`.
   - no shell string concatenation for user text.
   - session names are allowlisted from `PROJECTS`.
2. Test native mode:
   - optional `AI_ROOM_TMUX_MODE=native` uses `tmux`.
3. Implement `listSessions`, `capturePane`, `sendKeys`, `interrupt`, `newSession`, and `killSession`.
4. Implement inventory that labels sessions as `active`, `legacy`, `unknown`, or `missing`.
5. Run tests.

**Verification:**

```powershell
npx vitest run --config tools/ai-room/vitest.config.ts
wsl tmux list-sessions
```

Expected: tests pass and live session inventory can be printed by a dry-run script.

### Task 3: Add Locking And Write Policy

**Files:**

- Create: `tools/ai-room/locks.mjs`
- Create: `tools/ai-room/policy.mjs`
- Create: `tools/ai-room/__tests__/locks.test.mjs`
- Create: `tools/ai-room/__tests__/policy.test.mjs`

**Steps:**

1. Test that reads do not require locks.
2. Test that writes to active `rc-*` require a write lock.
3. Test that writes to `dc-*` are denied by default.
4. Test that `dc-vibesync` denial includes the legacy partner-channel warning.
5. Test exclusive locks for `/rebind`.
6. Implement lock acquisition with expiry.
7. Implement hard-gate policy functions.

**Verification:**

```powershell
npx vitest run --config tools/ai-room/vitest.config.ts
```

Expected: policy tests prove private-room writes are rc-only.

### Task 4: Add Focus, Sessions, And Health CLI

**Files:**

- Create: `tools/ai-room/cli.mjs`
- Create: `tools/ai-room/health.mjs`
- Modify: `package.json`
- Create: `tools/ai-room/__tests__/health.test.mjs`

**Steps:**

1. Add npm script:

```json
{
  "scripts": {
    "ai-room": "node tools/ai-room/cli.mjs"
  }
}
```

2. Implement `npm run ai-room -- sessions`.
3. Implement `npm run ai-room -- focus travel`.
4. Implement `npm run ai-room -- focus vibesync`.
5. Implement `npm run ai-room -- health`.
6. Health should detect:
   - missing active session
   - cwd mismatch
   - legacy session warning
   - tmux-only state when desktop bind is not confirmed
7. Run CLI commands manually.

**Verification:**

```powershell
npm run ai-room -- sessions
npm run ai-room -- focus travel
npm run ai-room -- health
npx vitest run --config tools/ai-room/vitest.config.ts
```

Expected: commands print concise Traditional Chinese or mixed Chinese/English status suitable for Discord.

### Task 5: Add Round, Clear, Interrupt, And Rebind Skeleton

**Files:**

- Create: `tools/ai-room/lifecycle.mjs`
- Create: `tools/ai-room/round-writer.mjs`
- Create: `tools/ai-room/__tests__/lifecycle.test.mjs`
- Create: `tools/ai-room/__tests__/round-writer.test.mjs`

**Steps:**

1. Test `/round` sends only to the active `rc-*` session.
2. Test `/round` writes `tmp/ai-room/rounds/*.md`.
3. Test `/clear` requires a recent round unless `force` is present.
4. Test `/interrupt` requires explicit confirmation.
5. Test `/rebind` returns a confirmation plan before killing anything.
6. Implement lifecycle functions using the tmux adapter seam.
7. Do not implement automatic kill/new until confirmation buttons exist.

**Verification:**

```powershell
npx vitest run --config tools/ai-room/vitest.config.ts
npm run ai-room -- round --dry-run
npm run ai-room -- clear --dry-run
```

Expected: dry-run prints the exact action plan and target session.

### Task 6: Add Discord Bot MVP

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tools/ai-room/discord-bot.mjs`
- Create: `tools/ai-room/discord-channel-cleaner.mjs`
- Create: `tools/ai-room/discord-router.mjs`
- Create: `tools/ai-room/discord-format.mjs`
- Create: `tools/ai-room/__tests__/discord-router.test.mjs`

**Steps:**

1. Add Discord dependency only after CLI and policy tests pass.
2. Add env vars to `.env.example`:

```env
AI_ROOM_DISCORD_TOKEN=
AI_ROOM_DISCORD_GUILD_ID=
AI_ROOM_PRIVATE_CHANNEL_ID=
AI_ROOM_TMUX_MODE=wsl
AI_ROOM_STATE_DIR=tmp/ai-room
```

3. Implement channel allowlist:
   - only `AI_ROOM_PRIVATE_CHANNEL_ID` can issue private-room write commands.
   - legacy project channels can be listed later, but cannot write through this bot.
4. Implement `/sessions`, `/focus`, `/health`, `/round`.
5. Implement `/chat-clear count:N` as Discord channel cleanup, separate from tmux `/clear`.
6. Implement mention routing for `@cc` and `@codex`.
7. Labels must show source clearly:

```text
[CC/rc-travel]
[Codex/review]
[Room/focus]
```

8. Keep Discord output short. Link to round files or summarize, do not paste full logs.

**Verification:**

```powershell
npx vitest run --config tools/ai-room/vitest.config.ts
npm run ai-room -- health
node tools/ai-room/discord-bot.mjs
```

Expected: bot connects only with env vars present and refuses commands from non-private channels.

### Task 7: Add Autonomous Dev Loop

**Files:**

- Create: `tools/ai-room/dev-loop.mjs`
- Create: `tools/ai-room/intent-router.mjs`
- Create: `tools/ai-room/__tests__/dev-loop.test.mjs`
- Create: `tools/ai-room/__tests__/intent-router.test.mjs`

**Steps:**

1. Test natural-language intent reduction.
2. Test `@cc implement then @codex review` creates a staged loop:
   - plan/implementation prompt to `@cc`
   - `/round`
   - review prompt to `@codex`
   - optional fix prompt back to `@cc`
3. Test hard gates stop the loop.
4. Test commit/push does not happen unless mode or task grants it.
5. Implement the loop as a state machine, not as open-ended bot-to-bot recursion.
6. Cap discussion rounds, for example `maxAgentTurns = 3` unless Eric extends it.

**Verification:**

```powershell
npx vitest run --config tools/ai-room/vitest.config.ts
```

Expected: no infinite agent loop is possible in tests.

### Task 8: Documentation And Context Harness Update

**Files:**

- Modify: `docs/ai-harness/context-management.md`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Create: `docs/plans/2026-06-05-discord-ai-room-smoke-report.md`

**Steps:**

1. Keep root context files short.
2. Add only a concise pointer:

```text
Discord private AI Engineering Room: focus-locked, rc-only writes, dc-* legacy read-only by default. Detailed design: docs/plans/2026-06-05-discord-focus-locked-ai-engineering-room.md.
```

3. Do not paste full plan text into root files.
4. Add smoke report after CLI or Discord MVP is manually tested.
5. Run context harness audit.

**Verification:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/context-harness-audit.ps1
```

Expected: startup files remain short and the audit does not show new broad context bloat.

## Smoke Test Script

After M1-M6:

```powershell
npm run ai-room -- sessions
npm run ai-room -- focus travel
npm run ai-room -- health
npm run ai-room -- round --dry-run
```

Manual Discord smoke:

```text
/sessions
/focus travel
/health
/chat-mode casual
/cc status
/codex review current state
@cc status
@codex review current state
/chat-clear count:1
```

Expected:

- Travel focus targets `rc-travel`.
- VibeSync focus targets `rc-vibesync`.
- `dc-travel` and `dc-vibesync` are visible but read-only.
- Any write attempt to `dc-vibesync` warns about legacy partner-channel monitoring/control.
- `/round` writes a short handoff and updates current state.
- `/clear` refuses to run without a recent round unless forced by Eric.
- `/chat-clear` deletes only Discord channel messages and does not send anything to tmux.

## Execution Notes

- Prefer implementing this as a local bridge first. Do not involve Vercel until the local CLI and Discord MVP are stable.
- Do not connect this private room to LINE OA customer flows.
- Do not reuse the existing LINE agent permission layer as-is; this is a separate private-room control plane. It can borrow ideas, not source-channel names.
- Keep `tmp/ai-room` out of git except placeholder documentation if needed.
- Keep all Discord tokens and channel IDs in `.env.local` or local environment only.
- Run targeted tests after every task and commit in small slices if Eric asks for commits.

## Open Questions

- Confirm VibeSync workspace path before enabling `/focus vibesync`.
- Decide whether `@codex` in the private room is a lightweight local model/API worker, a prompt template that asks the current desktop Codex to review manually, or a future Codex CLI/session adapter.
- Decide the exact Discord bot names and avatars.
- Decide whether commit/push authorization is per task, per mode, or per project.
