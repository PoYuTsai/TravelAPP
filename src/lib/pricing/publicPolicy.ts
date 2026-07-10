import { calcPerPersonDay } from './perPersonRates'

function thb(amount: number): string {
  return amount.toLocaleString('en-US')
}

export const PUBLIC_DAY_TOUR_PRICE_RANGE_THB = Object.freeze({
  min: calcPerPersonDay('T1', 9, false),
  max: calcPerPersonDay('T4', 2, true),
})

export const PUBLIC_PRICE_RANGE =
  `THB ${thb(PUBLIC_DAY_TOUR_PRICE_RANGE_THB.min)}–${thb(PUBLIC_DAY_TOUR_PRICE_RANGE_THB.max)}／人／日`

export const CHARTER_OVERTIME_POLICY = Object.freeze({
  chiangMaiHours: 10,
  chiangRaiGoldenTriangleHours: 12,
  graceMinutes: 30,
  feeThbPerHourPerCar: 300,
  guideFeeThbPerHour: 0,
})
