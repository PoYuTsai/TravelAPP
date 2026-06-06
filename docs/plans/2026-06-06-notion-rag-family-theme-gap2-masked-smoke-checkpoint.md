# Notion RAG · GAP-2 Family/Kids Theme — Masked Real-Corpus Smoke (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (feature `e93a450`, suite `9c22c5a`). Validates
the GAP-2 family/kids theme signal against the REAL private_2026 corpus through
the operator-only RAG search CLI. No code changed this cut.

Operator-safe by construction (GAP-1): every result line shows only structured
facts and ends at `車型-`. Nothing below is unmasked — no `.env.local`, no token /
DB id / Notion URL, no guest name, no cost / revenue / profit.

Command: `npm run agent:notion-rag-search -- "<query>"` · index size **90**.

## Results (parsed token → top-result structured facts)

| Query | parsed area / theme / partySize | hits | family in query? | family-signal cases on top? |
|-------|---------------------------------|------|------------------|------------------------------|
| 清邁 親子 大象 夜間動物園 | `[chiangmai]` / `[family, elephant, night_safari]` / `-` | 5 | yes | all top-5 carry `family` |
| 小朋友 夜間動物園 | `[-]` / `[family, night_safari]` / `-` | 5 | yes | all top-5 carry `family` |
| family kids chiangmai | `[chiangmai]` / `[family]` (kids deduped) / `-` | 5 | yes | all top-5 carry `family` |
| 茵他儂 親子 | `[inthanon]` / `[family]` / `-` | 5 | yes | top-1 = inthanon + family |
| 6人包車 | `[-]` / `[-]` / `6` | 5 | **no** | partySize=6 filter only |
| 成人6人包車 | `[-]` / `[-]` / `6` | 5 | **no** | partySize=6 filter only |

Sample masked top line (query 1):
`天數- · 區域 chiangmai/chiangrai · 主題 …/night_safari/family · 6人 · 車型-`

## Judgment — all criteria pass

1. **親子 / 小朋友 / family / kids → `family` token**: yes on all four family
   queries; `kids` dedupes into the single `family` token.
2. **family query prioritises family-signal cases**: every top result for the
   four family queries carries the `family` theme (derived on real data from real
   親子 / 小朋友 signals), so family cases rank above same-area non-family ones.
3. **`6人包車` / `成人6人包車` never auto-tag family**: both parse theme `[-]`,
   partySize `6`. Retrieval returns the 6-person subset (not family-injected); a
   family case can still appear because it genuinely has 6 people, but the QUERY
   added no family token. The "不要把 partySize 當 family" rule holds.
4. **no whole-corpus bleed**: `6人` queries return a partySize-filtered subset, not
   all 90; the four family queries return ≤5 descriptive matches.

Privacy: every line is masked — no name / flight / phone / URL / amount / id.

## Soft observation (not a gap, no code change)

`family` is a HIGH-frequency theme in the real corpus (most cases are family
charters — the core business), so on its own it is a weak discriminator. Ranking
still works because area + activity themes carry the discrimination; family acts
as a recall booster, not a precision filter. If precision ever matters, a future
cut could weight rarer themes — but that is out of GAP-2 scope and not needed now.

## Not done (by design)

- No code touched; smoke only.
- Operator CLI / index preview only; not wired to LINE live path; no Sanity, no
  quote, no LLM, no scheduler. Branch stays as-is (no merge/PR).
