/**
 * handlers.ts
 *
 * Handler stubs dispatched to by the command router.
 *
 * Each handler accepts a typed context and returns a structured placeholder
 * result.  Full implementation is planned for later Tasks (7, 8, 9+).  The
 * goal here is to wire the routing + permission system; stubs keep the
 * TypeScript types sound and allow tests to confirm the right handler is
 * reached without executing real logic.
 */

import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { OperatorCommand } from '../operator/operator-command'
import type { CommandIntent } from './intent'
import type { AgentLogger } from '../observability/structured-log'
import {
  stubPartnerGroupResponder,
  type PartnerGroupResponder,
} from '../partner-group/responder'
import type { CaseStore } from '../storage/store'
import type { AgentCase } from '../cases/case-state'
import { TERMINAL_STATUSES } from '../cases/case-state'
import { createInitialCase } from '../cases/case-state'
import { caseReducer } from '../cases/case-reducer'
import { CasePersistenceError } from '../errors'
import { buildCaseTriage, type CaseTriageSummary } from './case-triage'
import {
  safeDefaultCustomerClassifier,
  type CustomerEventCategory,
  type CustomerEventClassifier,
  type ClassifyMessageType,
} from '../cases/customer-event'
import {
  resolveInboxZone,
  compareWithinZone,
  INBOX_ZONE_ORDER,
  type InboxZone,
} from '../cases/inbox-zone'
import { deriveReminderCandidate, type ReminderCandidate } from '../cases/reminder'

// ---------------------------------------------------------------------------
// Idempotency tuning
// ---------------------------------------------------------------------------

/**
 * Most recent LINE messageIds retained per case for redelivery de-duplication.
 * The set exists only to absorb LINE's at-least-once redelivery window, so it
 * is bounded FIFO — once a case exceeds this many distinct messages the oldest
 * ids are evicted.  MVP value; revisit (TTL / event-store) only if real case
 * volume ever outgrows it.
 */
const MAX_PROCESSED_MESSAGE_IDS = 200

// ---------------------------------------------------------------------------
// Handler result type
// ---------------------------------------------------------------------------

export interface HandlerResult {
  /** The handler that was called. */
  handler: string
  /** Placeholder status — real handlers will return richer structs. */
  status: 'stub_ok' | 'stub_skipped' | 'error'
  /**
   * The plain text to reply into the partner group, when this handler produced
   * one (currently only handleRespondToPartnerGroup).  This is the FIXED field
   * for "would-be reply" so impls don't each invent their own.  Carrying text
   * here does NOT mean it was sent — the router + permission layer (B4
   * sendTarget) still own the decision to actually post.
   */
  outboundText?: string
  /** Optional diagnostic data for testing or audit. */
  meta?: Record<string, unknown>
}

export interface CaseSummary {
  caseId: string
  status: AgentCase['status']
  customerDisplayName: string
  lastCustomerMessageAt: string
  latestCustomerMessageText: string
  messageCount: number
  missingFields: string[]
  triage: CaseTriageSummary
  /** Latest customer-event category (advisory), if classified. */
  eventCategory?: CustomerEventCategory
  /** SLA inbox zone derived at read-time (design §6). */
  zone: InboxZone
  /** Reminder candidate derived at read-time (design §5), or null. */
  reminder: ReminderCandidate | null
}

export type CustomerDisplayNameResolver = (
  agentCase: AgentCase
) => Promise<string | null>

export interface ListRecentCasesOptions {
  limit?: number
  resolveCustomerDisplayName?: CustomerDisplayNameResolver
  /**
   * ISO-8601 "now", injected so zone/reminder age math stays deterministic.
   * Defaults to the wall clock when omitted (the operator `/inbox` route does
   * not pin a clock; only tests need determinism).
   */
  now?: string
}

// ---------------------------------------------------------------------------
// Respond handler — reply in the partner group after a tagged message
// ---------------------------------------------------------------------------

export async function handleRespondToPartnerGroup(
  event: NormalizedLineEvent,
  intent: CommandIntent,
  responder: PartnerGroupResponder = stubPartnerGroupResponder,
  botDirected?: boolean,
  quotedBotContent?: string,
  log?: AgentLogger
): Promise<HandlerResult> {
  // The responder ONLY produces text; it never sends. Whether outboundText
  // actually reaches the group is decided by the router + permission layer.
  //
  // `botDirected` is threaded from the router (mentionsBot OR quote-to-bot) so a
  // dispatching responder (M3.2 rag draft) can reach the rag path for a
  // quote-to-bot message without a re-tag; absent, consumers fall back to
  // `event.mentionsBot`.  It does NOT change the send decision — that stays the
  // router's job.
  //
  // `quotedBotContent` (M3.6c) is the cached content of the quoted bot draft,
  // resolved + sanitized by the webhook. It lets the customer-summary path fire;
  // absent, that path fails closed (asks the partner to paste the draft).
  const result = await responder.respond({
    event,
    intent,
    text: event.text ?? '',
    actor: { lineUserId: event.lineUserId },
    ...(botDirected !== undefined ? { botDirected } : {}),
    ...(quotedBotContent !== undefined ? { quotedBotContent } : {}),
    ...(log !== undefined ? { log } : {}),
  })

  return {
    handler: 'handleRespondToPartnerGroup',
    status: 'stub_ok',
    outboundText: result.text,
    meta: { kind: event.kind, action: intent.action, responder: result.meta },
  }
}

// ---------------------------------------------------------------------------
// Case creation handler — when an OA customer message arrives
// ---------------------------------------------------------------------------

/**
 * Injectable seams for the case handler.  Defaults keep production
 * collision-safe and deterministic while letting tests pin exact values.
 */
export interface CaseHandlerDeps {
  /**
   * Deterministic caseId generator.  Default is messageId-based — unique per
   * LINE message and collision-safe, and only ever called on case CREATION
   * (the first message), so the id stays stable for the case's lifetime.
   * MUST NOT use listAll().length + 1 (races under concurrent invocations).
   */
  generateCaseId?: (event: NormalizedLineEvent) => string
  /**
   * Resolve the customer display name.  Default is a fallback derived from the
   * lineUserId — we deliberately do NOT call the LINE profile API on the
   * webhook path (a profile fetch must never block or fail the webhook).
   * Enriching displayName via a profile fetch is a later follow-up.
   */
  resolveDisplayName?: (event: NormalizedLineEvent) => string
  /**
   * Customer-event classifier (advisory).  Default is the safe, key-less
   * deterministic-first classifier; tests may inject a stub.  The result NEVER
   * widens permissions and NEVER triggers a reply/push — it only annotates the
   * case for `/inbox` zoning and reminders.
   */
  classifier?: CustomerEventClassifier
}

function defaultCaseId(event: NormalizedLineEvent): string {
  return `CW-${event.messageId}`
}

function defaultDisplayName(event: NormalizedLineEvent): string {
  // Fallback only — no profile API call. Short, stable, non-empty.
  return `LINE-${event.lineUserId.slice(0, 8)}`
}

/**
 * Map a normalized event kind to the classifier's message-type input.
 *
 * `unknown_group` covers everything the normalizer can't type (sticker, audio,
 * video, location, …).  For an OA CUSTOMER such a message is very likely
 * meaningful (a pinned location, a voice note, a video) and must NOT be silenced
 * into non_actionable — we conservatively treat it as media that needs a human
 * to look at.  Only group-side unknowns fall through to sticker/non_actionable.
 * Once the normalizer distinguishes a genuine `sticker` type, real stickers can
 * be muted again (review P1).
 */
function messageTypeFromKind(
  kind: NormalizedLineEvent['kind'],
  sourceChannel: NormalizedLineEvent['sourceChannel']
): ClassifyMessageType {
  switch (kind) {
    case 'image':
      return 'image'
    case 'file':
      return 'file'
    case 'unknown_group':
      // OA customer unknown → needs human (media_or_ocr_needed); group → sticker.
      return sourceChannel === 'line_oa' ? 'file' : 'sticker'
    default:
      // oa_text / group_text / group_quoted
      return 'text'
  }
}

/**
 * Load-or-create the case for an OA customer message, apply the reducer for the
 * incoming message, persist the new state, and append the audit entry.
 *
 * This NEVER replies to the customer — the official OA is receive-only.  The
 * result is purely internal case state.
 */
export async function handleCreateOrUpdateCase(
  event: NormalizedLineEvent,
  store: CaseStore,
  deps: CaseHandlerDeps = {}
): Promise<HandlerResult> {
  const now = new Date(event.timestamp).toISOString()

  // Wrap ONLY store I/O so a persistence failure surfaces as a typed
  // CasePersistenceError → webhook returns 500 → LINE retries.  The pure
  // reducer below is intentionally NOT wrapped: a logic guard must not be
  // misclassified as a transient persistence failure (it would retry forever).
  const persist = async <T>(op: () => Promise<T>): Promise<T> => {
    try {
      return await op()
    } catch (err) {
      if (err instanceof CasePersistenceError) throw err
      throw new CasePersistenceError(event.lineUserId, { cause: err })
    }
  }

  const existing = await persist(() => store.getByLineUserId(event.lineUserId))
  const created = existing === null

  const current =
    existing ??
    createInitialCase({
      caseId: (deps.generateCaseId ?? defaultCaseId)(event),
      lineUserId: event.lineUserId,
      customerDisplayName: (deps.resolveDisplayName ?? defaultDisplayName)(event),
      now,
    })

  // ── Idempotency gate (LINE at-least-once delivery) ───────────────────────
  // LINE may redeliver the SAME event (e.g. after a 500 retry).  If this
  // messageId was already folded into the case, skip the reducer/persist
  // entirely so we never grow a duplicate audit entry or re-bump timestamps.
  // Empty messageId (a message that arrived without an id) is NEVER deduped —
  // collapsing all id-less messages into one would silently drop real ones.
  const messageId = event.messageId
  const seen = current.processedMessageIds ?? []
  if (messageId !== '' && seen.includes(messageId)) {
    return {
      handler: 'handleCreateOrUpdateCase',
      status: 'stub_skipped',
      meta: {
        caseId: current.caseId,
        created: false,
        deduped: true,
        status: current.status,
        kind: event.kind,
        sourceChannel: event.sourceChannel,
      },
    }
  }

  const prevAudit = created ? [] : await persist(() => store.getAudit(current.caseId))

  // Reuse the canonical reducer — do not reimplement transitions here.
  const { case: nextCase, audit } = caseReducer(
    current,
    {
      type: 'line_oa_message',
      lineUserId: event.lineUserId,
      messageId: event.messageId,
      text: event.text ?? '',
      now,
    },
    prevAudit
  )

  // Record the messageId so a later redelivery is recognised as a duplicate.
  // Only non-empty ids participate in the idempotency set (see gate above).
  // The set is capped FIFO at MAX_PROCESSED_MESSAGE_IDS so a long-lived case
  // never grows an unbounded KV value; the oldest ids fall out of the window.
  const caseToPersist: AgentCase =
    messageId === ''
      ? nextCase
      : {
          ...nextCase,
          processedMessageIds: [...seen, messageId].slice(-MAX_PROCESSED_MESSAGE_IDS),
        }

  // ── Advisory customer-event classification (write-time, design §3) ───────
  // Done here (not at read-time) because media/postback events cannot be
  // reclassified from the stored text alone.  The classifier performs NO I/O
  // by default and the result is purely advisory — it annotates the case for
  // `/inbox` zoning/reminders and never triggers a reply, push or permission
  // change.  `hasPriorMessages` reflects the case state BEFORE this message.
  const classifier = deps.classifier ?? safeDefaultCustomerClassifier
  const classification = await classifier.classify({
    text: event.text ?? '',
    messageType: messageTypeFromKind(event.kind, event.sourceChannel),
    isPostback: false, // normalizer does not surface postback in M2 (Open Item)
    hasPriorMessages: (current.customerMessages?.length ?? 0) > 0,
    missingFields: caseToPersist.missingFields,
    now,
  })

  const classifiedCase: AgentCase = {
    ...caseToPersist,
    latestEventCategory: classification.category,
    latestClassifiedAt: classification.classifiedAt,
  }

  await persist(() => store.put(classifiedCase))
  await persist(() => store.appendAudit(classifiedCase.caseId, audit[audit.length - 1]))

  return {
    handler: 'handleCreateOrUpdateCase',
    status: 'stub_ok',
    meta: {
      caseId: classifiedCase.caseId,
      created,
      status: classifiedCase.status,
      eventCategory: classifiedCase.latestEventCategory,
      kind: event.kind,
      sourceChannel: event.sourceChannel,
    },
  }
}

// ---------------------------------------------------------------------------
// Draft handler — prepare a message but do NOT send to LINE
// ---------------------------------------------------------------------------

export async function handleDraft(
  command: OperatorCommand,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleDraft',
    status: 'stub_ok',
    meta: { action: intent.action, actor: command.actor },
  }
}

// ---------------------------------------------------------------------------
// List recent cases handler — private/operator read path
// ---------------------------------------------------------------------------

const HOUR_MS = 3_600_000
const NEW_INQUIRY_SLA_HOURS = 4

/**
 * Escalation keywords (design §8) — medical/safety risk or competitor/price
 * comparison.  First batch is keyword-only; spam/duplicate detection is a later
 * milestone.  No match → not an escalation.
 */
const ESCALATION_PATTERN =
  /過敏|生病|發燒|发烧|發炎|受傷|受伤|急診|急诊|醫院|医院|住院|出事|危險|危险|比價|比价|別家|别家|其他家|更便宜|kkday|klook/i

export async function handleListRecentCases(
  store: CaseStore,
  options: number | ListRecentCasesOptions = 5
): Promise<HandlerResult> {
  const limit = typeof options === 'number' ? options : options.limit ?? 5
  const resolveCustomerDisplayName =
    typeof options === 'number' ? undefined : options.resolveCustomerDisplayName
  const now =
    typeof options === 'number' ? new Date().toISOString() : options.now ?? new Date().toISOString()
  const nowMs = Date.parse(now)

  const all = await store.listAll()

  // Enrich EVERY active case (zone/reminder/triage are cheap, no I/O) BEFORE
  // limiting — otherwise an old-but-urgent case (needs_eric / overdue quote)
  // outside the recency window would be sliced off before zoning ever runs
  // (review P1).  Display-name resolution (the only I/O) is deferred to the
  // final slice so we never make N profile calls.
  const enriched = all
    .filter((c) => !TERMINAL_STATUSES.has(c.status))
    .map((c) => {
      const triage = buildCaseTriage(c)
      const hasUnansweredQuestion = (triage.knownFacts.questions?.length ?? 0) > 0
      const messageText = (c.customerMessages ?? []).map((m) => m.text).join('\n')
      const isEscalation = ESCALATION_PATTERN.test(messageText)
      const newInquiryOverdue =
        c.status === 'new_inquiry' &&
        (nowMs - Date.parse(c.lastCustomerMessageAt)) / HOUR_MS > NEW_INQUIRY_SLA_HOURS

      const zone = resolveInboxZone({
        status: c.status,
        latestEventCategory: c.latestEventCategory,
        hasUnansweredQuestion,
        isEscalation,
        newInquiryOverdue,
      })

      const reminder = deriveReminderCandidate({
        caseId: c.caseId,
        status: c.status,
        latestEventCategory: c.latestEventCategory,
        hasUnansweredQuestion,
        lastCustomerMessageAt: c.lastCustomerMessageAt,
        now,
      })

      return { agentCase: c, triage, zone, reminder }
    })

  // Order by zone (needs_eric pinned top), then within-zone urgency (§6.3),
  // and ONLY THEN take the top `limit` — so urgency, not recency, decides what
  // survives the cut.
  const zoneRank = (z: InboxZone): number => INBOX_ZONE_ORDER.indexOf(z)
  enriched.sort((a, b) => {
    const byZone = zoneRank(a.zone) - zoneRank(b.zone)
    if (byZone !== 0) return byZone
    return compareWithinZone(
      {
        severity: a.reminder?.severity,
        ageHours: a.reminder?.ageHours ?? 0,
        lastCustomerMessageAt: a.agentCase.lastCustomerMessageAt,
      },
      {
        severity: b.reminder?.severity,
        ageHours: b.reminder?.ageHours ?? 0,
        lastCustomerMessageAt: b.agentCase.lastCustomerMessageAt,
      }
    )
  })

  const cases: CaseSummary[] = await Promise.all(
    enriched.slice(0, limit).map(async ({ agentCase: c, triage, zone, reminder }) => {
      const messages = c.customerMessages ?? []
      const resolvedDisplayName =
        (await resolveCustomerDisplayName?.(c).catch(() => null)) ?? c.customerDisplayName

      return {
        caseId: c.caseId,
        status: c.status,
        customerDisplayName: resolvedDisplayName,
        lastCustomerMessageAt: c.lastCustomerMessageAt,
        latestCustomerMessageText: messages.at(-1)?.text ?? '',
        messageCount: messages.length,
        missingFields: [...triage.missingFields],
        triage,
        eventCategory: c.latestEventCategory,
        zone,
        reminder,
      }
    })
  )

  return {
    handler: 'handleListRecentCases',
    status: 'stub_ok',
    meta: { cases, count: cases.length },
  }
}

// ---------------------------------------------------------------------------
// Post-to-partner-group handler — send a prepared message to the LINE group
// ---------------------------------------------------------------------------

export async function handlePostToPartnerGroup(
  command: OperatorCommand,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handlePostToPartnerGroup',
    status: 'stub_ok',
    meta: {
      action: intent.action,
      actor: command.actor,
      sendTarget: command.sendTarget,
    },
  }
}

// ---------------------------------------------------------------------------
// Triage handler — analyse an incoming case (stub)
// ---------------------------------------------------------------------------

export async function handleTriage(
  event: NormalizedLineEvent,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleTriage',
    status: 'stub_ok',
    meta: { action: intent.action, kind: event.kind },
  }
}

// ---------------------------------------------------------------------------
// Parse-review handler — run itinerary/quote parse dry-run (stub)
// ---------------------------------------------------------------------------

export async function handleParseReview(
  event: NormalizedLineEvent
): Promise<HandlerResult> {
  return {
    handler: 'handleParseReview',
    status: 'stub_ok',
    meta: { kind: event.kind },
  }
}

// ---------------------------------------------------------------------------
// Bug-packet handler — create a structured bug report (stub)
// ---------------------------------------------------------------------------

export async function handleBugPacket(
  event: NormalizedLineEvent,
  intent: CommandIntent
): Promise<HandlerResult> {
  return {
    handler: 'handleBugPacket',
    status: 'stub_ok',
    meta: { action: intent.action, kind: event.kind },
  }
}

// ---------------------------------------------------------------------------
// Silent / no-op handler — used for casual chat that should be ignored
// ---------------------------------------------------------------------------

export function handleSilent(): HandlerResult {
  return {
    handler: 'handleSilent',
    status: 'stub_skipped',
  }
}
