/**
 * case-intake-enrichment.test.ts — 客需三分流 LLM enrichment（design 2026-06-10
 * §1 LLM 刀）.
 *
 * Threat model 同 refine：LLM 是 untrusted candidate producer。本檔鎖住：
 *   - insufficient → 問法潤飾：coverage / format / leak guard，任一不過退模板
 *   - sufficient → 草稿閘鏈：schema → compose/lint → 真 parser round-trip →
 *     leak，任一不過退 deterministic summary
 *   - tricky → 連 source 都不可被呼叫（零 LLM）
 *   - source error / 壞 JSON → fail-closed，replyText 永遠非空
 */

import { describe, expect, it } from 'vitest'
import {
  enrichCaseIntakeReply,
  extractJsonValue,
  validatePolishedQuestions,
  validateDraftPlan,
} from '../partner-group/case-intake-enrichment'
import { triageCaseIntake } from '../partner-group/case-intake-triage'
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS as GOLDEN_REQ,
  LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS as GOLDEN_C,
} from '../notion/__fixtures__/customer-itinerary-golden'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUFFICIENT_TEXT = [
  '客人 12/20 出發到清邁，12/26 回，包車6天',
  '2大2小（5歲、8歲），需要兒童座椅',
  '航班 CI851，10:20 抵達清邁機場',
  '住宿清邁古城民宿',
].join('\n')

const INSUFFICIENT_TEXT = '客人說 12 月想去清邁玩'

const TRICKY_TEXT = '客人小孩對花生嚴重過敏，想去清邁'

/** 合法草稿 plan：直接借 golden 李家 7D6N（已知會過 compose/lint/round-trip）。 */
function goldenPlanJson(): string {
  return JSON.stringify({
    constraints: {
      days: GOLDEN_C.days,
      nights: GOLDEN_C.nights,
      stayArea: GOLDEN_C.stayArea,
      sameLodgingAllTrip: GOLDEN_C.sameLodgingAllTrip,
      departureDayTransferTime: GOLDEN_C.departureDayTransferTime,
      departureDayPeriod: GOLDEN_C.departureDayPeriod,
    },
    requirements: GOLDEN_REQ.requirements,
  })
}

function neverCalled(): Promise<string> {
  throw new Error('source must not be called')
}

/** 潤飾問句 fake：覆蓋 triage 算出的「可問」缺項，每欄一句合法問句。 */
function validQuestionsJsonFor(missingFields: string[]): string {
  return JSON.stringify(
    missingFields.map((field) => ({ field, question: `想跟您確認 ${field} 的安排，方便提供嗎？` }))
  )
}

// ---------------------------------------------------------------------------
// extractJsonValue
// ---------------------------------------------------------------------------

describe('extractJsonValue', () => {
  it('parses bare JSON and code-fenced JSON', () => {
    expect(extractJsonValue('{"a":1}')).toEqual({ a: 1 })
    expect(extractJsonValue('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJsonValue('```\n[1,2]\n```')).toEqual([1, 2])
  })

  it('returns undefined on anything unparseable', () => {
    expect(extractJsonValue('好的，這是草稿：…')).toBeUndefined()
    expect(extractJsonValue('')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validatePolishedQuestions — coverage / format / leak
// ---------------------------------------------------------------------------

describe('validatePolishedQuestions', () => {
  const FIELDS = ['travelDates', 'partySize']

  it('accepts exact coverage and renders in canonical order', () => {
    const v = validatePolishedQuestions(
      [
        { field: 'partySize', question: '請問這次有幾位大人小孩同行呢？' },
        { field: 'travelDates', question: '請問大概什麼時候出發呢？' },
      ],
      FIELDS
    )
    expect(v.ok).toBe(true)
    if (v.ok) {
      // canonical order: travelDates before partySize（LLM 給的順序不被信任）
      expect(v.lines[0]).toContain('什麼時候出發')
      expect(v.lines[1]).toContain('大人小孩')
    }
  })

  it('rejects a missing field（coverage_mismatch）', () => {
    const v = validatePolishedQuestions(
      [{ field: 'travelDates', question: '請問什麼時候出發呢？' }],
      FIELDS
    )
    expect(v).toEqual({ ok: false, reason: 'coverage_mismatch' })
  })

  it('rejects an extra field outside the list（coverage_mismatch）', () => {
    const v = validatePolishedQuestions(
      [
        { field: 'travelDates', question: '請問什麼時候出發呢？' },
        { field: 'partySize', question: '請問幾位同行呢？' },
        { field: 'budget', question: '請問預算多少呢？' },
      ],
      FIELDS
    )
    expect(v).toEqual({ ok: false, reason: 'coverage_mismatch' })
  })

  it('rejects non-question / multi-line / overlong text（question_format）', () => {
    const noMark = validatePolishedQuestions(
      [
        { field: 'travelDates', question: '請告訴我出發日期。' },
        { field: 'partySize', question: '請問幾位同行呢？' },
      ],
      FIELDS
    )
    expect(noMark).toEqual({ ok: false, reason: 'question_format' })

    const multiline = validatePolishedQuestions(
      [
        { field: 'travelDates', question: '請問\n什麼時候出發呢？' },
        { field: 'partySize', question: '請問幾位同行呢？' },
      ],
      FIELDS
    )
    expect(multiline).toEqual({ ok: false, reason: 'question_format' })

    const overlong = validatePolishedQuestions(
      [
        { field: 'travelDates', question: `${'好'.repeat(121)}？` },
        { field: 'partySize', question: '請問幾位同行呢？' },
      ],
      FIELDS
    )
    expect(overlong).toEqual({ ok: false, reason: 'question_format' })
  })

  it('rejects internal vocabulary in a question（question_leak）', () => {
    const v = validatePolishedQuestions(
      [
        { field: 'travelDates', question: '依內部報價想確認您何時出發？' },
        { field: 'partySize', question: '請問幾位同行呢？' },
      ],
      FIELDS
    )
    expect(v).toEqual({ ok: false, reason: 'question_leak' })
  })

  it('rejects non-array / malformed items（question_format）', () => {
    expect(validatePolishedQuestions({ field: 'x' }, FIELDS)).toEqual({
      ok: false,
      reason: 'question_format',
    })
    expect(validatePolishedQuestions([{ question: '？' }], FIELDS)).toEqual({
      ok: false,
      reason: 'question_format',
    })
  })
})

// ---------------------------------------------------------------------------
// validateDraftPlan — schema 閘
// ---------------------------------------------------------------------------

describe('validateDraftPlan', () => {
  it('accepts the golden plan and forces customerVersion=true', () => {
    const v = validateDraftPlan(JSON.parse(goldenPlanJson()))
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.constraints.customerVersion).toBe(true)
      expect(v.constraints.days).toBe(7)
      expect(v.requirements.days).toHaveLength(7)
    }
  })

  it('rejects non-contiguous day numbering', () => {
    const plan = JSON.parse(goldenPlanJson())
    plan.requirements.days[2].day = 99
    expect(validateDraftPlan(plan)).toEqual({ ok: false, reason: 'schema_invalid' })
  })

  it('rejects constraints/days mismatch', () => {
    const plan = JSON.parse(goldenPlanJson())
    plan.constraints.days = 5
    expect(validateDraftPlan(plan)).toEqual({ ok: false, reason: 'schema_invalid' })
  })

  it('rejects missing requirement header fields', () => {
    const plan = JSON.parse(goldenPlanJson())
    plan.requirements.dateRange = ''
    expect(validateDraftPlan(plan)).toEqual({ ok: false, reason: 'schema_invalid' })
  })

  it('drops unknown keys（pick, never spread）', () => {
    const plan = JSON.parse(goldenPlanJson())
    plan.requirements.internalPrice = '15000'
    plan.constraints.operatorNotes = 'x'
    const v = validateDraftPlan(plan)
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect('internalPrice' in v.requirements).toBe(false)
      expect('operatorNotes' in v.constraints).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// enrichCaseIntakeReply — orchestration（fail-closed everywhere）
// ---------------------------------------------------------------------------

describe('enrichCaseIntakeReply — tricky flow', () => {
  it('never calls any source for a tricky case', async () => {
    const triage = triageCaseIntake(TRICKY_TEXT)
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: TRICKY_TEXT,
      sources: { questionSource: neverCalled, draftSource: neverCalled },
    })
    expect(result.enrichment).toBe('none')
    expect(result.degradedReason).toBeUndefined()
    expect(result.replyText).toBe(triage.replyText)
  })
})

describe('enrichCaseIntakeReply — insufficient flow（問法潤飾）', () => {
  const triage = triageCaseIntake(INSUFFICIENT_TEXT)

  it('adopts polished questions but keeps the deterministic skeleton', async () => {
    let requested: string[] = []
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: INSUFFICIENT_TEXT,
      sources: {
        questionSource: async (req) => {
          requested = req.missingFields
          return validQuestionsJsonFor(req.missingFields)
        },
        draftSource: neverCalled,
      },
    })
    expect(result.enrichment).toBe('llm_questions')
    // 骨架不變：標題行、已知行、boundary line 都還在
    expect(result.replyText).toContain('【客需整理】目前資訊還不足')
    expect(result.replyText).toContain('已知：')
    expect(result.replyText).toContain('仍需 Eric 最終確認')
    // 潤飾問句進了編號區
    expect(result.replyText).toContain('1. 想跟您確認')
    // 請 LLM 覆蓋的欄位＝triage 缺項（皆有模板問句）
    expect(requested.length).toBeGreaterThan(0)
  })

  const FAIL_CASES: Array<[string, () => Promise<string>, string]> = [
    ['source throw', () => Promise.reject(new Error('boom')), 'source_error'],
    ['empty output', async () => '', 'empty_output'],
    ['non-JSON', async () => '好的我幫你問', 'invalid_json'],
    ['coverage mismatch', async () => '[]', 'coverage_mismatch'],
  ]

  it.each(FAIL_CASES)(
    'fails closed to the deterministic template on %s',
    async (_name, source, reason) => {
      const result = await enrichCaseIntakeReply({
        triage,
        requirementText: INSUFFICIENT_TEXT,
        sources: { questionSource: source, draftSource: neverCalled },
      })
      expect(result.enrichment).toBe('none')
      expect(result.degradedReason).toBe(reason)
      expect(result.replyText).toBe(triage.replyText)
    }
  )

  it('fails closed on a leaked question（question_leak）', async () => {
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: INSUFFICIENT_TEXT,
      sources: {
        questionSource: async (req) =>
          JSON.stringify(
            req.missingFields.map((field, i) => ({
              field,
              question: i === 0 ? '依內部報價想確認您何時出發？' : '請問方便提供嗎？',
            }))
          ),
        draftSource: neverCalled,
      },
    })
    expect(result.enrichment).toBe('none')
    expect(result.degradedReason).toBe('question_leak')
    expect(result.replyText).toBe(triage.replyText)
  })
})

describe('enrichCaseIntakeReply — sufficient flow（草稿閘鏈）', () => {
  const triage = triageCaseIntake(SUFFICIENT_TEXT)

  it('adopts a golden-grade plan：compose → lint → round-trip 全過', async () => {
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: SUFFICIENT_TEXT,
      sources: { questionSource: neverCalled, draftSource: async () => goldenPlanJson() },
    })
    expect(result.enrichment).toBe('llm_draft')
    expect(result.replyText).toContain('已通過格式閘')
    expect(result.replyText).toContain('<李先生一家套餐訂製>')
    expect(result.replyText).toContain('Day 7｜')
    expect(result.replyText).toContain('仍需 Eric 最終確認')
  })

  it('fails closed on lint violation（compose_lint_failed）— final-day dinner', async () => {
    const plan = JSON.parse(goldenPlanJson())
    plan.requirements.days[6].dinner = '鳳飛飛豬腳飯'
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: SUFFICIENT_TEXT,
      sources: { questionSource: neverCalled, draftSource: async () => JSON.stringify(plan) },
    })
    expect(result.enrichment).toBe('none')
    expect(result.degradedReason).toBe('compose_lint_failed')
    expect(result.replyText).toBe(triage.replyText)
  })

  it('fails closed on schema violation（schema_invalid）', async () => {
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: SUFFICIENT_TEXT,
      sources: { questionSource: neverCalled, draftSource: async () => '{"constraints":{}}' },
    })
    expect(result.enrichment).toBe('none')
    expect(result.degradedReason).toBe('schema_invalid')
  })

  it('fails closed when the draft cannot round-trip（roundtrip_failed）— bad dateRange', async () => {
    const plan = JSON.parse(goldenPlanJson())
    // 日期區間格式破壞：compose/lint 不管 header 日期格式，但真 parser 解不出來
    plan.requirements.dateRange = '八月初出發～八月中回'
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: SUFFICIENT_TEXT,
      sources: { questionSource: neverCalled, draftSource: async () => JSON.stringify(plan) },
    })
    expect(result.enrichment).toBe('none')
    expect(result.degradedReason).toBe('roundtrip_failed')
    expect(result.replyText).toBe(triage.replyText)
  })

  it('fails closed on source error', async () => {
    const result = await enrichCaseIntakeReply({
      triage,
      requirementText: SUFFICIENT_TEXT,
      sources: { questionSource: neverCalled, draftSource: () => Promise.reject(new Error('x')) },
    })
    expect(result.enrichment).toBe('none')
    expect(result.degradedReason).toBe('source_error')
    expect(result.replyText).toBe(triage.replyText)
  })
})
