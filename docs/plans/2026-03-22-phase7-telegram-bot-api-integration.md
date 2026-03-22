# 2026-03-22 Phase 7 Telegram Bot API Integration

## Summary

This slice upgrades the Phase 7 assistant from synthetic Telegram placeholders to real Bot API behavior for forum topics and callback acknowledgements.

## What Changed

### Real Telegram Client

- Replaced the placeholder-only Telegram client in `src/lib/line-assistant/telegram/client.ts`
- Added real Bot API methods for:
  - `createForumTopic`
  - `sendMessage` with `message_thread_id`
  - `answerCallbackQuery`
- Kept the memory client for tests, but expanded it so route and runtime tests can assert:
  - created topics
  - sent summaries
  - answered callback queries

### KV Runtime Topic Creation

- Updated `src/lib/line-assistant/runtime.ts` so KV mode now builds a real Telegram Bot client
- Updated `src/lib/line-assistant/storage/kv-stores.ts` so topic mapping can persist the real `message_thread_id`
- Added a lightweight topic creation lock in KV mode so duplicate runtime requests do not blindly create a second topic key

### Telegram Callback UX

- Updated `src/app/api/telegram-callback/route.ts`
- Successful callback actions now answer Telegram callback queries so operators do not get a stuck loading spinner after tapping inline buttons
- Acknowledgement text is now tied to the action outcome:
  - `sent`
  - `dismissed`
  - `duplicate`

## Tests Added / Updated

- Added `src/lib/line-assistant/__tests__/telegram-client.test.ts`
- Updated `src/lib/line-assistant/__tests__/kv-runtime.test.ts`
- Updated `src/app/api/telegram-callback/__tests__/route.test.ts`

## Verification

- `npm run test:run` -> passed (`92/92`)
- `npm run lint` -> passed
- `npm run build` -> passed

## Remaining Gaps

1. `/api/line-webhook/process` still needs a production trigger strategy.
2. Draft generation is still deterministic stub text and not yet Anthropic-backed.
3. KV behavior is still mocked in tests and should be smoke-tested against a real Upstash / Vercel KV environment.
4. Telegram image / media workflows are still Phase 7.2 work, not part of this slice.

## Commit

- Feature commit: `8ced3d2` `feat: integrate telegram bot api topics and callback ack`
- Docs commit: `6d2d430` `docs: record telegram bot api integration progress`
