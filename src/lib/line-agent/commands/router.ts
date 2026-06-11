/**
 * router.ts
 *
 * Command router — routes a (source, event/command, intent) tuple to an
 * action decision AFTER consulting the permission layer.
 *
 * Design rules:
 * 1. Deterministic dispatch for KNOWN commands FIRST (a command table).
 * 2. LLM intent classification ONLY as fallback via the injected seam.
 * 3. The permission layer ALWAYS gates the final action — LLM can NEVER widen
 *    permissions.
 * 4. Every routing decision returns a typed RouterDecision with action, source,
 *    and (on denial) a reason.
 */

import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { OperatorCommand } from '../operator/operator-command'
import {
  classifyIntent,
  type LlmIntentClassifier,
  type CommandIntent,
} from './intent'
import {
  canRespondToPartnerGroupTag,
  shouldIgnoreCasualPartnerGroupChat,
  canAutoReplyToOaCustomer,
  canPostToPartnerGroupFromDC,
  canPartnerGroupTriggerDevAction,
} from '../permissions'
import {
  handleRespondToPartnerGroup,
  handleCreateOrUpdateCase,
  handleDraft,
  handleListRecentCases,
  handlePostToPartnerGroup,
  handleSilent,
  type HandlerResult,
  type CaseHandlerDeps,
  type CustomerDisplayNameResolver,
} from './handlers'
import type { AgentSourceChannel } from '../types'
import type { CaseStore } from '../storage/store'
import { parseCaseDoneCommand, markCaseHandled } from '../cases/handled-command'
import { createQuote, type CreateQuoteResult } from '../quote/create-quote'
import {
  stubPartnerGroupResponder,
  type PartnerGroupResponder,
} from '../partner-group/responder'
import type { AgentLogger } from '../observability/structured-log'
import { isDistillCommand } from '../distill/run-distillation'

// ---------------------------------------------------------------------------
// Phase C dry-run quote payload
// ---------------------------------------------------------------------------

/**
 * Raw payload for an explicit DC create-quote command.
 *
 * Carries the raw itinerary/quote text plus deterministic seams (origin,
 * timestamp) so the dry-run stays reproducible in tests.
 *
 * SAFETY: there is intentionally NO writer field here. The router ALWAYS lets
 * createQuote default to the dry-run writer, so the live writer / any Sanity
 * write token is structurally unreachable from this path.
 */
export interface QuoteDryRunInput {
  /** Raw itinerary text (the day-by-day plan). */
  itineraryText: string
  /** Raw quotation text (the priced breakdown). */
  quoteText: string
  /** Site origin for URL composition, e.g. https://chiangway-travel.com */
  origin: string
  /** ISO-8601 timestamp — injected so the audit entry stays deterministic. */
  timestamp: string
  /** Optional year hint passed through to the parsers. */
  year?: number
}

// ---------------------------------------------------------------------------
// Router input — either an event (LINE) or a command (DC/operator)
// ---------------------------------------------------------------------------

export interface RouterInput {
  /** Normalized LINE event — present for LINE-sourced inputs. */
  event?: NormalizedLineEvent
  /** Parsed operator command — present for DC/operator-sourced inputs. */
  command?: OperatorCommand
  /** Injected LLM classifier (stub in tests, real adapter in production). */
  llmClassifier: LlmIntentClassifier
  /**
   * Durable case store.  REQUIRED for OA customer events (they persist a case);
   * unused for partner-group / operator-command paths.
   */
  store?: CaseStore
  /** Injectable seams for the case handler (caseId / displayName). */
  deps?: CaseHandlerDeps
  /**
   * Phase C dry-run quote payload — present ONLY for an explicit DC create-quote
   * command. Required when the resolved intent is `create_quote`.
   */
  quoteDryRun?: QuoteDryRunInput
  /**
   * Optional operator-only display-name enrichment for private inbox reads.
   * This may call LINE's profile API outside the webhook path; the response
   * still omits raw lineUserId.
   */
  customerDisplayNameResolver?: CustomerDisplayNameResolver
  /**
   * Injected partner-group responder (safe-default pattern, like the LLM
   * classifier).  Defaults to the deterministic `stubPartnerGroupResponder`.
   * A real LLM impl is swapped in here later WITHOUT touching the permission /
   * send boundaries — the responder only produces text.
   */
  partnerGroupResponder?: PartnerGroupResponder
  /**
   * Runtime-derived "bot is addressed" signal (quote-to-bot plan §3):
   * mentionsBot OR a quote-reply to a bot-authored message. Threaded into B1/B2
   * so a quote-to-bot message reaches `respond` without a re-tag. Defaults to
   * `event?.mentionsBot === true` to preserve the tag-only behavior when a caller
   * does not provide it.
   */
  botDirected?: boolean
  /**
   * Cached content of the bot-authored message this event quoted (M3.6c
   * quote-to-bot carryover). Resolved + sanitized by the webhook for a
   * partner-group quote-to-bot event; threaded to the responder so the
   * customer-summary path can fire. Absent ⇒ the responder fails closed.
   */
  quotedBotContent?: string
  /**
   * True iff this event quotes a recorded partner-group IMAGE message（圖片
   * 刀B：引用圖＋tag 即觸發）. Resolved fail-safe by the webhook against the
   * store's image marker; threaded to the responder so the vision path can
   * fire without any keyword.
   */
  quotedImage?: boolean
  /**
   * Per-request structured logger（P0-A 刀 2）— bound by the webhook to this
   * event's requestId and threaded through to the responder so its llm_call /
   * cost_cap / route_decision entries join the same trace. Optional.
   */
  log?: AgentLogger
  /**
   * 沉澱刀2 seam — webhook 在 AI_AGENT_DISTILL_ENABLED 開時注入；未注入 ⇒
   * 整條路徑不存在（ship 零行為改變）。run/approve 都回 HandlerResult；
   * approve 回 null ＝ 不是批准語句或無 pending → 落回 responder。
   */
  distill?: {
    run(groupId: string): Promise<HandlerResult>
    approve(groupId: string, text: string): Promise<HandlerResult | null>
  }
}

// ---------------------------------------------------------------------------
// Router decision — the authoritative output of the router
// ---------------------------------------------------------------------------

export type RouterAction =
  | 'respond'              // Respond in the partner group (B1 tagged msg)
  | 'silent'               // Ignore / no-op (B2 casual chat, unknown)
  | 'create_case'          // Create a new case from an OA event (B3)
  | 'update_case'          // Update an existing case from an OA event
  | 'internal_case_event'  // Internal case work — NOT a customer reply
  | 'draft'                // Prepare a message draft (B4 no sendTarget)
  | 'post_to_partner_group'// Send to LINE partner group (B4 + sendTarget)
  | 'list_cases'           // Private/operator read: recent active OA cases
  | 'create_quote_dryrun'  // Phase C: dry-run quote build (DC/operator only)
  | 'mark_handled'         // §3 刀1: @bot done <caseId> — 超時提醒 ack
  | 'distill'              // 沉澱刀2: @bot 沉澱 / 批准語句 — 知識沉澱管線
  | 'denied'               // Permission denied (B5 dev action from partner group)

export interface RouterDecision {
  /** The action the router decided on. */
  action: RouterAction
  /** The source channel of the input. */
  source: AgentSourceChannel
  /** true when the action was explicitly denied by the permission layer. */
  denied?: boolean
  /** Human-readable denial reason — present when denied is true. */
  denialReason?: string
  /** The handler result, if a handler was invoked. */
  handlerResult?: HandlerResult
  /** The resolved intent (for audit/debug). */
  intent?: CommandIntent
  /**
   * Phase C dry-run quote result — present only for a `create_quote_dryrun`
   * action. Carries the validation report, the would-be (non-official) URL, and
   * the dry-run draft. Never a written Sanity document.
   */
  quoteDryRunResult?: CreateQuoteResult
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sourceFromEvent(event: NormalizedLineEvent): AgentSourceChannel {
  return event.sourceChannel
}

function sourceFromCommand(command: OperatorCommand): AgentSourceChannel {
  return command.sourceChannel
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

/**
 * Route a command/event to an action decision, gated by the permission layer.
 *
 * Routing order:
 *  1. If input is a LINE event, apply LINE routing logic.
 *  2. If input is an operator command (DC), apply DC routing logic.
 *  3. Permission layer is called AFTER intent resolution — it is the final gate.
 */
export async function routeCommand(input: RouterInput): Promise<RouterDecision> {
  const { event, command, llmClassifier, store, deps } = input

  // -------------------------------------------------------------------------
  // LINE event routing
  // -------------------------------------------------------------------------

  if (event) {
    const source = sourceFromEvent(event)

    // -----------------------------------------------------------------------
    // LINE OA customer events — B3: NEVER auto-reply
    // -----------------------------------------------------------------------

    if (event.sourceChannel === 'line_oa') {
      // B3 gate — always deny auto-reply regardless of intent
      const oaPerm = canAutoReplyToOaCustomer(event)
      if (!oaPerm.allowed) {
        // Create/update a case internally, but DO NOT reply to the customer.
        // Persistence requires a store — fail loud rather than silently drop
        // the case (the webhook always provides one).
        if (!store) {
          throw new Error(
            '[router] OA customer event requires a store to persist the case. ' +
              'Pass `store` in RouterInput.'
          )
        }
        const handlerResult = await handleCreateOrUpdateCase(event, store, deps)
        // A redelivered (already-processed) message is a true no-op: the
        // handler deduped it, so nothing was created or updated.
        if (handlerResult.meta?.deduped) {
          return { action: 'silent', source, denied: false, handlerResult }
        }
        return {
          // Distinguish first-contact (create) from a follow-up (update).
          action: handlerResult.meta?.created ? 'create_case' : 'update_case',
          source,
          denied: false, // Not a denial — this IS the correct action
          handlerResult,
        }
      }
      // (Non-OA sources handled below — should not reach here for OA events)
    }

    // -----------------------------------------------------------------------
    // LINE partner group events — B2 / B1 / B5
    // -----------------------------------------------------------------------

    if (event.sourceChannel === 'line_partner_group') {
      // Runtime-derived bot-addressed signal (quote-to-bot plan §3). Until the
      // webhook supplies it (Task 5), this falls back to mentionsBot so B1/B2
      // behavior is unchanged.
      const botDirected = input.botDirected ?? (event.mentionsBot === true)

      // B5 (+ B6 LLM widening prevention): ALWAYS check for dev actions FIRST,
      // before the casual-chat gate.  A partner-group message that contains a
      // dev command (deploy, code_edit, parser_change, schema_change) must be
      // EXPLICITLY DENIED — not silently ignored — so the denial is auditable.
      // This runs for ALL partner-group messages regardless of tagging.
      const earlyIntent = await classifyIntent(event.text ?? '', llmClassifier)
      const devPerm = canPartnerGroupTriggerDevAction(event, earlyIntent)
      if (!devPerm.allowed) {
        return {
          action: 'denied',
          source,
          denied: true,
          denialReason: devPerm.reason,
          intent: earlyIntent,
        }
      }

      // B2: After dev-action gate, is this casual chat that should be ignored?
      if (shouldIgnoreCasualPartnerGroupChat(event, botDirected)) {
        const handlerResult = handleSilent()
        return { action: 'silent', source, handlerResult }
      }

      // B1: Is the bot addressed (tag or quote-to-bot)? → intent already resolved
      const tagPerm = canRespondToPartnerGroupTag(event, botDirected)
      if (tagPerm.allowed) {
        // §3 刀1 — `@bot done <caseId>` ack（超時提醒解除）。Checked BEFORE the
        // responder：這是唯一會寫 store 的 partner-group 路徑（responder 是
        // text-only），所以走 handler 而不是 responder。explicit token（done）
        // ＋tagged 才會進來；permission 是現成的 B1 tagged-message gate。
        const doneCaseId = parseCaseDoneCommand(event.text ?? '')
        if (doneCaseId !== null) {
          if (!store) {
            throw new Error(
              '[router] done command requires a store to mark the case handled. ' +
                'Pass `store` in RouterInput.'
            )
          }
          const ack = await markCaseHandled({
            store,
            caseId: doneCaseId,
            actor: event.lineUserId ?? 'partner',
            now: new Date(event.timestamp).toISOString(),
          })
          return {
            action: 'mark_handled',
            source,
            denied: false,
            handlerResult: {
              handler: 'markCaseHandled',
              status: ack.ok ? 'stub_ok' : 'error',
              outboundText: ack.replyText,
              meta: { caseId: doneCaseId, handled: ack.ok },
            },
            intent: earlyIntent,
          }
        }

        // 沉澱刀2 — explicit-token 指令（同 done 前例：parser 攔截、不走
        // intent）。seam 未注入（閘關）⇒ 此 if 不存在，行為與 ship 前相同。
        // seam 內部已各自收斂錯誤；這裡再包一層是 webhook 不被裸 throw 炸掉
        // 的最後防線（store 讀路徑仍可能 throw）。
        if (input.distill && event.groupId) {
          try {
            if (isDistillCommand(event.text ?? '')) {
              const handlerResult = await input.distill.run(event.groupId)
              return { action: 'distill', source, handlerResult, intent: earlyIntent }
            }
            const approval = await input.distill.approve(event.groupId, event.text ?? '')
            if (approval !== null) {
              return { action: 'distill', source, handlerResult: approval, intent: earlyIntent }
            }
          } catch {
            return {
              action: 'distill',
              source,
              handlerResult: {
                handler: 'distill',
                status: 'error',
                outboundText: '沉澱處理失敗，請稍後重試。',
                meta: { reason: 'distill_seam_failed' },
              },
              intent: earlyIntent,
            }
          }
        }

        // Permission granted — respond in the group. The responder only
        // produces text; it never sends (the router owns that decision).
        const handlerResult = await handleRespondToPartnerGroup(
          event,
          earlyIntent,
          input.partnerGroupResponder ?? stubPartnerGroupResponder,
          botDirected,
          input.quotedBotContent,
          input.log,
          input.quotedImage
        )
        return { action: 'respond', source, handlerResult, intent: earlyIntent }
      }

      // Not tagged and not casual (edge case) → silent
      const handlerResult = handleSilent()
      return { action: 'silent', source, handlerResult }
    }

    // Unknown event source — silent
    const handlerResult = handleSilent()
    return { action: 'silent', source, handlerResult }
  }

  // -------------------------------------------------------------------------
  // Operator command routing (DC / internal_worker)
  // -------------------------------------------------------------------------

  if (command) {
    const source = sourceFromCommand(command)
    // Classify once — the resolved intent drives every operator-command branch.
    const intent = await classifyIntent(command.commandText, llmClassifier)

    // Phase C — explicit create-quote dry-run command (DC/operator plane only).
    // Partner-group sources can never reach here: they take the event branch and
    // are denied by canPartnerGroupTriggerDevAction. This path is operator-only.
    if (intent.action === 'create_quote') {
      return routeCreateQuoteDryRun(command, intent, source, input.quoteDryRun)
    }

    if (intent.action === 'list_cases') {
      if (!store) {
        throw new Error(
          '[router] list_cases command requires a `store` in RouterInput.'
        )
      }
      const handlerResult = await handleListRecentCases(store, {
        resolveCustomerDisplayName: input.customerDisplayNameResolver,
      })
      return { action: 'list_cases', source, denied: false, handlerResult, intent }
    }

    // B4: Can DC post to the partner group?
    const postPerm = canPostToPartnerGroupFromDC(command)

    if (postPerm.allowed) {
      // Explicit sendTarget present — post to LINE partner group
      const handlerResult = await handlePostToPartnerGroup(command, intent)
      return { action: 'post_to_partner_group', source, handlerResult, intent }
    }

    // No sendTarget (or invalid source) — check if it is a draft
    if (!command.sendTarget) {
      // Draft-only mode
      const handlerResult = await handleDraft(command, intent)
      return { action: 'draft', source, handlerResult, intent }
    }

    // Invalid operator source or invalid sendTarget — denied
    return {
      action: 'denied',
      source,
      denied: true,
      denialReason: postPerm.reason,
    }
  }

  // -------------------------------------------------------------------------
  // Neither event nor command — silent
  // -------------------------------------------------------------------------

  return {
    action: 'silent',
    source: 'internal_worker',
    handlerResult: handleSilent(),
  }
}

// ---------------------------------------------------------------------------
// Phase C — create-quote dry-run routing
// ---------------------------------------------------------------------------

/**
 * Route an explicit create-quote command to the dry-run createQuote flow.
 *
 * Dry-run ONLY:
 *  - the writer arg is deliberately omitted, so createQuote uses the dry-run
 *    writer (written:false). The live writer / any Sanity write token cannot be
 *    reached from here.
 *  - blocked severity yields a report with no draft / no would-be URL — that is
 *    handled inside createQuote; the router just relays the result.
 *
 * Fails loud (throws) when the bridge omits the payload or caseId — silently
 * emitting a `DRAFT-undefined` slug would be worse than a 500.
 */
async function routeCreateQuoteDryRun(
  command: OperatorCommand,
  intent: CommandIntent,
  source: AgentSourceChannel,
  payload: QuoteDryRunInput | undefined
): Promise<RouterDecision> {
  if (!payload) {
    throw new Error(
      '[router] create_quote command requires a `quoteDryRun` payload in RouterInput.'
    )
  }
  if (!command.caseId) {
    throw new Error(
      '[router] create_quote command requires `command.caseId` (drives the DRAFT-<caseId> slug).'
    )
  }

  const quoteDryRunResult = await createQuote({
    itineraryText: payload.itineraryText,
    quoteText: payload.quoteText,
    caseId: command.caseId,
    actor: command.actor,
    sourceChannel: command.sourceChannel,
    origin: payload.origin,
    timestamp: payload.timestamp,
    year: payload.year,
    // writer intentionally omitted → dryRunQuoteWriter (no live writer/token).
  })

  return {
    action: 'create_quote_dryrun',
    source,
    denied: false,
    intent,
    quoteDryRunResult,
  }
}
