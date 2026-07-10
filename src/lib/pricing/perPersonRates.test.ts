import { describe, expect, it } from 'vitest'
import {
  AIRPORT_TRANSFER_FEES,
  DEFAULT_THB_PER_TWD,
  calcPerPersonDay,
  calcTrip,
  resolveFleet,
  resolveGuidePricing,
} from '@/lib/pricing/perPersonRates'

describe('pricing constants', () => {
  it('keeps airport transfer and TWD fallback constants stable', () => {
    expect(AIRPORT_TRANSFER_FEES).toEqual({ sedan: 500, van: 700 })
    expect(DEFAULT_THB_PER_TWD).toBe(1.1)
  })
})

describe('resolveFleet', () => {
  it('uses one sedan for 2-3 guests and one Van for 4-9 guests', () => {
    expect(resolveFleet(2)).toMatchObject({
      vehicle: 'sedan',
      carCount: 1,
      guideRequired: false,
      guideAllowed: false,
      manualQuoteRequired: false,
    })
    expect(resolveFleet(3).vehicle).toBe('sedan')
    expect(resolveFleet(4)).toMatchObject({
      vehicle: 'van',
      carCount: 1,
      guideRequired: false,
      guideAllowed: true,
      manualQuoteRequired: false,
    })
    expect(resolveFleet(9).carCount).toBe(1)
  })

  it('uses two Vans for 10-18 guests without forcing a guide', () => {
    expect(resolveFleet(10)).toMatchObject({
      vehicle: 'van',
      carCount: 2,
      guideRequired: false,
      guideAllowed: true,
      manualQuoteRequired: false,
    })
    expect(resolveFleet(18).carCount).toBe(2)
  })

  it('returns a typed manual fleet for 19 or more guests', () => {
    expect(resolveFleet(19)).toMatchObject({
      vehicle: 'van',
      carCount: 3,
      guideRequired: false,
      manualQuoteRequired: true,
    })
    expect(resolveFleet(27)).toMatchObject({
      carCount: 3,
      manualQuoteRequired: true,
    })
    expect(resolveFleet(28)).toMatchObject({
      carCount: 4,
      manualQuoteRequired: true,
    })
  })

  it('never requires a guide merely because of passenger count', () => {
    for (let occupiedSeats = 2; occupiedSeats <= 28; occupiedSeats += 1) {
      expect(resolveFleet(occupiedSeats).guideRequired).toBe(false)
    }
  })

  it('rejects invalid occupied-seat counts', () => {
    expect(() => resolveFleet(0)).toThrow()
    expect(() => resolveFleet(2.5)).toThrow()
  })
})

describe('resolveGuidePricing', () => {
  it('returns zero guide cost and sell price when guide service is omitted', () => {
    expect(resolveGuidePricing(2, false)).toEqual({
      guideCostThb: 0,
      guideSellThb: 0,
      manualQuoteRequired: false,
      manualQuoteReason: null,
    })
  })

  it('separates one-Van guide cost from its public sell anchor', () => {
    expect(resolveGuidePricing(1, true)).toEqual({
      guideCostThb: 1500,
      guideSellThb: 2500,
      manualQuoteRequired: false,
      manualQuoteReason: null,
    })
  })

  it('uses one shared guide sell anchor for two Vans', () => {
    expect(resolveGuidePricing(2, true)).toEqual({
      guideCostThb: 2000,
      guideSellThb: 2500,
      manualQuoteRequired: false,
      manualQuoteReason: null,
    })
  })

  it('requires manual pricing when the three-Van sell anchor is unset', () => {
    expect(resolveGuidePricing(3, true)).toMatchObject({
      guideCostThb: 2500,
      guideSellThb: null,
      manualQuoteRequired: true,
    })
  })
})

describe('calcPerPersonDay', () => {
  it('matches the one-Van guided table', () => {
    expect(calcPerPersonDay('T1', 4, true)).toBe(2050)
    expect(calcPerPersonDay('T2', 5, true)).toBe(1850)
    expect(calcPerPersonDay('T3', 7, true)).toBe(1550)
    expect(calcPerPersonDay('T4', 9, true)).toBe(1350)
    expect(calcPerPersonDay('T1', 8, true)).toBe(1100)
  })

  it('matches the one-Van unguided table through 9 guests', () => {
    expect(calcPerPersonDay('T1', 4, false)).toBe(1400)
    expect(calcPerPersonDay('T2', 6, false)).toBe(1150)
    expect(calcPerPersonDay('T4', 7, false)).toBe(1350)
    expect(calcPerPersonDay('T1', 8, false)).toBe(800)
    expect(calcPerPersonDay('T1', 9, false)).toBe(750)
  })

  it('matches the sedan table when no guide is requested', () => {
    expect(calcPerPersonDay('T1', 2, false)).toBe(2300)
    expect(calcPerPersonDay('T2', 3, false)).toBe(1750)
    expect(calcPerPersonDay('T3', 2, false)).toBe(3200)
    expect(calcPerPersonDay('T4', 3, false)).toBe(2400)
  })

  it('does not silently return an unguided sedan price for a guided request', () => {
    expect(() => calcPerPersonDay('T1', 2, true)).toThrow(/manual|車型|人工/i)
  })

  it('prices two Vans and one shared guide for 10-18 adults', () => {
    expect(calcPerPersonDay('T2', 10, true)).toBe(1600)
    expect(calcPerPersonDay('T2', 18, true)).toBe(950)
  })

  it('does not return an automatic per-person price for 19 or more guests', () => {
    expect(() => calcPerPersonDay('T2', 19, true)).toThrow(/manual|人工/i)
  })
})

describe('calcTrip automatic and manual quote states', () => {
  it('prices a single guided day for adults only', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(trip.manualQuoteRequired).toBe(false)
    expect(trip.occupiedSeats).toBe(6)
    expect(trip.fleet.withGuide).toBe(true)
    expect(trip.guideCostThb).toBe(1500)
    expect(trip.perPerson.adult).toBe(1400)
    expect(trip.totalThb).toBe(8400)
    expect(trip.items).toEqual([
      { label: '成人', quantity: 6, unitPriceThb: 1400, subtotalThb: 8400 },
    ])
    expect(trip.items.some((item) => item.label.includes('導遊成本'))).toBe(false)
  })

  it('returns typed manual state for a 2-3 guest guided request', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }],
      adults: 2,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(trip.manualQuoteRequired).toBe(true)
    expect(trip.manualQuoteReason).toMatch(/車型|vehicle/i)
    expect(trip.totalThb).toBeNull()
    expect(trip.fareProtection).toBeNull()
    expect(trip.items).toEqual([])
  })

  it('returns typed manual state for 19+ instead of a fake final price', () => {
    const trip = calcTrip({
      days: [{ tier: 'T2' }],
      adults: 19,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(trip.manualQuoteRequired).toBe(true)
    expect(trip.totalThb).toBeNull()
    expect(trip.fareProtection).toBeNull()
  })

  it('requires at least one adult and at least two travelers', () => {
    expect(() =>
      calcTrip({
        days: [{ tier: 'T1' }],
        adults: 0,
        children: 2,
        infants: 0,
        withGuide: false,
      }),
    ).toThrow(/adult|成人/i)
    expect(() =>
      calcTrip({
        days: [{ tier: 'T1' }],
        adults: 1,
        children: 0,
        infants: 0,
        withGuide: false,
      }),
    ).toThrow(/two|2|兩/i)
  })
})

describe('calcTrip fare protection', () => {
  it('prices T2 guided 10 and 18 adult groups with two Vans', () => {
    const ten = calcTrip({
      days: [{ tier: 'T2' }],
      adults: 10,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    const eighteen = calcTrip({
      days: [{ tier: 'T2' }],
      adults: 18,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(ten.perPerson.adult).toBe(1600)
    expect(ten.totalThb).toBe(16000)
    expect(ten.guideCostThb).toBe(2000)
    expect(eighteen.perPerson.adult).toBe(950)
    expect(eighteen.totalThb).toBe(17100)
  })

  it('protects T2 guided 2A+2C+2I at the one-Van core floor', () => {
    const trip = calcTrip({
      days: [{ tier: 'T2' }],
      adults: 2,
      children: 2,
      infants: 2,
      withGuide: true,
    })

    expect(trip.perPerson).toEqual({ adult: 1550, child: 1240, infant: 775 })
    expect(trip.fareProtection).toEqual({
      provisionalThb: 7130,
      coreFloorThb: 8300,
      monotonicFloorThb: 8300,
      finalThb: 8300,
      appliedRule: 'core-floor',
    })
    expect(trip.totalThb).toBe(8300)
    expect(trip.items).toEqual([
      {
        label: '親子包車團費（家庭優惠後）',
        quantity: 1,
        unitPriceThb: 8300,
        subtotalThb: 8300,
      },
    ])
  })

  it('protects T2 guided two-Van 3A+4C+3I at THB 14,100', () => {
    const trip = calcTrip({
      days: [{ tier: 'T2' }],
      adults: 3,
      children: 4,
      infants: 3,
      withGuide: true,
    })

    expect(trip.fleet.carCount).toBe(2)
    expect(trip.fareProtection?.provisionalThb).toBe(12320)
    expect(trip.fareProtection?.coreFloorThb).toBe(14100)
    expect(trip.fareProtection?.finalThb).toBeGreaterThanOrEqual(14100)
    expect(trip.totalThb).toBeGreaterThanOrEqual(14100)
  })

  it('never lowers core group fare when one adult, child, or infant is added', () => {
    const tiers = ['T1', 'T2', 'T3', 'T4'] as const

    for (const tier of tiers) {
      for (const withGuide of [false, true]) {
        const quotes = new Map<string, ReturnType<typeof calcTrip>>()

        for (let adults = 1; adults <= 18; adults += 1) {
          for (let children = 0; children <= 18 - adults; children += 1) {
            for (
              let infants = 0;
              infants <= 18 - adults - children;
              infants += 1
            ) {
              const occupiedSeats = adults + children + infants
              if (occupiedSeats < 2) continue

              const quote = calcTrip({
                days: [{ tier }],
                adults,
                children,
                infants,
                withGuide,
              })
              quotes.set(`${adults}:${children}:${infants}`, quote)
            }
          }
        }

        for (const [key, quote] of quotes) {
          if (quote.manualQuoteRequired || !quote.fareProtection) continue
          const [adults, children, infants] = key.split(':').map(Number)
          const additions = [
            [adults + 1, children, infants],
            [adults, children + 1, infants],
            [adults, children, infants + 1],
          ]

          for (const nextCounts of additions) {
            if (nextCounts[0] + nextCounts[1] + nextCounts[2] > 18) continue
            const next = quotes.get(nextCounts.join(':'))
            if (!next || next.manualQuoteRequired || !next.fareProtection) continue

            expect(
              next.fareProtection.finalThb,
              `${tier} ${withGuide ? 'guided' : 'unguided'} ${key} -> ${nextCounts.join(':')}`,
            ).toBeGreaterThanOrEqual(quote.fareProtection.finalThb)
          }
        }
      }
    }
  })
})

describe('calcTrip add-ons remain outside fare protection', () => {
  it('adds a child seat and six-person insurance in full after the THB 8,300 floor', () => {
    const trip = calcTrip({
      days: [{ tier: 'T2' }],
      adults: 2,
      children: 2,
      infants: 2,
      withGuide: true,
      addons: { childSeats: 1, insurancePersons: 6 },
    })

    expect(trip.fareProtection?.finalThb).toBe(8300)
    expect(trip.totalThb).toBe(9400)
    expect(trip.items).toEqual([
      {
        label: '親子包車團費（家庭優惠後）',
        quantity: 1,
        unitPriceThb: 8300,
        subtotalThb: 8300,
      },
      {
        label: '兒童安全座椅',
        quantity: 1,
        unitPriceThb: 500,
        subtotalThb: 500,
      },
      {
        label: '旅遊保險',
        quantity: 6,
        unitPriceThb: 100,
        subtotalThb: 600,
      },
    ])
  })

  it('adds the airport luggage Van in full without changing per-person prices', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1', isAirportDay: true }],
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(trip.perPerson.adult).toBe(1100)
    expect(trip.fareProtection?.finalThb).toBe(8800)
    expect(trip.totalThb).toBe(9500)
    expect(trip.items.find((item) => item.label === '機場行李車')).toEqual({
      label: '機場行李車',
      quantity: 1,
      unitPriceThb: 700,
      subtotalThb: 700,
    })
  })

  it('adds overnight room fees exactly rather than discounting them by age', () => {
    const trip = calcTrip({
      days: [{ tier: 'T3' }, { tier: 'T3' }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
      addons: { overnightRoomNights: 2 },
    })

    expect(trip.perPerson.adult).toBe(3500)
    expect(trip.fareProtection?.finalThb).toBe(21000)
    expect(trip.totalThb).toBe(22500)
    expect(trip.items.find((item) => item.label.includes('房費'))?.subtotalThb).toBe(
      1500,
    )
  })
})

describe('calcTrip long-trip discounts', () => {
  it('discounts THB 50 per person per day from three-day adult rates', () => {
    const trip = calcTrip({
      days: [{ tier: 'T1' }, { tier: 'T1' }, { tier: 'T1' }],
      adults: 6,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(trip.perPersonDayPrices).toEqual([1350, 1350, 1350])
    expect(trip.perPerson.adult).toBe(4050)
    expect(trip.totalThb).toBe(24300)
  })

  it('discounts THB 100 per person per day from five-day adult rates', () => {
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

    expect(trip.perPersonDayPrices).toEqual([1300, 1300, 1300, 1300, 1300])
    expect(trip.perPerson.adult).toBe(6500)
    expect(trip.totalThb).toBe(39000)
  })
})
