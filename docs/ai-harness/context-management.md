# AI Context Harness

Last updated: 2026-06-03

## Goal

Keep Claude Code and Codex useful across TravelAPP, VibeSync, and remote-control workflows without starting every session in the yellow context zone.

## Principle

Always-on context should answer only: what project is this, what must never be violated, and where to read more. Everything else is on-demand.

## Layers

### 1. Always-On

Loaded at startup. Keep this small.

- `CLAUDE.md`
- `AGENTS.md`
- Active `.claude/skills/*/SKILL.md` metadata
- Enabled plugin command/skill metadata

Budget target: opening a new Claude Code session should stay below 25% context before real work begins.

### 2. On-Demand

Read only when the task calls for it.

- `docs/prompts/seo-article-prompt.md`
- `docs/plans/*.md`
- Chiangway-specific `.claude/skills/*`
- Exact source files near the requested change

Use paths plus short summaries first. Avoid pasting full files into chat unless the file itself is the task.

### 3. Archive

Useful for history, not for startup.

- Old handoff docs
- Long review logs
- Large implementation plans
- Full terminal output
- Full git diffs

When needed, summarize the archive first, then read only specific sections.

## Two-AI Workflow

- Claude Code owns implementation: inspect, edit, test, report.
- Codex owns architecture and review: plan review, diff review, harness maintenance.
- RC / Claude Code app + tmux is the primary operator channel. Both views share the same Claude Code session; tmux is the source of truth.
- Discord/DC is optional legacy intake only: short task ticket, not full context dump.
- Use tmux for `/clear`, interrupts, restarts, long-running commands, tests, commits, and pushes. The app UI can keep spinning after `/clear`; stop the app-side run manually and continue from tmux state.

## Operating Boundaries

- Eric sends requests through RC / Claude Code app or tmux.
- The shared CC/tmux session is the main operator: it reads files, edits code, runs tests, commits, pushes, and calls backend routes.
- The LINE bot is an execution channel, not the autonomous decision-maker. It can post to LINE only after CC/tmux routes an explicit action.
- LINE OA customer auto-reply remains disabled by default.
- Partner-group posting requires explicit send intent; private thinking or draft work must not leak to LINE.
- Formal quote creation and real `/quote/[slug]` writes remain blocked until Eric approves a server-side Sanity write token.
- Current quote flow is dry-run only: `DRAFT-<caseId>` slug and `isOfficial:false`.

Recommended remote-control ticket:

```md
Task:
Repo:
Branch:
Goal:
Current state:
Likely files:
Must not touch:
Verification:
Need from other AI:
```

## Round Protocol

`/round` should stay concise. Run it before `/clear`, before switching from app to tmux, or before handing work from Claude Code to Codex.

Include:

- Goal
- Current state
- Changed files
- Verification result
- Blocker, if any
- Next action

Avoid:

- Full diffs
- Full logs
- Full plans
- More than one screen of prose

## Skill Policy

Keep active project skills narrow and project-specific. Generic process skills are useful, but they are easy to over-trigger and should not live in every project by default.

Active in TravelAPP:

- `chiangway-itinerary-review`
- `chiangway-line-case-triage`
- `chiangway-notion-fill`
- `chiangway-ocr-extract`
- `chiangway-quote-automation-debug`
- `chiangway-quote-review`
- `chiangway-release-review`
- `chiangway-web-research`

Quarantined locally:

- Broad process skills such as TDD, brainstorming, UI/UX mega-reference, and generic planning/review skills.

Restore a quarantined skill only when it is clearly needed for this project and its trigger description is narrow enough.

## Audit

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/context-harness-audit.ps1
```

Review:

- Root context file sizes
- Active skill count and metadata size
- Broad skill trigger warnings
- Slash commands that auto-inject files with `@` or shell output with `!`
- Enabled plugins

## Rollout

1. Stabilize TravelAPP.
2. Open a fresh Claude Code window and check startup context.
3. If baseline is acceptable, apply the same pattern to VibeSync.
4. Do not change both projects in the same pass unless the TravelAPP result is verified.
