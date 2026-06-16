/**
 * vision-intake-surfacing.test.ts — 圖片刀B 的 surfacing decision + 共用常數.
 *
 * 鎖住（2026-06-11 真機煙測後改版：引用圖＋tag 即觸發、去關鍵詞）：
 *   - 觸發＝「引用一張圖片＋tag bot」：quotedImage 由 webhook 以 store 判定後
 *     傳入；無關鍵詞需求 — 夥伴零學習成本
 *   - shouldUseVisionIntake 走 M3-0 tool-gate（ocr）：OA 永不、未 tag 永不、
 *     AI_AGENT_OCR_ENABLED default off、cost cap 未設（0）也擋 — 雙閘
 *
 * Task 7.1（2026-06-16）：舊 createVisionIntakeResponder 死路 responder 已被
 * smart-reply 取代並移除；對應的 responder 測試一併移除（live 行為改由
 * vision-smart-reply-surfacing.test.ts 鎖）。本檔現只測 surfacing 判斷。
 */

import { describe, expect, it } from 'vitest'
import { shouldUseVisionIntake } from '../partner-group/vision-intake-surfacing'

const GATE_ON_ENV = {
  AI_AGENT_OCR_ENABLED: 'true',
  AI_AGENT_TOOL_COST_CAP_USD: '1',
}

// ---------------------------------------------------------------------------
// Surfacing gate（M3-0 tool-gate 'ocr' 真消費者）
// ---------------------------------------------------------------------------

describe('shouldUseVisionIntake', () => {
  const base = {
    sourceChannel: 'line_partner_group' as const,
    botDirected: true,
    quotedImage: true,
  }

  it('true only with partner group + tag + quoted image + BOTH gates on', () => {
    expect(shouldUseVisionIntake({ ...base, env: GATE_ON_ENV })).toBe(true)
  })

  it('no quoted image never fires（關鍵詞已除役 — 引用是唯一觸發）', () => {
    expect(
      shouldUseVisionIntake({ ...base, quotedImage: false, env: GATE_ON_ENV })
    ).toBe(false)
  })

  it('OA customer plane never fires (even with gates on)', () => {
    expect(
      shouldUseVisionIntake({ ...base, sourceChannel: 'line_oa', env: GATE_ON_ENV })
    ).toBe(false)
  })

  it('untagged message never fires', () => {
    expect(shouldUseVisionIntake({ ...base, botDirected: false, env: GATE_ON_ENV })).toBe(false)
  })

  it('default env (gate off) never fires', () => {
    expect(shouldUseVisionIntake({ ...base, env: {} })).toBe(false)
  })

  it('ocr enabled but cost cap unset (0) still never fires — 雙閘紀律', () => {
    expect(
      shouldUseVisionIntake({ ...base, env: { AI_AGENT_OCR_ENABLED: 'true' } })
    ).toBe(false)
  })
})
