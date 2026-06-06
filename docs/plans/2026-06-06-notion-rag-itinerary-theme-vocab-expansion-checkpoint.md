# Notion RAG · Itinerary Theme Vocab Expansion — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp`. Fixture-first TDD knife. NO live Notion, NO
LINE, NO Sanity, NO scheduler/cache. Only the deterministic alias table + tests
changed. No secret printed anywhere.

## Problem

Previous masked smoke (`d7579c0`) showed **theme token = 2** distinct on the live
`private_2026` corpus — the alias table only knew 大象/夜間動物園. That was the
last quality bottleneck after token=0 and the 90→85 drop were both cleared.

## What changed (TDD, fixture-first)

- RED: 12 targeted tests in `notion-itinerary-parser.test.ts` for the new themes.
- GREEN: extended `THEME_ALIASES` in `notion/itinerary-parser.ts` — **alias table
  only, zero matching-logic change**. 8 new canonical themes:

  | theme | aliases |
  |---|---|
  | zoo | 動物園 |
  | zipline | 叢林飛索 / 飛索 / Jungle Flight / Pongyang / Kingkong |
  | cafe | 咖啡廳 / 咖啡 / cafe |
  | temple | 寺 / 廟 (covers 藍廟/白廟/柴迪隆寺/帕辛寺) |
  | market | 市集 / 夜市 / 瓦洛洛 |
  | massage | 按摩 |
  | photo | 泰服 / 拍照 / 攝影 / 網美 |
  | shopping | Big C / 採買 / 伴手禮 |
  | adventure | Phoenix Adventure / 冒險 / 越野 / ATV |

## Key design point — zoo vs night_safari

Longest-alias-first + span consumption needs **no logic change**: 夜間動物園
(5 chars, → night_safari) is consumed before the bare 動物園 (3 chars, → zoo) can
re-match, so the night safari never emits a stray zoo. Verified by 3 dedicated
tests incl. `夜間動物園 + 清邁動物園 → ['night_safari','zoo']` (standalone zoo
coexists, distinct activity). Many aliases fold to one token via the seen-set.

English/named aliases (`cafe`, `ATV`, `Big C`, `Pongyang`…) matched
**case-sensitively as written** — the 行程框架 corpus uses these exact spellings.
Hardening with case variants deferred (would be alias-table-only, no logic change).

## Verification

- `notion-itinerary-parser.test.ts`: 29 → 41 tests, all green.
- Full line-agent suite: **701/701 green**.
- Two existing family-page assertions updated to the richer
  `['zoo','zipline','night_safari','elephant']` (the intended behavior change).
- Fixture corpus distinct theme tokens: **2 → 8**
  (`zoo, zipline, night_safari, elephant, cafe, massage, photo, temple`),
  computed network-free from `REAL_2026_FIXTURE_PAGES`.

## Not done (by design)

- **Live masked Notion smoke** (`agent:notion-rag-dry-run`) to re-measure theme
  distinct on the real 90 rows: optional, needs creds, and this knife's rule is
  不打真 Notion 起手. Fixture proof (2→8) stands in for it.
- Still NOT started: formal Sanity build + real `/quote/[slug]` (needs Eric's
  server-side write-token approval). Branch stays as-is (no merge/PR).
