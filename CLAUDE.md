# Chiangway Travel - Claude Code Context

Keep this file small. It is loaded into Claude Code sessions; detailed playbooks live in docs and skills.

## Project

- Brand: 清微旅行 Chiangway Travel
- Service: Chiang Mai family charter, custom travel, Mandarin guide
- Site: https://chiangway-travel.com
- Stack: Next.js 14, Sanity CMS, Tailwind CSS
- Positioning: Taiwan dad Eric + Thai mom Min, a real Chiang Mai family. Parent-friendly itineraries. Driver and guide are separate professional roles.

## AI Workflow

- Work one project at a time. Start with TravelAPP; copy proven context-harness changes to VibeSync later.
- Claude Code is the implementation runner: inspect files, edit, test, and report.
- Codex is the architecture/review partner: plan review, diff review, context-harness maintenance.
- Primary operator channel: RC / Claude Code app + tmux sharing the same session. Treat tmux as the source of truth.
- Discord/DC is optional legacy intake. Keep remote prompts short and avoid pasting full diffs, logs, or plans unless explicitly needed.
- Use tmux for control commands such as `/clear`, interrupts, restarts, long-running tests, and commits. If the app UI spins after `/clear`, stop it manually and trust tmux state.

## Context Budget Rules

- Do not auto-read long docs, full diffs, terminal logs, or history files.
- Prefer file paths plus short summaries. Read exact files only when the task requires them.
- Use `/round` before `/clear` or handoff: goal, changed files, verification, blocker, next action.
- If startup context is already yellow before work begins, first check `CLAUDE.md`, active `.claude/skills`, opened IDE files, and enabled plugins.
- Run `powershell -ExecutionPolicy Bypass -File scripts/context-harness-audit.ps1` when auditing context bloat.

## Language

- Reply to Eric in Traditional Chinese by default.
- Keep code identifiers, file paths, commands, env vars, and API names in their original form.
- Status updates, smoke reports, `/round` summaries, and handoffs should be concise Traditional Chinese unless Eric explicitly asks for English.

## Operating Boundaries

- CC/tmux is the operator. LINE bot is only a LINE execution channel that CC can call.
- LINE OA customer messages must not be auto-replied to unless Eric explicitly changes this rule.
- Posting to the partner LINE group requires explicit send intent.
- Quote creation is dry-run only until Eric approves a server-side Sanity write token.
- File edits, tests, commits, and deploys are done by CC/tmux, not by LINE bot.

## On-Demand References

- SEO article writing: read `docs/prompts/seo-article-prompt.md` first.
- SEO content strategy: `docs/plans/2026-01-15-seo-content-strategy.md`.
- Landing page design rules: `docs/plans/2026-01-13-landing-page-redesign.md`.
- Brand positioning: `docs/plans/2026-04-19-positioning-diagnosis.md`.
- Quote display: `docs/plans/2026-04-20-quote-display-page.md`.
- LINE OA / AI assistant plans: `docs/plans/2026-03-22-phase7-line-oa-ai-assistant*.md`.
- Context harness design: `docs/ai-harness/context-management.md`.

## Work Rules

- Before editing: inspect nearby code and current git status.
- Keep changes scoped. Do not touch unrelated files.
- Never commit secrets or `.env.local`.
- Verify with the smallest meaningful command, then broaden when risk is higher.
- If making commits: feature commit first, then docs update commit if required.
- If pushing after a feature commit, update relevant `docs/plans/...` and `README.md` build trigger in a follow-up docs commit.

## Content Rules

- Social post review: one core idea, clean line breaks, light CTA, fixed hashtags: `#清微旅行 #清邁親子包車 #親子自由行`.
- Avoid: "中英泰文導遊"; use "中文導遊".
- SEO articles must end with a LINE CTA.

## Links

- LINE: https://line.me/R/ti/p/@037nyuwk
- Facebook: https://www.facebook.com/profile.php?id=61569067776768
- Instagram: https://www.instagram.com/chiangway_travel
