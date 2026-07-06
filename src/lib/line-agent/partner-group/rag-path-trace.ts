/**
 * rag-path-trace.ts — M3.6b OFFLINE private-group RAG path tracer.
 *
 * Purpose: let Eric answer "why did my tagged private-group RAG message get a
 * free-form answer instead of a deterministic Notion draft?" WITHOUT guessing
 * from the real group. Given a simulated partner-group message + env, it reports
 * which of the four `shouldUsePartnerRagDraft` preconditions hold, whether the
 * answer source is wireable (env PRESENCE only), and which final path the live
 * dispatcher WOULD take.
 *
 * Hard boundaries (by construction — this module imports no LINE / Notion / LLM
 * client and performs no I/O):
 *   - never contacts LINE, Notion, or an LLM
 *   - never reads Notion live; wiring is an env-presence check only
 *   - never flips a gate (the forced-enabled overlay below mutates a COPY of env
 *     passed to a pure resolver — the caller's env is untouched)
 *   - the formatter prints only enabled/disabled/present/missing/PASS/FAIL —
 *     never an env VALUE, token, db id, or Notion url.
 *
 * Faithfulness: the decision is delegated to the SAME functions the webhook uses
 * (`shouldUsePartnerRagDraft`, `detectPartnerRagIntent`, `isPartnerRagDraftEnabled`,
 * `resolveNotionRagConfig`), so the trace cannot drift from the runtime.
 */

import type { AgentSourceChannel } from '../types'
import { resolveNotionRagConfig } from '../notion/notion-rag-config'
import {
  detectPartnerRagIntent,
  isPartnerRagDraftEnabled,
  shouldUsePartnerRagDraft,
} from './rag-draft-surfacing'

/** The final path the live dispatcher would take for this message + env. */
export type PartnerRagFinalPath =
  /** All four preconditions hold AND the source is env-wireable. */
  | 'rag_composer'
  /** Preconditions hold but the source is not wireable ⇒ fixed unavailable reply. */
  | 'rag_fail_closed'
  /** A precondition failed ⇒ the free-form base responder runs. */
  | 'fallback_responder'

/** Why the message fell back to the free-form responder (precondition order). */
export type PartnerRagFallbackReason =
  | 'not_partner_group'
  | 'not_bot_directed'
  | 'no_rag_intent'
  | 'gate_notion_rag_disabled'
  | 'gate_partner_draft_disabled'

/** Offline env-presence verdict for the lazy answer-source install. */
export type PartnerRagWiringStatus =
  /** Token present + a known active source with its db id present. */
  | 'env_present'
  | 'missing_notion_token'
  | 'no_active_sources'
  | 'missing_database_id'
  | 'unknown_active_source'

export interface PartnerRagPathTraceInput {
  /** The simulated partner-group message text. */
  text: string
  /**
   * Simulated source channel. Defaults to 'line_partner_group' so the gate is
   * the single isolated variable — the diagnostic Eric needs.
   */
  sourceChannel?: AgentSourceChannel
  /** Simulated mentionsBot OR quote-to-bot. Defaults to true (properly addressed). */
  botDirected?: boolean
  /** Env to evaluate against. Defaults to process.env. */
  env?: Record<string, string | undefined>
}

export interface PartnerRagPathTrace {
  // Step 1 — source channel
  sourceChannel: AgentSourceChannel
  isPartnerGroup: boolean
  // Step 2 — bot directed
  botDirected: boolean
  // Step 3 — RAG intent
  intentHit: boolean
  // Step 4 — the two gates (in series)
  notionRagEnabled: boolean
  partnerDraftEnabled: boolean
  bothGatesEnabled: boolean
  // Step 5 — answer-source wiring (env presence only)
  notionTokenPresent: boolean
  wiring: PartnerRagWiringStatus
  // Steps 6 & 7 — final path + reason
  finalPath: PartnerRagFinalPath
  fallbackReason: PartnerRagFallbackReason | null
}

/** Same trimmed `=== 'true'` rule the gate helpers use (kept per-gate for the report). */
function flagEnabled(value: string | undefined): boolean {
  return (value ?? '').trim() === 'true'
}

/**
 * Offline wiring verdict. Reuses the real `resolveNotionRagConfig` so source /
 * db-id parsing (dedupe, url normalisation) can never drift. The resolver
 * short-circuits to empty when the master gate is off, so to assess wireability
 * INDEPENDENTLY of the gate we pass a forced-enabled overlay on a COPY of env —
 * no live read, no real gate flip.
 */
function evaluateWiring(
  env: Record<string, string | undefined>,
): { notionTokenPresent: boolean; wiring: PartnerRagWiringStatus } {
  const notionTokenPresent = (env.NOTION_TOKEN ?? '').trim() !== ''
  if (!notionTokenPresent) {
    return { notionTokenPresent: false, wiring: 'missing_notion_token' }
  }

  const { config, issues } = resolveNotionRagConfig({
    ...env,
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
  })

  if (issues.some((issue) => issue.code === 'unknown_active_source') && config.activeSources.length === 0) {
    return { notionTokenPresent: true, wiring: 'unknown_active_source' }
  }
  if (config.activeSources.length === 0) {
    return { notionTokenPresent: true, wiring: 'no_active_sources' }
  }
  if (issues.some((issue) => issue.code === 'missing_database_id')) {
    return { notionTokenPresent: true, wiring: 'missing_database_id' }
  }
  return { notionTokenPresent: true, wiring: 'env_present' }
}

/**
 * Trace the private-group RAG decision for a simulated message + env. Pure: no
 * I/O, no gate mutation. The final path mirrors the live dispatcher exactly.
 */
export function tracePartnerRagPath(input: PartnerRagPathTraceInput): PartnerRagPathTrace {
  const env = input.env ?? process.env
  const sourceChannel: AgentSourceChannel = input.sourceChannel ?? 'line_partner_group'
  const botDirected = input.botDirected ?? true
  const text = input.text ?? ''

  const isPartnerGroup = sourceChannel === 'line_partner_group'
  const intentHit = detectPartnerRagIntent(text)
  const notionRagEnabled = flagEnabled(env.AI_AGENT_NOTION_RAG_ENABLED)
  const partnerDraftEnabled = flagEnabled(env.AI_AGENT_PARTNER_RAG_DRAFT_ENABLED)
  const bothGatesEnabled = isPartnerRagDraftEnabled(env)

  const { notionTokenPresent, wiring } = evaluateWiring(env)

  // Delegate the surfacing decision to the SAME function the webhook calls.
  const shouldUse = shouldUsePartnerRagDraft({ sourceChannel, botDirected, text, env })

  let finalPath: PartnerRagFinalPath
  let fallbackReason: PartnerRagFallbackReason | null = null

  if (shouldUse) {
    // Preconditions hold: the runtime would lazy-install the source. If the env
    // is not wireable, the first request throws and the rag responder fails
    // closed to the fixed unavailable reply — never a fabricated draft.
    finalPath = wiring === 'env_present' ? 'rag_composer' : 'rag_fail_closed'
  } else {
    finalPath = 'fallback_responder'
    // First failing precondition wins, mirroring the dispatcher short-circuit.
    if (!isPartnerGroup) fallbackReason = 'not_partner_group'
    else if (!botDirected) fallbackReason = 'not_bot_directed'
    else if (!intentHit) fallbackReason = 'no_rag_intent'
    else if (!notionRagEnabled) fallbackReason = 'gate_notion_rag_disabled'
    else fallbackReason = 'gate_partner_draft_disabled'
  }

  return {
    sourceChannel,
    isPartnerGroup,
    botDirected,
    intentHit,
    notionRagEnabled,
    partnerDraftEnabled,
    bothGatesEnabled,
    notionTokenPresent,
    wiring,
    finalPath,
    fallbackReason,
  }
}

// ---------------------------------------------------------------------------
// Masked report
// ---------------------------------------------------------------------------

const WIRING_LABELS: Record<PartnerRagWiringStatus, string> = {
  env_present: '已就緒（env present；未做 live 驗證）',
  missing_notion_token: 'NOTION_TOKEN 缺失',
  no_active_sources: '無啟用來源（AI_AGENT_NOTION_RAG_ACTIVE_SOURCES 空）',
  missing_database_id: '缺資料庫 ID',
  unknown_active_source: '未知來源設定',
}

const FINAL_PATH_LABELS: Record<PartnerRagFinalPath, string> = {
  rag_composer: 'deterministic RAG composer（會嘗試；實際結果取決於 live Notion）',
  rag_fail_closed: 'fail-closed 不可用回覆（PARTNER_RAG_UNAVAILABLE_REPLY，不幻覺）',
  fallback_responder: 'fallback free-form responder（非 RAG）',
}

const FALLBACK_REASON_LABELS: Record<PartnerRagFallbackReason, string> = {
  not_partner_group: '非夥伴群來源（line_partner_group 才會進入）',
  not_bot_directed: '未 tag／未引用 bot（botDirected=false）',
  no_rag_intent: '訊息未含 RAG intent 關鍵詞（例如：查內部案例）',
  gate_notion_rag_disabled: 'AI_AGENT_NOTION_RAG_ENABLED 未開（disabled）',
  gate_partner_draft_disabled: 'AI_AGENT_PARTNER_RAG_DRAFT_ENABLED 未開（disabled）',
}

function pass(ok: boolean): string {
  return ok ? '✓ PASS' : '✗ FAIL'
}

function enabledLabel(ok: boolean): string {
  return ok ? 'enabled' : 'disabled'
}

/**
 * Render a masked Traditional Chinese operator report. Prints only
 * enabled/disabled/present/missing/PASS/FAIL — never an env value, token, db id,
 * or url. `text` is the operator's own simulated input, echoed back for context.
 */
export function formatPartnerRagPathTrace(trace: PartnerRagPathTrace, text: string): string {
  const lines: string[] = [
    '夥伴群 RAG 路徑追蹤 · Dry-run（離線；不接 LINE／不讀 Notion／不跑 LLM／不翻 gate）',
    `輸入訊息：「${text}」`,
    '',
    `1. 來源頻道 line_partner_group：${pass(trace.isPartnerGroup)}（實際：${trace.sourceChannel}）`,
    `2. botDirected（tag／引用 bot）：${pass(trace.botDirected)}`,
    `3. RAG intent 命中：${pass(trace.intentHit)}`,
    '4. RAG 雙閘：',
    `   · AI_AGENT_NOTION_RAG_ENABLED：${enabledLabel(trace.notionRagEnabled)}`,
    `   · AI_AGENT_PARTNER_RAG_DRAFT_ENABLED：${enabledLabel(trace.partnerDraftEnabled)}`,
    '5. answerSource 接線（離線 env-presence 檢查，未做 live 驗證）：',
    `   · NOTION_TOKEN：${trace.notionTokenPresent ? 'present' : 'missing'}`,
    `   · 設定：${WIRING_LABELS[trace.wiring]}`,
    `6. 最終路徑：${FINAL_PATH_LABELS[trace.finalPath]}`,
    `7. 原因：${trace.fallbackReason ? FALLBACK_REASON_LABELS[trace.fallbackReason] : '—'}`,
  ]
  return lines.join('\n')
}
