/**
 * 人頭計價轉接層：把報價器的每日車費列（CarFeeDay）映射成
 * perPersonRates 引擎輸入，並處理引擎沒有的邊界（純接送日按車收、10+ 拆單）。
 * 規格：docs/plans/2026-07-10-per-person-pricing-framework.md 第 3、5 節
 */

import {
  AIRPORT_TRANSFER_FEES,
  LUGGAGE_VAN_FEE,
  calcTrip,
  countLuggageCheckCars,
  resolveFleet,
  type Fleet,
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

/** 整日行程中含接機/送機 → 機場日；行李車僅在逐車確認需要後計入 */
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
  /** 每個機場接送日已確認需要的行李車台數；未確認時為 0 */
  luggageVansPerAirportDay?: number
}

export interface PerPersonQuoteResult {
  occupiedSeats: number
  fleet: Fleet | null
  /** 依客人選擇決定是否配中文導遊 */
  guided: boolean
  /** 平均配車後，有幾台載客達 7 位，需逐台確認行李空間 */
  luggageCheckCarCount: number
  /** 佔位 ≥10 需兩台車 → 拆兩張單各自計價 */
  splitOrderRequired: boolean
  trip: TripQuote | null
  /** 純接送日合計（按車收，另含已確認需要的行李車） */
  transferFee: number
  transferTrips: number
  /** 團費售價總額 = 引擎人頭總價 + 接送費（拆單時為 0） */
  groupTourPrice: number
}

const EMPTY_RESULT: PerPersonQuoteResult = {
  occupiedSeats: 0,
  fleet: null,
  guided: false,
  luggageCheckCarCount: 0,
  splitOrderRequired: false,
  trip: null,
  transferFee: 0,
  transferTrips: 0,
  groupTourPrice: 0,
}

export function buildPerPersonQuote(input: PerPersonQuoteInput): PerPersonQuoteResult {
  const {
    days,
    adults,
    children,
    infants,
    withGuide,
    luggageVansPerAirportDay = 0,
  } = input
  const occupiedSeats = adults + children + infants
  if (occupiedSeats < 1) return EMPTY_RESULT

  const fleet = resolveFleet(occupiedSeats)
  const guided = fleet.guideRequired ? true : fleet.guideAllowed ? withGuide : false
  const luggageCheckCarCount = countLuggageCheckCars(occupiedSeats, fleet.carCount)

  if (fleet.carCount > 1) {
    return {
      ...EMPTY_RESULT,
      occupiedSeats,
      fleet,
      guided,
      luggageCheckCarCount,
      splitOrderRequired: true,
    }
  }

  const tripDays = days
    .filter((d) => dayTypeToTier(d.type) !== 'transfer')
    .map((d) => ({
      tier: dayTypeToTier(d.type) as Tier,
      isAirportDay: isAirportServiceDay(d.name),
    }))

  const transferTrips = days.length - tripDays.length
  const confirmedLuggageFeePerTrip =
    Math.max(0, luggageVansPerAirportDay) * LUGGAGE_VAN_FEE
  const transferFee =
    transferTrips *
    (AIRPORT_TRANSFER_FEES[fleet.vehicle] * fleet.carCount + confirmedLuggageFeePerTrip)

  const trip =
    tripDays.length > 0
      ? calcTrip({
          days: tripDays,
          adults,
          children,
          infants,
          withGuide: guided,
          addons: { luggageVansPerAirportDay },
        })
      : null

  return {
    occupiedSeats,
    fleet,
    guided,
    luggageCheckCarCount,
    splitOrderRequired: false,
    trip,
    transferFee,
    transferTrips,
    groupTourPrice: (trip?.totalThb ?? 0) + transferFee,
  }
}
