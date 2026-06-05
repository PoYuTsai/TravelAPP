# Discord AI Room Smoke Report

Date: 2026-06-05

## Scope

Local Discord private AI Engineering Room bridge MVP for TravelAPP focus.

Implemented locally:

- Project mapping for TravelAPP and VibeSync.
- `rc-*` write policy and `dc-*` legacy read-only warnings.
- tmux adapter, session inventory, health checks, locks, lifecycle dry-runs.
- Discord router, executor, bot wiring, ambient chat replies, bounded dev loop, `/mode`.
- Official Discord slash command definitions, interaction handling, and guild registration on bot ready.
- Optional Codex / Claude Code / Room webhook delivery so each agent can speak with its own Discord name and icon.
- Confirmed `@cc ... --confirm` dispatch to the active `rc-*` tmux session with lock, health, and rc-only policy checks.
- Confirmed `/round confirm` from Discord sends `/round` to the active `rc-*` session, captures output, writes a round file, and updates current state.
- Confirmed `/clear confirm` from Discord sends `/clear` to the active `rc-*` session only after a recent round exists or `force` is used.
- Confirmed `/interrupt confirm` from Discord sends `C-c` to the active `rc-*` session with lock and state tracking.
- Local `.env.local` loading for `ai-room:bot`, without overriding shell environment values.
- `ai-room:doctor` preflight check for Discord env, active focus health, and tmux warnings.
- `ai-room -- invite` helper for building the Discord bot invite URL from `AI_ROOM_DISCORD_CLIENT_ID`.
- Short context-harness pointers in `AGENTS.md`, `CLAUDE.md`, and `docs/ai-harness/context-management.md`.
- Discord bot login, guild slash-command registration, and private-channel round trip.
- Separate webhook identities for `AI Room`, `Codex`, and `Claude Code`.
- Local chat modes through `/chat-mode casual|balanced|work`.
- Slash-command aliases `/codex` and `/cc` for reliable routing when webhook identities cannot be selected from the Discord mention picker.
- Discord `/chat-clear` with private-channel permission scoping and ephemeral cleanup reports.

Still guarded or not enabled:

- Long autonomous Claude Code work still warns while desktop Claude Code bind is not confirmed.
- `dc-*` writes remain blocked unless Eric explicitly unlocks them.
- Optional live AI replies are off by default; ambient chat uses local templates unless `AI_ROOM_LIVE_AI_ENABLED=true`.

## Verification

```powershell
npx.cmd vitest run --config tools/ai-room/vitest.config.ts
npm.cmd run ai-room -- sessions
npm.cmd run ai-room -- health
node --check tools/ai-room/discord-bot.mjs
npm.cmd run ai-room:doctor
```

Latest observed test result:

- 23 test files passed.
- 129 tests passed.

Latest observed session inventory:

- `rc-travel`: present, TravelAPP active, private-room writable.
- `dc-travel`: present, TravelAPP legacy, read-only warning.
- `rc-vibesync`: may be missing when TravelAPP is the active focus.
- `dc-vibesync`: present, VibeSync legacy/partner, read-only warning.

Latest observed health:

- `tmux_only`.
- `rc-travel` is present for TravelAPP.
- Desktop Claude Code bind is not confirmed.
- `dc-travel` and `dc-vibesync` warnings are active.

Latest observed doctor:

- `ready`.
- Focus is `travel -> rc-travel`.
- Health is `tmux_only`.
- Desktop Claude Code bind is not confirmed.
- `dc-travel` and `dc-vibesync` warnings are active.
- No secrets were printed.

## Agent Identity

Use Discord webhooks for the two visible AI engineer identities:

- `AI_ROOM_CODEX_WEBHOOK_URL`
- `AI_ROOM_CC_WEBHOOK_URL`
- `AI_ROOM_ROOM_WEBHOOK_URL`
- `AI_ROOM_CODEX_AVATAR_URL`
- `AI_ROOM_CC_AVATAR_URL`
- `AI_ROOM_ROOM_AVATAR_URL`

Avatar rule:

- Codex uses the official OpenAI / Codex visual identity source.
- Claude Code uses the official Anthropic / Claude visual identity source.
- Do not generate, remix, recolor, or commit logo files into this repo.
- Prefer a webhook avatar uploaded from an official source, or a stable official-source URL if available.
- OpenAI brand source: https://openai.com/brand/
- Claude / Anthropic official source: https://www.anthropic.com/product

Webhook identities are not Discord members. They will not appear in Discord's
mention picker. Use `/codex` and `/cc` for reliable command routing; plain-text
`@codex` and `@cc` remain supported as local aliases.

## Local Chat Mode

Current local mode can be changed with:

```text
/chat-mode casual
/chat-mode balanced
/chat-mode work
```

Observed default after setup:

- `casual` for untagged greetings, small talk, moods, and event sharing.
- Tagged or slash-command work requests still route through the engineering roles.
- No tmux write happens unless Eric uses an explicit confirmed command such as `/cc ... --confirm`, `@cc ... --confirm`, `/round confirm`, `/clear confirm`, or `/interrupt confirm`.

## Confirmed CC Dispatch

Default `@cc` behavior remains safe:

- `@cc implement the plan` creates a dry-run dev loop and does not write tmux.
- `@cc implement the plan --confirm` sends a guarded prompt to the active `rc-*` session.

Dispatch checks before writing:

- current focus active session only
- `rc-*` write policy
- live tmux session exists
- cwd health check has no blocker
- short lock is acquired and released

Dispatch prompt reminds Claude Code:

- stay in the active focus
- do not commit, push, deploy, edit secrets, write `dc-*`, or send external messages unless Eric explicitly authorizes it

## Remote Round

Default `/round` behavior remains safe:

- `/round` previews the action plan only.
- `/round confirm` sends `/round` to the active `rc-*` tmux session.

Confirmed round result:

- captures the active pane
- writes `tmp/ai-room/rounds/YYYY-MM-DD-HHMMSS-<focus>.md`
- updates `current-state.json`
- returns the round file path to Discord

## Remote Clear

Default `/clear` behavior remains safe:

- `/clear` previews the action plan only.
- `/clear confirm` sends `/clear` to the active `rc-*` tmux session.
- `/clear force confirm` bypasses the recent-round requirement.

Confirmed clear result:

- requires a recent `lastRoundPath` unless forced
- acquires and releases the active-session lock
- captures the active pane after clear
- writes `contextClearedAt` into `current-state.json`
- returns the cleared timestamp to Discord

## Remote Interrupt

Default `/interrupt` behavior remains safe:

- `/interrupt` blocks and asks for Eric confirmation.
- `/interrupt confirm` sends `C-c` to the active `rc-*` tmux session.

Confirmed interrupt result:

- acquires and releases the active-session lock
- sends the tmux interrupt signal
- captures the active pane after interrupt
- writes `interruptedAt` into `current-state.json`
- returns the interrupted timestamp to Discord

## Next Steps

1. Create a new private Discord channel and bot application.
2. Put `AI_ROOM_DISCORD_CLIENT_ID` in `.env.local`, then run `npm.cmd run ai-room -- invite`.
3. Put `AI_ROOM_DISCORD_TOKEN`, `AI_ROOM_DISCORD_GUILD_ID`, and `AI_ROOM_PRIVATE_CHANNEL_ID` in `.env.local` or the local shell environment.
4. Start the bot with `npm.cmd run ai-room:bot`.
5. In the private channel, test registered slash commands `/sessions`, `/health`, `/mode`, ordinary chatter, `@codex`, and `@cc`.
6. Confirm desktop Claude Code bind before allowing long autonomous work.
