import { describe, it, expect } from 'vitest'
import { inferTimelineItem } from '../inferTimelineItem'
import type { TimelineItem } from '../inferTimelineItem'

describe('inferTimelineItem', () => {
  describe('kind detection', () => {
    it('detects transport for "機場接機"', () => {
      const result = inferTimelineItem('機場接機', 0)
      expect(result.kind).toBe('transport')
    })

    it('detects transport for "送機"', () => {
      const result = inferTimelineItem('送機回機場', 0)
      expect(result.kind).toBe('transport')
    })

    it('detects transport for "check out"', () => {
      const result = inferTimelineItem('飯店 check out 出發', 0)
      expect(result.kind).toBe('transport')
    })

    it('detects meal for "脆皮豬午餐"', () => {
      const result = inferTimelineItem('脆皮豬午餐', 1)
      expect(result.kind).toBe('meal')
    })

    it('detects meal for "晚餐"', () => {
      const result = inferTimelineItem('帝王餐晚餐', 3)
      expect(result.kind).toBe('meal')
    })

    it('detects meal for "buffet"', () => {
      const result = inferTimelineItem('自助 buffet', 2)
      expect(result.kind).toBe('meal')
    })

    it('detects snack for "下午茶"', () => {
      const result = inferTimelineItem('下午茶甜點', 2)
      expect(result.kind).toBe('snack')
    })

    it('detects snack for "咖啡"', () => {
      const result = inferTimelineItem('網紅咖啡廳', 2)
      expect(result.kind).toBe('snack')
    })

    it('detects stop for "Check in 飯店"', () => {
      const result = inferTimelineItem('Check in 飯店', 4)
      expect(result.kind).toBe('stop')
    })

    it('detects stop for "Big C"', () => {
      const result = inferTimelineItem('Big C 採買', 3)
      expect(result.kind).toBe('stop')
    })

    it('detects stop for "換匯"', () => {
      const result = inferTimelineItem('換匯', 1)
      expect(result.kind).toBe('stop')
    })

    it('defaults to activity for unknown text', () => {
      const result = inferTimelineItem('大象保護營', 1)
      expect(result.kind).toBe('activity')
    })

    it('defaults to activity for generic text', () => {
      const result = inferTimelineItem('叢林飛躍', 2)
      expect(result.kind).toBe('activity')
    })
  })

  describe('icon assignment', () => {
    it('assigns Plane for 機場接機', () => {
      const result = inferTimelineItem('機場接機', 0)
      expect(result.icon).toBe('Plane')
    })

    it('assigns Car for transport without airport keywords', () => {
      const result = inferTimelineItem('車程前往目的地', 0)
      expect(result.icon).toBe('Car')
    })

    it('assigns UtensilsCrossed for meal', () => {
      const result = inferTimelineItem('脆皮豬午餐', 1)
      expect(result.icon).toBe('UtensilsCrossed')
    })

    it('assigns Coffee for snack', () => {
      const result = inferTimelineItem('下午茶', 2)
      expect(result.icon).toBe('Coffee')
    })

    it('assigns Heart for 大象 (override)', () => {
      const result = inferTimelineItem('大象保護營', 1)
      expect(result.icon).toBe('Heart')
    })

    it('assigns Droplets for 瀑布', () => {
      const result = inferTimelineItem('瀑布探險', 2)
      expect(result.icon).toBe('Droplets')
    })

    it('assigns Building for 寺廟', () => {
      const result = inferTimelineItem('雙龍寺', 1)
      expect(result.icon).toBe('Building')
    })

    it('assigns ShoppingBag for 夜市', () => {
      const result = inferTimelineItem('週日夜市', 3)
      expect(result.icon).toBe('ShoppingBag')
    })

    it('assigns MountainSnow for 攀岩', () => {
      const result = inferTimelineItem('攀岩冒險', 2)
      expect(result.icon).toBe('MountainSnow')
    })

    it('assigns Camera for 泰服拍照', () => {
      const result = inferTimelineItem('泰服拍照', 1)
      expect(result.icon).toBe('Camera')
    })

    it('assigns Heart for 按摩', () => {
      const result = inferTimelineItem('泰式按摩', 3)
      expect(result.icon).toBe('Heart')
    })

    it('assigns Coins for 換匯', () => {
      const result = inferTimelineItem('換匯', 1)
      expect(result.icon).toBe('Coins')
    })

    it('assigns MapPin for stop without special override', () => {
      const result = inferTimelineItem('入住飯店', 4)
      expect(result.icon).toBe('MapPin')
    })

    it('assigns Sparkles for default activity', () => {
      const result = inferTimelineItem('叢林飛躍', 2)
      expect(result.icon).toBe('Sparkles')
    })
  })

  describe('time estimation', () => {
    it('returns HH:MM format', () => {
      const result = inferTimelineItem('機場接機', 0)
      expect(result.time).toMatch(/^\d{2}:\d{2}$/)
    })

    it('starts around 08:00-09:00 for first item', () => {
      const result = inferTimelineItem('機場接機', 0)
      const hour = parseInt(result.time.split(':')[0])
      expect(hour).toBeGreaterThanOrEqual(8)
      expect(hour).toBeLessThanOrEqual(9)
    })

    it('generates later times for higher indices', () => {
      const r0 = inferTimelineItem('出發', 0)
      const r1 = inferTimelineItem('午餐', 1)
      const r2 = inferTimelineItem('活動', 2)
      expect(r0.time < r1.time).toBe(true)
      expect(r1.time < r2.time).toBe(true)
    })

    it('does not exceed 21:00', () => {
      const result = inferTimelineItem('很晚的活動', 20)
      const hour = parseInt(result.time.split(':')[0])
      expect(hour).toBeLessThanOrEqual(21)
    })
  })

  describe('label preservation', () => {
    it('preserves the original label', () => {
      const result = inferTimelineItem('大象保護營', 1)
      expect(result.label).toBe('大象保護營')
    })
  })

  describe('case insensitivity', () => {
    it('matches "CHECK IN" case-insensitively', () => {
      const result = inferTimelineItem('CHECK IN 飯店', 4)
      expect(result.kind).toBe('stop')
    })

    it('matches "Buffet" case-insensitively', () => {
      const result = inferTimelineItem('Buffet 吃到飽', 2)
      expect(result.kind).toBe('meal')
    })

    it('matches "SPA" for icon override', () => {
      const result = inferTimelineItem('SPA 放鬆', 3)
      expect(result.icon).toBe('Heart')
    })
  })
})
