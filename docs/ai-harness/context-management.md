# AI Context Harness

Last updated: 2026-06-02

## Goal

Keep Claude Code and Codex useful across TravelAPP, VibeSync, and Discord workflows without starting every session in the yellow context zone.

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
- Discord is intake: short task ticket, not full context dump.

Recommended DC ticket:

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

`/round` should stay concise.

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
