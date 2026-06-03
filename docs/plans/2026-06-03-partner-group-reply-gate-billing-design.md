# Partner Group Reply Gate + Billing Guardrails

- Date: 2026-06-03
- Branch: `codex/line-oa-agent-mvp`
- Status: design agreed; no implementation yet
- Depends on:
  - `2026-06-03-partner-group-mention-design.md`
  - `2026-06-03-partner-group-responder-model-adapter-design.md`
- Related:
  - `2026-06-03-payment-booking-risk-policy.md` (hard payment/booking boundaries the bot must enforce)

## 0. Decision

Eric approved this rule:

> In the partner group, tagging the official LINE account (`清微旅行chiangway_travel`) is explicit permission for the AI assistant to answer in that same partner group.

This does **not** change the customer OA boundary:

> Customer LINE OA inbound events must never call an LLM and must never auto-reply.

## 0.1 Working Model: Dual-AI Operating Roles

This project runs on two AI roles with distinct authority. Keeping them distinct is itself a design constraint — it decides *who decides* before any code is written.

- **Codex = Eric's product brain.** Owns architecture review, requirement convergence, and event-boundary decisions. When a requirement or an event boundary is ambiguous, Codex (with Eric) resolves it first.
- **CC/tmux = implementation worker.** Executes well-scoped engineering tasks. Inspects files, edits, tests, reports. tmux is the source of truth for control actions.

Operating rules:

- When the requirement is unclear, or the event boundary (which plane, which trigger, which gate) is not yet pinned, **stop and align with Eric before writing code.** Do not "guess and build."
- Only a **clearly specified engineering task** proceeds to TDD implementation. Design ambiguity is resolved in docs first (like this one), not in code.
- This doc is the alignment artifact for the partner-group reply + billing boundaries. Code that crosses these boundaries is blocked until the boundary is approved here.

## 1. Planes

The official LINE account `清微旅行chiangway_travel` carries **two identities at once**:

- a **customer-facing official account** (清微旅行 chiangway_travel) for travellers, and
- an **AI operations assistant** inside the partner group for Eric / @Tsai / @Chun.

These identities share one LINE channel but are **two separate planes** with different rules. The plane is decided by `event.sourceChannel`, never by message content. The customer plane never calls an LLM; the partner plane may, but only on explicit partner trigger.

### Customer OA plane

Source: `sourceChannel === 'line_oa'`

Scope: this boundary applies to **every** customer inbound — free text, rich-menu taps, postbacks, stickers, images, location, and voice. None of them may auto-reply or call a model.

Allowed (deterministic only):
- Normalize event
- Persist webhook event
- Persist/update case
- Deterministic customer-event classification
- Missing-field detection
- Case state update
- `/inbox` visibility / listing
- Reminder candidate calculation
- Rich-menu / postback **browsing context** recording (see §1.1)

Forbidden:
- Calling Anthropic/OpenAI/any LLM on inbound customer messages
- Replying to customer
- Pushing to customer
- Running web search
- Running quote formal write

Reason: customer message volume is unpredictable. Calling an LLM on every OA inbound would burn API billing and create automation risk. **A customer simply entering the OA must never trigger an LLM.**

Important UX rule (no manual bookkeeping):
- Do not design `/done Eunice`-style commands.
- Do not require partners to type "已回".
- Do not require partners to type a `caseId` on each interaction.
- Partners should keep their natural workflow: open LINE OA Manager, read the customer thread, and reply to the customer directly when available.
- The bot exists to **reduce** partner workload, not add operation steps.
- The agent must infer status from stored webhook events plus scheduled/operated scans, rather than pushing manual bookkeeping onto partners.

### Partner group plane

Source: `sourceChannel === 'line_partner_group'`

Allowed only when `mentionsBot === true`:
- Resolve intent
- Call `PartnerGroupResponder`
- Produce an internal reply
- Send that reply back to the same partner group using the event reply token

Still forbidden:
- Customer reply
- Dev/code/deploy/parser/schema mutation
- Formal quote write
- Silent background web search
- Any send without bot mention
- Suggesting pay-on-behalf / book-on-behalf for hotels/B&B, or out-of-scope ticket booking (see `2026-06-03-payment-booking-risk-policy.md`)

Trigger aliases: any partner group member may tag the bot to ask it a question. `mentionsBot` resolves true for any of the account aliases, e.g. `@清微旅行chiangway_travel`, `@清微旅行`, `@清微AI助理`.

Also allowed:
- If a partner quotes/replies to a bot-authored message or case card in the partner group, treat that as an explicit bot-directed message, even if the partner does not type `@...` again. Once the quoted message is bot-authored, that **is** an explicit "answer me" — the bot should respond.
- A quote/reply to a human teammate's message does not trigger the bot unless `mentionsBot === true`.

UX intent: this tag / quote-bot flow is the **primary way partners use the bot like ChatGPT** inside their existing group. It must feel natural — do not make it awkward, and do not require partners to type a `caseId` or any command to ask a question.

## 1.1 Rich Menu / Browsing Context Lifecycle

A customer tapping the rich menu is **not** an active inquiry. Rich-menu taps, postbacks, and keyword auto-replies are low-intent browsing signals, not a request that needs a human.

Rules for rich-menu / postback / keyword auto-reply events:
- Record them as **browsing context** only.
- No reminder fires.
- No LLM is called.
- Nothing is pushed to the partner group.

Real-world timing: a customer may tap the rich menu a few times, then send free text minutes — or days — later. **The free text is what actually starts a case action**, not the menu taps.

### Promote to active case

When a free-text message promotes a contact to an active case, the prior browsing context is folded into the case summary as **hints, not facts**:

- Which menu items / postbacks were tapped.
- How long ago, relative to the latest free-text message.
- Which package / product / attraction those taps might correspond to.

Strict labelling:
- These are marked as `context` / `hint` with their own confidence.
- They must **never** be treated as a confirmed customer requirement. The customer has not confirmed anything by browsing.

Aging:
- If the browsing context is older than **14 days**, list it as `old_context` with lower confidence (or drop it from the active summary), so stale taps do not skew the new inquiry.

Future — browsing taxonomy (CUA):
- A later step needs a **CUA driver** to inspect Eric's LINE rich menu, keyword rules, and auto-reply global settings, and to compile a **browsing taxonomy** (which menu item / keyword maps to which package / product / attraction).
- Until that inventory exists, a rich-menu tap / postback / keyword hit may only be treated as a **hint**, never as a confirmed customer requirement.
- This taxonomy is read-only inventory work; building it is out of scope for the current implementation and must not call an LLM or reply to customers.

## 2. Billing Model

Billing should be explicit and predictable.

No LLM billing:
- Customer OA inbound
- Rich menu browsing events
- Case persistence
- `/inbox` deterministic listing
- Reminder candidate calculation
- Missing-field rule checks

LLM billing allowed:
- Partner explicitly tags the bot in the partner group
- Partner quotes/replies to a bot-authored message in the partner group
- Eric explicitly triggers an operator command that calls a model

Higher-cost LLM/tool use requires an explicit later gate:
- Web search / live website lookup
- OCR / image understanding
- Notion RAG over many records
- Long itinerary or quote review

For MVP, partner-group tagged replies may use the model responder, but external tools are out of scope.

## 3. Reply Gate

A partner-group model reply may be sent only when all conditions are true:

1. `event.sourceChannel === 'line_partner_group'`
2. `event.mentionsBot === true`, OR the event quotes/replies to a bot-authored partner-group message
3. Router action is `respond`
4. Handler produced `handlerResult.outboundText`
5. The event has a valid `replyToken`
6. The intent is not denied by B5/dev-plane permissions

If any condition fails, no LINE reply/push is sent.

Use LINE reply, not push, for this first implementation:
- Reply is naturally scoped to the message that tagged the bot.
- Reply token proves the reply is event-bound.
- Push is more suitable for future explicit operator send or scheduled reminders.

## 4. Runtime Shape

Current state:
- `routeCommand()` may return `action: 'respond'`
- `handleRespondToPartnerGroup()` returns `handlerResult.outboundText`
- `webhook-runtime.ts` currently discards `RouterDecision`
- No LINE send occurs from webhook-runtime
- The system does not yet track bot-authored partner-group message IDs, so quote-to-bot detection is not complete.

Next implementation should add a narrow send gate in the webhook path:

1. Preserve `RouterDecision` from `routeCommand()`
2. If it matches the reply gate, call `replyMessage(replyToken, [text])`
3. Do not route through `pushMessage`
4. Do not send for OA events
5. Do not send for reminders
6. Do not send for operator `/inbox`

`PartnerGroupResponder` remains pure:
- Produces text only
- No LINE client import
- No token access
- No send decision

## 5. Event Shape Needed

`NormalizedLineEvent` needs `replyToken?: string`.

Rules:
- Capture `raw.replyToken` for message events when present.
- The reply gate requires it.
- Missing `replyToken` means no send; log a warning and keep the webhook 200.
- Do not add `replyToken` to case storage or inbox summaries.

Quote-to-bot support also needs bot-authored message tracking:
- When the bot sends a partner-group case card or reply, persist enough metadata to identify it later.
- Minimum metadata: bot message id if available, case id if embedded, timestamp, and message purpose (`case_card`, `assistant_reply`, `reminder_card`).
- LINE quoted messages provide `quotedMessageId`; the system can match that against stored bot-authored message IDs.
- If LINE does not provide enough bot message metadata for a given send method, fall back to explicit `mentionsBot` only for that event.

## 5.1 Scheduled Scan / CUA Status Detection

Webhook ingestion alone cannot reliably know whether a human partner opened the OA thread, read it, or replied in LINE Official Account Manager.

Therefore the operating model should include a separate status scan layer:

- Cron job: periodically evaluate case age, last inbound customer message, last known internal update, and current zone.
- CUA/OA Manager scan: when authorized, inspect the LINE OA Manager UI to infer human-reply state that webhook cannot see.
- Operator-triggered scan: Eric can ask the control session to scan a specific customer or the whole inbox.

The scan layer may update internal case status and may produce partner-group reminder cards.

It must not:
- Call an LLM by default.
- Reply to customers.
- Require partners to type bookkeeping commands.
- Push every minor state change into the partner group.

Recommended reminder policy:
- First new actionable customer message: may post one short case card to partner group.
- Follow-up in same case: update inbox; post only when urgency/SLA/high-intent threshold is met.
- Stale case: cron can post a reminder card after cooldown.
- Rich menu/postback browsing: record only; no reminder unless later paired with free-text intent.
- Cooldown by case, so repeated customer messages do not spam the group.

## 5.2 Customer Conversation Status Matrix

This is the state model the deterministic scan layer (§5.1) uses to decide *when* a case earns a partner-group reminder and *where* it sits in `/inbox`. All of these states are computed from stored webhook events plus scheduled/operated scans — **never** from an LLM, and they **never** auto-reply the customer.

### Detection signals (deterministic inputs)

States are derived from these signals only — each is observed (webhook event) or inferred (scheduled / CUA / operator scan), never produced by an LLM:

- `customer_sent` — there is an inbound customer message.
- `human_read_detected` — a human partner has opened/read the latest customer message (inferred via scan; may be unknown).
- `no_human_reply_detected` — no outbound human reply has gone out since the latest customer message.
- `human_replied` — an outbound human reply went out after the customer's last message.
- `customer_read` — the customer has read our latest outbound message (LINE read receipt, when available).
- `customer_no_reply` — the customer has not replied since our latest outbound message.

When a signal is unknown (e.g. read state not yet scanned), the state defaults to the **least-disturbing** interpretation.

| Status | Condition (signals) | Priority | Partner-group action | LLM | `/inbox` placement |
|---|---|---|---|---|---|
| `customer_sent_no_human_reply` | `customer_sent` + `no_human_reply_detected` | **Highest** | Remind partner group; debounce consecutive messages into one case card | No | Top / urgent |
| `possibly_stuck` / `needs_attention` | `customer_sent` + `human_read_detected` + `no_human_reply_detected` | High | May post one card framing the stuck point (see below) | No | Needs-attention |
| `waiting_customer` | `human_replied` + `customer_no_reply` | Low | None by default | No | Low-priority "waiting customer" |
| `waiting_customer_after_itinerary_or_quote` | `human_replied` + `customer_read` + `customer_no_reply` (most common) | Low | None by default | No | Low-priority "waiting customer" (passive watch) |
| `customer_followup_after_waiting` | New `customer_sent` free text on a waiting case | Re-activates to active case | Re-evaluate as a fresh actionable message, carrying prior summary | No | Active |
| `browsing_only` | Rich-menu / postback / keyword auto-reply only, no free text | None | None — record context only | No | Hidden or context-only (see §1.1) |

### `customer_sent_no_human_reply` — the one the bot must guard

`customer_sent` + `no_human_reply_detected`. This is the highest-priority state and the core missed-lead risk the bot exists to catch.

- Must remind the partner group.
- Multiple messages sent in quick succession are **debounced/merged** into a single case card, not one card per message.
- No LLM call. No customer reply.

### `possibly_stuck` / `needs_attention` — help, don't blame

`customer_sent` + `human_read_detected` + `no_human_reply_detected`: the customer replied, a human read it, but no reply went out. This usually means the partner is busy, opened it by accident, is still thinking, or hit a tough question.

The bot may post one partner-group card that lists:

- The customer's latest question.
- Which information is still missing.
- The likely point where things are stuck.
- Whether this probably needs Eric's judgement.

If the content touches **price, itinerary logic, safety, kids, elderly, luggage van, guide, accommodation, or payment**, escalate the card to `may_need_eric_or_ai_help`.

The card's purpose is to let Eric see it and to make it easier for a partner to take over — **not** to blame the partner for going quiet.

### `waiting_customer` — we replied, customer has not

`human_replied` + `customer_no_reply` (read state unknown or not-yet-read). By default this fires **no** reminder. The customer may simply be comparing prices, not interested, blocked, or just not in the mood to reply right now. Do not let the bot turn into a follow-up/nag machine. Show it only in the `/inbox` low-priority "waiting customer" zone.

### `waiting_customer_after_itinerary_or_quote` — the most common state

`human_replied` + `customer_read` + `customer_no_reply`. This is the most common situation: there has already been a conversation, the partner organised/sent an itinerary or a quote, and the customer has read it but not replied.

- Default: **no** partner-group push, **no** nudge, **no** disturbance.
- Reason: the customer may be comparing prices, thinking it over, not interested, or may even have blocked us — all of that is fine.
- Show it only in the `/inbox` low-priority "waiting customer" zone as a passive watch.
- Future: only once the case enters a clearly high-intent stage (customer says they want to book, asks about payment, or adds Eric's LINE QR) do we consider low-frequency follow-up.

### `customer_followup_after_waiting` — still willing to talk, don't give up the case

As soon as the customer sends any free-text message again — **whether or not it is a question** — the case becomes active again.

- Do not judge only by the latest single sentence; carry the prior conversation summary forward.
- The core conversion logic is: show professionalism, build trust, demonstrate value, **then** deliver the itinerary/quote — that is what makes booking flow smoothly.
- So as long as the customer still shows any willingness to communicate, do not give the case up lightly.

### `browsing_only` — context only

Rich-menu taps, keyword hits, and auto-reply browsing only record **context** — no reminder, no LLM, no partner-group push. The full lifecycle (promote on free text, hint-only labelling, 14-day aging, and the CUA browsing-taxonomy inventory) is defined in §1.1.

## 5.3 Reminder Philosophy

The reminder rules above all follow one philosophy:

- **Failing to reply a customer = a big deal → remind.** This is the missed-lead risk the bot exists to guard.
- **The customer not replying us = by default not a big deal → do not nag.** Comparing prices / thinking / not interested / blocked are all acceptable outcomes.
- **Read-but-no-reply = possibly stuck → use a card to help organise the question**, not to blame the partner.
- **As long as the customer still shows willingness to communicate, do not give the case up lightly.**

### Hard constraints (all states)

- Status and reminder calculation **must not** call an LLM.
- Nothing here **auto-replies the customer**.
- Partners are **never** required to type `/done`, "已回", or a `caseId`.
- An LLM is permitted **only** when a partner tags the bot, or quotes/replies to a bot-authored message, in the partner group (§1, §2, §3).

## 6. Error Handling

Model responder failure:
- `AnthropicPartnerGroupResponder` already degrades to safe stub and never throws.
- If responder returns degraded stub, it may still be sent in partner group because the partner explicitly tagged the bot.

LINE reply failure:
- Must be logged with a non-minified error.
- Must not cause customer reply.
- Open decision for implementation: whether LINE reply failure should return 500 for partner-group events.

Recommended MVP behavior:
- Return 200 after logging reply failure.
- Reason: partner-group assistant is an enhancement; LINE redelivery could duplicate model calls unless idempotency is extended to reply sending.

## 7. Tests

Required tests before implementation is accepted:

1. `line-event-normalizer.test.ts`
   - Captures `replyToken` for partner group text events.
   - Captures `replyToken` for OA events but does not change `mentionsBot:false`.

2. `webhook-runtime` or route-level test
   - Partner group tagged event + fake responder + fake reply client sends exactly one reply with `outboundText`.
   - Partner group quote/reply to bot-authored message sends exactly one reply with `outboundText`.
   - Partner group untagged event sends nothing.
   - Partner group quote/reply to a human teammate's message sends nothing unless `mentionsBot === true`.
   - OA event containing `@bot` sends nothing and does not call responder.
   - `respond` without `replyToken` sends nothing and logs warning.

3. Guardrails
   - Dev action from partner group remains denied and sends nothing.
   - `post_to_partner_group` explicit operator send remains separate from tagged reply.
   - No customer OA path imports or calls LLM responder.
   - Scheduled scan produces reminder candidates/cards without calling LLM.
   - No test requires partner manual commands like `/done`.

## 8. Non-Goals

Not in this implementation:
- Web search
- Notion RAG
- OCR
- Sanity formal quote write
- Full CUA/OA Manager automation
- Automatic customer read marking
- Replying to customer OA

Those require separate gates.
