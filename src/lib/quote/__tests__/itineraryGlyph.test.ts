import { describe, expect, it } from 'vitest'

import { inferItineraryGlyph } from '@/lib/quote/itineraryGlyph'

describe('inferItineraryGlyph', () => {
  it('uses meaningful destination and activity icons instead of day-index fallbacks', () => {
    expect(inferItineraryGlyph({ title: '抵達清邁 -> 湄登 -> 清道 -> 芳縣' }, 0)).toBe('🛬')
    expect(inferItineraryGlyph({ title: '芳縣 -> 金三角' }, 1)).toBe('🚤')
    expect(
      inferItineraryGlyph(
        {
          title: '清萊一日',
          items: [{ label: '長頸族村' }, { label: '藍廟' }, { label: '白廟' }],
        },
        2
      )
    ).toBe('🏛️')
    expect(inferItineraryGlyph({ title: '南邦一日' }, 4)).toBe('🐴')
    expect(inferItineraryGlyph({ title: '收心慢遊・送機回國' }, 5)).toBe('✈️')
  })

  it('falls back to the brand-safe car icon for route days without clear activities', () => {
    expect(inferItineraryGlyph({ title: '清萊 -> 清邁' }, 2)).toBe('🚐')
    expect(inferItineraryGlyph({ title: '自由調整行程' }, 8)).toBe('🚐')
  })
})
