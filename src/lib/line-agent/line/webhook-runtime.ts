/**
 * Webhook runtime seams — injectable handler + store for the LINE webhook route.
 *
 * These live in the lib layer (not the route file) because a Next.js App Router
 * route file may only export HTTP-method handlers (`POST`, …) and a fixed set
 * of config keys.  Arbitrary exports like `setEventHandler` / `setStore` are
 * rejected by `next build`'s route validator, so the seam state and its
 * setters/getters are kept here and imported by the route.
 *
 * Module-singleton state with live ES-module bindings: the route reads the
 * current handler/store via the getters at request time, while a test (or a
 * future bootstrap) injects an alternative implementation via the setters.
 *
 * The default handler routes events through `routeCommand`, which durably
 * persists OA customer cases via the reducer + the bootstrapped store
 * (KvStore in production, MemoryStore locally).  No customer auto-reply.
 */

import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { CaseStore } from '@/lib/line-agent/storage/store'
import { selectStore } from '@/lib/line-agent/storage/select-store'
import { routeCommand } from '@/lib/line-agent/commands/router'
import { safeDefaultLlmClassifier } from '@/lib/line-agent/commands/intent'
import type { PartnerGroupResponder } from '@/lib/line-agent/partner-group/responder'
import {
  createPartnerGroupResponder,
  createPartnerGroupResponderWithRagDraft,
} from '@/lib/line-agent/partner-group/responder-factory'
import type { PartnerRagDraftSource } from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import {
  createNotionRagAnswerSource,
  type NotionRagAnswerSourceDeps,
} from '@/lib/line-agent/partner-group/notion-rag-answer-source'
import { getPartnerResponderConfig } from '@/lib/line-agent/partner-group/responder-config'
import { ensurePartnerRagAnswerSourceInstalled } from '@/lib/line-agent/line/ensure-partner-rag-installed'
import { shouldReplyToPartnerGroup } from '@/lib/line-agent/line/partner-reply-gate'
import { sanitizeQuotedBotContext } from '@/lib/line-agent/partner-group/quoted-draft-customer-reply'
import { replyMessage, type LineMessage } from '@/lib/line-agent/line/message-client'
import { createDailyCostCap } from '@/lib/line-agent/observability/daily-cost-cap'
import { createKvClientFromEnv } from '@/lib/line-agent/storage/kv-store'
import { createCaseIntakeResponder } from '@/lib/line-agent/partner-group/case-intake-surfacing'
import { createAnthropicCaseIntakeSources } from '@/lib/line-agent/partner-group/case-intake-llm-adapter'
import { createAgentLogger } from '@/lib/line-agent/observability/structured-log'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Routing seam — injectable handler
// ---------------------------------------------------------------------------

/**
 * The normalized-event handler.
 *
 * A test (or future bootstrap) calls `setEventHandler(...)` to override the
 * default without modifying the POST handler.  The webhook AWAITS this handler
 * before returning its 200 so routing is guaranteed to run for each event.
 */
export type NormalizedEventHandler = (
  event: NormalizedLineEvent,
  store: CaseStore
) => Promise<void>

/**
 * Default handler: route the normalized event through the command router using
 * the safe default classifier (no API calls, no keys).  For OA customer events
 * the router persists the case via the reducer + store; a persistence failure
 * propagates as CasePersistenceError so the route can return 500.
 *
 * Partner-group SEND GATE (tagged-reply plan §3/§5): the router only *decides*
 * (it never sends).  Sending happens here and ONLY here, and ONLY when the pure
 * gate `shouldReplyToPartnerGroup` is satisfied — a tagged partner-group message
 * with non-empty responder text and a live reply token.  Customer OA events can
 * never satisfy the gate (condition 1 pins the source to the partner group), so
 * a customer is never auto-replied.
 *
 * A reply failure is suppressed (logged, not rethrown) so the webhook still acks
 * 200 — LINE redelivery would otherwise re-bill the model and disturb the other
 * events in the same batch.  The reply token's single-use semantics are the
 * primary duplicate-reply guard.
 */
/**
 * Cheap, event-only precondition for resolving the (possibly billed) responder:
 * the necessary conditions for a reply that do NOT depend on the routing
 * decision (source + tag + a live reply token).  It is intentionally a SUBSET of
 * `shouldReplyToPartnerGroup` — the full gate still runs post-routing before any
 * send.  Used only to avoid wasted model calls; it never authorises a send.
 */
/**
 * Derive the runtime "is the bot being addressed?" signal (quote-to-bot plan §3):
 *
 *   botDirected = mentionsBot || isBotAuthoredQuote
 *
 * `isBotAuthoredQuote` is computed ONLY for a partner-group `group_quoted` event
 * whose `quotedMessageId` hits the bot-authored store — i.e. the quoted message
 * is one THIS bot previously sent in the group, so quoting it (even without a
 * re-tag) counts as addressing the bot.  The customer OA plane is never consulted
 * (it can never be botDirected).  A store read failure is FAIL-SAFE: treat as
 * NOT bot-authored, so the worst case is the partner re-tags — never a spurious
 * reply or a billed model call.
 *
 * This NEVER mutates the normalizer's raw `event.mentionsBot`; it derives a
 * separate signal.  `defaultEventHandler` calls it first, then threads the
 * result through the precondition, router (B1/B2), and the send gate.
 */
export async function deriveBotDirected(
  event: NormalizedLineEvent,
  store: CaseStore
): Promise<boolean> {
  if (event.mentionsBot === true) return true // short-circuit: no store read needed

  const qid = event.quotedRef?.quotedMessageId
  if (
    event.sourceChannel === 'line_partner_group' &&
    event.kind === 'group_quoted' &&
    typeof qid === 'string' &&
    qid !== ''
  ) {
    try {
      return await store.isBotAuthoredPartnerMsg(qid)
    } catch {
      return false // fail-safe: cannot confirm bot-authored → not addressed
    }
  }

  return false
}

/**
 * Resolve the cached content of the bot-authored message a partner-group event
 * quoted (M3.6c quote-to-bot carryover). Returns the sanitized + length-capped
 * content ONLY for a bot-directed partner-group `group_quoted` event whose
 * quoted messageId has cached content; undefined otherwise.
 *
 * FAIL-SAFE: any store read failure returns undefined — the responder then takes
 * its conservative "ask the partner to paste the draft" fallback, never
 * fabricates the quoted content. The OA plane is never bot-directed, so a
 * customer message can never reach this read.
 */
async function resolveQuotedBotContent(
  event: NormalizedLineEvent,
  store: CaseStore,
  botDirected: boolean
): Promise<string | undefined> {
  if (
    !botDirected ||
    event.sourceChannel !== 'line_partner_group' ||
    event.kind !== 'group_quoted'
  ) {
    return undefined
  }
  const qid = event.quotedRef?.quotedMessageId
  if (typeof qid !== 'string' || qid === '') return undefined
  try {
    const raw = await store.getBotAuthoredPartnerMsgContent(qid)
    if (!raw) return undefined
    return sanitizeQuotedBotContext(raw)
  } catch {
    return undefined // fail-safe: cannot read content → responder fails closed
  }
}

function mayProducePartnerGroupReply(
  event: NormalizedLineEvent,
  botDirected: boolean
): boolean {
  return (
    event.sourceChannel === 'line_partner_group' &&
    botDirected === true &&
    typeof event.replyToken === 'string' &&
    event.replyToken.trim() !== ''
  )
}

const defaultEventHandler: NormalizedEventHandler = async (event, store) => {
  // 0. P0-A 刀 2 — one requestId per inbound event; every log line this message
  //    produces（收件→路由→LLM→送出）joins on it. The logger's field shapes are a
  //    closed union（codes/numbers only）so a token / message body / PII has no
  //    slot to leak through.
  const log = createAgentLogger({ requestId: randomUUID() })

  // 1. Derive the runtime bot-addressed signal: mentionsBot OR a quote-reply to
  //    a bot-authored partner-group message (quote-to-bot plan §3).  Fail-safe
  //    inside (store read failure → false); the customer OA plane is always
  //    false, so a customer can never be auto-replied.
  const botDirected = await deriveBotDirected(event, store)

  log('webhook_received', {
    channel: event.sourceChannel === 'line_partner_group' ? 'partner_group' : 'oa',
    messageKind: event.kind,
    botDirected,
  })

  // 1b. M3.6c — when this is a quote-to-bot message, fetch the cached content of
  //     the quoted bot draft (fail-safe inside) so the responder can turn it into
  //     a customer-safe summary. undefined ⇒ the responder fails closed and asks
  //     the partner to paste the draft; it never fabricates the quoted content.
  const quotedBotContent = await resolveQuotedBotContent(event, store, botDirected)

  // 2. Cheap precondition (a SUBSET of the full send gate): could this event
  //    even produce a reply? — partner group, addressed, live reply token.
  const replyCandidate = mayProducePartnerGroupReply(event, botDirected)

  // 3. Send-once secondary guard (tagged-reply plan §4).  Atomically claim the
  //    right to reply to THIS partner-group message BEFORE the (possibly billed)
  //    responder runs.  LINE delivers at-least-once and concurrent serverless
  //    instances may pick up the same event; the first caller claims and
  //    proceeds, every later caller loses the claim and returns immediately —
  //    no re-billed model call, no duplicate reply.  The reply token's
  //    single-use semantics remain the PRIMARY guard; this is the cross-instance
  //    backstop.
  //
  //    Empty messageId is NEVER deduped (mirrors the OA rule, handlers.ts:246):
  //    collapsing all id-less messages into one claim would silently drop
  //    replies.
  if (replyCandidate && event.messageId !== '') {
    const claimed = await store.claimPartnerReply(event.messageId)
    if (!claimed) {
      log('reply_skipped', { sendOutcome: 'skipped', reason: 'duplicate_claim' })
      return
    }
  }

  // 4. Resolve the REAL (possibly billed) responder ONLY when this event could
  //    actually produce a LINE reply.  Otherwise (OA inbound, not addressed,
  //    missing/expired reply token) the responder's text would be generated only
  //    to be discarded by the send gate — wasted model calls in anthropic mode.
  //    In those cases we pass no responder and routeCommand falls back to its
  //    free stub, so routing and the missing-replyToken warning below still work
  //    without burning a model.  `botDirected` is threaded so B1/B2 reach
  //    `respond` for a quote-to-bot message without a re-tag.
  const decision = await routeCommand({
    event,
    store,
    llmClassifier: safeDefaultLlmClassifier,
    botDirected,
    quotedBotContent,
    partnerGroupResponder: replyCandidate ? getPartnerGroupResponder() : undefined,
    log,
  })

  // 5. Full send gate (post-routing) — the only place a reply is authorised.
  if (shouldReplyToPartnerGroup(event, decision, botDirected)) {
    const outboundText = decision.handlerResult!.outboundText!
    try {
      const sentIds = await getReplyClient()(event.replyToken!, [
        { type: 'text', text: outboundText },
      ])
      log('reply_sent', { sendOutcome: 'ok' })
      // 6. Record the bot-authored ids so a future quote-reply to THIS message
      //    is itself botDirected (quote-to-bot plan §4).  M3.6c also caches the
      //    OUTBOUND text so a later quote can carry this reply's content into the
      //    responder context.  Best-effort: a store write failure must NOT disturb
      //    the already-sent reply, so each write is guarded — the worst case is the
      //    partner has to re-tag (and paste the draft) next time.  Code-only log:
      //    the raw store error could echo a KV url.
      for (const id of sentIds) {
        try {
          await store.putBotAuthoredPartnerMsg(id, outboundText)
        } catch {
          log('store_write_failed', { reason: 'bot_msg_record_failed' })
        }
      }
    } catch {
      // §5: a reply failure must NOT propagate (no 500) and must NOT fall back
      // to the customer plane or push.  Code-only log（the raw LINE error could
      // echo the channel token）; the webhook still acks 200.
      log('reply_sent', { sendOutcome: 'error', reason: 'line_reply_failed' })
    }
    return
  }

  // Diagnostic: a respond-worthy partner-group decision blocked ONLY by a
  // missing/expired reply token (the gate would pass with a token present).
  // We cannot reply without a token; surface it but still ack 200.
  if (
    !event.replyToken &&
    shouldReplyToPartnerGroup({ ...event, replyToken: 'probe' }, decision, botDirected)
  ) {
    log('reply_skipped', { sendOutcome: 'skipped', reason: 'missing_reply_token' })
    return
  }

  // Anything else that produced no send: not a reply candidate（OA / untagged /
  // no token from the start）or a non-respond routing decision. One line so a
  // message's trace always terminates in reply_sent OR reply_skipped.
  log('reply_skipped', {
    sendOutcome: 'skipped',
    reason: replyCandidate ? 'send_gate' : 'not_reply_candidate',
  })
}

let _eventHandler: NormalizedEventHandler = defaultEventHandler

/**
 * Override the normalized-event handler.  Called by tests or a future startup
 * bootstrap.  The handler must be idempotent — it may be called multiple times
 * in test environments.
 */
export function setEventHandler(handler: NormalizedEventHandler): void {
  _eventHandler = handler
}

/** Read the currently-registered handler (called per request by the route). */
export function getEventHandler(): NormalizedEventHandler {
  return _eventHandler
}

// ---------------------------------------------------------------------------
// Store seam — injectable store
// ---------------------------------------------------------------------------

/**
 * The shared CaseStore instance.
 *
 * Resolved LAZILY via selectStore() on first read so that:
 *   - importing this module never throws (the fail-closed throw for a
 *     production deployment missing KV env is deferred to the first request,
 *     where it surfaces as a 500 — LINE then retries);
 *   - a test or bootstrap can still inject an override via setStore() before
 *     the first getStore() call.
 */
let _store: CaseStore | null = null

/** Override the store (called by a future bootstrap or in tests). */
export function setStore(store: CaseStore): void {
  _store = store
}

/** Read the current store (called per request by the route). */
export function getStore(): CaseStore {
  if (_store === null) {
    _store = selectStore()
  }
  return _store
}

// ---------------------------------------------------------------------------
// Partner-group responder seam — injectable text producer
// ---------------------------------------------------------------------------

/**
 * The partner-group responder (produces the TEXT the bot would say after a tag;
 * it never sends — the webhook send gate owns that, added in a later task).
 *
 * Resolved LAZILY via the factory on first read so that:
 *   - importing this module never reads env / builds an adapter;
 *   - the default honours `AI_AGENT_PARTNER_RESPONDER_MODE` (defaults to the
 *     safe stub — an Anthropic key alone never auto-enables a billed model);
 *   - a test or bootstrap can inject an override via setPartnerGroupResponder().
 */
let _partnerGroupResponder: PartnerGroupResponder | null = null

/** Override the partner-group responder (called by a bootstrap or in tests). */
export function setPartnerGroupResponder(responder: PartnerGroupResponder): void {
  _partnerGroupResponder = responder
}

/**
 * Read the current partner-group responder (called per request by the handler).
 *
 * M3.2 wiring (design §6/§7): the default is the DISPATCHING responder — the M2
 * stub/anthropic `base` wrapped by `createPartnerGroupResponderWithRagDraft`.
 * Per message it routes to the rag path ONLY when `shouldUsePartnerRagDraft`
 * holds (partner group + botDirected + explicit intent + BOTH env gates on); the
 * gate is read per-respond, so wrapping is always safe — gate-off collapses to
 * `base` with zero Notion read, and the OA plane can never satisfy the predicate.
 *
 * The rag `answerSource` is bound LATE via the seam getter (mirroring the reply
 * client) so a test can inject a fake after this singleton is built. The
 * production default source is NOT wired to Notion this slice — it fails closed,
 * so flipping both gates on before the real retrieval lands yields the honest
 * `PARTNER_RAG_UNAVAILABLE_REPLY`, never a fabricated draft and never a Notion
 * read (design §5/§6).
 */
export function getPartnerGroupResponder(): PartnerGroupResponder {
  if (_partnerGroupResponder === null) {
    const models = getPartnerResponderConfig()
    // P0-A 刀 2 — daily LLM cost cap, KV-backed, 雙 fail-closed：cap env 未設
    // 或 KV 未接/壞掉 ⇒ the adapter degrades to the stub and the LLM is never
    // called. Constructing the KV client here is network-free. ONE shared
    // instance：base responder 與 case-intake enrichment 共用同一個每日預算。
    const costCap = createDailyCostCap({
      env: process.env,
      kv: createKvClientFromEnv(),
    })
    const base = createPartnerGroupResponder({
      models,
      transport: fetch,
      costCap,
    })
    // 客需三分流 LLM enrichment（design 2026-06-10 §1 LLM 刀）— 有 key 才組
    // enriched responder；無 key ⇒ deterministic-only（factory default）。
    // Gate `AI_AGENT_CASE_INTAKE_LLM_ENABLED` 由 responder 每次 respond 重讀，
    // default off ⇒ sources 永不被呼叫，零行為改變。
    const caseIntake = models.anthropicApiKey
      ? createCaseIntakeResponder({
          enrichment: createAnthropicCaseIntakeSources({
            transport: fetch,
            apiKey: models.anthropicApiKey,
            costCap,
            env: process.env,
          }),
        })
      : undefined
    _partnerGroupResponder = createPartnerGroupResponderWithRagDraft({
      base,
      caseIntake,
      // Late-bound thunk: always calls the CURRENTLY registered source, so a test
      // injecting a fake via setPartnerRagAnswerSource is honoured even though
      // this dispatcher singleton was built earlier.
      //
      // M3.2 decision C (rag-call-site-wiring-design §3): lazily install the real
      // cached Notion source on the FIRST rag-eligible request. This thunk runs
      // ONLY when `shouldUsePartnerRagDraft` already held (partner + botDirected +
      // explicit intent + both gates on), so the structural gate guards the
      // install — no extra env check here, and gate-off / OA / untagged / no-intent
      // never reach this line. `ensure` is idempotent + single-flight; a timeout or
      // installer error throws (NOT cached) and is converted by the rag responder's
      // try/catch into the unavailable reply — never a fabricated draft.
      answerSource: async (input) => {
        await ensurePartnerRagAnswerSourceInstalled()
        return getPartnerRagAnswerSource()(input)
      },
    })
  }
  return _partnerGroupResponder
}

// ---------------------------------------------------------------------------
// Partner-group RAG answer-source seam — injectable draft producer
// ---------------------------------------------------------------------------

/**
 * The rag draft producer (operator-safe body) consumed by the dispatching
 * responder. It is reached ONLY when every surfacing precondition holds
 * (partner group + botDirected + explicit intent + both gates on); on every
 * other message — and every OA event — the dispatcher routes to `base` and this
 * source is never invoked (no Notion read).
 *
 * The production default is intentionally NOT wired to Notion this slice: it
 * THROWS, which `createRagPartnerGroupResponder`'s try/catch converts into the
 * fail-closed `PARTNER_RAG_UNAVAILABLE_REPLY` (design §5). A real
 * retrieval+composeAnswer source is the next knife. A test injects a fake.
 */
let _partnerRagAnswerSource: PartnerRagDraftSource | null = null

/** Override the rag answer source (called by a bootstrap or in tests). */
export function setPartnerRagAnswerSource(source: PartnerRagDraftSource): void {
  _partnerRagAnswerSource = source
}

/** Read the current rag answer source (called late by the dispatcher thunk). */
export function getPartnerRagAnswerSource(): PartnerRagDraftSource {
  if (_partnerRagAnswerSource === null) {
    _partnerRagAnswerSource = async () => {
      // Not wired to Notion yet — fail closed (design §5/§6). Non-minified so the
      // misconfiguration (gates flipped on before the retrieval slice) is traceable.
      throw new Error('partner_rag_answer_source_not_wired')
    }
  }
  return _partnerRagAnswerSource
}

/**
 * Opt the runtime INTO the real cached Notion RAG answer source (design §6 cost
 * guard + "Next knife"). This is the deliberate installer: NOTHING calls it at
 * module load, so the production default above stays not-wired + fail-closed
 * unless a bootstrap explicitly invokes this. It does NOT flip any env gate — the
 * dispatcher's per-respond `shouldUsePartnerRagDraft` gate still governs whether
 * the installed source is ever reached (gate off ⇒ `base` runs, source untouched).
 *
 * The caller supplies the loader `client` (the real `@notionhq/client` adapter in
 * production, a fake in tests) so this module stays free of the SDK.
 */
export function installPartnerRagAnswerSource(deps: NotionRagAnswerSourceDeps): void {
  setPartnerRagAnswerSource(createNotionRagAnswerSource(deps))
}

// ---------------------------------------------------------------------------
// Reply client seam — the single LINE-send boundary for tagged replies
// ---------------------------------------------------------------------------

/**
 * Sends a reply to a partner-group event using its reply token.  This is the
 * ONLY place the tagged-reply path touches the LINE Messaging API; the router
 * and responder stay pure.  A test injects a recording fake via setReplyClient.
 */
export type ReplyClient = (
  replyToken: string,
  messages: LineMessage[]
) => Promise<string[]>

/**
 * The reply client.
 *
 * Resolved LAZILY so importing this module never reads env.  The default reads
 * `LINE_CHANNEL_ACCESS_TOKEN` at CALL time (not seam-build time) and delegates
 * to the real `replyMessage`; a missing token therefore surfaces as a
 * LineApiError caught by the send gate (log + 200), never an import-time throw.
 */
let _replyClient: ReplyClient | null = null

/** Override the reply client (called by a bootstrap or in tests). */
export function setReplyClient(client: ReplyClient): void {
  _replyClient = client
}

/** Read the current reply client (called by the send gate). */
export function getReplyClient(): ReplyClient {
  if (_replyClient === null) {
    _replyClient = (replyToken, messages) =>
      replyMessage(replyToken, messages, process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '')
  }
  return _replyClient
}
