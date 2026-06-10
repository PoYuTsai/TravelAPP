#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadNotionRagDryRunRuntime,
  loadNotionRagSearchRuntime,
  loadNotionRagAnswerRuntime,
  loadNotionRagChangeRuntime,
} from './notion-rag-dry-runner.mjs'
import {
  loadRefineLlmRuntime,
  summarizeRefineSmoke,
  formatRefineSmokeReport,
} from './refine-smoke-runner.mjs'

const DEFAULT_ORIGIN = 'https://chiangway-travel.com'
const DOTENV_PATH = '.env.local'

const STATUS_LABELS = {
  new_inquiry: '新詢問',
  needs_info: '需補資料',
  ready_for_itinerary: '可排行程',
  itinerary_in_progress: '排行程中',
  itinerary_review: '行程待審',
  ready_for_quote: '可報價',
  quote_review: '報價待審',
  quoted_tracking: '已報價追蹤',
  added_eric: '已加 Eric',
  converted: '已收單',
  lost: '未成交',
  idle: '閒置',
}

const NEXT_STEP_LABELS = {
  childSeatNeeds: '兒童座椅需求',
  flightOrPickupInfo: '航班或接送資訊',
  hotelOrPickupLocation: '住宿或上車地點',
  travelDates: '旅遊日期',
  partySize: '人數',
  childAges: '小孩年齡',
}

// SLA inbox zones — must mirror INBOX_ZONE_ORDER in
// src/lib/line-agent/cases/inbox-zone.ts (needs_eric pinned top, browsing last).
const ZONE_ORDER = [
  'needs_eric',
  'need_reply',
  'awaiting_customer',
  'ready_itinerary',
  'quote_review',
  'quoted_tracking',
  'browsing_idle',
]

const ZONE_LABELS = {
  needs_eric: '需 Eric 介入',
  need_reply: '需回覆 / 需處理',
  awaiting_customer: '等客人補資料',
  ready_itinerary: '可排行程',
  quote_review: '報價待檢查',
  quoted_tracking: '已報價追蹤',
  browsing_idle: '瀏覽中 / 靜置',
}

// reason → operator-facing flag label (icon falls back to severity).
const REMINDER_FLAG_LABELS = {
  unanswered_question_overdue: { icon: '⚠️', label: '未回提問' },
  new_inquiry_unhandled: { icon: '⏰', label: '新詢問未處理' },
  awaiting_customer_stale: { icon: '💤', label: '等補資料逾時' },
  quote_review_pending: { icon: '⏰', label: '報價待檢查逾時' },
  quoted_tracking_followup: { icon: '💤', label: '已報價待追蹤' },
}

const SEVERITY_ICONS = { urgent: '⚠️', attention: '⏰', info: '💤' }

export function parseAgentCommandArgs(args) {
  const command = String(args[0] ?? '').trim()
  if (command === 'inbox' || command === '/inbox') {
    return { commandText: 'inbox' }
  }
  if (command === 'notion-rag-dry-run' || command === '/notion-rag-dry-run') {
    return { commandText: 'notion-rag-dry-run' }
  }
  if (command === 'notion-rag-search' || command === '/notion-rag-search') {
    // The remaining args form the free-text query (operator may or may not quote it).
    const query = args.slice(1).join(' ').trim()
    return { commandText: 'notion-rag-search', query }
  }
  if (command === 'notion-rag-answer' || command === '/notion-rag-answer') {
    const query = args.slice(1).join(' ').trim()
    return { commandText: 'notion-rag-answer', query }
  }
  if (command === 'notion-rag-change-dry-run' || command === '/notion-rag-change-dry-run') {
    const query = args.slice(1).join(' ').trim()
    return { commandText: 'notion-rag-change-dry-run', query }
  }
  if (command === 'refine-smoke' || command === '/refine-smoke') {
    return { commandText: 'refine-smoke' }
  }
  if (command === 'partner-rag-path-trace' || command === '/partner-rag-path-trace') {
    // The remaining args form the simulated partner-group message text.
    const query = args.slice(1).join(' ').trim()
    return { commandText: 'partner-rag-path-trace', query }
  }
  if (command === 'case-intake' || command === '/case-intake') {
    // The remaining args form the raw customer requirement text.
    const query = args.slice(1).join(' ').trim()
    return { commandText: 'case-intake', query }
  }

  throw new Error(
    '目前支援：inbox、/inbox、notion-rag-dry-run、notion-rag-search、notion-rag-answer、notion-rag-change-dry-run、refine-smoke、partner-rag-path-trace、case-intake'
  )
}

export function readDotEnvValue(dotenvText, key) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(.*)\\s*$`)

  for (const line of String(dotenvText).split(/\r?\n/)) {
    const match = line.match(pattern)
    if (!match) continue

    let value = match[1].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }

  return ''
}

export function formatInboxCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return '目前沒有未處理客人。'
  }

  // Bucket by zone (server already enriched each case with a `zone`). An
  // unknown/absent zone falls back to need_reply — conservative, stays visible.
  const byZone = new Map(ZONE_ORDER.map((zone) => [zone, []]))
  for (const agentCase of cases) {
    const zone = byZone.has(agentCase.zone) ? agentCase.zone : 'need_reply'
    byZone.get(zone).push(agentCase)
  }

  const lines = [`LINE OA Inbox · 7 區 · 共 ${cases.length} 筆`, '']

  for (const zone of ZONE_ORDER) {
    const zoneCases = byZone.get(zone)
    // Always print the header, even for empty zones — collapsed `(0)` so the
    // operator sees the full SLA picture without a wall of empty detail.
    lines.push(`【${ZONE_LABELS[zone]}】(${zoneCases.length})`)

    zoneCases.forEach((agentCase, index) => {
      const missingFields = normaliseMissingFields(agentCase)
      const category =
        agentCase.eventCategory ||
        STATUS_LABELS[agentCase.status] ||
        agentCase.status
      const flag = formatReminderFlag(agentCase.reminder)
      // Keep the caseId on every line so operators can name a specific case in a
      // follow-up command and so logs are unambiguous when names collide (§6.4).
      const label = `${formatCustomerLabel(agentCase, index)} · ${agentCase.caseId}`
      const headerParts = [`#${index + 1} ${label}`, category]
      if (flag) headerParts.push(flag)
      lines.push(headerParts.join('｜'))

      const latestText = agentCase.latestCustomerMessageText || '（尚無文字訊息）'
      lines.push(`   「${latestText}」`)

      const nextStep = agentCase.reminder?.suggestedAction || formatNextStep(missingFields)
      lines.push(`   下一步：${nextStep}`)
    })

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

function formatReminderFlag(reminder) {
  if (!reminder || typeof reminder !== 'object') return ''
  const meta = REMINDER_FLAG_LABELS[reminder.reason]
  const icon = meta?.icon ?? SEVERITY_ICONS[reminder.severity] ?? ''
  const label = meta?.label ?? reminder.reason ?? ''
  const age = typeof reminder.ageHours === 'number' ? ` ${reminder.ageHours.toFixed(1)}hr` : ''
  return `${icon}${label}${age}`.trim()
}

// --- notion-rag-dry-run (operator-only, offline) ----------------------------
// This command runs the Notion RAG traverse *dry-run* report from the operator
// CLI. It never hits a real Notion API and never goes through the live HTTP
// path. The report it formats is a PROJECTION: it may surface only status /
// counts / issue codes — never a db id, token, notion.so url, customer PII,
// cost, or profit. See src/lib/line-agent/notion/notion-rag-traverse.ts.

// De-identified source-table labels (mirror notion-rag-config KNOWN_SOURCES).
const NOTION_RAG_SOURCE_LABELS = {
  private_2025: '私帳 2025',
  private_2026: '私帳 2026',
  team_2026: '團隊 2026',
}

const NOTION_RAG_SOURCE_STATUS_LABELS = {
  loaded: '已載入',
  skipped: '略過',
  error: '失敗',
}

// Issue / error CODES are operator-safe by contract — surface them verbatim with
// a Traditional Chinese gloss. `client_not_wired` is CLI-level (this cut wires no
// real @notionhq/client yet); the rest come from the resolver / loader.
const NOTION_RAG_CODE_LABELS = {
  missing_database_id: '缺少資料庫 ID',
  unknown_active_source: '未知來源設定',
  client_error: 'Notion 連線失敗',
  client_not_wired: '尚未接上真實 Notion client',
}

/**
 * Disabled gate — mirrors resolveNotionRagConfig: AI_AGENT_NOTION_RAG_ENABLED
 * must be exactly "true" (trimmed). notion-rag-config.ts is the source of truth.
 */
export function isNotionRagEnabled(env) {
  return String(env?.AI_AGENT_NOTION_RAG_ENABLED ?? '').trim() === 'true'
}

/** Format a NotionRagTraverseReport into a Traditional Chinese operator summary. */
export function formatNotionRagTraverseReport(report) {
  const index = report?.index ?? {}
  const totalRecords = index.totalRecords ?? 0
  const issues = Array.isArray(report?.issues) ? report.issues : []

  if (report?.status === 'skipped') {
    return [
      'Notion RAG Dry-run · 已略過',
      '（AI_AGENT_NOTION_RAG_ENABLED 未開啟，未連線 Notion）',
      `總筆數：${totalRecords}`,
    ].join('\n')
  }

  if (report?.status === 'error') {
    const lines = ['Notion RAG Dry-run · 失敗']
    if (report.errorCode) {
      lines.push(`錯誤碼：${report.errorCode}（${codeLabel(report.errorCode)}）`)
    }
    if (issues.length > 0) {
      lines.push(`議題：${issues.map((code) => `${code}（${codeLabel(code)}）`).join('、')}`)
    }
    return lines.join('\n')
  }

  // ok
  const lines = ['Notion RAG Dry-run · 完成', `總筆數：${totalRecords}`, '來源：']
  for (const source of report?.sources ?? []) {
    const label = NOTION_RAG_SOURCE_LABELS[source.sourceTable] ?? source.sourceTable
    const statusLabel = NOTION_RAG_SOURCE_STATUS_LABELS[source.status] ?? source.status
    lines.push(
      `  · ${label}：頁 ${source.pageCount ?? 0} / 筆 ${source.recordCount ?? 0}（${statusLabel}）`
    )
  }
  lines.push(`區域 token：${index.areaTokenCount ?? 0} · 主題 token：${index.themeTokenCount ?? 0}`)
  if (issues.length > 0) {
    lines.push(`議題：${issues.map((code) => `${code}（${codeLabel(code)}）`).join('、')}`)
  }
  return lines.join('\n')
}

function codeLabel(code) {
  return NOTION_RAG_CODE_LABELS[code] ?? code
}

/** Zero-count index shape used by the skipped / not-wired projections. */
function emptyNotionRagIndexSummary() {
  return { totalRecords: 0, sourceCounts: {}, areaTokenCount: 0, themeTokenCount: 0 }
}

/** Build the safe `client_not_wired` / `client_error` error projection. */
function notWiredReport(errorCode) {
  return {
    status: 'error',
    sources: [],
    index: emptyNotionRagIndexSummary(),
    issues: [errorCode],
    errorCode,
  }
}

/**
 * Run the notion-rag-dry-run command offline. Runner resolution is layered:
 *
 *   1. disabled gate → skipped report, NOTHING loaded or called.
 *   2. injected `runDryRun` + `client` (tests / explicit wiring) → use them.
 *   3. otherwise call the runtime loader `loadRuntime({ env }) → { runDryRun,
 *      client }` — the pluggable seam where a future cut wires the real
 *      @notionhq/client + the (TypeScript) traverse. The default loader is
 *      mock-first (not wired).
 *   4. a missing runDryRun OR client after loading → safe `client_not_wired`.
 *
 * This CLI is the operator boundary: a loader throw OR a runner throw may carry
 * a token / db id / notion.so url, so both collapse to a sanitized `client_error`
 * projection rather than propagating a raw message.
 */
export async function runNotionRagDryRunCommand(options = {}) {
  const env = options.env ?? process.env

  if (!isNotionRagEnabled(env)) {
    return formatNotionRagTraverseReport({
      status: 'skipped',
      sources: [],
      index: emptyNotionRagIndexSummary(),
      issues: [],
    })
  }

  let runDryRun = options.runDryRun ?? null
  let client = options.client ?? null

  // Only reach for the runtime loader when an explicit runner was not injected.
  if (!runDryRun || !client) {
    const loadRuntime = options.loadRuntime ?? loadNotionRagDryRunRuntime
    let runtime
    try {
      runtime = await loadRuntime({ env })
    } catch {
      return formatNotionRagTraverseReport(notWiredReport('client_error'))
    }
    runDryRun = runDryRun ?? runtime?.runDryRun ?? null
    client = client ?? runtime?.client ?? null
  }

  if (!runDryRun || !client) {
    return formatNotionRagTraverseReport(notWiredReport('client_not_wired'))
  }

  // Collapse any runner throw (the traverse self-sanitizes, but a future bridge
  // might not) to a safe client_error — never propagate a raw, leak-prone message.
  let report
  try {
    report = await runDryRun(env, client)
  } catch {
    report = notWiredReport('client_error')
  }
  return formatNotionRagTraverseReport(report)
}

// ---------------------------------------------------------------------------
// notion-rag-search — operator-only retrieval PREVIEW (masked by contract)
// ---------------------------------------------------------------------------

/**
 * Render an OperatorSafeCaseSummary line — reads ONLY whitelisted safe fields.
 * GAP-1: the raw 行程框架 snippet is NOT rendered; it is free text that leaks
 * customer names / flight numbers / phone / URL / amounts. Structured facts only.
 */
function formatSafeCaseLine(rank, c) {
  const duration =
    c?.days != null ? `${c.days}天${c?.nights != null ? c.nights + '夜' : ''}` : '天數-'
  const area = Array.isArray(c?.areaHints) && c.areaHints.length > 0 ? c.areaHints.join('/') : '-'
  const theme = Array.isArray(c?.themeHints) && c.themeHints.length > 0 ? c.themeHints.join('/') : '-'
  const party = c?.partySize != null ? `${c.partySize}人` : '人數-'
  const vehicle = c?.vehicleType ? c.vehicleType : '車型-'
  return `  ${rank}. ${duration} · 區域 ${area} · 主題 ${theme} · ${party} · ${vehicle}`
}

/**
 * Format a NotionRagSearchReport into a Traditional Chinese operator summary.
 * The `results` are already operator-safe summaries (no privateContext / PII),
 * so this renderer is masked by construction: it reads only whitelisted fields.
 */
export function formatNotionRagSearchReport(report) {
  const pq = report?.parsedQuery ?? { areas: [], themes: [] }
  const areas = Array.isArray(pq.areas) && pq.areas.length > 0 ? pq.areas.join(', ') : '-'
  const themes = Array.isArray(pq.themes) && pq.themes.length > 0 ? pq.themes.join(', ') : '-'
  const party = pq.partySize != null ? `${pq.partySize}` : '-'
  const tokenLine = `查詢 token：區域 [${areas}] · 主題 [${themes}] · 人數 ${party}`
  const issues = Array.isArray(report?.issues) ? report.issues : []

  if (report?.status === 'skipped') {
    return [
      'RAG 檢索預覽 · 已略過',
      '（AI_AGENT_NOTION_RAG_ENABLED 未開啟，未連線 Notion）',
    ].join('\n')
  }

  if (report?.status === 'error') {
    const lines = ['RAG 檢索預覽 · 失敗']
    if (report.errorCode) {
      lines.push(`錯誤碼：${report.errorCode}（${codeLabel(report.errorCode)}）`)
    }
    if (issues.length > 0) {
      lines.push(`議題：${issues.map((code) => `${code}（${codeLabel(code)}）`).join('、')}`)
    }
    return lines.join('\n')
  }

  const resultCount = report?.resultCount ?? 0
  const results = Array.isArray(report?.results) ? report.results : []

  if (resultCount === 0) {
    return [
      'RAG 檢索預覽 · 低信心（無足夠訊號或無命中）',
      tokenLine,
      `索引總筆數：${report?.totalRecords ?? 0}`,
      '命中：0',
    ].join('\n')
  }

  const lines = [
    'RAG 檢索預覽 · 完成',
    tokenLine,
    `索引總筆數：${report?.totalRecords ?? 0}`,
    `命中：${resultCount}（顯示前 ${results.length}）`,
  ]
  results.forEach((c, i) => lines.push(formatSafeCaseLine(i + 1, c)))
  if (issues.length > 0) {
    lines.push(`議題：${issues.map((code) => `${code}（${codeLabel(code)}）`).join('、')}`)
  }
  return lines.join('\n')
}

/**
 * Run the notion-rag-search command offline. Mirrors runNotionRagDryRunCommand:
 *   1. disabled gate → skipped, NOTHING loaded or read.
 *   2. injected runSearch + client (tests / explicit wiring) → use them.
 *   3. otherwise call the runtime loader loadNotionRagSearchRuntime.
 *   4. missing runSearch OR client → safe client_not_wired.
 * A loader throw OR a runner throw may carry a token / db id / notion.so url, so
 * both collapse to a sanitized client_error projection — never a raw message.
 */
export async function runNotionRagSearchCommand(options = {}) {
  const env = options.env ?? process.env
  const query = options.query ?? ''

  if (!isNotionRagEnabled(env)) {
    return formatNotionRagSearchReport({
      status: 'skipped',
      parsedQuery: { areas: [], themes: [] },
      totalRecords: 0,
      resultCount: 0,
      results: [],
      issues: [],
    })
  }

  let runSearch = options.runSearch ?? null
  let client = options.client ?? null

  if (!runSearch || !client) {
    const loadRuntime = options.loadRuntime ?? loadNotionRagSearchRuntime
    let runtime
    try {
      runtime = await loadRuntime({ env })
    } catch {
      return formatNotionRagSearchReport(searchErrorReport('client_error'))
    }
    runSearch = runSearch ?? runtime?.runSearch ?? null
    client = client ?? runtime?.client ?? null
  }

  if (!runSearch || !client) {
    return formatNotionRagSearchReport(searchErrorReport('client_not_wired'))
  }

  let report
  try {
    report = await runSearch(env, client, query)
  } catch {
    report = searchErrorReport('client_error')
  }
  return formatNotionRagSearchReport(report)
}

/** Build the safe client_not_wired / client_error error projection for search. */
function searchErrorReport(errorCode) {
  return {
    status: 'error',
    parsedQuery: { areas: [], themes: [] },
    totalRecords: 0,
    resultCount: 0,
    results: [],
    issues: [errorCode],
    errorCode,
  }
}

// ---------------------------------------------------------------------------
// notion-rag-answer — operator-only DRAFT preview (search → composeAnswer)
// ---------------------------------------------------------------------------

/**
 * Derive a TransportationAssessmentInput from operator free text + the parsed
 * query. CLI-input parsing only (like the query itself): partySize comes from the
 * parsed query; airport / luggage are light surface signals. Returns `undefined`
 * when there is no signal at all, so an unrelated draft is not padded with
 * vehicle confirmations.
 */
export function deriveTransportationSignals(query, parsedQuery) {
  const q = String(query ?? '')
  const partySize = parsedQuery?.partySize
  const airportTransfer = /機場|接機|送機|airport/i.test(q)
  let luggageCount
  const m = q.match(/行李\s*(\d+)\s*件?/)
  if (m) luggageCount = Number(m[1])

  if (partySize == null && !airportTransfer && luggageCount == null) return undefined

  const out = {}
  if (partySize != null) out.partySize = partySize
  if (airportTransfer) out.airportTransfer = true
  if (luggageCount != null) out.luggageCount = luggageCount
  return out
}

/**
 * Format a composed answer into a Traditional Chinese operator preview. Reads
 * ONLY masked/composed fields (parsedQuery tokens, counts, confidence, draft
 * text); the draft text comes from `composeAnswer`, which consumes operator-safe
 * summaries and never fabricates private strings — so this renderer is masked by
 * construction. Explicitly labelled partner-group draft only, never a customer
 * reply, and nothing is ever sent.
 */
export function formatNotionRagAnswerReport(report) {
  if (report?.status === 'skipped') {
    return [
      'RAG 草稿預覽 · 已略過',
      '（AI_AGENT_NOTION_RAG_ENABLED 未開啟，未連線 Notion）',
    ].join('\n')
  }

  if (report?.status === 'error') {
    const lines = ['RAG 草稿預覽 · 失敗']
    if (report.errorCode) {
      lines.push(`錯誤碼：${report.errorCode}（${codeLabel(report.errorCode)}）`)
    }
    return lines.join('\n')
  }

  const pq = report?.parsedQuery ?? { areas: [], themes: [] }
  const areas = Array.isArray(pq.areas) && pq.areas.length > 0 ? pq.areas.join(', ') : '-'
  const themes = Array.isArray(pq.themes) && pq.themes.length > 0 ? pq.themes.join(', ') : '-'
  const party = pq.partySize != null ? `${pq.partySize}` : '-'
  const tokenLine = `查詢 token：區域 [${areas}] · 主題 [${themes}] · 人數 ${party}`

  const answer = report?.answer ?? {}
  const confidence = answer.confidence ?? 'low'

  return [
    'RAG 草稿預覽 · 完成（夥伴群草稿，僅供內部，非客人回覆）',
    tokenLine,
    `索引總筆數：${report?.totalRecords ?? 0} · 命中：${report?.resultCount ?? 0}`,
    `信心：${confidence}`,
    '— 草稿 —',
    String(answer.text ?? ''),
  ].join('\n')
}

/** Build the safe client_not_wired / client_error error projection for answer. */
function answerErrorReport(errorCode) {
  return { status: 'error', errorCode }
}

/**
 * Run the notion-rag-answer command offline. Mirrors runNotionRagSearchCommand,
 * with an extra pure `composeAnswer` step:
 *   1. disabled gate → skipped, NOTHING loaded or read.
 *   2. injected runSearch + composeAnswer + client → use them.
 *   3. otherwise call the runtime loader loadNotionRagAnswerRuntime.
 *   4. missing runSearch / composeAnswer / client → safe client_not_wired.
 * A search skip/error passes through; a runner OR composer throw collapses to a
 * sanitized client_error (a raw message may carry token / db id / notion.so url).
 * No LLM refine hook is ever passed; no message is ever sent.
 */
export async function runNotionRagAnswerCommand(options = {}) {
  const env = options.env ?? process.env
  const query = options.query ?? ''

  if (!isNotionRagEnabled(env)) {
    return formatNotionRagAnswerReport({ status: 'skipped' })
  }

  let runSearch = options.runSearch ?? null
  let composeAnswer = options.composeAnswer ?? null
  let client = options.client ?? null

  if (!runSearch || !composeAnswer || !client) {
    const loadRuntime = options.loadRuntime ?? loadNotionRagAnswerRuntime
    let runtime
    try {
      runtime = await loadRuntime({ env })
    } catch {
      return formatNotionRagAnswerReport(answerErrorReport('client_error'))
    }
    runSearch = runSearch ?? runtime?.runSearch ?? null
    composeAnswer = composeAnswer ?? runtime?.composeAnswer ?? null
    client = client ?? runtime?.client ?? null
  }

  if (!runSearch || !composeAnswer || !client) {
    return formatNotionRagAnswerReport(answerErrorReport('client_not_wired'))
  }

  let searchReport
  try {
    searchReport = await runSearch(env, client, query)
  } catch {
    return formatNotionRagAnswerReport(answerErrorReport('client_error'))
  }

  if (searchReport?.status === 'skipped') {
    return formatNotionRagAnswerReport({ status: 'skipped' })
  }
  if (searchReport?.status === 'error') {
    return formatNotionRagAnswerReport(answerErrorReport(searchReport.errorCode ?? 'client_error'))
  }

  // Map the search REPORT (skipped|ok|error) onto the composer's expected
  // NotionRagSearchResult (ok|low_confidence): zero hits ⇒ low_confidence.
  const resultCount = searchReport?.resultCount ?? 0
  const search = {
    status: resultCount > 0 ? 'ok' : 'low_confidence',
    parsedQuery: searchReport?.parsedQuery ?? { areas: [], themes: [] },
    totalRecords: searchReport?.totalRecords ?? 0,
    resultCount,
    results: Array.isArray(searchReport?.results) ? searchReport.results : [],
  }

  const transportation = deriveTransportationSignals(query, search.parsedQuery)

  let answer
  try {
    // No `options` passed ⇒ refine stays off and the LLM hook is never invoked.
    answer = composeAnswer(
      transportation
        ? { userQuestion: query, search, transportation }
        : { userQuestion: query, search }
    )
  } catch {
    return formatNotionRagAnswerReport(answerErrorReport('client_error'))
  }

  return formatNotionRagAnswerReport({
    status: 'ok',
    parsedQuery: search.parsedQuery,
    totalRecords: search.totalRecords,
    resultCount: search.resultCount,
    answer,
  })
}

// ---------------------------------------------------------------------------
// notion-rag-change-dry-run — operator-only CHANGE dry-run (live masked → preview)
// ---------------------------------------------------------------------------
// M3.4a Cut 2. Runs a FIXTURE change scenario but swaps its retrieval cases for
// the LIVE Notion masked theme signals, proving the policy: a live_masked case is
// theme-signal only, so it can be SUGGESTED (named_only) but is never written into
// the draft (substitution guard lives in the composer). The report is masked by
// construction — it surfaces theme tokens / counts / outcomes / the operator
// preview, never a raw Notion payload, URL, db id, token, customer PII, cost,
// revenue, profit, or a concrete live attraction name. The draft (built from the
// fixture) must pass lint; a lint error fails closed.

const NOTION_RAG_CHANGE_OUTCOME_LABELS = {
  substituted: '已代入替代景點',
  named_only: '僅建議，不代入 draft',
  none: '無候選，請人工補景點',
}

/**
 * Format a change dry-run report into a Traditional Chinese operator summary.
 * Reads ONLY masked fields: theme tokens (generic), hit counts, per-activity
 * outcome codes, the draft lint status, and the operator preview (which itself
 * only names generic labels for live_masked candidates).
 */
export function formatNotionRagChangeReport(report) {
  if (report?.status === 'skipped') {
    return [
      '客變 Dry-run · 已略過',
      '（AI_AGENT_NOTION_RAG_ENABLED 未開啟，未連線 Notion）',
    ].join('\n')
  }

  if (report?.status === 'error') {
    const lines = ['客變 Dry-run · 失敗']
    if (report.errorCode) {
      lines.push(`錯誤碼：${report.errorCode}（${codeLabel(report.errorCode)}）`)
    }
    return lines.join('\n')
  }

  const themes = Array.isArray(report?.liveThemeSignals) ? report.liveThemeSignals : []
  const themeLine =
    themes.length > 0
      ? `live theme 訊號：[${themes.join(', ')}]（masked，僅 theme，無景點名，依政策不代入）`
      : 'live theme 訊號：[]（無 mobility-friendly 主題，未提供候選）'

  const applications = Array.isArray(report?.applications) ? report.applications : []
  const outcomeLines = applications.map((app) => {
    const code = app.outcome
    const label = NOTION_RAG_CHANGE_OUTCOME_LABELS[code] ?? code
    const count = Array.isArray(app.candidates) ? app.candidates.length : 0
    return `  · Day ${app.day}「${app.declinedActivity}」→ ${code}（${label}；候選 ${count} 筆）`
  })

  const lines = [
    '客變 Dry-run · 完成（live masked，僅 theme 訊號，不代入 draft；fixture 情境）',
    `索引總筆數：${report?.totalRecords ?? 0} · 命中：${report?.resultCount ?? 0}`,
    themeLine,
    '替代結果：',
    ...(outcomeLines.length > 0 ? outcomeLines : ['  · （此情境無替代判斷）']),
    report?.draftPresent ? '草稿：已產生（過 lint）' : '草稿：fail-closed（lint error，未產生）',
  ]
  const preview = Array.isArray(report?.preview) ? report.preview : []
  if (preview.length > 0) {
    lines.push('— operator preview —')
    lines.push(preview.join('\n\n'))
  }
  return lines.join('\n')
}

/** Build the safe client_not_wired / client_error error projection for change. */
function changeErrorReport(errorCode) {
  return { status: 'error', errorCode }
}

/**
 * Run the notion-rag-change-dry-run command offline. Mirrors the other RAG
 * commands' resolution seam:
 *   1. disabled gate → skipped, NOTHING loaded or read.
 *   2. injected runSearch + changeKit + client → use them.
 *   3. otherwise call the runtime loader loadNotionRagChangeRuntime.
 *   4. missing runSearch / changeKit / client → safe client_not_wired.
 * A loader / runner / scenario / composer throw collapses to a sanitized
 * client_error (a raw message may carry token / db id / notion.so url). No LLM,
 * no Sanity, no message send. The live retrieval only contributes a theme signal;
 * the composer's guard keeps live_masked cases out of the draft.
 */
export async function runNotionRagChangeDryRunCommand(options = {}) {
  const env = options.env ?? process.env
  const query = options.query ?? ''

  if (!isNotionRagEnabled(env)) {
    return formatNotionRagChangeReport({ status: 'skipped' })
  }

  let runSearch = options.runSearch ?? null
  let changeKit = options.changeKit ?? null
  let client = options.client ?? null

  if (!runSearch || !changeKit || !client) {
    const loadRuntime = options.loadRuntime ?? loadNotionRagChangeRuntime
    let runtime
    try {
      runtime = await loadRuntime({ env })
    } catch {
      return formatNotionRagChangeReport(changeErrorReport('client_error'))
    }
    runSearch = runSearch ?? runtime?.runSearch ?? null
    changeKit = changeKit ?? runtime?.changeKit ?? null
    client = client ?? runtime?.client ?? null
  }

  if (!runSearch || !changeKit || !client) {
    return formatNotionRagChangeReport(changeErrorReport('client_not_wired'))
  }

  // The demo scenario is a FIXTURE (base + changes); only its retrievalCases are
  // replaced with the LIVE masked theme signals below, so the live path can only
  // ever degrade a fixture substitution into named_only — never inject a name.
  const buildScenario = options.buildScenario ?? changeKit.buildScenario
  let scenario
  try {
    scenario = buildScenario()
  } catch {
    return formatNotionRagChangeReport(changeErrorReport('client_error'))
  }

  let searchReport
  try {
    searchReport = await runSearch(env, client, query)
  } catch {
    return formatNotionRagChangeReport(changeErrorReport('client_error'))
  }

  if (searchReport?.status === 'skipped') {
    return formatNotionRagChangeReport({ status: 'skipped' })
  }
  if (searchReport?.status === 'error') {
    return formatNotionRagChangeReport(changeErrorReport(searchReport.errorCode ?? 'client_error'))
  }

  let liveCases
  let result
  let preview
  try {
    liveCases = changeKit.toLiveMaskedRetrievalCases(
      Array.isArray(searchReport?.results) ? searchReport.results : []
    )
    result = changeKit.composeCustomerChange({
      base: scenario.base,
      changes: scenario.changes,
      retrievalCases: liveCases,
    })
    preview = changeKit.buildOperatorRetrievalPreview(result.retrievalApplications)
  } catch {
    return formatNotionRagChangeReport(changeErrorReport('client_error'))
  }

  return formatNotionRagChangeReport({
    status: 'ok',
    totalRecords: searchReport?.totalRecords ?? 0,
    resultCount: searchReport?.resultCount ?? 0,
    liveThemeSignals: liveCases.map((c) => c.themeTag),
    applications: result.retrievalApplications,
    draftPresent: result.draft !== null,
    preview,
  })
}

/**
 * Run the refine-smoke command offline (M3.4c Cut 2). Mirrors the RAG commands'
 * resolution seam:
 *   1. resolve the three-gate runtime (loadRefineLlmRuntime) unless a source +
 *      kit are injected (tests).
 *   2. no source → project the loader's status/reason (skipped / client_not_wired).
 *   3. a loader throw (sanitized wiring error) → error report.
 *   4. source present → for each fixture draft, PRE-CHECK scanRefinePromptLeak (a
 *      hit is a first-class prompt_leak fallback and the LLM is NOT called),
 *      otherwise run the real M3.4b harness whose three guards decide adoption.
 * The report is masked: guard COUNTS and rates only — no draft, prompt, token,
 * cost, or PII. REAL runs are operator-initiated only; CC/tmux never auto-runs.
 */
export async function runRefineSmokeCommand(options = {}) {
  const env = options.env ?? process.env

  let refineSource = options.refineSource ?? null
  let rescueSource = options.rescueSource ?? null
  let kit = options.kit ?? null
  let status = null
  let reason = null

  if (!refineSource || !kit) {
    const loadRuntime = options.loadRuntime ?? loadRefineLlmRuntime
    let runtime
    try {
      runtime = await loadRuntime({ env })
    } catch {
      return formatRefineSmokeReport({ status: 'error' })
    }
    refineSource = refineSource ?? runtime?.refineSource ?? null
    rescueSource = rescueSource ?? runtime?.rescueSource ?? null
    kit = kit ?? runtime?.kit ?? null
    status = runtime?.status ?? null
    reason = runtime?.reason ?? null
  }

  if (!refineSource || !kit) {
    if (status === 'skipped') {
      return formatRefineSmokeReport({ status: 'skipped', reason })
    }
    return formatRefineSmokeReport({ status: 'client_not_wired', reason: reason ?? 'factory_unavailable' })
  }

  const model = typeof kit.resolveModel === 'function' ? kit.resolveModel({ env }) : 'unknown'
  const rescueModel =
    typeof kit.resolveRescueModel === 'function' ? kit.resolveRescueModel({ env }) : undefined
  const cases = Array.isArray(kit.cases) ? kit.cases : []
  const outcomes = []

  for (const c of cases) {
    const leak = kit.scanPromptLeak(c.deterministicDraft)
    if (Array.isArray(leak) && leak.length > 0) {
      // Dirty deterministic draft: never send it to the LLM. First-class fallback.
      outcomes.push({ caseId: c.caseId, model, rescueModel, promptLeak: true, result: null })
      continue
    }

    let result
    try {
      result = await kit.refine({
        deterministicDraft: c.deterministicDraft,
        constraints: c.constraints,
        source: refineSource,
        // M3.4d: rescue tier runs ONLY if the primary candidate is rejected.
        rescueSource: rescueSource ?? undefined,
      })
    } catch {
      // The harness already fail-closes a throwing source; a throw here is
      // unexpected, so treat it as a source_error fallback rather than crashing.
      result = {
        used: 'deterministic',
        rejectionReasons: ['source_error'],
        structuralIssues: [],
        lintIssues: [],
        leakHits: [],
      }
    }
    outcomes.push({ caseId: c.caseId, model, rescueModel, promptLeak: false, result })
  }

  return formatRefineSmokeReport({ status: 'ok', summary: summarizeRefineSmoke(outcomes) })
}

// ---------------------------------------------------------------------------
// partner-rag-path-trace — OFFLINE private-group RAG path tracer (M3.6b)
// ---------------------------------------------------------------------------
// Diagnoses "why did my tagged private-group RAG message get a free-form answer
// instead of a deterministic Notion draft?" WITHOUT touching the real group: no
// LINE, no Notion live read, no LLM, no gate flip. The trace + masked formatter
// live in the pure TS module src/lib/line-agent/partner-group/rag-path-trace.ts,
// which reuses the SAME decision functions the webhook calls so it cannot drift.
// The report is masked by construction (enabled/disabled/present/missing only).

/**
 * GUARD-loaded dynamic import of the pure TS trace kit — resolves under a TS
 * runtime (tsx, the npm script); under plain `node` the `.ts` import throws and
 * is swallowed → null, so the command surfaces a wiring error rather than crash.
 * Injectable so the command is testable without the host runtime.
 */
export async function loadPartnerRagPathTraceKit(ctx = {}) {
  const {
    importModule = () => import('../src/lib/line-agent/partner-group/rag-path-trace.ts'),
  } = ctx
  try {
    const mod = await importModule()
    if (!mod?.tracePartnerRagPath || !mod?.formatPartnerRagPathTrace) return null
    return {
      tracePartnerRagPath: mod.tracePartnerRagPath,
      formatPartnerRagPathTrace: mod.formatPartnerRagPathTrace,
    }
  } catch {
    return null
  }
}

/**
 * Run the partner-rag-path-trace command offline. The `traceKit` (pure TS) is
 * injected in tests; otherwise it is guard-loaded. A missing kit (plain node /
 * import failure) surfaces a fixed sanitized message — never a raw error.
 */
export async function runPartnerRagPathTraceCommand(options = {}) {
  const env = options.env ?? process.env
  const text = options.query ?? ''

  const traceKit = options.traceKit ?? (await loadPartnerRagPathTraceKit())
  if (!traceKit?.tracePartnerRagPath || !traceKit?.formatPartnerRagPathTrace) {
    return '夥伴群 RAG 路徑追蹤 · 失敗（trace 模組未載入，請用 tsx 執行）'
  }

  const trace = traceKit.tracePartnerRagPath({ text, env })
  return traceKit.formatPartnerRagPathTrace(trace, text)
}

// ---------------------------------------------------------------------------
// case-intake — OFFLINE 客需三分流 dev harness（design 2026-06-10 §1）
// ---------------------------------------------------------------------------
// CLI 僅為 CC 的開發驗證 harness（非產品；產品形態是夥伴群 @bot）。純函式：
// 不碰 LINE / Notion / LLM / gate，吃裸客需文字，回三分流結果＋回覆草稿。

/**
 * GUARD-loaded dynamic import of the pure TS triage core — same pattern as
 * loadPartnerRagPathTraceKit: under plain `node` the `.ts` import throws and is
 * swallowed → null, so the command surfaces a wiring message rather than crash.
 */
export async function loadCaseIntakeKit(ctx = {}) {
  const {
    importModule = () => import('../src/lib/line-agent/partner-group/case-intake-triage.ts'),
  } = ctx
  try {
    const mod = await importModule()
    if (!mod?.triageCaseIntake) return null
    return { triageCaseIntake: mod.triageCaseIntake }
  } catch {
    return null
  }
}

const CASE_INTAKE_FLOW_LABELS = {
  insufficient: '資訊不足（缺項模式）',
  sufficient: '資訊已齊',
  tricky: '需 Eric 確認',
}

/** Run the case-intake command offline. `kit` is injected in tests. */
export async function runCaseIntakeCommand(options = {}) {
  const text = String(options.query ?? '').trim()
  if (!text) {
    return '客需三分流 · 失敗（請帶客需文字：npm run agent:case-intake -- "客需內容"）'
  }

  const kit = options.kit ?? (await loadCaseIntakeKit())
  if (!kit?.triageCaseIntake) {
    return '客需三分流 · 失敗（triage 模組未載入，請用 tsx 執行）'
  }

  const result = kit.triageCaseIntake(text)
  const lines = [
    `客需三分流 · ${CASE_INTAKE_FLOW_LABELS[result.flow] ?? result.flow}（flow=${result.flow}）`,
    result.missingFields.length > 0 ? `缺項：${result.missingFields.join('、')}` : '缺項：無',
  ]
  if (result.trickyReasons.length > 0) {
    lines.push(`棘手原因：${result.trickyReasons.join('；')}`)
  }
  lines.push('--- 回覆草稿（夥伴群 would-be reply）---', result.replyText)
  return lines.join('\n')
}

export async function runAgentCommand(args, options = {}) {
  const { commandText, query } = parseAgentCommandArgs(args)
  if (commandText === 'refine-smoke') {
    return runRefineSmokeCommand({ env: options.env ?? process.env })
  }
  if (commandText === 'notion-rag-dry-run') {
    return runNotionRagDryRunCommand({ env: options.env ?? process.env })
  }
  if (commandText === 'notion-rag-search') {
    return runNotionRagSearchCommand({ env: options.env ?? process.env, query })
  }
  if (commandText === 'notion-rag-answer') {
    return runNotionRagAnswerCommand({ env: options.env ?? process.env, query })
  }
  if (commandText === 'notion-rag-change-dry-run') {
    return runNotionRagChangeDryRunCommand({ env: options.env ?? process.env, query })
  }
  if (commandText === 'partner-rag-path-trace') {
    return runPartnerRagPathTraceCommand({ env: options.env ?? process.env, query })
  }
  if (commandText === 'case-intake') {
    return runCaseIntakeCommand({ query })
  }
  const envText = options.envText ?? readEnvFile(options.cwd ?? process.cwd())
  const secret =
    options.secret ??
    process.env.AI_AGENT_INTERNAL_SECRET ??
    readDotEnvValue(envText, 'AI_AGENT_INTERNAL_SECRET')

  if (!secret) {
    throw new Error('找不到 AI_AGENT_INTERNAL_SECRET。請確認 .env.local 或環境變數。')
  }

  const origin = options.origin ?? process.env.AGENT_COMMAND_ORIGIN ?? DEFAULT_ORIGIN
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${origin}/api/agent/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-secret': secret,
    },
    body: JSON.stringify({
      actor: 'eric',
      sourceChannel: 'discord_private',
      commandText,
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(`agent command failed (${response.status}): ${payload?.error ?? 'unknown error'}`)
  }

  const cases = payload?.handlerResult?.meta?.cases ?? []
  return formatInboxCases(cases)
}

function readEnvFile(cwd) {
  const envPath = path.join(cwd, DOTENV_PATH)
  if (!fs.existsSync(envPath)) return ''
  return fs.readFileSync(envPath, 'utf8')
}

function normaliseMissingFields(agentCase) {
  return Array.from(
    new Set([
      ...(agentCase.triage?.missingFields ?? []),
      ...(agentCase.missingFields ?? []),
    ].filter(Boolean))
  )
}

function formatCustomerLabel(agentCase, index) {
  const displayName = String(agentCase.customerDisplayName ?? '').trim()
  if (displayName && !isOpaqueLineFallback(displayName)) {
    return displayName
  }

  return formatPlainLanguageCustomerLabel(agentCase, index)
}

function isOpaqueLineFallback(displayName) {
  return /^LINE-U/i.test(displayName)
}

function formatPlainLanguageCustomerLabel(agentCase, index) {
  const knownFacts = agentCase.triage?.knownFacts ?? {}
  const leadParts = []
  const descriptorParts = []

  if (knownFacts.travelDate) {
    leadParts.push(String(knownFacts.travelDate))
  }

  if (knownFacts.adults !== undefined || knownFacts.children !== undefined) {
    leadParts.push(`${knownFacts.adults ?? '?'}大${knownFacts.children ?? '?'}小`)
  }

  if ((knownFacts.children ?? 0) > 0) {
    descriptorParts.push('親子')
  }

  if (knownFacts.charterDays) {
    descriptorParts.push('包車')
  } else if (knownFacts.interests?.length) {
    descriptorParts.push('旅遊')
  }

  if (leadParts.length > 0 || descriptorParts.length > 0) {
    return `${leadParts.join(' ')}${descriptorParts.join('')}客`
  }

  return `客人 #${index + 1}`
}

function formatNextStep(fields) {
  if (!fields.length) return '可請夥伴開始判斷是否進入排行程'
  return `請確認${fields.map((field) => NEXT_STEP_LABELS[field] ?? field).join('、')}`
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  try {
    const output = await runAgentCommand(process.argv.slice(2))
    console.log(output)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
