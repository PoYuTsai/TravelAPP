# 2026-05-11 Thai Phrase Learning Launch

## Summary

- Added `/thai` as a practical Thai phrase learning page for Chiangway Travel guests.
- Built content around real Chiang Mai travel situations: basics, restaurant, charter driver communication, family needs, massage, hotel/airport, shopping, and emergency help.
- Added Min-recorded natural and slow audio for 75 phrase cards, totaling 150 production MP3 files.
- Added a local-only `/thai/record` recorder workflow for future audio maintenance.
- Kept recording drafts and source batches out of production by ignoring `public/audio/thai-drafts/` and `docs/assets/thai-audio-source/`.

## Product Positioning

- This is a free value-first travel utility, not a standalone paid language course.
- It should support Threads, LINE OA, and itinerary conversations as a soft entry point into Chiangway Travel.
- The strongest CTA is contextual: "學會幾句實用泰文，真的要排行程再找我們。"

## Files Changed

- `src/app/thai/page.tsx`
- `src/components/thai/ThaiLearningTool.tsx`
- `src/lib/thai/phrases.ts`
- `public/audio/thai/**`
- `src/app/thai/record/page.tsx`
- `src/components/thai/ThaiRecorderTool.tsx`
- `src/app/api/thai/audio/route.ts`
- `src/app/api/thai/local-recording/route.ts`
- `src/lib/thai/audio-storage.ts`
- `src/lib/thai/recorder-access.ts`
- `src/lib/thai/__tests__/*`
- `src/app/sitemap.ts`
- `src/lib/navigation.ts`
- `.gitignore`

## Verification

- `npm.cmd run lint`
- `npm.cmd run test:run -- src/lib/thai/__tests__/content.test.ts src/lib/thai/__tests__/recorder-access.test.ts src/lib/thai/__tests__/audio-storage.test.ts`
- `npm.cmd run build`
- Production smoke test:
  - `/thai` returns `200`
  - `/thai/record` returns `404`
  - `/api/thai/local-recording` returns `403`

## Commit

- Feature: `0a8f1ad` `Add Thai phrase learning page`

## Deployment Notes

- Push is currently blocked by GitHub SSH authentication: `Permission denied (publickey)`.
- After GitHub access is restored, push `codex/thai-learning-launch` and inspect the Vercel preview before merging to production.

## 2026-05-26 Update - Conservative Audio Cleanup

- Applied a conservative cleanup filter to all 150 production Thai MP3 files:
  - `highpass=f=90`
  - `lowpass=f=9000`
  - `afftdn=nf=-25:tn=1`
  - `loudnorm=I=-18:TP=-1.5:LRA=11`
- The goal is to reduce computer/room noise while preserving Min's Thai pronunciation and sentence endings.
- Original production MP3s were backed up locally under `docs/assets/thai-audio-source/formal-backup-denoise-20260526-033311`.
- Recording drafts remain excluded from production.

### Verification

- Confirmed production Thai MP3 count remains `150`.
- Confirmed backup MP3 count is `150`.
- `npm.cmd run test:run -- src/lib/thai/__tests__/content.test.ts src/lib/thai/__tests__/audio-storage.test.ts`
- `npm.cmd run build`

### Commit

- Audio: `0f1bb9e` `Clean Thai phrase audio noise`
