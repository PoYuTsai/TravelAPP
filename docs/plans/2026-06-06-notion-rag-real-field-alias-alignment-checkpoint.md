# Notion RAG · Real 2026 Field-Alias Alignment — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp`. Fixture/mock-only TDD knife. NO live path, NO
real db id, NO network, NO Sanity, NO scheduler/cache. No secret (token / db id /
Notion url / customer name / cost / revenue / profit) is written to code, tests,
docs, or terminal output anywhere in this work.

## Problem this knife addresses

Prior live masked smoke (checkpoint `2026-06-06-notion-rag-real-dry-run-wiring`)
observed `區域/主題 token = 0` and a merged record count slightly below the loaded
page count. Root cause: the **real** `private_2026` column names did not line up
with the adapter's aliases, so every record's facts came back empty → identical
`computeNaturalFingerprint` hashes → `dedupeCaseRecords` collapsed distinct cases
into one (the "rows merge/drop" symptom).

This knife aligns the real column names against the mapper — **fixture-only**, no
client dump of real customer rows.

## Eric's schema decisions (2026-06-06)

| Real column | Maps to | Notes |
|---|---|---|
| 旅遊日期 | `facts.travelDateRange` | alias already existed |
| 旅遊人數 | `facts.partySize` (+ optional `adults`/`children`) | new `partySize` fact; split filled ONLY when the text states 成人/小朋友/大/小 — never auto-derived |
| 飛行班次 | `facts.flightInfo` | raw text, partner-safe |
| 包車車型 | `facts.vehicleType` | NEW fact (not `pickupInfo` — 接送 ≠ 車型); first-class retrieval dimension, partner-safe |
| 行程框架 | `facts.itinerarySnippet` | searchable text |
| 總成本 | `privateContext.cost` | private only |
| 總收入 | `privateContext.revenue` | NEW private field; operator-only |
| 利潤 | `privateContext.profitShare` | private only (kept `string` per existing type/contract) |

**area/theme intentionally NOT invented.** The real schema has no 城市區域 /
行程類型 column, so `areaHints`/`themeHints` stay empty for this corpus. Extracting
them from `行程框架` text is a **later parser knife** — out of scope here (honours
Eric's RED rule「不要亂補」).

## Changes (all additive)

- `rag-index.ts`: `RagCaseFacts` += `partySize?`, `vehicleType?`;
  `RagPrivateContext` += `revenue?`; `computeNaturalFingerprint` += `ps:`/`v:`
  segments; `RagIndexQuery` += `partySize?` with exact-match in `matchesStructural`.
- `field-policy.ts`: `CanonicalField` += `flightInfo`/`vehicleType`/`revenue`;
  `FIELD_ALIASES` += the 8 real column names above; `POLICY` += flightInfo/
  vehicleType (read_only → partner_group), revenue (private → never → omit). The
  `Record<CanonicalField, PolicyRow>` type forces a policy row for every new
  canonical field, so a new field can't silently default to leaky.
- `notion-rag-adapter.ts`: `parsePartySize()` (`成人2 小朋友2`→4/2/2; `7大2小`→9/7/2;
  `成人9`→9/9; `9人`/`8`→partySize only; un-splittable→{}); switch cases for
  `partySize` / `flightInfo` / `vehicleType` / `revenue`.

## Tests (TDD: RED → GREEN)

- NEW `__fixtures__/real-2026-schema.ts`: 3 pages keyed by the real column names.
- NEW `__tests__/notion-rag-real-schema.test.ts`: 24 specs — alias resolution,
  partySize parsing matrix, flight/vehicle/itinerary facts, cost/revenue/profit
  private-only, no-invented-area/theme, partySize exact-match query, distinct
  fingerprints (no collapse), partner-safe projection leak-free.
- UPDATED `notion-rag-adapter.test.ts` e2e: the two 清邁+親子 family cases tie on
  rank+matched dims; new fingerprint segments flipped the arbitrary hash
  tiebreak, so the assertion now checks the real invariant (top is a family case)
  and pins the leak check on the known-sensitive 5d record.
- **line-agent suite: 671/671 green.** Touched files are `tsc --noEmit` clean
  (the 40 repo-wide tsc errors are pre-existing and unrelated).

## Not done (deliberate, out of scope)

- **Live masked smoke** (`npm run agent:notion-rag-dry-run`): NOT run here — it is
  a live Notion call needing Eric's `NOTION_TOKEN` + gate flags, outside this
  fixture-only knife. The 24 new specs reproduce the exact real-column→facts
  mapping the smoke exercises. Eric re-runs the masked smoke with his env to
  confirm `區域/主題 token` and record counts on real data.
- area/theme parser over `行程框架` (the actual fix for token=0) — next knife.
