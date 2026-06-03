import { describe, expect, test } from 'vitest'
import { DEFAULT_AUTO_REPLY_CONFIG } from '../cases/auto-reply'

describe('auto-reply schema（dormant）', () => {
  test('全域總開關恆為 false', () => {
    expect(DEFAULT_AUTO_REPLY_CONFIG.autoReplyEnabled).toBe(false)
  })

  test('每個 mapping enabled 皆為 false', () => {
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(m.enabled).toBe(false)
    }
  })

  test('每個 mapping 都對應一個合法 CustomerEventCategory', () => {
    const valid = new Set([
      'new_inquiry',
      'follow_up_info',
      'change_request',
      'price_question',
      'product_or_itinerary_question',
      'menu_browsing',
      'media_or_ocr_needed',
      'non_actionable',
    ])
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(valid.has(m.mapsToCategory)).toBe(true)
    }
  })

  test('draftReplyTemplate 存在但僅供 operator 視圖（非空字串）', () => {
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(typeof m.draftReplyTemplate).toBe('string')
    }
  })

  // P2：postback 一律 map menu_browsing，瀏覽不得混進 actionable category
  test('rich_menu_postback 觸發一律 map 到 menu_browsing', () => {
    for (const m of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      if (m.trigger.type === 'rich_menu_postback') {
        expect(m.mapsToCategory).toBe('menu_browsing')
      }
    }
  })
})
