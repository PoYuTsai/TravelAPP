#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

  throw new Error('目前支援：inbox 或 /inbox')
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

export async function runAgentCommand(args, options = {}) {
  const { commandText } = parseAgentCommandArgs(args)
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
