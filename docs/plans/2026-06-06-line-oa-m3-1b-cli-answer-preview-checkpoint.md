# M3.1b — Operator CLI Preview `agent:notion-rag-answer` (Checkpoint)

**Date:** 2026-06-06
**Branch:** `codex/line-oa-agent-mvp`
**Status:** IMPLEMENTED (feature `4a7dad1`). TDD complete — 11 command tests green,
full line-agent suite 761/761, tsc clean, live masked smoke on the real corpus.

---

## What this slice adds

An operator-only, masked CLI that turns a free-text need into a **partner-group
draft** by piping the real Notion RAG search result into the deterministic
`composeAnswer` (M3.1). Lets Eric probe draft tone locally before any wiring.

```
npm run agent:notion-rag-answer -- "清邁 親子 大象 夜間動物園"
```

Mirrors the `notion-rag-search` two-layer seam exactly:
- **TS (pure):** reuses `composeAnswer` + `transportationAssessment` — unchanged.
- **CLI (`scripts/agent-command.mjs`):** disabled gate → skipped (no Notion read),
  injectable `runSearch` / `composeAnswer` / `client`, runtime loader default.

## Files

- `scripts/agent-command.mjs` — `parseAgentCommandArgs` (+`notion-rag-answer`),
  `deriveTransportationSignals`, `formatNotionRagAnswerReport`,
  `runNotionRagAnswerCommand`, dispatch in `runAgentCommand`.
- `scripts/notion-rag-dry-runner.mjs` — `importComposerDefault`,
  `loadNotionRagAnswerRuntime` (resolves runSearch + composeAnswer + client;
  real-runtime gate + token gate + sanitized `NotionRagRuntimeWiringError`).
- `package.json` — `agent:notion-rag-answer` script (tsx, `--env-file=.env.local`).
- `src/lib/line-agent/__tests__/agent-command-notion-rag-answer.test.ts` — 11 tests.

## Key seam

`runSearch(env, client, query)` returns a search REPORT (`skipped|ok|error`);
`composeAnswer` expects a `NotionRagSearchResult` (`ok|low_confidence`). The
command maps them: **zero hits ⇒ `low_confidence`**, search skip/error passes
through, a runner OR composer throw collapses to a sanitized `client_error`.

`deriveTransportationSignals` is CLI-input parsing only (like the query itself):
`partySize` from the parsed query; `airport` / `luggage N 件` as light surface
signals; returns `undefined` when there is no signal so unrelated drafts are not
padded with vehicle confirmations.

## Output contract (masked by construction)

Renders ONLY: parsed tokens (area/theme/partySize), index/hit counts, confidence,
and the composed draft text. The draft comes from `composeAnswer`, which consumes
operator-safe summaries and never fabricates private strings — so no customer
name / cost / revenue / profit / db id / Notion URL / raw itinerary can appear.
Explicitly labelled `夥伴群草稿 · 僅供內部 · 非客人回覆`. No LLM refine hook is
ever passed; nothing is ever sent.

## Eight locked behaviors (tests)

1. disabled gate → skipped, runtime loader never called.
2. enabled + results → composeAnswer runs → partner draft (內部過往案例傾向).
3. low_confidence / empty → 目前沒有強內部參考.
4. `6人包車` → Toyota Commuter 10 人座 Van 方向，無具體金額，無一定/保證/固定派.
5. 機場接送 + 行李 8 件 → mustConfirm 行李件數與尺寸 + safetyNote 行李車/第二台車.
6. formatter renders none of the forbidden tokens.
7. composeAnswer called with no `options` (no refine / refineHook).
8. output marked partner-group draft only — not a customer opener / not sent.

Plus: arg parsing, `client_not_wired`, sanitized runner-throw.

## Live masked smoke (real `.env.local`, tsx, real 90-record corpus)

- `"清邁 親子 大象 夜間動物園"` → area `chiangmai`, themes `family/elephant/
  night_safari`, 命中 5, 信心 high; draft = structured tokens only, zero PII.
- `"6人包車 機場接送 行李 8 件"` → partySize 6, 信心 medium, big-van direction,
  行李件數與尺寸 + 行李車/第二台車 safetyNote; no price, partner-group only.

## Out of scope (unchanged boundaries)

No LINE live path, no partner-group send, no OA auto-reply, no Sanity write, no
LLM, no web search, no scheduler/cache. `.env.local` / secrets never printed.

## Next slices

- **M3.2** — partner-group RAG-assisted draft surfacing (explicit send intent;
  no auto-send).
- **M3.3** — DK review / approval loop.
- **later** — optional gated LLM `refine` hook through the M3-0 tool gate.
