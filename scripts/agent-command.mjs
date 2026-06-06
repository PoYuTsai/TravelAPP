#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadNotionRagDryRunRuntime,
  loadNotionRagSearchRuntime,
} from './notion-rag-dry-runner.mjs'

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

  throw new Error('目前支援：inbox、/inbox、notion-rag-dry-run、notion-rag-search')
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

export async function runAgentCommand(args, options = {}) {
  const { commandText, query } = parseAgentCommandArgs(args)
  if (commandText === 'notion-rag-dry-run') {
    return runNotionRagDryRunCommand({ env: options.env ?? process.env })
  }
  if (commandText === 'notion-rag-search') {
    return runNotionRagSearchCommand({ env: options.env ?? process.env, query })
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
