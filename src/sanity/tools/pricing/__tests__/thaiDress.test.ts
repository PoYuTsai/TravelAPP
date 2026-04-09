import { describe, expect, it } from 'vitest'
import { parseItineraryText } from '@/lib/itinerary'

import {
  detectThaiDressDay,
  getThaiDressPhotographerCount,
  getThaiDressPhotographerLabel,
} from '@/sanity/tools/pricing/thaiDress'

describe('thai dress photographer helpers', () => {
  it('defaults to one photographer even when the group is larger than ten', () => {
    expect(
      getThaiDressPhotographerCount({
        isSelected: true,
        people: 12,
        includeExtraPhotographer: false,
      })
    ).toBe(1)
  })

  it('adds a second photographer only when explicitly requested', () => {
    expect(
      getThaiDressPhotographerCount({
        isSelected: true,
        people: 12,
        includeExtraPhotographer: true,
      })
    ).toBe(2)
  })

  it('returns clear customer-facing copy for the photographer service', () => {
    expect(getThaiDressPhotographerLabel(1)).toBe('攝影師 1 小時（1位，最多服務 10 位）')
    expect(getThaiDressPhotographerLabel(2)).toBe('攝影師 1 小時（2位，每位最多服務 10 位）')
  })

  it('detects thai dress on day 1 even when the line mixes other locations or activities', () => {
    const parsed = parseItineraryText(`
8/28 (五)
Day 1｜機場接機
・Nakhonping Exchange換匯
・泰服體驗1小時，請專業攝影師拍攝 (古城塔配門/柴迪隆寺，統計女生幾位化妝)

8/29 (六)
Day 2｜清萊一日遊
・白廟
`.trim())

    expect(detectThaiDressDay(parsed.days)).toBe(1)
  })

  it('detects thai dress when it is scheduled on a later day', () => {
    const parsed = parseItineraryText(`
8/28 (五)
Day 1｜機場接機
・Nakhonping Exchange換匯

8/29 (六)
Day 2｜古城半日
・泰服體驗
`.trim())

    expect(detectThaiDressDay(parsed.days)).toBe(2)
  })
})
