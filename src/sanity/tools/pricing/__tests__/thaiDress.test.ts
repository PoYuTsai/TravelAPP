import { describe, expect, it } from 'vitest'

import {
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
})
