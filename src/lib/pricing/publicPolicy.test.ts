import { describe, expect, it } from 'vitest'
import { calcPerPersonDay } from './perPersonRates'
import {
  CHARTER_OVERTIME_POLICY,
  PUBLIC_DAY_TOUR_PRICE_RANGE_THB,
  PUBLIC_PRICE_RANGE,
} from './publicPolicy'

describe('public pricing policy', () => {
  it('derives the published price range from the canonical engine', () => {
    expect(PUBLIC_DAY_TOUR_PRICE_RANGE_THB).toEqual({
      min: calcPerPersonDay('T1', 9, false),
      max: calcPerPersonDay('T4', 2, true),
    })
    expect(PUBLIC_PRICE_RANGE).toBe('THB 750–4,750／人／日')
  })

  it('owns the shared charter overtime policy', () => {
    expect(CHARTER_OVERTIME_POLICY).toEqual({
      chiangMaiHours: 10,
      chiangRaiGoldenTriangleHours: 12,
      graceMinutes: 30,
      feeThbPerHourPerCar: 300,
      guideFeeThbPerHour: 0,
    })
  })
})
