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

  test('formats inbox cases as Traditional Chinese and omits raw line user ids', () => {
    const output = formatInboxCases([
      {
        caseId: 'CW-616786419020464384',
        status: 'new_inquiry',
        customerDisplayName: 'LINE-U4256d23',
        lastCustomerMessageAt: '2026-06-03T06:40:46.853Z',
        latestCustomerMessageText: '小孩一個5歲一個8歲，需要兒童座椅嗎？',
        messageCount: 3,
        missingFields: [
          'childSeatNeeds',
          'flightOrPickupInfo',
          'hotelOrPickupLocation',
        ],
        triage: {
          summaryText: '日期：8/21；人數：2大2小；小孩年齡：5歲、8歲；包車4天',
          knownFacts: {
            travelDate: '8/21',
            adults: 2,
            children: 2,
          },
          missingFields: [
            'childSeatNeeds',
            'flightOrPickupInfo',
            'hotelOrPickupLocation',
          ],
        },
      },
    ])

    expect(output).toContain('目前 1 筆未處理客人')
    expect(output).toContain('#1 CW-616786419020464384')
    expect(output).toContain('狀態：新詢問')
    expect(output).toContain('摘要：日期：8/21；人數：2大2小')
    expect(output).toContain('缺漏：兒童座椅需求、航班/接送資訊、住宿/上車地點')
    expect(output).toContain('建議下一步：請確認兒童座椅需求、航班或接送資訊、住宿或上車地點')
    expect(output).not.toContain('U4256d23')
    expect(output).not.toContain('secret-value')
  })
})
