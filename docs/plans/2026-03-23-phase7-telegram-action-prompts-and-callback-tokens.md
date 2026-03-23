# 2026-03-23 Phase 7 Telegram Action Prompts and Callback Tokens

## Summary

This slice closes a critical operator-flow gap in Phase 7. The branch already had a Telegram callback route, but no real inline action prompts were being sent to Telegram, and raw JSON callback payloads would eventually hit Telegram's callback data length limits. The new implementation sends draft action prompts with compact callback tokens and resolves those tokens server-side before handling the action.

## What Changed

### Compact Telegram Callback Tokens

- Added `src/lib/line-assistant/storage/telegram-action-store.ts`
- New store persists compact callback tokens and the server-side `TelegramAction` payload
- Runtime now exposes `telegramActionStore` for both memory and KV modes
- KV-backed runtime stores these callback records durably via `src/lib/line-assistant/storage/kv-stores.ts`

### Telegram Inline Action Prompts

- Updated `src/lib/line-assistant/telegram/client.ts`
- Telegram client can now send inline keyboard action prompts in a topic thread
- Memory Telegram client tracks prompts in tests so we can verify button payloads without hitting the real Bot API

### Draft Prompts After Inbound Processing

- Updated `src/lib/line-assistant/process/process-inbound-event.ts`
- After generating a pending draft, the processor now:
  - stores a compact `send` action token
  - stores a compact `dismiss` action token
  - sends a Telegram action prompt with inline buttons
- This makes the existing callback route reachable from real operator UI, instead of only from synthetic tests

### Callback Token Resolution

- Updated `src/app/api/telegram-callback/route.ts`
- The route now accepts compact callback payloads like `la:<token>`
- Server resolves that token through `telegramActionStore`, hydrates the stored action payload, and then passes it into the existing action handler
- Legacy JSON callback payload parsing is still preserved as a fallback

## Tests Added / Updated

- Updated `src/lib/line-assistant/__tests__/telegram-client.test.ts`
- Updated `src/lib/line-assistant/__tests__/process-inbound-event.test.ts`
- Updated `src/app/api/telegram-callback/__tests__/route.test.ts`

## Verification

- `npm run test:run` -> passed (`107/107`)
- `npm run lint` -> passed
- `npm run build` -> passed

## Remaining Gaps

1. Draft prompts now reach Telegram, but `edit_then_send` still has no real operator editing UI.
2. The Phase 7.2 image / media workflow still needs to be built on top of the same callback-token mechanism.
3. The periodic `/api/line-webhook/process` deployment trigger and live staging smoke tests are still pending.

## Commit

- Feature commit: `cdc75df` (`feat: add telegram action prompts and callback tokens`)
- Docs commit: pending
