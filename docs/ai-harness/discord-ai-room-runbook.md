# Discord AI Room Runbook

Purpose: bring the local focus-locked AI Engineering Room online in a new private Discord channel.

## Local Source Of Truth

- Project focus state: `tmp/ai-room/current-state.json`
- TravelAPP active write target: `rc-travel`
- TravelAPP legacy read-only target: `dc-travel`
- VibeSync active write target: `rc-vibesync`
- VibeSync legacy/partner read-only target: `dc-vibesync`

The private room writes to `rc-*` only. Any `dc-*` write remains a hard gate.

## Discord Setup

1. Create or open the Discord application for the private AI room.
2. Copy the Application ID into `.env.local` as `AI_ROOM_DISCORD_CLIENT_ID`.
3. Run:

```powershell
npm.cmd run ai-room -- invite
```

4. Open the printed invite URL and add the bot to Eric's private Discord server.
5. In the Discord Developer Portal, enable Message Content Intent for the bot.
6. Create the new private AI Engineering Room channel.
7. Copy IDs into `.env.local`:

```env
AI_ROOM_DISCORD_TOKEN=
AI_ROOM_DISCORD_GUILD_ID=
AI_ROOM_PRIVATE_CHANNEL_ID=
```

8. Optional but recommended: create Codex and Claude Code webhooks in that same channel, then set:

```env
AI_ROOM_CODEX_WEBHOOK_URL=
AI_ROOM_CC_WEBHOOK_URL=
AI_ROOM_ROOM_WEBHOOK_URL=
AI_ROOM_CODEX_AVATAR_URL=
AI_ROOM_CC_AVATAR_URL=
AI_ROOM_ROOM_AVATAR_URL=
```

Use official-source icons only. Do not commit logo files into the repo.

The bot needs `Manage Messages`, `Read Message History`, and `View Channel`
permissions in the private AI Engineering Room if `/chat-clear` will be used.

## Preflight

```powershell
npm.cmd run ai-room:doctor
npm.cmd run ai-room -- sessions
npm.cmd run ai-room -- health
```

Expected before live use:

- `doctor` reports ready, or only known identity warnings.
- Focus is `travel -> rc-travel` unless Eric intentionally switched.
- `rc-travel` is present.
- `dc-travel` and `dc-vibesync` are shown as read-only warnings.

## Channel Permissions

For normal chat and slash commands, the bot needs:

- View Channel
- Send Messages
- Read Message History

For `/chat-clear`, the bot also needs:

- Manage Messages

Grant `Manage Messages` only inside `#ai-engineering-room` if you want the cleaner to work without giving the bot broad server-level powers.

## Start The Bot

```powershell
npm.cmd run ai-room:bot
```

The bot registers slash commands on `ready` when `AI_ROOM_DISCORD_GUILD_ID` is set.

## First Channel Smoke

Run these in the private Discord channel:

```text
/sessions
/health
/mode autopilot_dev
/chat-mode casual
/codex status
/cc status
@codex status
@cc status
/round
/chat-clear count:1
```

`Codex` and `Claude Code` usually speak through Discord webhooks, so they are
not real Discord members that appear in the mention picker. Use `/codex` and
`/cc` when you want reliable slash-command routing. Plain text `@codex` and
`@cc` are still supported as local aliases.

Safe write smoke, only after Eric confirms the desktop Claude Code bind:

```text
/round confirm
```

Do not start with `@cc ... --confirm` until `/round confirm` proves the active `rc-travel` binding.

## Cleaning The Room

Use `/clear confirm` only for Claude Code / tmux context cleanup.

Use `/chat-clear count:100` for Discord channel history cleanup. It keeps the
same channel, webhooks, permissions, and channel ID. The command deletes recent
unpinned messages, skips messages older than Discord's bulk-delete window, and
replies ephemerally so the cleanup report does not add more channel noise.

Clearing more than 100 recent messages requires confirmation:

```text
/chat-clear count:300 confirm:true
```
