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
import { routeCommand, type RouterInput } from '@/lib/line-agent/commands/router'
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
import { canUseExternalTool } from '@/lib/line-agent/tools/tool-gate'
import { loadToolConfig } from '@/lib/line-agent/tools/tool-config'
import { ensurePartnerRagAnswerSourceInstalled } from '@/lib/line-agent/line/ensure-partner-rag-installed'
import { shouldReplyToPartnerGroup } from '@/lib/line-agent/line/partner-reply-gate'
import { sanitizeQuotedBotContext } from '@/lib/line-agent/partner-group/quoted-draft-customer-reply'
import { replyMessage, type LineMessage } from '@/lib/line-agent/line/message-client'
import { createDailyCostCap } from '@/lib/line-agent/observability/daily-cost-cap'
import { createKvClientFromEnv } from '@/lib/line-agent/storage/kv-store'
import { createCaseIntakeResponder } from '@/lib/line-agent/partner-group/case-intake-surfacing'
import { createAnthropicCaseIntakeSources } from '@/lib/line-agent/partner-group/case-intake-llm-adapter'
import { createVisionIntakeResponder } from '@/lib/line-agent/partner-group/vision-intake-surfacing'
import { createAnthropicVisionIntakeSource } from '@/lib/line-agent/partner-group/vision-intake-adapter'
import { fetchLineImageContent } from '@/lib/line-agent/line/content-client'
import {
  archivePartnerGroupMessage,
  isTranscriptCaptureEnabled,
  TRANSCRIPT_OCR_SYSTEM_INSTRUCTION,
  TRANSCRIPT_OCR_USER_TEXT,
  type TranscriptOcr,
} from '@/lib/line-agent/transcript/archiver'
import {
  isDistillEnabled,
  runDistillation,
} from '@/lib/line-agent/distill/run-distillation'
import { resolveDistillApproval } from '@/lib/line-agent/distill/approval'
import {
  createAnthropicDistillSource,
  type DistillSource,
} from '@/lib/line-agent/distill/distill-llm-adapter'
import {
  createAnthropicApprovalIntentSource,
  type ApprovalIntentSource,
} from '@/lib/line-agent/distill/approval-llm-adapter'
// type-only — 靜態圖不拉 @notionhq/client；真 SDK 只在 composition root
// （install-default-distilled-qa-writer）dynamic import 時構建。
import type { DistilledQaWriter } from '@/lib/line-agent/distill/distilled-qa-writer'
import { resolveQaKnowledgeReadConfig } from '@/lib/line-agent/partner-group/qa-knowledge-config'
// type-only — 同上紀律：讀取 SDK 只在 install-default-qa-knowledge-source
// dynamic import 時構建，靜態圖零 @notionhq/client。
import type { QaKnowledgeSource } from '@/lib/line-agent/partner-group/qa-knowledge-source'
import {
  createAgentLogger,
  type AgentLogger,
} from '@/lib/line-agent/observability/structured-log'
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

/**
 * True iff a bot-directed partner-group event quotes a recorded partner-group
 * IMAGE message（圖片刀B：引用圖＋tag 即觸發）. FAIL-SAFE: a store read failure
 * returns false — vision simply does not trigger and the base responder's 刀A
 * honest clause owns the reply. The OA plane is never botDirected, so a
 * customer message can never reach this read.
 */
async function resolveQuotedImage(
  event: NormalizedLineEvent,
  store: CaseStore,
  botDirected: boolean
): Promise<boolean> {
  if (
    !botDirected ||
    event.sourceChannel !== 'line_partner_group' ||
    event.kind !== 'group_quoted'
  ) {
    return false
  }
  const qid = event.quotedRef?.quotedMessageId
  if (typeof qid !== 'string' || qid === '') return false
  try {
    return await store.isPartnerGroupImageMsg(qid)
  } catch {
    return false // fail-safe: cannot confirm it is an image → no vision trigger
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

  // 1a. 圖片刀B — mark partner-group image messageIds so a later quote-reply
  //     to one of them is recognised as「引用了一張圖」（引用圖＋tag 即觸發）.
  //     Best-effort: a store failure must never 500 the webhook (LINE would
  //     redeliver) — worst case the partner re-sends the image.  Code-only
  //     log: the raw store error could echo a KV url.  OA events never reach
  //     this branch (no partner-group sourceChannel), so the customer plane
  //     never feeds the vision path.
  if (
    event.kind === 'image' &&
    event.sourceChannel === 'line_partner_group' &&
    event.messageId !== ''
  ) {
    try {
      await store.putPartnerGroupImageMsg(event.messageId)
    } catch {
      log('store_write_failed', { reason: 'partner_image_record_failed' })
    }
  }

  // 1a-2. 沉澱管線刀1 — 旁聽存檔：夥伴群文字/截圖被動入 KV（TTL 30 天），
  //       截圖進群當下 OCR。閘 default off ⇒ 此行為不存在。archiver 內部
  //       fail-safe（吞錯）— 回覆優先於記錄，絕不堵 webhook。閘先查再取
  //       OCR seam，閘關時連 adapter 都不建。
  if (isTranscriptCaptureEnabled(process.env)) {
    await archivePartnerGroupMessage(event, store, {
      ocr: getTranscriptOcr(),
      env: process.env,
      log,
    })
  }

  // 1b. M3.6c — when this is a quote-to-bot message, fetch the cached content of
  //     the quoted bot draft (fail-safe inside) so the responder can turn it into
  //     a customer-safe summary. undefined ⇒ the responder fails closed and asks
  //     the partner to paste the draft; it never fabricates the quoted content.
  const quotedBotContent = await resolveQuotedBotContent(event, store, botDirected)

  // 1c. 圖片刀B — does this bot-directed message quote a recorded partner-group
  //     image?（引用圖＋tag 即觸發 vision、無關鍵詞）fail-safe ⇒ false.
  const quotedImage = await resolveQuotedImage(event, store, botDirected)

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
    quotedImage,
    partnerGroupResponder: replyCandidate ? getPartnerGroupResponder() : undefined,
    // 沉澱刀2 — distill seam：閘（AI_AGENT_DISTILL_ENABLED, default off）開＋
    // key 齊才注入；undefined ⇒ router 整條沉澱路徑不存在（ship 零行為改變）。
    // 夥伴群限定 — 沉澱只對 partner group 有意義；OA 客訊一律不跑 seam
    // builder（零 overhead，閘開＋key 缺的錯誤部署下也不會每則客訊都多一行
    // distill_api_key_missing 噪音）。
    distill:
      event.sourceChannel === 'line_partner_group'
        ? getDistillSeams(store, log)
        : undefined,
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
    // 檢索閉環刀 — 沉澱 QA 知識源。閘（QA_KNOWLEDGE_READ_ENABLED 三件齊）在
    // 這裡同步判：閘關 ⇒ undefined ⇒ adapter 行為 byte-identical、零 Notion 讀。
    // 閘開 ⇒ lazy thunk：首次呼叫才 dynamic import installer（靜態圖零 SDK，
    // mirror distilled-qa-writer 的 lazy seam）；installer 失敗 ⇒ 永久 null
    // source（fail-open，adapter 端照常 try-catch）。singleton scope：thunk 與
    // installed source 都掛在 responder singleton 上 — TTL 快取跨請求生效。
    const qaKnowledgeConfig = resolveQaKnowledgeReadConfig(process.env)
    let installedQaKnowledgeSource: QaKnowledgeSource | null = null
    const knowledgeSource = qaKnowledgeConfig.enabled
      ? async () => {
          if (installedQaKnowledgeSource === null) {
            const mod = await import('./install-default-qa-knowledge-source')
            const built = mod.buildDefaultQaKnowledgeSource()
            if (!built.source) {
              // Fixed reason code only（installer 已吞 raw error）— 永久降級前留痕，
              // 不然 reason 被丟掉就 unobservable（Task 6 review Important）。
              console.warn(`[qa-knowledge] install failed — reason=${built.reason ?? 'unknown'}`)
            }
            installedQaKnowledgeSource = built.source ?? (async () => null)
          }
          return installedQaKnowledgeSource()
        }
      : undefined
    // 外部佐證刀 — composition root 判 web_search 閘：用 tool-gate 本人判
    //（單一事實來源，不重複 env 解析）。sourceChannel / botDirected 帶
    // 「夥伴群＋bot-directed」的前提值 — base responder 只會被這種訊息觸發，
    // adapter 內另有 per-request 防衛性收窄。
    const webSearchGate = canUseExternalTool(
      {
        tool: 'web_search',
        sourceChannel: 'line_partner_group',
        botDirected: true,
        userRequestedExternalData: false, // 刀1 後 web_search 不看此關（tag 即授權）
        costSpentUsd: 0,
      },
      loadToolConfig(process.env)
    )
    const base = createPartnerGroupResponder({
      models,
      transport: fetch,
      costCap,
      knowledgeSource,
      webSearchEnabled: webSearchGate.allowed,
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
    // 圖片刀B — 讀圖 responder：有 key 才組；無 key ⇒ 路徑不存在。Surfacing
    // 走 M3-0 ocr 雙閘（AI_AGENT_OCR_ENABLED + AI_AGENT_TOOL_COST_CAP_USD，
    // default off）⇒ 不開閘完全不影響現行行為。觸發＝引用圖＋tag（quotedImage
    // 由 handler 以 store 判定後線入 respondInput）。fetchImage 的 channel
    // token 在 CALL time 讀（mirror reply client）。共用同一個 daily cost cap。
    const visionIntake = models.anthropicApiKey
      ? createVisionIntakeResponder({
          fetchImage: (messageId) =>
            fetchLineImageContent(messageId, process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''),
          vision: createAnthropicVisionIntakeSource({
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
      visionIntake,
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

// ---------------------------------------------------------------------------
// Transcript OCR seam — 沉澱管線刀1（旁聽存檔的截圖轉錄）
// ---------------------------------------------------------------------------

/**
 * 旁聽存檔的截圖 OCR（messageId → 轉錄文字）。LAZY：首讀才建；無 Anthropic
 * key ⇒ null（截圖仍入檔但 text=''）。與圖片刀B 共用 content-client 與
 * daily cost cap 工廠（同一個每日預算池 — KV 計量是跨 instance 的），但
 * prompt 是沉澱專用的全文轉錄版、max_tokens 調高（全文轉錄比客需抽取長，
 * 截斷偵測在 adapter 內 log）。閘（AI_AGENT_TRANSCRIPT_ENABLED）由 handler
 * 把守，這裡只負責「能不能轉錄」。
 */
const TRANSCRIPT_OCR_MAX_TOKENS = 2048

let _transcriptOcr: TranscriptOcr | null | undefined = undefined

/** Override（測試注入 fake；null ⇒ 無 OCR 退化）。 */
export function setTranscriptOcr(ocr: TranscriptOcr | null): void {
  _transcriptOcr = ocr
}

/** Read the current transcript OCR（handler 在閘開時呼叫）。 */
export function getTranscriptOcr(): TranscriptOcr | null {
  if (_transcriptOcr === undefined) {
    const models = getPartnerResponderConfig()
    if (!models.anthropicApiKey) {
      _transcriptOcr = null
    } else {
      const vision = createAnthropicVisionIntakeSource({
        transport: fetch,
        apiKey: models.anthropicApiKey,
        costCap: createDailyCostCap({ env: process.env, kv: createKvClientFromEnv() }),
        systemInstruction: TRANSCRIPT_OCR_SYSTEM_INSTRUCTION,
        userText: TRANSCRIPT_OCR_USER_TEXT,
        maxTokens: TRANSCRIPT_OCR_MAX_TOKENS,
      })
      _transcriptOcr = async (messageId) => {
        // Channel token 在 CALL time 讀（mirror reply client）。
        const image = await fetchLineImageContent(
          messageId,
          process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''
        )
        return vision(image)
      }
    }
  }
  return _transcriptOcr
}

// ---------------------------------------------------------------------------
// Distill seam — 沉澱刀2（「沉澱」指令＋批准語句的 webhook 接線）
// ---------------------------------------------------------------------------

/**
 * 沉澱 LLM source（織好的 promptText → raw model text）。LAZY singleton
 * （mirror getTranscriptOcr）：沉澱指令真的來才建 — 平日訊息流零 adapter
 * 構建、零 KV client 構建。transport 用全域 fetch；cost cap 走同一個
 * daily 工廠（KV 計量跨 instance，與其他 LLM 路徑共用每日預算池）。
 * adapter 內部 log 用它的 default（requestId '-'）— singleton 不能綁第一
 * 個 request 的 logger（同 getTranscriptOcr 前例）。
 */
let _distillSource: DistillSource | null = null

/** Override（測試注入 fake；null ⇒ 重置回 lazy default — 測試間不串味）。 */
export function setDistillSource(source: DistillSource | null): void {
  _distillSource = source
}

function getDistillSource(): DistillSource {
  if (_distillSource === null) {
    _distillSource = createAnthropicDistillSource({
      transport: fetch,
      apiKey: getPartnerResponderConfig().anthropicApiKey,
      costCap: createDailyCostCap({ env: process.env, kv: createKvClientFromEnv() }),
      env: process.env,
    })
  }
  return _distillSource
}

/**
 * 刀A 層2 source — 批准語句的 LLM intent parser（Haiku）。LAZY singleton，
 * 組法逐行 mirror getDistillSource：同 transport（全域 fetch）、同 apiKey、
 * 同一個 daily cost cap 工廠（KV 計量跨 instance，與其他 LLM 路徑共用每日
 * 預算池 — costCap 必接，忘了接永不等於無上限燒錢）。adapter 內部 log 用它
 * 的 default（requestId '-'）— singleton 不能綁第一個 request 的 logger
 * （同 getDistillSource / getTranscriptOcr 前例）。
 */
let _approvalIntentSource: ApprovalIntentSource | null = null

/** Override（測試注入 fake；null ⇒ 重置回 lazy default — 測試間不串味）。 */
export function setApprovalIntentSource(source: ApprovalIntentSource | null): void {
  _approvalIntentSource = source
}

function getApprovalIntentSource(): ApprovalIntentSource {
  if (_approvalIntentSource === null) {
    _approvalIntentSource = createAnthropicApprovalIntentSource({
      transport: fetch,
      apiKey: getPartnerResponderConfig().anthropicApiKey,
      costCap: createDailyCostCap({ env: process.env, kv: createKvClientFromEnv() }),
      env: process.env,
    })
  }
  return _approvalIntentSource
}

/**
 * 刀3 knowledge writer — LAZY singleton（mirror getDistillSource）：批准語句
 * 真的來才 dynamic import composition root（靜態圖零 @notionhq/client）。
 * 三態：undefined＝未解析（下一則批准會重 resolve）、null＝config 終態 off
 * （閘關/缺 token/缺 db — env 在 instance 生命週期內不變，cache 免每則批准
 * 重 resolve）、writer＝on。例外：`sdk_init_failed` 不 cache —— 那是 runtime
 * 構建失敗而非 config，transient 失敗不得永久關閘；留 undefined 讓下一則
 * 批准重試（log 照發、ack 照 dry-run）。
 */
let _distilledQaWriter: DistilledQaWriter | null | undefined // undefined＝未解析

/** Override（測試注入 fake；null ⇒ 重置回 lazy default）。 */
export function setDistilledQaWriter(writer: DistilledQaWriter | null): void {
  _distilledQaWriter = writer ?? undefined
}

async function getDistilledQaWriter(
  log: AgentLogger
): Promise<DistilledQaWriter | undefined> {
  if (_distilledQaWriter !== undefined) return _distilledQaWriter ?? undefined
  const mod = await import('./install-default-distilled-qa-writer')
  const result = mod.buildDefaultDistilledQaWriter()
  if (!result.writer) {
    if (result.reason !== 'disabled') {
      log('route_decision', { reason: `distill_write_${result.reason}` })
    }
    if (result.reason !== 'sdk_init_failed') {
      _distilledQaWriter = null // config 終態 cache — 形同閘關
    }
    // sdk_init_failed ⇒ 不 cache（_distilledQaWriter 留 undefined）— 下一則批准重試
    return undefined
  }
  _distilledQaWriter = result.writer
  return result.writer
}

/**
 * 組 router 的 distill seam（RouterInput['distill']）— 每事件呼叫，但只做
 * 兩個 env 讀（網路零、構建零）：
 *   - 閘（AI_AGENT_DISTILL_ENABLED, default off）關 ⇒ undefined — router
 *     整條沉澱路徑不存在，ship 零行為改變。
 *   - 閘開但 ANTHROPIC_API_KEY 缺 ⇒ undefined＋一行 fixed-code log（形同
 *     閘關 — 絕不炸 webhook，部署缺 key 可從 log 追到）。
 *   - approve 是刀A 三層接話：層1 regex 仍在最前（resolveDistillApproval
 *     內，零成本零延遲）；parse-first 契約演化（design 2026-06-12 §1）—
 *     regex miss＋無 pending ＝ 一次 KV 讀即落回 responder（讀失敗也回
 *     null — KV 故障時無 pending 路徑絕不劫持日常問答）；writer 是 lazy thunk — 非批准
 *     路徑零初始化。
 */
function getDistillSeams(
  store: CaseStore,
  log: AgentLogger
): RouterInput['distill'] | undefined {
  if (!isDistillEnabled(process.env)) return undefined
  if (getPartnerResponderConfig().anthropicApiKey === '') {
    log('route_decision', { reason: 'distill_api_key_missing' })
    return undefined
  }
  return {
    run: (groupId) =>
      runDistillation({
        groupId,
        store,
        source: getDistillSource(),
        now: Date.now(),
        log,
      }),
    approve: async (groupId, text, ctx) =>
      // 三層接話 orchestrator：層1 regex → 複述確認 → 層2 LLM intent →
      // 層3 deterministic 套用（超界整批拒絕在 applyDistillApproval 裡）。
      // ctx.quotedBotContent：複述確認比對＋free-form 消歧的引用 context。
      resolveDistillApproval({
        store,
        groupId,
        text,
        quotedBotContent: ctx?.quotedBotContent,
        now: Date.now(),
        log,
        getKnowledgeWriter: () => getDistilledQaWriter(log),
        intentSource: getApprovalIntentSource(),
      }),
  }
}
