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

const MISSING_FIELD_LABELS = {
  childSeatNeeds: '兒童座椅需求',
  flightOrPickupInfo: '航班/接送資訊',
  hotelOrPickupLocation: '住宿/上車地點',
  travelDates: '旅遊日期',
  partySize: '人數',
  childAges: '小孩年齡',
}

const NEXT_STEP_LABELS = {
  childSeatNeeds: '兒童座椅需求',
  flightOrPickupInfo: '航班或接送資訊',
  hotelOrPickupLocation: '住宿或上車地點',
  travelDates: '旅遊日期',
  partySize: '人數',
  childAges: '小孩年齡',
}

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

  const lines = [`目前 ${cases.length} 筆未處理客人`, '']

  cases.forEach((agentCase, index) => {
    const missingFields = normaliseMissingFields(agentCase)
    const latestText = agentCase.latestCustomerMessageText || '（尚無文字訊息）'
    const statusLabel = STATUS_LABELS[agentCase.status] ?? agentCase.status

    lines.push(`#${index + 1} ${formatCustomerLabel(agentCase, index)}｜${statusLabel}`)
    lines.push(`案件：${agentCase.caseId}`)
    lines.push(`摘要：${agentCase.triage?.summaryText || '尚未取得可整理的客需重點'}`)
    lines.push(`缺漏：${formatMissingFields(missingFields)}`)
    lines.push(`最新訊息：${latestText}`)
    lines.push(`訊息數：${agentCase.messageCount ?? 0}`)
    lines.push(`建議下一步：${formatNextStep(missingFields)}`)
    if (agentCase.lastCustomerMessageAt) {
      lines.push(`更新時間：${formatTaipeiTime(agentCase.lastCustomerMessageAt)}`)
    }
    lines.push('')
  })

  return lines.join('\n').trimEnd()
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

function formatMissingFields(fields) {
  if (!fields.length) return '目前沒有明顯缺漏'
  return fields.map((field) => MISSING_FIELD_LABELS[field] ?? field).join('、')
}

function formatNextStep(fields) {
  if (!fields.length) return '可請夥伴開始判斷是否進入排行程'
  return `請確認${fields.map((field) => NEXT_STEP_LABELS[field] ?? field).join('、')}`
}

function formatTaipeiTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
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
