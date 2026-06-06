# Notion RAG · 行程框架 → area/theme Parser — Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp`. Fixture/mock-only TDD knife. NO live path, NO
real db id, NO network, NO LLM, NO Sanity, NO scheduler/cache, NO LINE live path.
No secret (token / db id / Notion url / customer name / cost / revenue / profit)
is written to code, tests, docs, or terminal output anywhere in this work.

## Problem this knife addresses

The field-alias checkpoint (`2026-06-06-notion-rag-real-field-alias-alignment`)
mapped the real `private_2026` columns but deliberately deferred area/theme: the
real schema has **no 城市區域 / 行程類型 column**, so `areaHints`/`themeHints`
stayed empty → the live masked smoke's `區域/主題 token = 0`. That earlier note
called extracting them from `行程框架` "a later parser knife". This is that knife.

## Solution

`notion/itinerary-parser.ts` — a pure, deterministic, whitelist parser:

- `parseItineraryHints(text) → { areaHints, themeHints }`
- strict alias table only; unrecognised text yields **nothing** (honours Eric's
  「不亂補」rule)
- **longest-alias-first + span consumption**: `夜間動物園 → night_safari` is never
  also counted as a substring (`動物園`) should a shorter alias ever be added
- output ordered by first appearance in the text; the index layer normalises /
  sorts again, so the contract is stable end-to-end

Alias table (extend this only; keep matching logic + contract intact):

| 行程框架 token | hint | kind |
|---|---|---|
| 清邁 | `chiangmai` | area |
| 清萊 | `chiangrai` | area |
| 芳縣 / 芳县 | `fang` | area |
| 茵他儂 | `inthanon` | area |
| 湄康蓬 | `mae_kampong` | area |
| 南邦 | `lampang` | area |
| 南奔 | `lamphun` | area |
| 大象 | `elephant` | theme |
| 夜間動物園 | `night_safari` | theme |

## Adapter wiring

`notion-rag-adapter.ts`: after property parsing, when `facts.itinerarySnippet`
exists and no explicit column supplied them, derive `areaHints`/`themeHints` from
the parser. **Explicit 城市區域 / 行程類型 columns always win**; the parser is a
fallback for the real corpus that lacks them. Derived hints flow straight into
`buildRagIndex` → `queryRagIndex` (area/theme filters) and the partner-safe view
still drops all `privateContext`.

## TDD (RED → GREEN)

`__tests__/notion-itinerary-parser.test.ts` (15 tests) — RED first (module
missing), then GREEN. Covers Eric's 10 cases: 清邁一日→chiangmai; 清萊->芳縣→
chiangrai+fang; 大象+夜間動物園→elephant+night_safari; 茵他儂/湄康蓬/南邦/南奔;
unrecognised→empty; index query/filter end-to-end; partner-safe view clean.

`__tests__/notion-rag-real-schema.test.ts`: the old "leaves area/theme empty"
assertion (whose own comment said it was a later parser's job) evolved into a
"derives recognised tokens, still invents nothing for unrecognised text" pair.

## Verification

- targeted: `notion-itinerary-parser.test.ts` 15/15 green
- full line-agent suite: **687/687 green** (671 baseline + 15 new + 1 guard)
- `tsc --noEmit`: no errors in changed files

## Out of scope / next knife candidates

- Wider alias coverage (動物園→zoo, 叢林飛索→zipline, 咖啡廳→cafe, 藍廟→blue_temple,
  按摩→massage, 拍照/網美→photo…) — add to the alias table when a real case needs it.
- Still NOT started: formal Sanity build + real `/quote/[slug]` (needs Eric's
  server-side write-token approval). Branch stays as-is (no merge/PR).
