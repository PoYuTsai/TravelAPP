import { describe, expect, it } from 'vitest'
import {
  AIRPORT_TRANSFER_FEES,
  DEFAULT_THB_PER_TWD,
  calcPerPersonDay,
  calcTrip,
  countLuggageCheckCars,
  resolveFleet,
} from '@/lib/pricing/perPersonRates'

describe('純接送日按車收（framework 第 5 節規則 2）', () => {
  it('接送機單趟：轎車 500 / van 700，按車收不算一日團費', () => {
    expect(AIRPORT_TRANSFER_FEES).toEqual({ sedan: 500, van: 700 })
  })
})

describe('resolveFleet', () => {
  it('assigns sedan with an optional guide for 2-3 seats', () => {
    expect(resolveFleet(2)).toEqual({
      vehicle: 'sedan',
      carCount: 1,
      guideRequired: false,
      guideAllowed: true,
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

  it('keeps the guide optional for 8-9 seats', () => {
    expect(resolveFleet(8)).toEqual({
      vehicle: 'van',
      carCount: 1,
      guideRequired: false,
      guideAllowed: true,
    })
    expect(resolveFleet(9).guideRequired).toBe(false)
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
  it('matches the guided table for 2-9 seats', () => {
    expect(calcPerPersonDay('T1', 2, true)).toBe(3550)
    expect(calcPerPersonDay('T4', 3, true)).toBe(3250)
    expect(calcPerPersonDay('T1', 4, true)).toBe(2050)
    expect(calcPerPersonDay('T2', 5, true)).toBe(1850)
    expect(calcPerPersonDay('T3', 7, true)).toBe(1550)
    expect(calcPerPersonDay('T4', 9, true)).toBe(1350)
    expect(calcPerPersonDay('T1', 8, true)).toBe(1100)
  })

  it('matches the no-guide van table for 4-9 seats', () => {
    expect(calcPerPersonDay('T1', 4, false)).toBe(1400)
    expect(calcPerPersonDay('T2', 6, false)).toBe(1150)
    expect(calcPerPersonDay('T4', 7, false)).toBe(1350)
    expect(calcPerPersonDay('T1', 8, false)).toBe(800)
    expect(calcPerPersonDay('T4', 9, false)).toBe(1050)
  })

  it('matches the sedan table (2-3, never guided)', () => {
    expect(calcPerPersonDay('T1', 2, false)).toBe(2300)
    expect(calcPerPersonDay('T2', 3, false)).toBe(1750)
    expect(calcPerPersonDay('T3', 2, false)).toBe(3200)
    expect(calcPerPersonDay('T4', 3, false)).toBe(2400)
  })

  it('adds guide pricing when a sedan group selects a guide', () => {
    expect(calcPerPersonDay('T1', 2, true)).toBe(3550)
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

  it('counts infants toward the seat bracket without forcing a guide at 8', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 6,
      children: 0,
      infants: 2,
      withGuide: false,
    })
    expect(trip.occupiedSeats).toBe(8)
    expect(trip.fleet.withGuide).toBe(false)
    expect(trip.perPerson.adult).toBe(800)
    expect(trip.perPerson.infant).toBe(400)
    expect(trip.totalThb).toBe(6 * 800 + 2 * 400)
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
  it('does not add a luggage van from headcount alone', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1', isAirportDay: true }],
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(trip.perPerson.adult).toBe(1100)
  })

  it('adds the confirmed luggage van count to an airport service day', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1', isAirportDay: true }],
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
      addons: { luggageVansPerAirportDay: 1 },
    })
    expect(trip.perPerson.adult).toBe(1200)
  })
})

describe('countLuggageCheckCars', () => {
  it('checks each car separately once that car carries 7 or more guests', () => {
    expect(countLuggageCheckCars(6, 1)).toBe(0)
    expect(countLuggageCheckCars(7, 1)).toBe(1)
    expect(countLuggageCheckCars(13, 2)).toBe(1)
    expect(countLuggageCheckCars(14, 2)).toBe(2)
    expect(countLuggageCheckCars(18, 2)).toBe(2)
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
