# 2026-06-07 — LINE OA M3.2 Preview Build Type-Import Fix Checkpoint

## Context

The first Vercel Preview deploy after adding the M3.2 preview env keys failed during
Next.js type checking, before any LINE or Notion smoke could run.

This was not an environment-variable issue. The Preview env keys remained masked and
the partner RAG draft gate stayed off.

## Root Cause

`src/lib/line-agent/partner-group/rag-draft-surfacing.ts` imported
`AgentSourceChannel` from `../line/event-normalizer`.

`event-normalizer.ts` imports that type locally but does not re-export it. The public
export lives in `src/lib/line-agent/types.ts`.

Vitest erased the type-only import and did not catch this, while `next build` /
Vercel's type checker correctly failed.

## Fix

- Import `AgentSourceChannel` from the public `../types` module.
- Update the related factory-selection test import to use the same public type module.
- Add a static regression test that prevents partner RAG surfacing code from importing
  `AgentSourceChannel` through `event-normalizer` again.

## Verification

- Targeted partner RAG surfacing/factory/type-import tests: green.
- Full `src/lib/line-agent` suite: green.
- Local `npm run build`: passed.

The local build still prints an unrelated existing Notion integration warning for the
legacy 2025 site data path. That warning did not fail the build and this checkpoint
does not record any database id or secret value.

## Boundaries

- No partner gate flip.
- No LINE live-path smoke.
- No Sanity write.
- No secret or database id committed.
- Preview deploy should be retried after this fix lands.
