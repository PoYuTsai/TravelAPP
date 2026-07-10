/**
 * 人頭計價轉接層：把報價器的每日車費列（CarFeeDay）映射成
 * perPersonRates 引擎輸入，並處理引擎沒有的邊界（純接送日按車收）。
 * 規格：docs/plans/2026-07-10-per-person-pricing-framework.md 第 3、5 節
 */

import {
  AIRPORT_TRANSFER_FEES,
  LUGGAGE_VAN_FEE,
  LUGGAGE_VAN_SEAT_THRESHOLD,
  calcTrip,
  resolveFleet,
  type AutomaticTripQuote,
  type Fleet,
  type ManualQuoteReason,
  type ManualTripQuote,
  type Tier,
  type TripQuote,
} from '@/lib/pricing/perPersonRates'

/** city→T1 市區、suburban→T2 近郊、chiangrai→T3 清萊、goldentriangle→T4 金三角；airport＝純接送 */
export function dayTypeToTier(type: string): Tier | 'transfer' {
  switch (type) {
    case 'city':
      return 'T1'
    case 'suburban':
      return 'T2'
    case 'chiangrai':
      return 'T3'
    case 'goldentriangle':
      return 'T4'
    case 'airport':
      return 'transfer'
    default:
      return 'T2'
  }
}

/** 整日行程中含接機/送機 → 機場日（佔位 ≥8 引擎自動攤行李車） */
export function isAirportServiceDay(name: string): boolean {
  return /接機|送機|機場/.test(name)
}

export interface CarFeeDayLike {
  name: string
  type: string
}

export interface PerPersonQuoteInput {
  days: CarFeeDayLike[]
  adults: number
  children: number // 3-11 歲
  infants: number // 0-2 歲
  withGuide: boolean
}

interface PerPersonQuoteResultBase {
  occupiedSeats: number
  fleet: Fleet | null
  /** 保留使用者的導遊選擇；不能自動履約時改由 manual quote 表達。 */
  guided: boolean
  trip: TripQuote | null
  /** 純接送日合計（按車收，含 ≥8 行李車） */
  transferFee: number
  transferTrips: number
}

export interface AutomaticPerPersonQuoteResult extends PerPersonQuoteResultBase {
  manualQuoteRequired: false
  manualQuoteReason: null
  trip: AutomaticTripQuote | null
  /** 團費售價總額 = 引擎人頭總價 + 接送費。 */
  groupTourPrice: number
}

export type PerPersonManualQuoteReason =
  | ManualQuoteReason
  | 'minimum-group-size-required'

export interface ManualPerPersonQuoteResult extends PerPersonQuoteResultBase {
  manualQuoteRequired: true
  manualQuoteReason: PerPersonManualQuoteReason
  trip: ManualTripQuote | null
  /** Manual quotes must never expose a fake public total. */
  groupTourPrice: null
}

export type PerPersonQuoteResult =
  | AutomaticPerPersonQuoteResult
  | ManualPerPersonQuoteResult

const EMPTY_RESULT: AutomaticPerPersonQuoteResult = {
  occupiedSeats: 0,
  fleet: null,
  guided: false,
  manualQuoteRequired: false,
  manualQuoteReason: null,
  trip: null,
  transferFee: 0,
  transferTrips: 0,
  groupTourPrice: 0,
}

export function buildPerPersonQuote(input: PerPersonQuoteInput): PerPersonQuoteResult {
  const { days, adults, children, infants, withGuide } = input
  const occupiedSeats = adults + children + infants
  if (occupiedSeats < 1) return EMPTY_RESULT

  const fleet = resolveFleet(occupiedSeats)
  const guided = withGuide

  const tripDays = days
    .filter((d) => dayTypeToTier(d.type) !== 'transfer')
    .map((d) => ({
      tier: dayTypeToTier(d.type) as Tier,
      isAirportDay: isAirportServiceDay(d.name),
    }))

  const transferTrips = days.length - tripDays.length
  const luggagePerTrip =
    occupiedSeats >= LUGGAGE_VAN_SEAT_THRESHOLD ? LUGGAGE_VAN_FEE : 0
  const transferFee =
    transferTrips *
    (AIRPORT_TRANSFER_FEES[fleet.vehicle] * fleet.carCount + luggagePerTrip)

  const baseResult = {
    occupiedSeats,
    fleet,
    guided,
    transferFee,
    transferTrips,
  }

  if (occupiedSeats === 1) {
    return {
      ...baseResult,
      manualQuoteRequired: true,
      manualQuoteReason: 'minimum-group-size-required',
      trip: null,
      groupTourPrice: null,
    }
  }

  const trip =
    tripDays.length > 0
      ? calcTrip({ days: tripDays, adults, children, infants, withGuide: guided })
      : null

  if (trip) {
    if (trip.manualQuoteRequired) {
      return {
        ...baseResult,
        manualQuoteRequired: true,
        manualQuoteReason: trip.manualQuoteReason,
        trip,
        groupTourPrice: null,
      }
    }

    return {
      ...baseResult,
      manualQuoteRequired: false,
      manualQuoteReason: null,
      trip,
      groupTourPrice: trip.totalThb + transferFee,
    }
  }

  const manualQuoteReason = fleet.manualQuoteRequired
    ? fleet.manualQuoteReason
    : null

  if (manualQuoteReason) {
    return {
      ...baseResult,
      manualQuoteRequired: true,
      manualQuoteReason,
      trip: null,
      groupTourPrice: null,
    }
  }

  return {
    ...baseResult,
    manualQuoteRequired: false,
    manualQuoteReason: null,
    trip: null,
    groupTourPrice: transferFee,
  }
}
