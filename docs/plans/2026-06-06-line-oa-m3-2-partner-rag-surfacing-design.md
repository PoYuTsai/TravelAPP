# M3.2 — Partner-Group RAG-Assisted Draft Surfacing (Design)

**Date:** 2026-06-06
**Branch:** `codex/line-oa-agent-mvp` (tip `c5c7002`)
**Status:** DESIGN ONLY. No code, no operator bridge, no responder wiring, no LINE
wiring this slice. Implementation is a **separate later TDD slice** that follows
this contract.
**Scope:** Define the *safety boundary* for **when and how** a RAG-assisted draft
may surface in the partner LINE group after the bot is tagged. This locks the
trigger / explicit-intent / fail-closed / cost / env contract before any runtime
code is written.

---

## Goal

Decide the rules that govern surfacing — not the draft text. The draft text is
already solved:

- **M3.1** `composeAnswer()` → `ComposedAnswer` produces the deterministic,
  operator-safe partner-group draft (marker `【夥伴群草稿】`, framing
  `內部過往案例傾向`, `mustConfirm`, no PII/price). M3.2 does **not** touch it.
- **M2** `PartnerGroupResponder` seam + `responder-factory` already isolate "what
  text the bot would say" from "whether it is sent" (the router's `sendTarget`,
  B4). M3.2 plugs into this seam later; it does **not** move these boundaries.

M3.2's only job: specify the **gate from `mentionsBot`/`quote-to-bot` → run RAG →
surface draft**, so that the eventual implementation is small, fail-closed, and
cannot leak or auto-reply.

---

## What this slice does / does NOT do

Does:
- Define **Trigger**, **Explicit Intent**, **Gate**, **Output contract**,
  **Failure modes**, **Cost/latency** posture, and the **future implementation
  seam**.
- Document **2–3 surfacing options** with trade-offs and a recommended
  minimal-safe option.

Does NOT (explicitly out of scope this slice):
- No code. No new operator CLI bridge. No `ragPartnerGroupResponder`. No factory
  env-gate change. No LINE webhook wiring. No cache/scheduler/index reuse.
- Does not change `composeAnswer`, the responder seam, or the router's B3 OA
  auto-reply ban.

---

## Surfacing options (the real fork)

The open question is **how the draft appears once the bot is tagged in the
partner group**. Three options, cheapest-safest first.

### Option A — Direct draft on any bot tag (rejected)
Every `mentionsBot`/`quote-to-bot` in the partner group runs RAG and posts a
draft.
- ➖ Runs a real Notion read on *every* tag → cost/latency on noise (greetings,
  "收到", stickers).
- ➖ Surfaces a "draft" even when the partner only wanted to chat → reads like the
  bot is answering for Eric.
- ➖ Hardest to keep fail-closed: the default behavior is "do the expensive,
  risky thing".

### Option B — Two-step offer ("found internal references, want a draft?")
On tag, the bot replies "我找到一些內部參考，需要我整理成夥伴內部草稿嗎？" and only
composes after a confirming reply.
- ➕ Cheaper than A on the first hop *if* the offer itself doesn't read Notion.
- ➖ But to honestly say "我找到參考" the bot must **already have queried Notion** →
  either it lies, or it pays the read anyway. Two messages, two round-trips,
  more group noise.
- ➖ Adds a stateful "pending offer" handshake — more surface area, more failure
  modes — for little safety gain over C.

### Option C — Explicit-intent keyword gate (RECOMMENDED, minimal-safe)
A tag alone never runs RAG. The partner message must **also** carry explicit
intent — e.g. contains 「查內部案例 / 幫我草稿 / 參考過往 / RAG」. Only then (and
only with the env gate on) does it run `composeAnswer` and surface **one** clearly
labelled draft.
- ➕ Cheapest: no Notion read on ordinary tags; cost is paid only on deliberate
  asks.
- ➕ Safest default: absent the keyword, behavior is exactly today's responder —
  fail-closed by construction.
- ➕ Single message, no handshake state, no extra round-trip.
- ➕ Composes cleanly with the existing env disabled-gate convention (below).

**Recommendation: Option C.** It is the smallest change that satisfies every
constraint, and it degrades to current behavior whenever any precondition is
missing.

---

## 1. Trigger

A RAG draft may be considered **only** when ALL hold:
- Source is the **partner group** (`LINE_PARTNER_GROUP_ID`). Never DM, never
  another group.
- Event is **`mentionsBot`** OR **quote-to-bot** (reply to a bot-authored
  message). This reuses the router's existing `botDirected` signal
  (`commands/router.ts` ~L233, `botDirected ?? event.mentionsBot === true`).
- **No tag ⇒ no reply.** Untagged partner chatter is ignored, as today.

**Hard boundary (unchanged):** OA customer events are **never** auto-replied.
Router B3 (`commands/router.ts` L194–206) denies OA auto-reply regardless of
intent; M3.2 adds nothing on the OA path and must not weaken B3.

---

## 2. Explicit intent

A tag is necessary but **not sufficient**. RAG runs only if the message also
expresses explicit intent to consult internal cases / produce a draft.

- Trigger lexicon (initial): 「查內部案例」「幫我草稿」「參考過往」「內部參考」「RAG」.
  Exact tokens to be pinned by RED-first tests in the implementation slice.
- **No explicit intent ⇒ existing responder runs, Notion is NOT read.** The bot
  still answers via the M2 stub/LLM responder; it simply does not pay for or
  surface a RAG draft.
- Intent detection is a **pure string check** on already-normalized text — no
  network, no LLM — so it is cheap and testable.

Rationale: separates "tagged me in conversation" from "deliberately asked me to
mine internal cases", which is what keeps cost and surfacing under control.

---

## 3. Gate (env, fail-closed)

Two gates in series (defense in depth). A draft surfaces only if **both** are
exactly `"true"`:

1. **Existing RAG gate** — `AI_AGENT_NOTION_RAG_ENABLED === "true"` (already
   enforced in `notion-rag-config.ts` L82; anything else ⇒ disabled, no sources,
   no parse, no Notion read).
2. **New partner-draft gate** — `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED === "true"`,
   **default off**.

> Naming note: the brainstorm draft used `PARTNER_RAG_DRAFT_ENABLED`. This design
> aligns it to the established `AI_AGENT_*` prefix + exact-`"true"` convention used
> by every other agent gate, so the disabled-gate helper and tests stay uniform.

Fail-closed rule: **gate off ⇒ no Notion read, no RAG draft, no error to the
group.** Even with a perfect trigger + explicit intent, an off gate behaves
exactly like "no explicit intent" — the existing responder answers. The gate is
checked **before** any Notion I/O.

This slice ships neither gate value flipped on; enabling is a deliberate later op
action after the implementation slice lands.

---

## 4. Output contract

When a draft IS surfaced, it must:
- Carry the **`【夥伴群草稿】`** marker (already emitted by `composeAnswer`).
- Read explicitly as an **internal draft, not a formal quote** — cannot be
  forwarded to a customer as-is; needs Eric/partner confirmation.
- Frame evidence as **「內部過往案例傾向」**, never "資料庫顯示" / "Notion 顯示".
- Contain **no** customer names, **no** cost/revenue/profit, **no** Notion URL /
  page id / DB id. (Guaranteed upstream by the operator-safe projection feeding
  the composer — M3.2 adds no new field, so it cannot reintroduce leakage.)
- Surface `mustConfirm` items (date, headcount, child age/height, flight,
  pickup/lodging) so the draft always reads as "needs verification", never as a
  promise.

M3.2 adds **no** new text or field to the M3.1 contract; it only decides when that
contract's output is allowed to appear.

---

## 5. Failure modes (fail-closed, no hallucinated fallback)

- **Low confidence / no strong reference:** surface the M3.1
  `目前沒有強內部參考案例…` line + `mustConfirm`. This is a *successful* low-signal
  result, not an error — the draft honestly says it found little.
- **Notion / RAG error:** do **not** produce a draft. Reply only "目前內部案例查詢
  暫時不可用，稍後再試或請 Eric 確認。" No silent swallow — log a non-minified error
  with a code for tracing (mirrors the responder's `degraded`+`error` pattern).
- **Timeout:** treated identically to an error — no draft, same unavailable
  reply.
- **No auto-fallback to a non-RAG hallucinated "draft".** On failure the bot
  never fabricates internal tendency. Worst case it says it cannot look right now.

---

## 6. Cost / latency posture

- A Notion RAG read is a **real API call** with cost and latency. It must **not**
  run on every partner tag — Trigger (§1) + Explicit Intent (§2) + Gate (§3)
  together ensure it runs only on deliberate, gated asks.
- This slice does **no** caching, indexing, scheduling, or index reuse. Today the
  retrieval path reads the corpus per query; that is acceptable only because
  M3.2 is operator-driven and not wired to runtime yet.
- **Forward note for the runtime slice:** before this is ever attached to live
  group traffic, add one of — cached index with manual refresh, an operator-only
  trigger, or a scheduled index build — so a burst of tagged messages cannot fan
  out into N full-corpus reads. This is a precondition for runtime, not part of
  M3.2.

---

## 7. Future implementation seam

When the separate TDD slice lands, it should reuse — not replace — existing
seams:
- New `ragPartnerGroupResponder` implementing `PartnerGroupResponder` (M2 seam),
  internally calling **existing** `composeAnswer` over operator-safe retrieval.
- Returned by `responder-factory` **only** when both gates (§3) are on; otherwise
  the factory keeps returning the current stub/LLM responder (degraded-stub
  semantics preserved).
- Send/no-send stays owned by the router's `sendTarget` /
  `post_to_partner_group` (B4). The responder still only produces text.
- OA auto-reply ban (B3) stays untouched. No OA path change, ever.

This keeps the eventual diff small: one responder object + one factory branch +
one env gate + the intent string check, all behind RED-first tests.

---

## Acceptance for THIS slice

- [x] Design doc committed (docs-only).

## Implementation status (M3.2 seam — commit `75742de`)

RED-first minimal seam landed in `partner-group/rag-draft-surfacing.ts` (+ a
one-line `meta.responder` union widening in `responder.ts`). Both env gates ship
**default off** — no production behavior is enabled.

- `detectPartnerRagIntent(text)` — pure explicit-intent check (§2 lexicon).
- `isPartnerRagDraftEnabled(env)` — two gates in series, BOTH exactly `"true"`
  (§3); default off.
- `shouldUsePartnerRagDraft({sourceChannel, botDirected, text, env})` — the §1+§2
  surfacing decision. OA never qualifies; untagged never qualifies.
- `createRagPartnerGroupResponder({source})` — injectable (no Notion/LLM here);
  prepends the §4 banner (`夥伴內部草稿` / `不是正式報價`); source error → §5
  fail-closed `PARTNER_RAG_UNAVAILABLE_REPLY` with `degraded`+`error` meta, never
  a fabricated draft.

15 contract tests (the design's Test 1–10 plus edge cases); full `line-agent`
suite **776/776** green.

## Implementation status (M3.2 factory selection — commit `0bfe244`)

RED-first dispatching factory landed in `partner-group/responder-factory.ts`
(`createPartnerGroupResponderWithRagDraft`), plus an additive optional
`botDirected?` on `PartnerGroupRespondInput`.

- Wraps the existing (stub/anthropic) `base` responder; per message routes to the
  rag responder ONLY when `shouldUsePartnerRagDraft` holds, else to `base`.
- `botDirected` resolves as `input.botDirected ?? event.mentionsBot === true`
  (mirrors the router; supports quote-to-bot).
- Gate off / no intent / OA / untagged → `base` runs, injected `answerSource`
  (fake this slice) is never invoked → zero Notion read.
- `answerSource` throw → fail-closed degraded reply (no hallucinated draft).
- Produces TEXT only — send stays owned by router `sendTarget`. Router / OA
  auto-reply ban untouched (verified: full suite green, no router test changed).

7 selection tests; full `line-agent` suite **783/783** green.

Still NOT done (future runtime slice, per §6/§7): wire the dispatcher into
`webhook-runtime.getPartnerGroupResponder()`, a real retrieval+`composeAnswer`
`answerSource`, cache/index reuse, and the actual LINE group attachment. The OA
auto-reply ban (router B3) and `sendTarget` (B4) remain untouched.

## Implementation status (M3.2 webhook-runtime wiring — commit `852b095`)

RED-first wiring of the dispatcher into the live responder seam landed in
`line/webhook-runtime.ts`, plus a `botDirected` threading in
`commands/handlers.ts` + `commands/router.ts`. BOTH env gates remain **default
off**; no production behavior is enabled and no real Notion is read.

- `getPartnerGroupResponder()` now returns `createPartnerGroupResponderWithRagDraft`
  over the M2 stub/anthropic `base`. The gate is read **per-respond**, so
  always-wrapping is safe — gate-off collapses to `base` (zero Notion read), and
  the OA plane can never satisfy `shouldUsePartnerRagDraft`.
- New `set/getPartnerRagAnswerSource` seam, late-bound via a thunk
  (`(input) => getPartnerRagAnswerSource()(input)`) so a test injects a fake after
  the singleton is built. **Production default is not wired to Notion**: it
  throws → `createRagPartnerGroupResponder` fails closed to
  `PARTNER_RAG_UNAVAILABLE_REPLY` (§5). Flipping both gates on before the
  retrieval slice lands therefore yields the honest unavailable reply, never a
  fabricated draft, never a Notion call.
- `botDirected` (mentionsBot OR quote-to-bot) is threaded router →
  `handleRespondToPartnerGroup` → respond input so quote-to-bot reaches the rag
  path without a re-tag. **No change** to `sendTarget` / action / OA auto-reply
  ban (B3) / send gate (B4).

10 wiring tests (gates-off base + source 0; gates-on rag; no-intent base;
quote-to-bot end-to-end; OA+keyword no-reply; untagged no-reply; source-throw
fail-closed; default not-wired fail-closed; sendTarget exactly-once). Full
`line-agent` suite **793/793** green.

Still NOT done (next knife): a real retrieval+`composeAnswer` `answerSource`
(replacing the not-wired default), the §6 cost guard (cached index / operator
trigger / scheduled build) BEFORE live group traffic, and flipping the env gates
on as a deliberate op action.
