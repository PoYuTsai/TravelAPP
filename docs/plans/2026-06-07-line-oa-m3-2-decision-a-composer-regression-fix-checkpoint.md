# 2026-06-07 — LINE OA M3.2 Decision A Composer Regression Fix Checkpoint

## Context

Eric reviewed the first private LINE-group smoke and chose Decision A:

- keep the partner-group RAG answer deterministic first,
- do not let Anthropic free-form be the main M3.2 partner draft surface,
- keep Preview/Production partner gates off until the deterministic regressions are
  fixed and re-smoked.

The smoke showed several free-form risks:

- invented 2024-style cases even though the active private corpus is 2025/2026,
- simulated `search` / waiting behavior for Tokyo ski/hot spring even though it has
  no strong Chiangway internal reference,
- framed Chiang Mai airport pickup like Taiwan airport transfer,
- overused "Eric 拍板" language even though Lulu / Chun are the main partner
  customer-facing operators.

## Implemented

### 1. Composer source-year / low-confidence guard

The deterministic composer remains structured and does not invent source years or
simulate external search behavior.

Low-confidence / no-strong-reference answers stay explicit instead of pretending to
query a tool or external corpus.

### 2. Chiang Mai airport SOP

Airport-transfer wording now follows the Chiang Mai / CNX operating model:

- flight number,
- CNX arrival/departure time,
- whether the driver should arrive early,
- whether day 1 is pickup only or pickup + exchange + itinerary,
- Bangkok domestic-transfer timing only when the message actually mentions a Bangkok
  domestic leg.

It does not ask "Taoyuan airport to city" style questions.

### 3. Partner-first wording

Routine drafts now use a partner-first closing:

> 夥伴可先依此整理回覆；正式報價、特殊承諾或例外狀況再請 Eric 最終確認。

This keeps Eric as the final escalation point while recognizing Lulu / Chun as the
normal customer-facing operators.

### 4. Partner aliases

Added a small partner-alias module for the known operating partners:

- Lulu = 宜 如果 乾
- 彥均 = Chun

The module documents future @-tag restraint: do not auto-tag partners unless a
future feature has a clear assignment / clarification need.

## Verification

- Targeted tests: 61/61 green.
- Full `src/lib/line-agent` suite: 857/857 green.

The two expected fail-closed stderr lines in partner RAG tests are intentional test
coverage for degraded paths.

## Boundaries

- No partner gate flip.
- No Preview LINE smoke in this slice.
- No Production deploy.
- No Sanity write.
- No LLM/Anthropic surfacing change.
- No secret, token, database id, customer name, or Notion URL committed.

## Next Step

Re-run the private LINE test-group smoke only after deciding whether Preview should
temporarily enable `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED=true` again. The formal
partner group remains out of scope until private smoke is reviewed.
