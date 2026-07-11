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

  it.each([8, 9])('%i 人未確認行李車時只收既有送機車費，並標示一台需確認', (occupiedSeats) => {
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
    expect(result.luggageCheckCarCount).toBe(1)
    expect(result.transferFee).toBe(700)
    expect(result.trip).not.toBeNull()
    expect(result.trip?.manualQuoteRequired).toBe(false)
    expect(result.trip!.perPersonDayPrices).toHaveLength(5)
    expect(result.groupTourPrice).toBe(
      result.trip!.manualQuoteRequired ? null : result.trip!.totalThb + 700,
    )
  })

  it('確認一台行李車後，整日接機與純送機各計一趟', () => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: 8,
      children: 0,
      infants: 0,
      withGuide: true,
      luggageVansPerAirportDay: 1,
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
      addons: { luggageVansPerAirportDay: 1 },
    })
    expect(result.trip!.totalThb).toBe(expected.totalThb)
    expect(result.transferFee).toBe(1400)
  })

  it.each([2, 3])('%i 人選導遊時使用 sedan＋guide 並自動完成報價', (occupiedSeats) => {
    const result = buildPerPersonQuote({
      days: sixDays,
      adults: occupiedSeats - 1,
      children: 1,
      infants: 0,
      withGuide: true,
    })
    expect(result.guided).toBe(true)
    expect(result.fleet?.vehicle).toBe('sedan')
    expect(result.manualQuoteRequired).toBe(false)
    expect(result.manualQuoteReason).toBeNull()
    expect(result.trip?.manualQuoteRequired).toBe(false)
    expect(result.trip?.guideCostThb).toBe(7500)
    expect(result.groupTourPrice).toBe(
      result.trip?.manualQuoteRequired ? null : result.trip!.totalThb + 500,
    )
    // 送機日：sedan 500 × 1 台
    expect(result.transferFee).toBe(500)
  })

  it('2–3 人 guided 純接送仍只收既有接送費，不新增導遊服務日', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '接機', type: 'airport' }, { name: '送機', type: 'airport' }],
      adults: 3,
      children: 0,
      infants: 0,
      withGuide: true,
    })

    expect(result.guided).toBe(true)
    expect(result.fleet?.vehicle).toBe('sedan')
    expect(result.trip).toBeNull()
    expect(result.manualQuoteRequired).toBe(false)
    expect(result.manualQuoteReason).toBeNull()
    expect(result.transferFee).toBe(1000)
    expect(result.groupTourPrice).toBe(1000)
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

  it.each([false, true])('1 位成人（withGuide=%s）含行程日時維持 typed manual quote', (withGuide) => {
    const result = buildPerPersonQuote({
      days: [{ name: '市區一日遊', type: 'city' }],
      adults: 1,
      children: 0,
      infants: 0,
      withGuide,
    })

    expect(result.occupiedSeats).toBe(1)
    expect(result.fleet).toMatchObject({ vehicle: 'sedan', carCount: 1 })
    expect(result.manualQuoteRequired).toBe(true)
    expect(result.manualQuoteReason).toBe('minimum-group-size-required')
    expect(result.trip).toBeNull()
    expect(result.groupTourPrice).toBeNull()
    expect(result.guided).toBe(withGuide)
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
    // van 700 × 2 趟，未確認行李車不加價
    expect(result.transferFee).toBe(1400)
    expect(result.groupTourPrice).toBe(1400)
  })

  it('10 人平均分兩台 Van 時每台 5 人，不觸發行李確認', () => {
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
    expect(result.luggageCheckCarCount).toBe(0)
    expect(result.transferFee).toBe(2800)
    expect(result.groupTourPrice).toBe(2800)
  })

  it('14 人兩台 Van 都達 7 人，確認兩台行李車後逐台逐趟計價', () => {
    const result = buildPerPersonQuote({
      days: [{ name: '接機', type: 'airport' }, { name: '送機', type: 'airport' }],
      adults: 14,
      children: 0,
      infants: 0,
      withGuide: false,
      luggageVansPerAirportDay: 2,
    })

    expect(result.fleet?.carCount).toBe(2)
    expect(result.luggageCheckCarCount).toBe(2)
    expect(result.transferFee).toBe(5600)
    expect(result.groupTourPrice).toBe(5600)
  })
})
