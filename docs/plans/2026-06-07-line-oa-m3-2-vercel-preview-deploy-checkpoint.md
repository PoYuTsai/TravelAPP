# 2026-06-07 — LINE OA M3.2 Vercel Preview Deploy Checkpoint

## Deployment

Preview deployment succeeded after the type-import build fix.

- Preview URL: <https://travel-3eayc8xdb-poyutsais-projects.vercel.app>
- Target: Vercel Preview
- Status: Ready
- Partner RAG draft gate: still off (`AI_AGENT_PARTNER_RAG_DRAFT_ENABLED` not enabled)

## Verification

- `vercel deploy --yes`: completed successfully.
- `vercel inspect`: deployment status `Ready`.
- `vercel curl / --deployment <preview-url> -- --head`: returned HTTP 200.

Direct unauthenticated browser/curl access is protected by Vercel Deployment
Protection. That is expected for this preview. `vercel curl` was used for the
safe authenticated smoke check.

## Boundaries

- No LINE live-path smoke.
- No partner group gate flip.
- No production deploy.
- No Sanity write.
- No secret, token, database id, customer name, or Notion URL printed or
  committed.

## Next Safe Step

Run the preview smoke runbook manually against a test group only after Eric
explicitly enables `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED=true` in Preview. Keep the
formal partner group and Production gate off until the test group behavior is
reviewed.
