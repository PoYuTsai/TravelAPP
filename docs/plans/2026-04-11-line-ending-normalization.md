# Repository Line-Ending Normalization

- **Completed:** 2026-04-11
- **Goal:** stop Windows Git, WSL, and other tooling from reporting line-ending-only diffs against the same working tree.
- **Code commit:** `31892fd` `chore: enforce repository line endings`

## Root Cause

- The repository did not define a shared line-ending policy in `.gitattributes`.
- This machine uses Git for Windows with `core.autocrlf=true`, while other tools can inspect the same files with different newline expectations.
- A few tracked files had drifted to mixed or Windows-style working-tree endings, so one environment looked clean while another reported many modified files.

## Changes

- added repo-level line-ending rules in:
  - `.gitattributes`
- normalized tracked text files to the repo policy:
  - `.claude/skills/ui-ux-pro-max/SKILL.md`
  - `.claude/skills/ui-ux-pro-max/data/*.csv`
  - `.claude/skills/ui-ux-pro-max/scripts/search.py`
  - `.claude/skills/writing-skills/graphviz-conventions.dot`
  - `src/app/page.tsx`
  - `src/components/sections/Hero.tsx`

## Verification

- `git diff --cached --check`
- sampled staged diffs to confirm they were newline-only:
  - `git diff --cached -- src/app/page.tsx`
  - `git diff --cached -- .claude/skills/ui-ux-pro-max/SKILL.md`
- `npm.cmd run build`

## Expected Result

- Future `git status` output should stay consistent across Windows Git, WSL, Claude, and Codex for this repository.
- If another tool still shows stale line-ending diffs, reopening that session or refreshing its checkout/index should usually clear it now that the repo policy is explicit.
