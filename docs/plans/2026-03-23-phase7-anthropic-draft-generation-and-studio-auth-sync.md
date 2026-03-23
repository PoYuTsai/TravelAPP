# 2026-03-23 Phase 7 Anthropic Draft Generation and Studio Auth Sync

## Summary

This slice replaces the Phase 7 deterministic draft stub with an Anthropic-backed draft generator interface while preserving a safe fallback path when no API key is configured. It also syncs the latest Studio auth recovery fixes from `main` into the Phase 7 branch so protected Studio tools do not regress when this branch is merged later.

## What Changed

### Anthropic Draft Provider

- Added `src/lib/line-assistant/ai/anthropic.ts`
- Uses the Anthropic Messages API with a Sonnet model for draft generation
- Builds a constrained prompt from the existing draft context:
  - customer identity
  - travel dates
  - people summary
  - attractions summary
  - special needs summary
  - recent messages

### Safe Draft Generation Wiring

- Updated `src/lib/line-assistant/ai/generate-draft.ts`
- `generateDraftForConversation()` now accepts an optional `draftTextGenerator`
- If a generator is provided, it is used for the pending draft text
- If no generator is configured, the code still falls back to the deterministic local template

### Runtime and Processor Integration

- Updated `src/lib/line-assistant/runtime.ts`
- Runtime now exposes `draftTextGenerator`
- When `ANTHROPIC_API_KEY` is configured, runtime wires a real Anthropic provider
- Updated:
  - `src/lib/line-assistant/process/process-inbound-event.ts`
  - `src/lib/line-assistant/process/process-pending-events.ts`
- Both direct processing and async pending-event processing now pass the same draft generator through to draft creation

### Studio Auth Sync From Main

- Synced the recent protected-Studio fixes into the Phase 7 branch:
  - `sanity.config.ts` now uses `auth.loginMethod = 'token'`
  - `src/sanity/hooks/useSessionToken.ts` now checks:
    - `authState.token`
    - `authState.authState.token`
    - `workspace.auth.token`
    - localStorage fallback keys

## Tests Added / Updated

- Added `src/lib/line-assistant/__tests__/anthropic-draft-generator.test.ts`
- Updated `src/lib/ai/__tests__/draft-generation.test.ts`
- Updated `src/lib/line-assistant/__tests__/process-inbound-event.test.ts`
- Updated `src/lib/line-assistant/__tests__/process-pending-events.test.ts`
- Updated `src/lib/line-assistant/__tests__/kv-runtime.test.ts`
- Updated `src/sanity/hooks/__tests__/useSessionToken.test.ts`

## Verification

- `npm run test:run` -> passed (`106/106`)
- `npm run lint` -> passed
- `npm run build` -> passed

## Remaining Gaps

1. Anthropic integration is wired, but still needs a real staging smoke test with `ANTHROPIC_API_KEY`.
2. The deployment still needs a periodic sweeper for `/api/line-webhook/process`.
3. KV and Telegram integration still need live-environment validation before production rollout.

## Commit

- Feature commit: `a051127` (`feat: add anthropic-backed phase 7 draft generation`)
- Docs commit: pending
