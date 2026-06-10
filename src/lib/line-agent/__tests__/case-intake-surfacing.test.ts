/**
 * case-intake-surfacing.test.ts — 客需三分流 surfacing decision + responder
 * （design 2026-06-10 §1；pattern 照 rag-draft-surfacing 的 Option C）.
 *
 * Surfacing requires ALL of:
 *   sourceChannel === 'line_partner_group'
 *   && botDirected
 *   && detectCaseIntakeIntent(text)        // explicit token, pure string check
 *   && isCaseIntakeEnabled(env)            // env gate exactly "true", default OFF
 */

import { describe, expect, it } from 'vitest'
import {
  detectCaseIntakeIntent,
  isCaseIntakeEnabled,
  shouldUseCaseIntake,
  caseIntakeResponder,
} from '../partner-group/case-intake-surfacing'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CommandIntent } from '../commands/intent'

const ON_ENV = { AI_AGENT_CASE_INTAKE_ENABLED: 'true' }

function makeEvent(text: string): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U-partner',
    messageId: 'msg-1',
    timestamp: 1760000000000,
    text,
    mentionsBot: true,
  } as NormalizedLineEvent
}

const INTENT: CommandIntent = { action: 'analyze', confidence: 'high', source: 'deterministic' }

describe('detectCaseIntakeIntent', () => {
  it('matches explicit intake tokens', () => {
    expect(detectCaseIntakeIntent('客需：12月 2大2小 想去清邁')).toBe(true)
    expect(detectCaseIntakeIntent('幫我整理一下這個客人需求')).toBe(true)
    expect(detectCaseIntakeIntent('這個新客需求夠不夠開排？')).toBe(true)
  })

  it('does not match casual chat or rag lookups', () => {
    expect(detectCaseIntakeIntent('大家午餐吃什麼')).toBe(false)
    expect(detectCaseIntakeIntent('查內部案例 清萊兩日')).toBe(false)
    expect(detectCaseIntakeIntent('')).toBe(false)
  })
})

describe('isCaseIntakeEnabled — default OFF', () => {
  it('requires the gate to be exactly "true"', () => {
    expect(isCaseIntakeEnabled({})).toBe(false)
    expect(isCaseIntakeEnabled({ AI_AGENT_CASE_INTAKE_ENABLED: '1' })).toBe(false)
    expect(isCaseIntakeEnabled({ AI_AGENT_CASE_INTAKE_ENABLED: 'TRUE' })).toBe(false)
    expect(isCaseIntakeEnabled({ AI_AGENT_CASE_INTAKE_ENABLED: 'true' })).toBe(true)
    expect(isCaseIntakeEnabled({ AI_AGENT_CASE_INTAKE_ENABLED: ' true ' })).toBe(true)
  })
})

describe('shouldUseCaseIntake — every precondition required', () => {
  const base = {
    sourceChannel: 'line_partner_group' as const,
    botDirected: true,
    text: '客需：12月 2大2小 想去清邁',
    env: ON_ENV,
  }

  it('true when all preconditions hold', () => {
    expect(shouldUseCaseIntake(base)).toBe(true)
  })

  it('false for OA / unknown channels（OA 永不進 intake）', () => {
    expect(shouldUseCaseIntake({ ...base, sourceChannel: 'line_oa' })).toBe(false)
  })

  it('false when not bot-directed', () => {
    expect(shouldUseCaseIntake({ ...base, botDirected: false })).toBe(false)
  })

  it('false without an explicit intake token', () => {
    expect(shouldUseCaseIntake({ ...base, text: '幫看一下這個' })).toBe(false)
  })

  it('false when the env gate is off（default off）', () => {
    expect(shouldUseCaseIntake({ ...base, env: {} })).toBe(false)
  })
})

describe('caseIntakeResponder', () => {
  it('returns the deterministic triage reply and tags meta', async () => {
    const result = await caseIntakeResponder.respond({
      event: makeEvent('客需：客人說 12 月想去清邁玩'),
      intent: INTENT,
      text: '客需：客人說 12 月想去清邁玩',
    })
    expect(result.text).toContain('【客需整理】')
    expect(result.text).toContain('資訊還不足')
    expect(result.meta?.responder).toBe('intake')
    expect(result.meta?.degraded).toBeUndefined()
  })

  it('routes a complete requirement to the sufficient reply', async () => {
    const text =
      '客需：客人 12/20 到 12/26，2大2小（5歲、8歲），航班 CI851 10:20 抵達，住清邁古城民宿，需要兒童座椅'
    const result = await caseIntakeResponder.respond({
      event: makeEvent(text),
      intent: INTENT,
      text,
    })
    expect(result.text).toContain('關鍵資訊已齊')
  })

  it('routes a needs-Eric requirement to the tricky reply', async () => {
    const text = '客需：客人小孩對花生嚴重過敏，想去清邁'
    const result = await caseIntakeResponder.respond({
      event: makeEvent(text),
      intent: INTENT,
      text,
    })
    expect(result.text).toContain('Eric')
    expect(result.text).toContain('過敏')
  })
})
