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
- Discord is for remote intake only. Keep DC prompts short and avoid pasting full diffs, logs, or plans unless explicitly needed.

## Context Budget Rules

- Do not auto-read long docs, full diffs, terminal logs, or history files.
- Prefer file paths plus short summaries. Read exact files only when the task requires them.
- Use `/round` for concise status handoff: goal, changed files, verification, blocker, next action.
- If startup context is already yellow before work begins, first check `CLAUDE.md`, active `.claude/skills`, opened IDE files, and enabled plugins.
- Run `powershell -ExecutionPolicy Bypass -File scripts/context-harness-audit.ps1` when auditing context bloat.

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
