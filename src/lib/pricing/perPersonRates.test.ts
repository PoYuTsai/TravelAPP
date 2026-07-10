import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THB_PER_TWD,
  calcPerPersonDay,
  calcTrip,
  resolveFleet,
} from '@/lib/pricing/perPersonRates'

describe('resolveFleet', () => {
  it('assigns sedan without guide for 2-3 seats', () => {
    expect(resolveFleet(2)).toEqual({
      vehicle: 'sedan',
      carCount: 1,
      guideRequired: false,
      guideAllowed: false,
    })
    expect(resolveFleet(3).vehicle).toBe('sedan')
  })

  it('assigns van with optional guide for 4-7 seats', () => {
    expect(resolveFleet(4)).toEqual({
      vehicle: 'van',
      carCount: 1,
      guideRequired: false,
      guideAllowed: true,
    })
    expect(resolveFleet(7).guideRequired).toBe(false)
  })

  it('requires licensed guide for 8-9 seats', () => {
    expect(resolveFleet(8)).toEqual({
      vehicle: 'van',
      carCount: 1,
      guideRequired: true,
      guideAllowed: true,
    })
    expect(resolveFleet(9).guideRequired).toBe(true)
  })

  it('requires two cars for 10+ seats', () => {
    expect(resolveFleet(10).carCount).toBe(2)
    expect(resolveFleet(12).carCount).toBe(2)
  })

  it('throws for fewer than 1 seat', () => {
    expect(() => resolveFleet(0)).toThrow()
  })
})

describe('calcPerPersonDay — 對照 framework 第 6 節價目表', () => {
  it('matches the guided van table (8-9 guide forced)', () => {
    expect(calcPerPersonDay('T1', 4, true)).toBe(2050)
    expect(calcPerPersonDay('T2', 5, true)).toBe(1850)
    expect(calcPerPersonDay('T3', 7, true)).toBe(1550)
    expect(calcPerPersonDay('T4', 9, true)).toBe(1350)
    expect(calcPerPersonDay('T1', 8, true)).toBe(1100)
  })

  it('matches the no-guide van table (4-7 only)', () => {
    expect(calcPerPersonDay('T1', 4, false)).toBe(1400)
    expect(calcPerPersonDay('T2', 6, false)).toBe(1150)
    expect(calcPerPersonDay('T4', 7, false)).toBe(1350)
  })

  it('matches the sedan table (2-3, never guided)', () => {
    expect(calcPerPersonDay('T1', 2, false)).toBe(2300)
    expect(calcPerPersonDay('T2', 3, false)).toBe(1750)
    expect(calcPerPersonDay('T3', 2, false)).toBe(3200)
    expect(calcPerPersonDay('T4', 3, false)).toBe(2400)
  })

  it('forces guide pricing at 8-9 even if withGuide=false is passed', () => {
    expect(calcPerPersonDay('T1', 8, false)).toBe(1100)
  })

  it('ignores withGuide=true for sedan groups', () => {
    expect(calcPerPersonDay('T1', 2, true)).toBe(2300)
  })
})

describe('calcTrip — 單日基本盤', () => {
  it('prices a single guided day for adults only', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(trip.occupiedSeats).toBe(6)
    expect(trip.fleet.withGuide).toBe(true)
    expect(trip.perPerson.adult).toBe(1400)
    expect(trip.totalThb).toBe(6 * 1400)
    expect(trip.items).toEqual([
      { label: '大人', quantity: 6, unitPriceThb: 1400, subtotalThb: 8400 },
    ])
  })

  it('charges children at 80% and infants at 50% of the adult price', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 4,
      children: 2,
      infants: 0,
      withGuide: true,
    })
    // 佔位 6 人 → 查 n=6 級距
    expect(trip.perPerson.adult).toBe(1400)
    expect(trip.perPerson.child).toBe(1120)
    expect(trip.totalThb).toBe(4 * 1400 + 2 * 1120)
  })

  it('counts infants toward the seat bracket and forces guide at 8', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 6,
      children: 0,
      infants: 2,
      withGuide: false,
    })
    expect(trip.occupiedSeats).toBe(8)
    expect(trip.fleet.withGuide).toBe(true)
    expect(trip.perPerson.adult).toBe(1100)
    expect(trip.perPerson.infant).toBe(550)
    expect(trip.totalThb).toBe(6 * 1100 + 2 * 550)
  })

  it('throws for 10+ seats (拆兩單)', () => {
    expect(() =>
      calcTrip({
        days: [{ tier: 'T1' }],
        adults: 10,
        children: 0,
        infants: 0,
        withGuide: true,
      }),
    ).toThrow(/兩/)
  })
})

describe('calcTrip — 機場日行李車', () => {
  it('adds the 700 THB luggage van into the day price when seats >= 8', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1', isAirportDay: true }],
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    // (4000 + 2500 + 1000 + 8×150 + 700) / 8 = 1175 → 1200
    expect(trip.perPerson.adult).toBe(1200)
  })

  it('does not add a luggage van below 8 seats', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1', isAirportDay: true }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(trip.perPerson.adult).toBe(1400)
  })
})

describe('calcTrip — 長包折扣', () => {
  it('discounts 50/person/day from 3 days', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }, { tier: 'T1' }, { tier: 'T1' }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(trip.perPersonDayPrices).toEqual([1350, 1350, 1350])
    expect(trip.perPerson.adult).toBe(4050)
    expect(trip.totalThb).toBe(6 * 4050)
  })

  it('discounts 100/person/day from 5 days', () => {
    const trip = calcTrip({
      days: [
        { tier: 'T1' },
        { tier: 'T1' },
        { tier: 'T1' },
        { tier: 'T1' },
        { tier: 'T1' },
      ],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(trip.perPersonDayPrices[0]).toBe(1300)
    expect(trip.perPerson.adult).toBe(5 * 1300)
  })
})

describe('calcTrip — 加購與過夜攤提', () => {
  it('charges child seats at 500/day/seat across trip days', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }, { tier: 'T1' }, { tier: 'T1' }],
      adults: 5,
      children: 0,
      infants: 1,
      withGuide: true,
      addons: { childSeats: 1 },
    })
    const seatItem = trip.items.find((i) => i.label.includes('安全座椅'))
    expect(seatItem).toEqual({
      label: '兒童安全座椅',
      quantity: 1,
      unitPriceThb: 1500,
      subtotalThb: 1500,
    })
  })

  it('charges insurance at 100/person/trip', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 4,
      children: 0,
      infants: 0,
      withGuide: false,
      addons: { insurancePersons: 4 },
    })
    const item = trip.items.find((i) => i.label.includes('保險'))
    expect(item?.subtotalThb).toBe(400)
    expect(trip.totalThb).toBe(4 * 1400 + 400)
  })

  it('spreads overnight room cost per person, rounded up to 50', () => {
    const trip = calcTrip({
      days: [{ tier: 'T3' }, { tier: 'T3' }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
      addons: { overnightRoomNights: 2 },
    })
    // 房費 2×750=1500，攤 6 人 = 250/人（已是 50 倍數）
    // T3 n=6 含導遊 = 1750/日 × 2 日 + 250 = 3750
    expect(trip.perPerson.adult).toBe(3750)
  })
})

describe('匯率 fallback 統一', () => {
  it('exports 1.1 THB per TWD (TWD = THB / rate)', () => {
    expect(DEFAULT_THB_PER_TWD).toBe(1.1)
  })
})
