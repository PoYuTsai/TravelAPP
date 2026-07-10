import { describe, expect, it } from 'vitest'
import {
  buildPerPersonQuote,
  dayTypeToTier,
  isAirportServiceDay,
} from '../perPersonAdapter'
import { calcTrip } from '@/lib/pricing/perPersonRates'

describe('dayTypeToTier', () => {
  it('maps calculator day types to pricing tiers', () => {
    expect(dayTypeToTier('city')).toBe('T1')
    expect(dayTypeToTier('suburban')).toBe('T2')
    expect(dayTypeToTier('chiangrai')).toBe('T3')
    expect(dayTypeToTier('goldentriangle')).toBe('T4')
  })

  it('marks airport days as transfer-only', () => {
    expect(dayTypeToTier('airport')).toBe('transfer')
  })

  it('falls back to T2 for unknown types', () => {
    expect(dayTypeToTier('whatever')).toBe('T2')
  })
})

describe('isAirportServiceDay', () => {
  it('detects pickup/dropoff keywords in day name', () => {
    expect(isAirportServiceDay('市區(接機+行程)')).toBe(true)
    expect(isAirportServiceDay('送機')).toBe(true)
    expect(isAirportServiceDay('機場outlet+回程')).toBe(true)
    expect(isAirportServiceDay('清萊一日遊')).toBe(false)
  })
})

describe('buildPerPersonQuote', () => {
  const sixDays = [
    { name: '市區(接機+行程)', type: 'city' },
    { name: '郊區(大象/射擊)', type: 'suburban' },
    { name: '清萊一日遊', type: 'chiangrai' },
    { name: '郊區(水上/動物園)', type: 'suburban' },
    { name: '郊區(叢林/蛇園)', type: 'suburban' },
    { name: '送機', type: 'airport' },
  ]

  it.each([8, 9])('%i 人不選導遊時維持無導遊，5 個整日進引擎、送機日按車收費', (occupiedSeats) => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: occupiedSeats - 2,
      children: 2,
      infants: 0,
      withGuide: false,
    })
    expect(result.manualQuoteRequired).toBe(false)
    expect(result.manualQuoteReason).toBeNull()
    expect(result.guided).toBe(false)
    expect(result.fleet?.vehicle).toBe('van')
    // 送機日：van 700 × 1 台 ＋ ≥8 人行李車 700
    expect(result.transferFee).toBe(1400)
    expect(result.trip).not.toBeNull()
    expect(result.trip?.manualQuoteRequired).toBe(false)
    expect(result.trip!.perPersonDayPrices).toHaveLength(5)
    expect(result.groupTourPrice).toBe(
      result.trip!.manualQuoteRequired ? null : result.trip!.totalThb + 1400,
    )
  })

  it('整日接機日會攤入行李車（isAirportDay 傳進引擎）', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    const expected = calcTrip({
      days: [
        { tier: 'T1', isAirportDay: true },
        { tier: 'T2' },
        { tier: 'T3' },
        { tier: 'T2' },
        { tier: 'T2' },
      ],
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(result.trip!.totalThb).toBe(expected.totalThb)
  })

  it('3 人選導遊時保留選擇並要求人工確認車型，不回傳假報價', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 2,
      children: 1,
      infants: 0,
      withGuide: true,
    })
    expect(result.guided).toBe(true)
    expect(result.fleet?.vehicle).toBe('sedan')
    expect(result.manualQuoteRequired).toBe(true)
    expect(result.manualQuoteReason).toBe(
      'guided-sedan-requires-vehicle-confirmation',
    )
    expect(result.trip?.manualQuoteRequired).toBe(true)
    expect(result.groupTourPrice).toBeNull()
    // 送機日：sedan 500 × 1 台，人數 <8 無行李車
    expect(result.transferFee).toBe(500)
  })

  it('10 人 guided T2 單日使用兩台 Van，自動團費為 16,000', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '郊區一日遊', type: 'suburban' }],
      adults: 10,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(result.occupiedSeats).toBe(10)
    expect(result.fleet?.carCount).toBe(2)
    expect(result.guided).toBe(true)
    expect(result.manualQuoteRequired).toBe(false)
    expect(result.trip?.manualQuoteRequired).toBe(false)
    expect(result.trip?.guideCostThb).toBe(2000)
    expect(result.groupTourPrice).toBe(16000)
  })

  it('18 人仍使用兩台 Van 並產生正數自動團費', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '郊區一日遊', type: 'suburban' }],
      adults: 18,
      children: 0,
      infants: 0,
      withGuide: false,
    })

    expect(result.fleet?.carCount).toBe(2)
    expect(result.guided).toBe(false)
    expect(result.manualQuoteRequired).toBe(false)
    expect(result.trip?.manualQuoteRequired).toBe(false)
    expect(result.groupTourPrice).toBeGreaterThan(0)
  })

  it('19 人回傳 typed manual quote，不產生對客團費', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '郊區一日遊', type: 'suburban' }],
      adults: 19,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(result.fleet?.carCount).toBe(3)
    expect(result.manualQuoteRequired).toBe(true)
    expect(result.manualQuoteReason).toBe('group-size-requires-manual-quote')
    expect(result.trip?.manualQuoteRequired).toBe(true)
    expect(result.groupTourPrice).toBeNull()
  })

  it('人數為 0 時安全回空結果，不 throw', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 0,
      children: 0,
      infants: 0,
      withGuide: true,
    })
    expect(result.trip).toBeNull()
    expect(result.groupTourPrice).toBe(0)
    expect(result.manualQuoteRequired).toBe(false)
    expect(result.manualQuoteReason).toBeNull()
  })

  it('全部都是接送日時只收接送費，不 throw', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '接機', type: 'airport' }, { name: '送機', type: 'airport' }],
      adults: 4,
      children: 0,
      infants: 0,
      withGuide: false,
    })
    expect(result.trip).toBeNull()
    // van 700 × 2 趟，<8 人無行李車
    expect(result.transferFee).toBe(1400)
    expect(result.groupTourPrice).toBe(1400)
  })

  it('10 人純接送依兩台 Van 收車費，行李車維持每趟一台', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '接機', type: 'airport' }, { name: '送機', type: 'airport' }],
      adults: 10,
      children: 0,
      infants: 0,
      withGuide: false,
    })

    expect(result.fleet?.carCount).toBe(2)
    expect(result.trip).toBeNull()
    expect(result.manualQuoteRequired).toBe(false)
    // van 700 × 2 台 × 2 趟，另加行李車 700 × 2 趟
    expect(result.transferFee).toBe(4200)
    expect(result.groupTourPrice).toBe(4200)
  })
})
