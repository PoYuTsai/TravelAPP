import { describe, expect, test } from 'vitest'
import {
  classifyCustomerEventDeterministic,
  safeDefaultCustomerClassifier,
  type ClassifyInput,
} from '../cases/customer-event'

const base: ClassifyInput = {
  text: '',
  messageType: 'text',
  isPostback: false,
  hasPriorMessages: false,
  missingFields: [],
  now: '2026-06-03T00:00:00.000Z',
}

describe('classifyCustomerEventDeterministic', () => {
  test('new_inquiry：無歷史 + 行程意圖詞', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '想帶小孩去清邁玩，有包車嗎' })
    expect(r?.category).toBe('new_inquiry')
    expect(r?.source).toBe('deterministic')
  })

  test('follow_up_info：已有歷史 + 補上日期人數', () => {
    const r = classifyCustomerEventDeterministic({
      ...base,
      text: '8/21，2大2小，住古城',
      hasPriorMessages: true,
      missingFields: ['travelDates', 'partySize'],
    })
    expect(r?.category).toBe('follow_up_info')
  })

  test('change_request：變更詞 + 已知需求', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '改成 8/22 出發', hasPriorMessages: true })
    expect(r?.category).toBe('change_request')
  })

  test('price_question 優先於 product：同時命中以 price 為準', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '大象體驗含午餐嗎？報價1600是哪間？' })
    expect(r?.category).toBe('price_question')
    expect(r?.signals).toContain('price')
  })

  test('menu_browsing：postback', () => {
    const r = classifyCustomerEventDeterministic({ ...base, isPostback: true, text: '' })
    expect(r?.category).toBe('menu_browsing')
  })

  test('media_or_ocr_needed：image 無文字', () => {
    const r = classifyCustomerEventDeterministic({ ...base, messageType: 'image', text: '' })
    expect(r?.category).toBe('media_or_ocr_needed')
  })

  test('non_actionable：純寒暄無商務詞', () => {
    const r = classifyCustomerEventDeterministic({ ...base, text: '謝謝' })
    expect(r?.category).toBe('non_actionable')
  })

  test('優先序：image 勝過文字訊號', () => {
    const r = classifyCustomerEventDeterministic({ ...base, messageType: 'image', text: '報價多少' })
    expect(r?.category).toBe('media_or_ocr_needed')
  })
})

describe('safeDefaultCustomerClassifier（low_context 不亂猜）', () => {
  test('未命中 → new_inquiry/low（最保守，丟給人看，不捏造事實）', async () => {
    const r = await safeDefaultCustomerClassifier.classify({ ...base, text: '在嗎' })
    expect(r.category).toBe('new_inquiry')
    expect(r.confidence).toBe('low')
    expect(r.source).toBe('llm')
  })
})
