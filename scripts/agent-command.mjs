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
  if (command === 'overdue-dry-run' || command === '/overdue-dry-run') {
    return { commandText: 'overdue-dry-run' }
  }
  if (command === 'case-done' || command === '/case-done') {
    // The remaining arg is the caseId to ack.
    const query = args.slice(1).join(' ').trim()
    return { commandText: 'case-done', query }
  }
  if (command === 'distill-dry-run' || command === '/distill-dry-run') {
    return { commandText: 'distill-dry-run' }
  }
  if (command === 'distill-flush' || command === '/distill-flush') {
    // default 唯讀列 backlog；唯一 flag 是 --write（走閘真寫 Notion）。
    return { commandText: 'distill-flush', write: args.slice(1).includes('--write') }
  }
  if (command === 'approve-parse' || command === '/approve-parse') {
    // 刀A CLI 黑箱內測（design 2026-06-12 §4）：一句話＋fixture 候選清單，
    // 不碰真 store、不貼群。--quoted 模擬「引用 bot 訊息」、--fixture 換候選檔。
    const rest = args.slice(1)
    const takeFlag = (flag) => {
      const i = rest.indexOf(flag)
      if (i === -1) return undefined
      const value = String(rest[i + 1] ?? '').trim()
      // 防呆：缺值 / 值長得像另一個 flag → 明確報錯，絕不默默把 flag 吃進
      // query 或 fallback 到 default fixture（會餵垃圾 context 給付費 LLM）。
      if (value === '' || value.startsWith('--')) {
        throw new Error(
          `approve-parse · 用法：${flag} 後面要接一個值（不能留空或接另一個 flag）`
        )
      }
      rest.splice(i, 2)
      if (rest.includes(flag)) {
        throw new Error(`approve-parse · 用法：${flag} 只能出現一次`)
      }
      return value
    }
    const quoted = takeFlag('--quoted')
    const fixture = takeFlag('--fixture')
    const query = rest.join(' ').trim()
    if (query === '') {
      throw new Error(
        'approve-parse · 用法：npm run agent:approve-parse -- "一句話" [--quoted "引用內容"] [--fixture path.json]'
      )
    }
    return { commandText: 'approve-parse', query, quoted, fixture }
  }
  if (command === 'partner-respond' || command === '/partner-respond') {
    // 檢索閉環刀 CLI 黑箱驗收（design 2026-06-12 §2 驗收）：一句話直打真
    // anthropic responder（含沉澱知識源，若閘開）。不碰真 store、不貼群。
    const rest = args.slice(1)
    // flag 紀律（mirror approve-parse）：絕不默默丟 flag 留值 — 「問題 --quoted
    // 草稿」會把「問題 草稿」併進 query 餵付費 LLM。不支援就明確 throw。
    const badFlag = rest.find((a) => a.startsWith('--'))
    if (badFlag !== undefined) {
      throw new Error(
        `partner-respond · 用法：不支援 flag（收到 ${badFlag}）— 一句話直接接在指令後`
      )
    }
    const query = rest.join(' ').trim()
    if (query === '') {
      throw new Error(
        'partner-respond · 失敗：請帶要問的話（npm run agent:partner-respond -- "兩大兩小小車會不會擠"）'
      )
    }
    return { commandText: 'partner-respond', query }
  }
  if (command === 'partner-image-respond' || command === '/partner-image-respond') {
    // 截圖智慧回覆刀 CLI 黑箱驗收（截圖智慧回覆 design Task 6.1）：讀本地圖→need→
    // agentic RAG/web→兩段。離線測截圖品質再開真群閘。不貼群、不碰真 store。
    const { imagePath } = parseImageRespondArgs(args)
    return { commandText: 'partner-image-respond', imagePath }
  }

  throw new Error(
    '目前支援：inbox、/inbox、notion-rag-dry-run、notion-rag-search、notion-rag-answer、notion-rag-change-dry-run、refine-smoke、partner-rag-path-trace、case-intake、overdue-dry-run、case-done、distill-dry-run、distill-flush、approve-parse、partner-respond、partner-image-respond'
  )
}

/**
 * `partner-image-respond` argv 解析（單一 positional 圖片路徑）。flag 紀律同
 * partner-respond：絕不默默丟 flag。throws ⇒ main 印訊息＋exit 1。
 */
export function parseImageRespondArgs(args) {
  const rest = args.slice(1)
  const badFlag = rest.find((a) => a.startsWith('--'))
  if (badFlag !== undefined) {
    throw new Error(
      `partner-image-respond · 用法：不支援 flag（收到 ${badFlag}）— 只接圖片路徑`
    )
  }
  const imagePath = (rest[0] ?? '').trim()
  if (imagePath === '') {
    throw new Error(
      'partner-image-respond · 失敗：請帶圖片路徑（npm run agent:partner-image-respond -- ./shot.jpg）'
    )
  }
  return { imagePath }
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
// case-intake — 客需三分流 dev harness（design 2026-06-10 §1）
// ---------------------------------------------------------------------------
// CLI 僅為 CC 的開發驗證 harness（非產品；產品形態是夥伴群 @bot）。
// Deterministic 三分流永遠先跑（純函式，不碰 LINE / Notion / LLM）。
// LLM enrichment（問法潤飾／行程草稿閘鏈）只在三閘全開時實打（mirror
// refine-smoke 的 gate 慣例）：
//   1. `AI_AGENT_CASE_INTAKE_LLM_ENABLED === 'true'`（feature gate）
//   2. `AI_AGENT_CASE_INTAKE_LLM_RUNTIME === 'real'`（real-connection gate）
//   3. `ANTHROPIC_API_KEY` present（credential）
// 之外還有 daily cost cap（cap env 未設或 KV 未接 ⇒ adapter fail-closed 不打）。

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

/** 三閘判定（fine-grained reason codes，operator 能看出差哪一閘）。 */
export function caseIntakeLlmGateStatus(env) {
  if (String(env?.AI_AGENT_CASE_INTAKE_LLM_ENABLED ?? '').trim() !== 'true') return 'disabled'
  if (String(env?.AI_AGENT_CASE_INTAKE_LLM_RUNTIME ?? '').trim() !== 'real') return 'runtime_not_real'
  if (String(env?.ANTHROPIC_API_KEY ?? '').trim() === '') return 'missing_key'
  return 'wired'
}

const CASE_INTAKE_LLM_GATE_LABELS = {
  disabled: 'AI_AGENT_CASE_INTAKE_LLM_ENABLED 未開啟',
  runtime_not_real: 'AI_AGENT_CASE_INTAKE_LLM_RUNTIME 不是 real',
  missing_key: 'ANTHROPIC_API_KEY 未設定',
}

/**
 * GUARD-loaded dynamic import of the enrichment kit（enrichment 純函式 +
 * adapter + cost cap + kv client）。任一缺 ⇒ null，命令回 wiring 訊息不爆。
 * Loading 本身零網路；真打發生在 enrichCaseIntakeReply 內被 cost cap 守住。
 */
export async function loadCaseIntakeLlmKit(ctx = {}) {
  const {
    importEnrichmentModule = () =>
      import('../src/lib/line-agent/partner-group/case-intake-enrichment.ts'),
    importAdapterModule = () =>
      import('../src/lib/line-agent/partner-group/case-intake-llm-adapter.ts'),
    importCostCapModule = () =>
      import('../src/lib/line-agent/observability/daily-cost-cap.ts'),
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
  } = ctx
  try {
    const enrichmentMod = await importEnrichmentModule()
    const adapterMod = await importAdapterModule()
    const costCapMod = await importCostCapModule()
    const kvMod = await importKvModule()
    const kit = {
      enrich: enrichmentMod?.enrichCaseIntakeReply ?? null,
      createSources: adapterMod?.createAnthropicCaseIntakeSources ?? null,
      resolveModel: adapterMod?.resolveCaseIntakeLlmModel ?? null,
      createDailyCostCap: costCapMod?.createDailyCostCap ?? null,
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
    }
    if (
      !kit.enrich ||
      !kit.createSources ||
      !kit.resolveModel ||
      !kit.createDailyCostCap ||
      !kit.createKvClientFromEnv
    ) {
      return null
    }
    return kit
  } catch {
    return null
  }
}

const CASE_INTAKE_FLOW_LABELS = {
  insufficient: '資訊不足（缺項模式）',
  sufficient: '資訊已齊',
  tricky: '需 Eric 確認',
}

/** Run the case-intake command. `kit` / `llmKit` are injected in tests. */
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

  // ── LLM enrichment（三閘 + cost cap；任何一閘關 ⇒ 上面 deterministic 結果就是全部）──
  const env = options.env ?? process.env
  const gate = caseIntakeLlmGateStatus(env)
  if (gate !== 'wired') {
    lines.push(`LLM enrichment：未啟用（${CASE_INTAKE_LLM_GATE_LABELS[gate] ?? gate}）`)
    return lines.join('\n')
  }

  const llmKit = options.llmKit ?? (await loadCaseIntakeLlmKit())
  if (!llmKit) {
    lines.push('LLM enrichment：未啟用（enrichment 模組未載入，請用 tsx 執行）')
    return lines.join('\n')
  }

  const transport = options.transport ?? fetch
  const costCap = llmKit.createDailyCostCap({
    env,
    kv: llmKit.createKvClientFromEnv(env),
  })
  const sources = llmKit.createSources({
    transport,
    apiKey: String(env.ANTHROPIC_API_KEY).trim(),
    costCap,
    env,
  })
  const enriched = await llmKit.enrich({
    triage: result,
    requirementText: text,
    sources,
  })
  lines.push(
    `LLM enrichment：${enriched.enrichment}` +
      (enriched.degradedReason ? `（degraded：${enriched.degradedReason}）` : '') +
      `（model=${llmKit.resolveModel({ env })}）`
  )
  if (enriched.enrichment !== 'none') {
    lines.push('--- enriched 回覆（夥伴群 would-be reply）---', enriched.replyText)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// overdue-dry-run / case-done — OA 超時提醒刀1 dev harness（design 2026-06-10 §3）
// ---------------------------------------------------------------------------
// dry-run 是 READ-ONLY：從 store 列 would-remind cases，不寫 KV、不發 LINE。
// case-done 與夥伴群 `@bot done <caseId>` 共用同一個 handler（CLI 僅為 CC 的
// dev 驗證 harness；產品 ack 入口是群內指令）。有 KV env 時打的是真 store。

/** GUARD-loaded dynamic import of the overdue kit（同 loadCaseIntakeKit 慣例）。 */
export async function loadOverdueKit(ctx = {}) {
  const {
    importOverdueModule = () => import('../src/lib/line-agent/cases/overdue-reminder.ts'),
    importHandledModule = () => import('../src/lib/line-agent/cases/handled-command.ts'),
    importStoreModule = () => import('../src/lib/line-agent/storage/select-store.ts'),
  } = ctx
  try {
    const overdueMod = await importOverdueModule()
    const handledMod = await importHandledModule()
    const storeMod = await importStoreModule()
    const kit = {
      listWouldRemindCases: overdueMod?.listWouldRemindCases ?? null,
      formatOverdueDryRunReport: overdueMod?.formatOverdueDryRunReport ?? null,
      markCaseHandled: handledMod?.markCaseHandled ?? null,
      selectStore: storeMod?.selectStore ?? null,
    }
    if (
      !kit.listWouldRemindCases ||
      !kit.formatOverdueDryRunReport ||
      !kit.markCaseHandled ||
      !kit.selectStore
    ) {
      return null
    }
    return kit
  } catch {
    return null
  }
}

/** READ-ONLY dry-run：列 would-remind cases。`kit`/`store`/`now` 注入供測試。 */
export async function runOverdueDryRunCommand(options = {}) {
  const kit = options.kit ?? (await loadOverdueKit())
  if (!kit) {
    return 'OA 超時 dry-run · 失敗（overdue 模組未載入，請用 tsx 執行）'
  }
  const store = options.store ?? kit.selectStore()
  const now = options.now ?? new Date().toISOString()
  const cases = await store.listAll()
  const wouldRemind = kit.listWouldRemindCases(cases, now)
  return kit.formatOverdueDryRunReport(wouldRemind)
}

/** Ack 一個 case（與群內 @bot done 同 handler）。WRITES the store. */
export async function runCaseDoneCommand(options = {}) {
  const caseId = String(options.query ?? '').trim()
  if (!caseId) {
    return 'case-done · 失敗（請帶 caseId：npm run agent:case-done -- CW-0601-001）'
  }
  const kit = options.kit ?? (await loadOverdueKit())
  if (!kit) {
    return 'case-done · 失敗（overdue 模組未載入，請用 tsx 執行）'
  }
  const store = options.store ?? kit.selectStore()
  const now = options.now ?? new Date().toISOString()
  const result = await kit.markCaseHandled({
    store,
    caseId,
    actor: options.actor ?? 'cli-operator',
    now,
  })
  return result.replyText
}

// ---------------------------------------------------------------------------
// distill-dry-run — 沉澱刀2 dev harness（design 2026-06-11 §2）
// ---------------------------------------------------------------------------
// 唯讀 dry-run：上線前驗 LLM 候選品質用。真 KV 掃檔 → 織串 → 一次真 LLM →
// 印候選 — 但**絕不** markTranscriptDistilled、**絕不** putDistillPending、
// **絕不**貼群。跑幾次都不留痕：transcript 不標、pending 不寫、LINE 零訊息。
// 產品入口是夥伴群「@bot 沉澱」；這裡只是 CC 的離線品質檢查 harness。

/** GUARD-loaded dynamic import of the distill kit（同 loadOverdueKit 慣例）。 */
export async function loadDistillKit(ctx = {}) {
  const {
    importRunModule = () => import('../src/lib/line-agent/distill/run-distillation.ts'),
    importWeaverModule = () => import('../src/lib/line-agent/distill/thread-weaver.ts'),
    importAdapterModule = () => import('../src/lib/line-agent/distill/distill-llm-adapter.ts'),
    importCandidatesModule = () => import('../src/lib/line-agent/distill/candidates.ts'),
    importCostCapModule = () =>
      import('../src/lib/line-agent/observability/daily-cost-cap.ts'),
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
  } = ctx
  try {
    const runMod = await importRunModule()
    const weaverMod = await importWeaverModule()
    const adapterMod = await importAdapterModule()
    const candidatesMod = await importCandidatesModule()
    const costCapMod = await importCostCapModule()
    const kvMod = await importKvModule()
    const kit = {
      isDistillEnabled: runMod?.isDistillEnabled ?? null,
      weaveTranscript: weaverMod?.weaveTranscript ?? null,
      createSource: adapterMod?.createAnthropicDistillSource ?? null,
      resolveModel: adapterMod?.resolveDistillModel ?? null,
      parseCandidates: candidatesMod?.parseDistillCandidates ?? null,
      createDailyCostCap: costCapMod?.createDailyCostCap ?? null,
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
      KvStore: kvMod?.KvStore ?? null,
    }
    if (
      !kit.isDistillEnabled ||
      !kit.weaveTranscript ||
      !kit.createSource ||
      !kit.resolveModel ||
      !kit.parseCandidates ||
      !kit.createDailyCostCap ||
      !kit.createKvClientFromEnv ||
      !kit.KvStore
    ) {
      return null
    }
    return kit
  } catch {
    return null
  }
}

/**
 * READ-ONLY distill dry-run。throws ⇒ main 印訊息＋exit 1（缺閘/缺 env/LLM 失敗）；
 * return string ⇒ exit 0。`kit`/`store`/`transport` 注入供測試。
 */
export async function runDistillDryRunCommand(options = {}) {
  const env = options.env ?? process.env
  const kit = options.kit ?? (await loadDistillKit())
  if (!kit) {
    throw new Error('distill-dry-run · 失敗（distill 模組未載入，請用 tsx 執行）')
  }

  // ① 前置檢查 — 缺哪個就明說（exit 1），絕不默默 fallback
  if (!kit.isDistillEnabled(env)) {
    throw new Error(
      'distill-dry-run · 失敗：AI_AGENT_DISTILL_ENABLED 未開（.env.local 設 true 才跑）'
    )
  }
  if (!String(env.ANTHROPIC_API_KEY ?? '').trim()) {
    throw new Error('distill-dry-run · 失敗：缺 ANTHROPIC_API_KEY')
  }
  const groupId = String(env.LINE_PARTNER_GROUP_ID ?? '').trim()
  if (!groupId) {
    throw new Error('distill-dry-run · 失敗：缺 LINE_PARTNER_GROUP_ID（不知道要掃哪個群）')
  }
  const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
  if (!kvClient) {
    throw new Error('distill-dry-run · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（KV 未接）')
  }

  // ② 真 KV 掃檔 — 同 runDistillation ① 的 filter（本群＋未 distilled）
  const store = options.store ?? new kit.KvStore(kvClient)
  const all = await store.listTranscriptEntries()
  const fresh = all.filter((e) => e.groupId === groupId && e.distilled !== true)

  // ③ 織串＋統計；零訊息就不打 LLM（沒得織就沒得花錢）
  const woven = kit.weaveTranscript(fresh)
  const lines = [
    'distill-dry-run（唯讀 — 不標 distilled、不寫 pending、不貼群）',
    `掃到 ${fresh.length} 則未沉澱訊息（存檔共 ${all.length} 則）`,
  ]
  if (woven.unreadableImageCount > 0) {
    lines.push(`⚠️ 有 ${woven.unreadableImageCount} 張截圖讀不到，已略過`)
  }
  if (woven.promptText === '') {
    lines.push('沒有可沉澱訊息 — 不打 LLM，結束。')
    return lines.join('\n')
  }

  // ④ 一次真 LLM（costCap 必接 — 同 webhook getDistillSource 組法）→ zero-trust 解析
  const costCap = kit.createDailyCostCap({ env, kv: kvClient })
  const source = kit.createSource({
    transport: options.transport ?? fetch,
    apiKey: String(env.ANTHROPIC_API_KEY).trim(),
    costCap,
    env,
  })
  lines.push(`model=${kit.resolveModel({ env })} · 沉澱估 $0.05–0.15/次`)
  const raw = await source(woven.promptText)
  const candidates = kit.parseCandidates(raw)

  // ⑤ 印候選 — 看品質用；這裡刻意零寫入（唯讀 harness 鐵律，見檔頭註解）
  if (candidates.length === 0) {
    lines.push('LLM 沒有找到重複的常規問答（0 條候選）。')
    return lines.join('\n')
  }
  lines.push(`--- 候選（${candidates.length} 條）---`)
  candidates.forEach((c, i) => {
    lines.push(`${i + 1}. Q：${c.question}`)
    lines.push(`   A：${c.answer}（出現 ${c.occurrences} 次｜出處行號 #${c.sourceLines.join(' #')}）`)
  })
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// distill-flush — 沉澱刀3 backlog 手動補寫／驗收工具（design 2026-06-11 §3 ⑤）
// ---------------------------------------------------------------------------
// default（唯讀）：真 KV getDistillPending → 列 resolved 中未寫入（無
// notionPageId）的 backlog — 零寫入，跑幾次都不留痕。
// --write：閘照規矩走（resolveKnowledgeWriteConfig 不 enabled ⇒ exit 1，
// **CLI 不繞閘**）→ buildDefaultDistilledQaWriter → flushResolvedToNotion。
// memory 教訓：CLI 載 .env.local — 三件齊＋--write ＝**真寫 Notion**。

/** GUARD-loaded dynamic import of the flush kit（同 loadDistillKit 慣例）。 */
export async function loadDistillFlushKit(ctx = {}) {
  const {
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
    importConfigModule = () =>
      import('../src/lib/line-agent/distill/knowledge-write-config.ts'),
    importFlushModule = () =>
      import('../src/lib/line-agent/distill/knowledge-flush.ts'),
  } = ctx
  try {
    const kvMod = await importKvModule()
    const configMod = await importConfigModule()
    const flushMod = await importFlushModule()
    const kit = {
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
      KvStore: kvMod?.KvStore ?? null,
      resolveKnowledgeWriteConfig: configMod?.resolveKnowledgeWriteConfig ?? null,
      flushResolvedToNotion: flushMod?.flushResolvedToNotion ?? null,
    }
    if (
      !kit.createKvClientFromEnv ||
      !kit.KvStore ||
      !kit.resolveKnowledgeWriteConfig ||
      !kit.flushResolvedToNotion
    ) {
      return null
    }
    return kit
  } catch {
    return null
  }
}

/** Writer builder 只在 --write 且閘 enabled 才載 — 唯讀路徑零 Notion SDK。 */
async function loadDistilledQaWriterBuilder() {
  try {
    const mod = await import(
      '../src/lib/line-agent/line/install-default-distilled-qa-writer.ts'
    )
    return mod?.buildDefaultDistilledQaWriter ?? null
  } catch {
    return null
  }
}

/**
 * Backlog 預覽（default）／走閘真寫（--write）。throws ⇒ main 印訊息＋exit 1
 * （缺 env / 閘未開 / 模組未載入）；return string ⇒ exit 0。
 * `kit`/`store`/`buildWriter` 注入供測試。
 */
export async function runDistillFlushCommand(options = {}) {
  const env = options.env ?? process.env
  const write = options.write === true
  const kit = options.kit ?? (await loadDistillFlushKit())
  if (!kit) {
    throw new Error('distill-flush · 失敗（distill 模組未載入，請用 tsx 執行）')
  }

  // ① 前置檢查 — 缺哪個就明說（exit 1），絕不默默 fallback
  const groupId = String(env.LINE_PARTNER_GROUP_ID ?? '').trim()
  if (!groupId) {
    throw new Error(
      'distill-flush · 失敗：缺 LINE_PARTNER_GROUP_ID（不知道要讀哪個群的 backlog）'
    )
  }
  const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
  if (!kvClient) {
    throw new Error('distill-flush · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（KV 未接）')
  }

  // ② --write 先驗閘（fail-fast，省一趟 KV 讀取）— 不 enabled 就 exit 1，CLI 不繞閘
  const config = write ? kit.resolveKnowledgeWriteConfig(env) : null
  if (write && !config.enabled) {
    throw new Error(
      `distill-flush --write · 失敗：KNOWLEDGE_WRITE_ENABLED 閘未開（reason=${config.reason ?? 'disabled'}）`
    )
  }

  // ③ 真 KV 讀 pending batch — 唯讀；無 batch ＝ 空 backlog
  const store = options.store ?? new kit.KvStore(kvClient)
  const batch = await store.getDistillPending(groupId)
  const resolved = batch?.resolved ?? []
  const unwritten = resolved.filter((c) => c.notionPageId === undefined)
  const writtenCount = resolved.length - unwritten.length

  const lines = [
    write
      ? 'distill-flush --write（走 KNOWLEDGE_WRITE_ENABLED 閘，真寫 Notion）'
      : 'distill-flush（唯讀 — 列 backlog，零寫入）',
    `backlog：${unwritten.length} 條 resolved 未寫入（已寫入 ${writtenCount} 條）`,
  ]
  unwritten.forEach((c) => {
    // modify ＝ Eric 改寫版為準（同 distilled-qa-writer 寫入時的取法）
    const answer =
      c.status === 'modified' && c.modifiedAnswer !== undefined
        ? c.modifiedAnswer
        : c.answer
    lines.push(`${c.id}. Q：${c.question}`)
    lines.push(`   A：${answer}（status=${c.status}｜出現 ${c.occurrences} 次）`)
  })

  if (!write) {
    lines.push('dry-run：加 --write 才真寫。')
    return lines.join('\n')
  }

  if (unwritten.length === 0) {
    lines.push('backlog 為空 — 沒東西可寫，結束。')
    return lines.join('\n')
  }

  // ④ 構建真 writer（composition root）→ flush 全部 backlog → 印 written/failed
  const buildWriter = options.buildWriter ?? (await loadDistilledQaWriterBuilder())
  if (!buildWriter) {
    throw new Error('distill-flush --write · 失敗（writer 模組未載入，請用 tsx 執行）')
  }
  const built = buildWriter(env)
  if (!built.writer) {
    throw new Error(
      `distill-flush --write · 失敗：writer 構建失敗（reason=${built.reason ?? 'unknown'}）`
    )
  }
  const result = await kit.flushResolvedToNotion({
    store,
    groupId,
    writer: built.writer,
    now: options.now ?? Date.now(),
  })
  lines.push(`flush 完成：written=${result.written} · failed=${result.failed}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// approve-parse — 刀A CLI 黑箱內測入口（design 2026-06-12 §4）
// ---------------------------------------------------------------------------
// 一句話 → 層1 regex → （miss 時）層2 真 LLM intent parser → deterministic
// 驗證 vs fixture 候選清單。鐵律：**不碰真 store（不讀不寫 pending/
// confirmation）、不貼群** — KV 只接 cost cap（cost 紀律不因離線而豁免——
// memory 教訓：CLI 載 .env.local，閘＋key 齊就是真打 API、真花錢）。

/** GUARD-loaded dynamic import（同 loadDistillKit 慣例）。 */
export async function loadApproveParseKit(ctx = {}) {
  const {
    importApprovalModule = () => import('../src/lib/line-agent/distill/approval.ts'),
    importIntentModule = () => import('../src/lib/line-agent/distill/approval-intent.ts'),
    importAdapterModule = () =>
      import('../src/lib/line-agent/distill/approval-llm-adapter.ts'),
    importRunModule = () => import('../src/lib/line-agent/distill/run-distillation.ts'),
    importCostCapModule = () =>
      import('../src/lib/line-agent/observability/daily-cost-cap.ts'),
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
  } = ctx
  try {
    const approvalMod = await importApprovalModule()
    const intentMod = await importIntentModule()
    const adapterMod = await importAdapterModule()
    const runMod = await importRunModule()
    const costCapMod = await importCostCapModule()
    const kvMod = await importKvModule()
    const kit = {
      parseDistillApproval: approvalMod?.parseDistillApproval ?? null,
      parseApprovalIntentJson: intentMod?.parseApprovalIntentJson ?? null,
      createAnthropicApprovalIntentSource:
        adapterMod?.createAnthropicApprovalIntentSource ?? null,
      resolveApprovalIntentModel: adapterMod?.resolveApprovalIntentModel ?? null,
      isDistillEnabled: runMod?.isDistillEnabled ?? null,
      createDailyCostCap: costCapMod?.createDailyCostCap ?? null,
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
    }
    if (
      !kit.parseDistillApproval ||
      !kit.parseApprovalIntentJson ||
      !kit.createAnthropicApprovalIntentSource ||
      !kit.resolveApprovalIntentModel ||
      !kit.isDistillEnabled ||
      !kit.createDailyCostCap ||
      !kit.createKvClientFromEnv
    ) {
      return null
    }
    return kit
  } catch {
    return null
  }
}

/**
 * Deterministic 驗證 vs fixture — 同 applyDistillApproval ① 的 wantedIds 邏輯
 * （層1 regex 給 `type`、層2 intent 給 `action`，兩種 shape 都收）。
 * 超界（含部分超界）＝整批拒絕，與真機行為一致。
 */
export function validateAgainstFixture(parsed, candidates) {
  const kind = parsed.type ?? parsed.action
  const wantedIds =
    kind === 'approve_all'
      ? candidates.map((c) => c.id)
      : kind === 'approve'
        ? parsed.indices
        : [parsed.index]
  const idSet = new Set(candidates.map((c) => c.id))
  const missing = wantedIds.filter((id) => !idSet.has(id))
  if (missing.length > 0) {
    return `驗證失敗：沒有第 ${missing.join('、')} 條（整批拒絕）`
  }
  return `驗證通過：會收 ${wantedIds.join('、')}`
}

/**
 * 刀A 黑箱內測：throws ⇒ main 印訊息＋exit 1（缺閘/缺 env/fixture 壞）；
 * return string ⇒ exit 0。`kit`/`intentSource`/`kvClient`/`transport` 注入供測試。
 */
export async function runApproveParseCommand(options = {}) {
  const env = options.env ?? process.env
  const kit = options.kit ?? (await loadApproveParseKit())
  if (!kit) {
    throw new Error('approve-parse · 失敗（模組未載入，請用 tsx 執行）')
  }

  // ① 前置閘（同 distill-dry-run：缺哪個就明說，絕不默默 fallback）
  if (!kit.isDistillEnabled(env)) {
    throw new Error(
      'approve-parse · 失敗：AI_AGENT_DISTILL_ENABLED 未開（.env.local 設 true 才跑）'
    )
  }
  if (!String(env.ANTHROPIC_API_KEY ?? '').trim()) {
    throw new Error('approve-parse · 失敗：缺 ANTHROPIC_API_KEY')
  }

  // ② fixture 候選（不碰真 pending — 候選清單一律來自檔案）
  const fixturePath = options.fixture ?? 'scripts/fixtures/distill-approve-candidates.json'
  let candidates
  try {
    candidates = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  } catch {
    throw new Error(`approve-parse · 失敗：fixture 讀取/解析失敗（${fixturePath}）`)
  }
  if (
    !Array.isArray(candidates) ||
    candidates.length === 0 ||
    !candidates.every(
      (c) =>
        typeof c?.id === 'number' &&
        typeof c?.question === 'string' &&
        typeof c?.answer === 'string'
    )
  ) {
    throw new Error(`approve-parse · 失敗：fixture 格式不對（要 [{id,question,answer}]）`)
  }

  const lines = [
    'approve-parse（黑箱內測 — 不碰真 store、不貼群）',
    `輸入：「${options.query}」${options.quoted ? `（引用：「${options.quoted}」）` : ''}`,
    `候選 fixture：${candidates.map((c) => c.id).join('、')}（${fixturePath}）`,
  ]

  // ③ 層1 regex（零成本零延遲 — 命中就不打 LLM）
  const regexHit = kit.parseDistillApproval(options.query)
  if (regexHit !== null) {
    lines.push(`層1 regex 命中：${JSON.stringify(regexHit)}`)
    lines.push(validateAgainstFixture(regexHit, candidates))
    return lines.join('\n')
  }
  lines.push('層1 regex miss → 層2 LLM intent parser')

  // ④ 層2 真 LLM。intentSource 注入＝測試；否則組真 source — costCap 必接
  //    （KV 缺就 throw，cost 紀律不豁免）。
  let source = options.intentSource ?? null
  if (!source) {
    const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
    if (!kvClient) {
      throw new Error('approve-parse · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（cost cap 要 KV）')
    }
    const costCap = kit.createDailyCostCap({ env, kv: kvClient })
    source = kit.createAnthropicApprovalIntentSource({
      transport: options.transport ?? fetch,
      apiKey: String(env.ANTHROPIC_API_KEY).trim(),
      costCap,
      env,
    })
  }
  lines.push(`model=${kit.resolveApprovalIntentModel({ env })} · 估 <$0.01/次`)
  const raw = await source({
    text: options.query,
    candidates,
    ...(options.quoted ? { quotedBotContent: options.quoted } : {}),
  })
  const intent = kit.parseApprovalIntentJson(raw)

  // ⑤ 印結果＋deterministic 驗證（純對照 fixture，零寫入）
  if (intent === null) {
    lines.push(
      `LLM 回傳解析失敗（raw：${raw}）→ 真機會回防呆兜底：「看不懂這句，要收哪幾條？例：1 3 要」`
    )
  } else if (intent.action === 'not_approval') {
    lines.push('LLM 判定 not_approval → 真機會落回 responder（日常問答不受劫持）')
  } else {
    lines.push(`LLM intent：${JSON.stringify(intent)}`)
    lines.push(validateAgainstFixture(intent, candidates))
    // 真機 resolveDistillApproval：low confidence（含 approve_all）一律走複述確認
    if (intent.confidence === 'low') {
      lines.push('信心 low → 真機會走複述確認（引用複述句回「對」才收）')
    }
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// partner-respond — 檢索閉環刀 CLI 黑箱驗收入口（design 2026-06-12 §2 驗收）
// ---------------------------------------------------------------------------
// 一句話 → 真 anthropic responder（含沉澱知識源，若閘開）→ 印回覆。鐵律同
// approve-parse：**不碰真 store、不貼群** — KV 只接 cost cap（cost 紀律不因
// 離線而豁免——memory 教訓：CLI 載 .env.local，閘＋key 齊就是真打 API、真花錢）。

/** GUARD-loaded dynamic import（同 loadApproveParseKit 慣例）。 */
export async function loadPartnerRespondKit(ctx = {}) {
  const {
    importFactoryModule = () =>
      import('../src/lib/line-agent/partner-group/responder-factory.ts'),
    importConfigModule = () =>
      import('../src/lib/line-agent/partner-group/responder-config.ts'),
    importInstallerModule = () =>
      import('../src/lib/line-agent/line/install-default-qa-knowledge-source.ts'),
    importCostCapModule = () =>
      import('../src/lib/line-agent/observability/daily-cost-cap.ts'),
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
    importToolGateModule = () => import('../src/lib/line-agent/tools/tool-gate.ts'),
    importToolConfigModule = () => import('../src/lib/line-agent/tools/tool-config.ts'),
  } = ctx
  try {
    const factoryMod = await importFactoryModule()
    const configMod = await importConfigModule()
    const installerMod = await importInstallerModule()
    const costCapMod = await importCostCapModule()
    const kvMod = await importKvModule()
    const toolGateMod = await importToolGateModule()
    const toolConfigMod = await importToolConfigModule()
    const kit = {
      createPartnerGroupResponder: factoryMod?.createPartnerGroupResponder ?? null,
      getPartnerResponderConfig: configMod?.getPartnerResponderConfig ?? null,
      buildDefaultQaKnowledgeSource: installerMod?.buildDefaultQaKnowledgeSource ?? null,
      createDailyCostCap: costCapMod?.createDailyCostCap ?? null,
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
      canUseExternalTool: toolGateMod?.canUseExternalTool ?? null,
      loadToolConfig: toolConfigMod?.loadToolConfig ?? null,
    }
    if (Object.values(kit).some((v) => !v)) return null
    return kit
  } catch {
    return null
  }
}

/**
 * 檢索閉環刀黑箱驗收：throws ⇒ main 印訊息＋exit 1（缺閘/缺 env）；return
 * string ⇒ exit 0。`kit`/`kvClient`/`transport` 注入供測試。知識閘
 * （QA_KNOWLEDGE_READ_ENABLED）關不擋跑（照樣問 — 用來對照「有知識 vs
 * 無知識」答案差異）；responder mode / key / KV 缺則明確 throw。
 */
export async function runPartnerRespondCommand(options = {}) {
  const env = options.env ?? process.env
  const kit = options.kit ?? (await loadPartnerRespondKit())
  if (!kit) {
    throw new Error('partner-respond · 失敗（模組未載入，請用 tsx 執行）')
  }

  // ① 前置閘（同 approve-parse：缺哪個就明說，絕不默默 fallback / degrade stub）
  const models = kit.getPartnerResponderConfig(env)
  if (models.partnerResponderMode !== 'anthropic') {
    throw new Error(
      'partner-respond · 失敗：AI_AGENT_PARTNER_RESPONDER_MODE 不是 anthropic（黑箱要打真 API）'
    )
  }
  if (!models.anthropicApiKey) {
    throw new Error('partner-respond · 失敗：缺 ANTHROPIC_API_KEY')
  }
  // 驗收 CLI 絕不 exit 0 印 stub：model 缺 ⇒ adapter 會降級 stub，必須擋在閘①
  if (!models.defaultModel || !models.researchModel) {
    throw new Error('partner-respond · 失敗：缺 AI_AGENT_DEFAULT_MODEL / AI_AGENT_RESEARCH_MODEL')
  }
  // cap env 缺/空 ⇒ daily-cost-cap 靜默 disabled（不擋花費），同樣不得當過關
  if ((env.AI_AGENT_DAILY_COST_CAP_USD ?? '').trim() === '') {
    throw new Error(
      'partner-respond · 失敗：缺 AI_AGENT_DAILY_COST_CAP_USD（cost cap 未設會靜默 disabled）'
    )
  }

  // ② costCap 必接 KV（KV 缺就 throw，cost 紀律不豁免）
  const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
  if (!kvClient) {
    throw new Error('partner-respond · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（cost cap 要 KV）')
  }
  const costCap = kit.createDailyCostCap({ env, kv: kvClient })

  // ③ 知識源走真 composition root（閘關 ⇒ source undefined＋fixed reason，照樣問）
  const built = kit.buildDefaultQaKnowledgeSource(env)
  const knowledgeSource = built.source

  // 外部佐證刀 — 與 webhook 同一個 composition-root 判法（tool-gate 單一事實來源）
  const webSearchGate = kit.canUseExternalTool(
    {
      tool: 'web_search',
      sourceChannel: 'line_partner_group',
      botDirected: true,
      userRequestedExternalData: false,
      costSpentUsd: 0,
    },
    kit.loadToolConfig(env)
  )

  const responder = kit.createPartnerGroupResponder({
    models,
    transport: options.transport ?? fetch,
    costCap,
    knowledgeSource,
    webSearchEnabled: webSearchGate.allowed,
  })

  // ④ 最小 event（CLI 黑箱；adapter 只讀 text / intent / quotedBotContent / log）。
  //    intent 是 CommandIntent 物件（routePartnerModel 讀 .action）— respond →
  //    defaultModel，與真機路由一致。真機排行程訊息經 LLM classifier 會判
  //    action='draft'（走 researchModel＋Q2 tripwire）；黑箱用 PARTNER_RESPOND_INTENT
  //    env 覆寫以驗 draft 路徑，預設 respond（不破「不收 flag」紀律）。
  const intentAction = (env.PARTNER_RESPOND_INTENT ?? 'respond').trim() || 'respond'
  const result = await responder.respond({
    event: { kind: 'group_text', sourceChannel: 'partner_group', mentionsBot: true },
    intent: { action: intentAction, confidence: 'high', source: 'deterministic' },
    text: options.query,
    botDirected: true,
  })

  return [
    'partner-respond（黑箱驗收 — 不碰真 store、不貼群）',
    `輸入：「${options.query}」`,
    `知識源：${knowledgeSource ? '已接（QA_KNOWLEDGE_READ_ENABLED 閘開）' : `未接（${built.reason}）`}`,
    `搜證：${webSearchGate.allowed ? '開（web_search 已掛，max 3 次/題）' : '關（AI_AGENT_WEB_SEARCH_ENABLED 未開或 AI_AGENT_TOOL_COST_CAP_USD 未設）'}`,
    `meta：${JSON.stringify(result.meta)}`,
    '--- 回覆 ---',
    result.text,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// partner-image-respond — 截圖智慧回覆刀 CLI 黑箱驗收入口（design Task 6.1）
// ---------------------------------------------------------------------------
// 讀本地圖片 → 抽 VisionNeedBrief → 跑 agentic 兩段回迴圈 → 印兩段回覆。供 Eric
// 離線測截圖回覆品質，再翻真群 env 閘。鐵律同 partner-respond：**不貼群、不碰真
// store** — KV 只接 cost cap（cost 紀律不因離線豁免）。反遺漏接線（plan Important）：
// 本刀必同時接 getRagIndex（AI_AGENT_NOTION_RAG_ENABLED 閘）＋ webSearchEnabled
// （web_search 閘），鏡像 webhook-runtime buildSmartReplyVisionResponder 的接線，
// 絕不重演舊 partner-respond 漏接 source 的 class of bug。

/** 副檔名 → Anthropic vision 支援的 media type（不支援即 throw 明確訊息）。 */
const IMAGE_EXT_MEDIA_TYPE = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

/** GUARD-loaded dynamic import（同 loadPartnerRespondKit 慣例）。 */
export async function loadPartnerImageRespondKit(ctx = {}) {
  const {
    importConfigModule = () =>
      import('../src/lib/line-agent/partner-group/responder-config.ts'),
    importVisionNeedModule = () =>
      import('../src/lib/line-agent/partner-group/vision-need-extraction.ts'),
    importAgentModule = () =>
      import('../src/lib/line-agent/partner-group/smart-reply-agent.ts'),
    importItineraryIndexModule = () =>
      import('../src/lib/line-agent/line/install-default-itinerary-reference-index.ts'),
    importRagGateModule = () =>
      import('../src/lib/line-agent/line/itinerary-reference-wiring.ts'),
    importCostCapModule = () =>
      import('../src/lib/line-agent/observability/daily-cost-cap.ts'),
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
    importToolGateModule = () => import('../src/lib/line-agent/tools/tool-gate.ts'),
    importToolConfigModule = () => import('../src/lib/line-agent/tools/tool-config.ts'),
  } = ctx
  try {
    const configMod = await importConfigModule()
    const visionNeedMod = await importVisionNeedModule()
    const agentMod = await importAgentModule()
    const itineraryIndexMod = await importItineraryIndexModule()
    const ragGateMod = await importRagGateModule()
    const costCapMod = await importCostCapModule()
    const kvMod = await importKvModule()
    const toolGateMod = await importToolGateModule()
    const toolConfigMod = await importToolConfigModule()
    const kit = {
      getPartnerResponderConfig: configMod?.getPartnerResponderConfig ?? null,
      createAnthropicVisionNeedSource: visionNeedMod?.createAnthropicVisionNeedSource ?? null,
      createSmartReplyAgent: agentMod?.createSmartReplyAgent ?? null,
      buildItineraryIndexLoader: itineraryIndexMod?.buildDefaultItineraryRagIndexLoader ?? null,
      isNotionRagEnabled: ragGateMod?.isNotionRagEnabled ?? null,
      createDailyCostCap: costCapMod?.createDailyCostCap ?? null,
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
      canUseExternalTool: toolGateMod?.canUseExternalTool ?? null,
      loadToolConfig: toolConfigMod?.loadToolConfig ?? null,
    }
    if (Object.values(kit).some((v) => !v)) return null
    return kit
  } catch {
    return null
  }
}

/**
 * 截圖智慧回覆黑箱驗收：throws ⇒ main 印訊息＋exit 1（缺閘/缺 env/讀檔失敗）；
 * return string ⇒ exit 0。`kit`/`kvClient` 注入供測試。前置閘同 partner-respond：
 * mode!=anthropic / 缺 key / 缺 model / 缺 cap / 缺 KV 都明確 throw（黑箱要打真 API，
 * 絕不默默 degrade stub）。
 */
export async function runPartnerImageRespondCommand(options = {}) {
  const env = options.env ?? process.env
  const kit = options.kit ?? (await loadPartnerImageRespondKit())
  if (!kit) {
    throw new Error('partner-image-respond · 失敗（模組未載入，請用 tsx 執行）')
  }

  // ① 前置閘（鏡像 partner-respond：缺哪個就明說，絕不默默 fallback / degrade stub）
  const models = kit.getPartnerResponderConfig(env)
  if (models.partnerResponderMode !== 'anthropic') {
    throw new Error(
      'partner-image-respond · 失敗：AI_AGENT_PARTNER_RESPONDER_MODE 不是 anthropic（黑箱要打真 API）'
    )
  }
  if (!models.anthropicApiKey) {
    throw new Error('partner-image-respond · 失敗：缺 ANTHROPIC_API_KEY')
  }
  if (!models.defaultModel || !models.researchModel) {
    throw new Error(
      'partner-image-respond · 失敗：缺 AI_AGENT_DEFAULT_MODEL / AI_AGENT_RESEARCH_MODEL'
    )
  }
  if ((env.AI_AGENT_DAILY_COST_CAP_USD ?? '').trim() === '') {
    throw new Error(
      'partner-image-respond · 失敗：缺 AI_AGENT_DAILY_COST_CAP_USD（cost cap 未設會靜默 disabled）'
    )
  }

  // ② costCap 必接 KV（KV 缺就 throw，cost 紀律不豁免）
  const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
  if (!kvClient) {
    throw new Error('partner-image-respond · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（cost cap 要 KV）')
  }
  const costCap = kit.createDailyCostCap({ env, kv: kvClient })

  // ③ 讀本地圖片 → base64 + 依副檔名推 mediaType → LineImageContent。讀檔失敗
  //    包成明確訊息（絕不丟 raw stack）。
  const ext = path.extname(options.imagePath ?? '').toLowerCase()
  const mediaType = IMAGE_EXT_MEDIA_TYPE[ext]
  if (!mediaType) {
    throw new Error(
      `partner-image-respond · 失敗：不支援的圖片副檔名「${ext || '(無)'}」（支援 .jpg/.jpeg/.png/.gif/.webp）`
    )
  }
  let base64
  try {
    base64 = fs.readFileSync(options.imagePath).toString('base64')
  } catch {
    throw new Error(`partner-image-respond · 失敗：讀不到圖片（${options.imagePath}）`)
  }
  const image = { base64, mediaType }

  // ④ 反遺漏接線 — RAG 閘 ＋ web_search 閘，鏡像 webhook-runtime 的單一事實來源。
  //    RAG 閘關 ⇒ getRagIndex=undefined（agent 不掛 search_chiangmai_cases、絕不建索引）；
  //    閘開 ⇒ 注入 TTL 快取 loader（與排行程參考源同一份機制）。
  const ragEnabled = kit.isNotionRagEnabled(env)
  let getRagIndex
  if (ragEnabled) {
    const built = kit.buildItineraryIndexLoader({ env })
    const loader = typeof built === 'function' ? built : built?.loader
    if (!loader) {
      throw new Error(
        `partner-image-respond · 失敗：RAG 閘開但索引未建（${built?.reason ?? 'unknown'}）`
      )
    }
    getRagIndex = loader
  }

  // web_search 閘 — 與 webhook 同一個 composition-root 判法（tool-gate 單一事實來源）。
  const webSearchGate = kit.canUseExternalTool(
    {
      tool: 'web_search',
      sourceChannel: 'line_partner_group',
      botDirected: true,
      userRequestedExternalData: false,
      costSpentUsd: 0,
    },
    kit.loadToolConfig(env)
  )

  // ⑤ 建 need source ＋ agent（兩者共用同一 daily cost cap，鏡像 webhook-runtime）。
  const need = kit.createAnthropicVisionNeedSource({
    transport: options.transport ?? fetch,
    apiKey: models.anthropicApiKey,
    costCap,
    env,
  })
  const agent = kit.createSmartReplyAgent({
    transport: options.transport ?? fetch,
    apiKey: models.anthropicApiKey,
    defaultModel: models.defaultModel,
    costCap,
    getRagIndex,
    webSearchEnabled: webSearchGate.allowed,
  })

  // ⑥ 圖→need→agent。最小 PartnerGroupRespondInput：botDirected true（允許 web
  //    search）、sourceChannel 非 line_oa（夥伴群面，agent per-request 收窄才放行）。
  const brief = await need(image)
  const input = {
    event: { kind: 'image', sourceChannel: 'line_partner_group', mentionsBot: true },
    intent: { action: 'respond', confidence: 'high', source: 'deterministic' },
    text: '',
    botDirected: true,
  }
  const result = await agent(brief, input)

  return [
    'partner-image-respond（黑箱驗收 — 不碰真 store、不貼群）',
    `圖片：${options.imagePath}（${mediaType}）`,
    `語義 need：${brief.summary}`,
    `RAG：${getRagIndex ? '開（search_chiangmai_cases 已掛）' : '關（AI_AGENT_NOTION_RAG_ENABLED 未開）'}`,
    `搜證：${webSearchGate.allowed ? '開（web_search 已掛，max 3 次/題）' : '關（AI_AGENT_WEB_SEARCH_ENABLED 未開或 AI_AGENT_TOOL_COST_CAP_USD 未設）'}`,
    `meta：${JSON.stringify(result.meta)}`,
    '--- 兩段回覆 ---',
    result.text,
  ].join('\n')
}

export async function runAgentCommand(args, options = {}) {
  const { commandText, query, write, quoted, fixture, imagePath } = parseAgentCommandArgs(args)
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
    return runCaseIntakeCommand({ query, env: options.env ?? process.env })
  }
  if (commandText === 'overdue-dry-run') {
    return runOverdueDryRunCommand({})
  }
  if (commandText === 'case-done') {
    return runCaseDoneCommand({ query })
  }
  if (commandText === 'distill-dry-run') {
    return runDistillDryRunCommand({ env: options.env ?? process.env })
  }
  if (commandText === 'distill-flush') {
    return runDistillFlushCommand({ env: options.env ?? process.env, write })
  }
  if (commandText === 'approve-parse') {
    return runApproveParseCommand({ env: options.env ?? process.env, query, quoted, fixture })
  }
  if (commandText === 'partner-respond') {
    return runPartnerRespondCommand({ env: options.env ?? process.env, query })
  }
  if (commandText === 'partner-image-respond') {
    return runPartnerImageRespondCommand({ env: options.env ?? process.env, imagePath })
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
