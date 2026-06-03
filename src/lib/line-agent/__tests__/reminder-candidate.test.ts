import { describe, expect, test } from 'vitest'
import { deriveReminderCandidate, type ReminderInput } from '../cases/reminder'

const base: ReminderInput = {
  caseId: 'CW-test-1',
  status: 'new_inquiry',
  latestEventCategory: 'new_inquiry',
  hasUnansweredQuestion: false,
  lastCustomerMessageAt: '2026-06-03T00:00:00.000Z',
  now: '2026-06-03T00:00:00.000Z',
}

describe('deriveReminderCandidate（read-time，注入 now）', () => {
  test('unanswered_question_overdue：未回提問 > 2hr → urgent', () => {
    const r = deriveReminderCandidate({
      ...base,
      hasUnansweredQuestion: true,
      lastCustomerMessageAt: '2026-06-03T00:00:00.000Z',
      now: '2026-06-03T02:30:00.000Z',
    })
    expect(r?.reason).toBe('unanswered_question_overdue')
    expect(r?.severity).toBe('urgent')
  })

  test('未回提問但僅 1hr → 不觸發', () => {
    const r = deriveReminderCandidate({
      ...base,
      hasUnansweredQuestion: true,
      now: '2026-06-03T01:00:00.000Z',
    })
    expect(r).toBeNull()
  })

  test('new_inquiry_unhandled：new_inquiry > 4hr → attention', () => {
    const r = deriveReminderCandidate({ ...base, now: '2026-06-03T05:00:00.000Z' })
    expect(r?.reason).toBe('new_inquiry_unhandled')
    expect(r?.severity).toBe('attention')
  })

  test('awaiting_customer_stale：needs_info + 客人 > 48hr → info', () => {
    const r = deriveReminderCandidate({
      ...base,
      status: 'needs_info',
      now: '2026-06-05T01:00:00.000Z',
    })
    expect(r?.reason).toBe('awaiting_customer_stale')
  })

  test('quote_review_pending：quote_review > 24hr → attention', () => {
    const r = deriveReminderCandidate({
      ...base,
      status: 'quote_review',
      now: '2026-06-04T01:00:00.000Z',
    })
    expect(r?.reason).toBe('quote_review_pending')
  })

  test('menu_browsing 不產生提醒（守門：瀏覽不催）', () => {
    const r = deriveReminderCandidate({
      ...base,
      latestEventCategory: 'menu_browsing',
      status: 'idle',
      now: '2026-06-05T00:00:00.000Z',
    })
    expect(r).toBeNull()
  })
})
