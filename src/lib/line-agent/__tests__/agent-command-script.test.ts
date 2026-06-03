import { describe, expect, test } from 'vitest'
import {
  formatInboxCases,
  parseAgentCommandArgs,
  readDotEnvValue,
} from '../../../../scripts/agent-command.mjs'

describe('agent-command CLI helpers', () => {
  test('parses /inbox-style command args', () => {
    expect(parseAgentCommandArgs(['inbox'])).toEqual({ commandText: 'inbox' })
    expect(parseAgentCommandArgs(['/inbox'])).toEqual({ commandText: 'inbox' })
  })

  test('reads dotenv values without quotes', () => {
    const env = [
      'AI_AGENT_INTERNAL_SECRET="secret-value"',
      "AGENT_KV_URL='https://example.test'",
    ].join('\n')

    expect(readDotEnvValue(env, 'AI_AGENT_INTERNAL_SECRET')).toBe('secret-value')
    expect(readDotEnvValue(env, 'AGENT_KV_URL')).toBe('https://example.test')
  })

  test('renders inbox as SLA zones, needs_eric on top, empty zones collapsed to (0)', () => {
    const output = formatInboxCases([
      {
        caseId: 'A',
        zone: 'need_reply',
        eventCategory: 'price_question',
        reminder: {
          severity: 'urgent',
          ageHours: 4.5,
          reason: 'unanswered_question_overdue',
          suggestedAction: '對帳1600報價來源',
        },
        customerDisplayName: 'Eunice 茜',
        latestCustomerMessageText: '報價1600的是哪間？',
        status: 'new_inquiry',
        triage: { knownFacts: {} },
        missingFields: [],
        messageCount: 2,
        lastCustomerMessageAt: '2026-06-03T00:00:00.000Z',
      },
      {
        caseId: 'B',
        zone: 'browsing_idle',
        eventCategory: 'menu_browsing',
        reminder: null,
        customerDisplayName: '客人 #2',
        latestCustomerMessageText: '（點選選單）',
        status: 'idle',
        triage: { knownFacts: {} },
        missingFields: [],
        messageCount: 1,
        lastCustomerMessageAt: '2026-06-03T00:00:00.000Z',
      },
    ])

    expect(output).toContain('LINE OA Inbox · 7 區 · 共 2 筆')
    expect(output).toContain('需 Eric 介入】(0)') // empty zone still shown
    expect(output).toContain('需回覆 / 需處理】(1)')
    expect(output).toContain('瀏覽中 / 靜置】(1)')
    // needs_eric pinned above need_reply
    expect(output.indexOf('需 Eric 介入')).toBeLessThan(output.indexOf('需回覆'))
    expect(output).toContain('#1 Eunice 茜｜price_question｜⚠️未回提問 4.5hr')
    expect(output).toContain('對帳1600報價來源') // suggestedAction as next step
    expect(output).toContain('⚠️')
  })

  test('falls back to status label + missing-field next step when no classification/reminder', () => {
    const output = formatInboxCases([
      {
        caseId: 'CW-616786419020464384',
        zone: 'need_reply',
        status: 'new_inquiry',
        customerDisplayName: '王小明',
        lastCustomerMessageAt: '2026-06-03T06:40:46.853Z',
        latestCustomerMessageText: '小孩一個5歲一個8歲，需要兒童座椅嗎？',
        messageCount: 3,
        reminder: null,
        missingFields: ['childSeatNeeds', 'flightOrPickupInfo', 'hotelOrPickupLocation'],
        triage: {
          summaryText: '日期：8/21；人數：2大2小；小孩年齡：5歲、8歲；包車4天',
          knownFacts: { travelDate: '8/21', adults: 2, children: 2 },
          missingFields: ['childSeatNeeds', 'flightOrPickupInfo', 'hotelOrPickupLocation'],
        },
      },
    ])

    // No eventCategory → falls back to the status label.
    expect(output).toContain('#1 王小明｜新詢問')
    expect(output).toContain('「小孩一個5歲一個8歲，需要兒童座椅嗎？」')
    expect(output).toContain('下一步：請確認兒童座椅需求、航班或接送資訊、住宿或上車地點')
    expect(output).not.toContain('U4256d23')
    expect(output).not.toContain('secret-value')
  })

  test('uses a plain-language customer label when LINE profile name is unavailable', () => {
    const output = formatInboxCases([
      {
        caseId: 'CW-616786419020464384',
        zone: 'need_reply',
        status: 'new_inquiry',
        customerDisplayName: 'LINE-U4256d23',
        latestCustomerMessageText: '想問8/21清邁親子包車',
        messageCount: 1,
        reminder: null,
        missingFields: [],
        triage: {
          summaryText: '日期：8/21；人數：2大2小；包車4天；想去：大象、夜間動物園',
          knownFacts: { travelDate: '8/21', adults: 2, children: 2, charterDays: 4 },
          missingFields: [],
        },
      },
    ])

    expect(output).toContain('#1 8/21 2大2小親子包車客｜新詢問')
    expect(output).not.toContain('LINE-U4256d23')
  })
})
