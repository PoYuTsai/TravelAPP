# 2026-03-23 Phase 7 Image Delivery Flow

## Summary

This slice implements the first end-to-end Phase 7.2 media path: Telegram receives a photo, Chiangway operators can choose a recipient from Telegram, and the system delivers that image to the customer through LINE via a public proxy route.

## What Changed

### Telegram Media Storage

- Added `src/lib/line-assistant/storage/telegram-media-store.ts`
- Runtime now exposes a shared `telegramMediaStore` in both memory and KV modes
- Photo payload metadata is now stored server-side before any LINE send happens

### Telegram Photo Intake

- Updated `src/app/api/telegram-callback/route.ts`
- Route now accepts Telegram `message.photo` payloads in addition to `callback_query`
- On photo receipt, the system:
  - validates a maximum photo size
  - deduplicates the Telegram message with idempotency storage
  - stores the chosen Telegram file id as media metadata
  - finds recent active conversations
  - sends a Telegram inline-button prompt asking who should receive the image

### LINE Image Delivery

- Updated `src/lib/line-assistant/line/send-message.ts`
- LINE sender now supports image push messages in addition to text messages
- Updated `src/lib/line-assistant/actions/handle-telegram-action.ts`
- New `send_image` action path now:
  - resolves a stored media token
  - builds a public Chiangway media URL
  - sends a LINE image push
  - writes audit log entries
  - appends an `image` message into the conversation history

### Public Media Proxy Route

- Added `src/app/api/line-media/[token]/route.ts`
- LINE can fetch image content through this route instead of using Telegram bot-token URLs directly
- Route resolves the stored Telegram file id, fetches the real Telegram file path server-side, and streams the image back to LINE

## Tests Added / Updated

- Added `src/app/api/line-media/[token]/__tests__/route.test.ts`
- Updated `src/lib/line-assistant/__tests__/handle-telegram-action.test.ts`
- Updated `src/app/api/telegram-callback/__tests__/route.test.ts`

## Verification

- `npm run test:run` -> passed (`110/110`)
- `npm run lint` -> passed
- `npm run build` -> passed

## Setup Stage

After this slice, the next meaningful step is no longer pure local coding. The next stage needs real deployment configuration so staging smoke tests can verify:

1. Telegram webhook receives `callback_query` and `message.photo` payloads.
2. LINE can fetch `https://<site>/api/line-media/<token>` from the deployed environment.
3. Actual customer accounts receive the pushed image.

## Remaining Gaps

1. No common photo library yet.
2. No real operator editing UI for `edit_then_send`.
3. Live staging validation is still required for Telegram photo webhook delivery and LINE image fetches.

## Commit

- Feature commit: `e3de295` (`feat: add phase 7 image delivery flow`)
- Docs commit: pending
