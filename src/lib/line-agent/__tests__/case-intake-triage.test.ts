/**
 * case-intake-triage.test.ts — 客需三分流 deterministic core（design 2026-06-10 §1）.
 *
 * The core is PURE text-in / structured-out: no LLM, no I/O, no env. Flows:
 *   - tricky       → needs-Eric markers found（precedence over everything）
 *   - insufficient → a CRITICAL field is missing → list + forwardable questions
 *   - sufficient   → all critical fields present → known-facts summary
 */

import { describe, expect, it } from 'vitest'
import {
  triageCaseIntake,
  CASE_INTAKE_CRITICAL_FIELDS,
} from '../partner-group/case-intake-triage'

const SUFFICIENT_TEXT = [
  '客人 12/20 出發到清邁，12/26 回，包車6天',
  '2大2小（5歲、8歲），需要兒童座椅',
  '航班 CI851，10:20 抵達清邁機場',
  '住宿清邁古城民宿',
].join('\n')

describe('triageCaseIntake — flow classification', () => {
  it('classifies a fully-specified requirement as sufficient', () => {
    const result = triageCaseIntake(SUFFICIENT_TEXT)
    expect(result.flow).toBe('sufficient')
    expect(result.trickyReasons).toEqual([])
    // No CRITICAL field may be missing（advisory fields are allowed to remain）.
    for (const field of CASE_INTAKE_CRITICAL_FIELDS) {
      expect(result.missingFields).not.toContain(field)
    }
  })

  it('classifies a vague requirement as insufficient with missing fields', () => {
    const result = triageCaseIntake('客人說 12 月想去清邁玩')
    expect(result.flow).toBe('insufficient')
    expect(result.missingFields).toContain('partySize')
    expect(result.missingFields).toContain('flightOrPickupInfo')
    expect(result.missingFields).toContain('hotelOrPickupLocation')
  })

  it('classifies empty text as insufficient（never throws）', () => {
    const result = triageCaseIntake('')
    expect(result.flow).toBe('insufficient')
    expect(result.missingFields).toContain('travelDates')
  })

  it('requires childAges only when children are present', () => {
    const noKids = triageCaseIntake('客人 12/20 到 12/26，2大0小，航班 CI851，住古城飯店')
    expect(noKids.missingFields).not.toContain('childAges')

    const kidsNoAges = triageCaseIntake('客人 12/20 到 12/26，2大2小，航班 CI851，住古城飯店')
    expect(kidsNoAges.flow).toBe('insufficient')
    expect(kidsNoAges.missingFields).toContain('childAges')
  })

  it('flags medical risk as tricky（precedence over missing fields）', () => {
    const result = triageCaseIntake('客人小孩對花生嚴重過敏，想去清邁')
    expect(result.flow).toBe('tricky')
    expect(result.trickyReasons.length).toBeGreaterThan(0)
  })

  it('flags price comparison / discount pressure as tricky', () => {
    const result = triageCaseIntake(SUFFICIENT_TEXT + '\n客人說 kkday 比較便宜，問能不能折扣')
    expect(result.flow).toBe('tricky')
  })

  it('flags refund / cancellation as tricky', () => {
    const result = triageCaseIntake(SUFFICIENT_TEXT + '\n客人問如果取消行程退款怎麼算')
    expect(result.flow).toBe('tricky')
  })
})

describe('triageCaseIntake — reply text', () => {
  it('insufficient reply lists missing fields and forwardable questions', () => {
    const result = triageCaseIntake('客人說 12 月想去清邁玩')
    expect(result.replyText).toContain('資訊還不足')
    expect(result.replyText).toContain('人數')
    expect(result.replyText).toContain('請問同行人數')
    expect(result.replyText).toContain('可直接轉傳')
  })

  it('sufficient reply contains the known-facts summary and the Eric boundary', () => {
    const result = triageCaseIntake(SUFFICIENT_TEXT)
    expect(result.replyText).toContain('關鍵資訊已齊')
    expect(result.replyText).toContain('2大2小')
    // 永遠保留「正式報價／承諾需 Eric 確認」邊界（design 北極星）。
    expect(result.replyText).toContain('Eric')
  })

  it('tricky reply names the reasons and warns against promising', () => {
    const result = triageCaseIntake('客人小孩對花生嚴重過敏，想去清邁')
    expect(result.replyText).toContain('Eric')
    expect(result.replyText).toContain('過敏')
    expect(result.replyText).toContain('不要')
  })

  it('reply never contains internal-only tokens（leak boundary）', () => {
    for (const text of ['', SUFFICIENT_TEXT, '客人問能不能便宜']) {
      const { replyText } = triageCaseIntake(text)
      expect(replyText).not.toMatch(/內部備註|成本|分潤|報價總額/)
    }
  })
})
