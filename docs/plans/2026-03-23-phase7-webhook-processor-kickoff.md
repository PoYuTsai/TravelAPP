# 2026-03-23 Phase 7 Webhook Processor Kickoff

## Summary

This slice adds a production-oriented trigger path between the fast-ack LINE webhook and the durable processor route.

## What Changed

### Best-Effort Internal Kickoff

- Added `src/lib/line-assistant/process/kickoff-processor.ts`
- The helper posts to `/api/line-webhook/process` with the cron secret after new LINE events are accepted
- The kickoff is intentionally best-effort:
  - webhook ingestion still returns `200`
  - accepted events remain durable in the inbound event store
  - a failed kickoff is logged instead of breaking the LINE webhook response

### Webhook Wiring

- Updated `src/app/api/line-webhook/route.ts`
- After `ingestLineEvents()` accepts new records, the webhook now tries to wake the shared processor
- If the kickoff returns a non-2xx response or throws, the webhook logs the failure and still returns success to LINE

## Tests Added / Updated

- Added `src/lib/line-assistant/__tests__/kickoff-processor.test.ts`
- Updated `src/app/api/line-webhook/__tests__/route.test.ts`

## Verification

- `npm run test:run` -> passed (`96/96`)
- `npm run lint` -> passed
- `npm run build` -> passed

## Remaining Gaps

1. This is still a best-effort trigger, not a queue-backed worker.
2. A periodic cron hit to `/api/line-webhook/process` should still be configured as the fallback sweeper.
3. Draft generation is still stub text and remains the next major implementation gap.

## Commit

- Feature commit: `542fd58` `feat: kick off line webhook processing after ingest`
- Docs commit: `2d65351` `docs: record webhook processor kickoff progress`
