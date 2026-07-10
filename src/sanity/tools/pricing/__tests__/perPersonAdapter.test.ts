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

  it('8 人未確認行李車：送機只收 van 700，並標示需確認一台車的行李', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 6,
      children: 2,
      infants: 0,
      withGuide: false,
    })
    expect(result.splitOrderRequired).toBe(false)
    expect(result.guided).toBe(false)
    expect(result.fleet?.vehicle).toBe('van')
    expect(result.luggageCheckCarCount).toBe(1)
    expect(result.transferFee).toBe(700)
    expect(result.trip).not.toBeNull()
    expect(result.trip!.perPersonDayPrices).toHaveLength(5)
    expect(result.groupTourPrice).toBe(result.trip!.totalThb + 700)
  })

  it('adds a luggage van only after it is explicitly confirmed', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: false,
      luggageVansPerAirportDay: 1,
    })
    expect(result.transferFee).toBe(1400)
  })

  it('整日接機日不因人數自動攤入行李車', () => {
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

  it('3 人轎車可選中文導遊；接送仍按轎車 500', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 2,
      children: 1,
      infants: 0,
      withGuide: true,
    })
    expect(result.guided).toBe(true)
    expect(result.fleet?.vehicle).toBe('sedan')
    // 送機日：sedan 500 × 1 台，人數 <8 無行李車
    expect(result.transferFee).toBe(500)
  })

  it('嬰兒佔位計入級距：3 大 4 小 3 嬰 = 10 佔位 → 拆兩單', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 3,
      children: 4,
      infants: 3,
      withGuide: true,
    })
    expect(result.occupiedSeats).toBe(10)
    expect(result.splitOrderRequired).toBe(true)
    expect(result.trip).toBeNull()
    expect(result.groupTourPrice).toBe(0)
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
    expect(result.splitOrderRequired).toBe(false)
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
})
