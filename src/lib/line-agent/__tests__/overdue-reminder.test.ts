/**
 * overdue-reminder.test.ts — OA 超時提醒狀態機（design 2026-06-10 §3 刀1）.
 *
 * 鎖住狀態閉環（全 derived，注入 now）：
 *   - 未 ack 且超過門檻 → would_remind；門檻內 → within_threshold
 *   - handledAt >= lastCustomerMessageAt → handled
 *   - 客人再發新訊息（reducer line_oa_message）→ ack 失效＋reminderCount 歸零
 *   - reminderCount >= cap → capped（防無限重複）
 *   - terminal／idle／瀏覽寒暄 → not_monitored
 *   - reducer case_handled → handledAt/handledBy，status 不變
 */

import { describe, expect, it } from 'vitest'
import {
  evaluateOverdueCase,
  listWouldRemindCases,
  formatOverdueDryRunReport,
  DEFAULT_OVERDUE_POLICY,
} from '../cases/overdue-reminder'
import { caseReducer } from '../cases/case-reducer'
import { createInitialCase, type AgentCase } from '../cases/case-state'

const NOW = '2026-06-11T10:00:00.000Z'

function hoursAgo(h: number): string {
  return new Date(Date.parse(NOW) - h * 3_600_000).toISOString()
}

function makeCase(overrides: Partial<AgentCase> = {}): AgentCase {
  return {
    ...createInitialCase({
      caseId: 'CW-0611-001',
      lineUserId: 'U-customer',
      customerDisplayName: '王小姐',
      now: hoursAgo(5),
    }),
    lastCustomerMessageAt: hoursAgo(5),
    ...overrides,
  }
}

describe('evaluateOverdueCase — 狀態判定', () => {
  it('超過門檻且未 ack → would_remind（ageHours 正確）', () => {
    const e = evaluateOverdueCase(makeCase(), NOW)
    expect(e.state).toBe('would_remind')
    expect(e.ageHours).toBeCloseTo(5, 1)
  })

  it('門檻內 → within_threshold', () => {
    const e = evaluateOverdueCase(makeCase({ lastCustomerMessageAt: hoursAgo(1) }), NOW)
    expect(e.state).toBe('within_threshold')
  })

  it('ack 在最後客訊之後 → handled', () => {
    const e = evaluateOverdueCase(
      makeCase({ handledAt: hoursAgo(4), handledBy: 'U-partner' }),
      NOW
    )
    expect(e.state).toBe('handled')
  })

  it('ack 後客人又發訊息 → ack 失效，回到 would_remind（重開計時）', () => {
    const e = evaluateOverdueCase(
      makeCase({ handledAt: hoursAgo(4), lastCustomerMessageAt: hoursAgo(3) }),
      NOW
    )
    expect(e.state).toBe('would_remind')
  })

  it('reminderCount 達上限 → capped（防無限重複）', () => {
    const e = evaluateOverdueCase(
      makeCase({ reminderCount: DEFAULT_OVERDUE_POLICY.maxRemindersPerCycle }),
      NOW
    )
    expect(e.state).toBe('capped')
  })

  it('terminal / idle / 瀏覽寒暄 → not_monitored', () => {
    expect(evaluateOverdueCase(makeCase({ status: 'converted' }), NOW).state).toBe(
      'not_monitored'
    )
    expect(evaluateOverdueCase(makeCase({ status: 'lost' }), NOW).state).toBe('not_monitored')
    expect(evaluateOverdueCase(makeCase({ status: 'idle' }), NOW).state).toBe('not_monitored')
    expect(
      evaluateOverdueCase(makeCase({ latestEventCategory: 'menu_browsing' }), NOW).state
    ).toBe('not_monitored')
    expect(
      evaluateOverdueCase(makeCase({ latestEventCategory: 'non_actionable' }), NOW).state
    ).toBe('not_monitored')
  })
})

describe('listWouldRemindCases — 清單與排序', () => {
  it('只收 would_remind，最久未回排最前', () => {
    const cases = [
      makeCase({ caseId: 'CW-A', lastCustomerMessageAt: hoursAgo(3) }),
      makeCase({ caseId: 'CW-B', lastCustomerMessageAt: hoursAgo(10) }),
      makeCase({ caseId: 'CW-C', lastCustomerMessageAt: hoursAgo(1) }), // within
      makeCase({ caseId: 'CW-D', handledAt: NOW }), // handled
    ]
    const list = listWouldRemindCases(cases, NOW)
    expect(list.map((e) => e.caseId)).toEqual(['CW-B', 'CW-A'])
  })
})

describe('formatOverdueDryRunReport — operator 報告', () => {
  it('空清單 → 安心訊息', () => {
    const report = formatOverdueDryRunReport([])
    expect(report).toContain('沒有超時未處理')
  })

  it('清單 → 每件一行（caseId＋時數＋次數），含 done 指令提示，不含客人內文', () => {
    const list = listWouldRemindCases(
      [makeCase({ caseId: 'CW-0611-002', lastCustomerMessageAt: hoursAgo(6) })],
      NOW
    )
    const report = formatOverdueDryRunReport(list)
    expect(report).toContain('CW-0611-002')
    expect(report).toContain('6h')
    expect(report).toContain('@bot done')
  })
})

describe('caseReducer — §3 刀1 events', () => {
  it('case_handled → 記 handledAt/handledBy，status 不變，audit 一筆', () => {
    const current = makeCase({ status: 'quote_review' })
    const result = caseReducer(
      current,
      { type: 'case_handled', actor: 'U-partner', now: NOW },
      []
    )
    expect(result.case.handledAt).toBe(NOW)
    expect(result.case.handledBy).toBe('U-partner')
    expect(result.case.status).toBe('quote_review')
    expect(result.audit).toHaveLength(1)
    expect(result.audit[0].eventType).toBe('case_handled')
  })

  it('line_oa_message → reminderCount 歸零（新一輪計時）', () => {
    const current = makeCase({ reminderCount: 2, handledAt: hoursAgo(4) })
    const result = caseReducer(
      current,
      {
        type: 'line_oa_message',
        lineUserId: 'U-customer',
        messageId: 'm-2',
        text: '我們改 1/5 出發',
        now: NOW,
      },
      []
    )
    expect(result.case.reminderCount).toBe(0)
    // handledAt 不清 — derived 比較會因 lastCustomerMessageAt 前進而自動失效
    expect(result.case.handledAt).toBe(hoursAgo(4))
    expect(evaluateOverdueCase(result.case, hoursAgo(-3)).state).toBe('would_remind')
  })
})
