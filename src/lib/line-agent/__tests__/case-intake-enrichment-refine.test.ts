/**
 * case-intake-enrichment-refine.test.ts — Task 1: enrichment 接 refine
 * （sufficient→draft seam）.
 *
 * 鎖住 refine 接線的 fail-closed 慣例：
 *   - refineSource 過 guard → 採用暖化版（enrichment 仍 'llm_draft'）
 *   - refineSource 被 guard 打回（竄改 Day 1 標題）→ 退 deterministic byte-identical
 *   - refineSource 缺席 → 與現況 byte-identical（regression 鎖）
 *   - refineSource throw（模擬 cost cap）→ deterministic
 *   - primary 打回、rescue 過 → 用 rescue 暖化版
 *
 * Fixtures 複用既有 sufficient→draft 測試：SUFFICIENT_TEXT 字串與 golden 7D6N
 * plan JSON（已知會過 compose/lint/round-trip）。
 */

import { describe, it, expect } from 'vitest'
import { enrichCaseIntakeReply } from '../partner-group/case-intake-enrichment'
import { triageCaseIntake } from '../partner-group/case-intake-triage'
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS as GOLDEN_REQ,
  LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS as GOLDEN_C,
} from '../notion/__fixtures__/customer-itinerary-golden'

const SUFFICIENT_TEXT = [
  '客人 12/20 出發到清邁，12/26 回，包車6天',
  '2大2小（5歲、8歲），需要兒童座椅',
  '航班 CI851，10:20 抵達清邁機場',
  '住宿清邁古城民宿',
].join('\n')

/** 合法草稿 plan：直接借 golden 李家 7D6N（已知會過 compose/lint/round-trip）。 */
const DRAFT_JSON = JSON.stringify({
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

function baseSources() {
  return {
    questionSource: async () => '[]',
    draftSource: async () => DRAFT_JSON,
  }
}

describe('enrichCaseIntakeReply — refine wiring', () => {
  it('採用 refined 草稿（refineSource 暖化只動開場/結尾）', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const det = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const warmed = (s: string) => `親愛的貴賓您好 🌿\n\n${s}\n\n期待與您同遊清邁！`
    const refined = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: { ...baseSources(), refineSource: async ({ deterministicDraft }) => warmed(deterministicDraft) },
    })
    expect(refined.enrichment).toBe('llm_draft')
    expect(refined.replyText).not.toBe(det.replyText)
    expect(refined.replyText).toContain('親愛的貴賓您好')
    // Task 3 觀測：採用 refined 時 refine metadata 透出 used/tier/masked reasons。
    expect(refined.refine?.used).toBe('refined')
    expect(refined.refine?.tier).toBe('primary')
    expect(refined.refine?.rejectionReasons).toEqual([])
    // 缺席 refineSource 的 det 跑不到 refine ⇒ 無 metadata。
    expect(det.refine).toBeUndefined()
  })

  it('refineSource 被 guard 打回 → 退 deterministic，與無 refine byte-identical', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const det = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const tampered = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: { ...baseSources(), refineSource: async ({ deterministicDraft }) =>
        deterministicDraft.replace(/Day 1｜[^\n]*/, 'Day 1｜被竄改的主題') },
    })
    expect(tampered.replyText).toBe(det.replyText)
    // Task 3 觀測：guard 打回後 used 為 deterministic，rejectionReasons 帶 masked 結構碼。
    expect(tampered.refine?.used).toBe('deterministic')
    expect(tampered.refine?.tier).toBeNull()
    expect(tampered.refine?.rejectionReasons).toContain('structural_diff')
  })

  it('refineSource 缺席 → 與現況 byte-identical（regression 鎖）', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const a = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const b = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: { ...baseSources() } })
    expect(a.replyText).toBe(b.replyText)
  })

  it('refineSource throw（模擬 cost cap 超額）→ deterministic', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const det = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const capped = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: { ...baseSources(), refineSource: async () => { throw new Error('budget') } },
    })
    expect(capped.replyText).toBe(det.replyText)
  })

  it('primary 打回、rescue 過 → 用 rescue 暖化版', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const warmed = (s: string) => `您好 🌿\n\n${s}\n\n清微旅行 敬上`
    const out = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: {
        ...baseSources(),
        refineSource: async ({ deterministicDraft }) => deterministicDraft.replace(/Day 1｜[^\n]*/, 'Day 1｜竄改'),
        rescueRefineSource: async ({ deterministicDraft }) => warmed(deterministicDraft),
      },
    })
    expect(out.replyText).toContain('清微旅行 敬上')
  })
})
