/**
 * 每人計價引擎（Per-Person Pricing）
 * 規格：docs/plans/2026-07-10-per-person-pricing-framework.md
 *
 * 單日團費總額 = 基準車價 + 導遊費(若配) + 每車日加成 G + 人數 n × 每人日加成 V
 * 每人每日價   = ⌈總額 ÷ n ÷ 50⌉ × 50
 * 級距一律看「總佔位人數」——嬰兒 0-2 歲也佔位。
 */

export type Tier = 'T1' | 'T2' | 'T3' | 'T4'
export type Vehicle = 'sedan' | 'van'

/** 內部基準車價（黃表，THB/日）——不對客展示 */
export const TIER_BASE_PRICES: Record<Tier, { sedan: number; van: number }> = {
  T1: { sedan: 3300, van: 4000 },
  T2: { sedan: 3800, van: 4800 },
  T3: { sedan: 4600, van: 5600 },
  T4: { sedan: 5200, van: 6600 },
}

/** 每車日加成 G（THB/日） */
export const CAR_DAY_MARKUP: Record<Tier, number> = {
  T1: 1000,
  T2: 1000,
  T3: 1500,
  T4: 1500,
}

/** 每人日加成 V（THB/人/日） */
export const PER_PERSON_DAY_MARKUP = 150

/** 持證中文導遊（THB/日） */
export const GUIDE_FEE_PER_DAY = 2500

/** 單車載客達 7 位時需確認行李空間；確認需要後才加行李車 */
export const LUGGAGE_VAN_FEE = 700
export const LUGGAGE_VAN_SEAT_THRESHOLD = 7

/** 僅接送日（接機/送機無排行程）按車收單趟價，不算一日團費 */
export const AIRPORT_TRANSFER_FEES: Record<Vehicle, number> = {
  sedan: 500,
  van: 700,
}

/** 收費三段制 */
export const CHILD_PRICE_RATIO = 0.8 // 3-11 歲
export const INFANT_PRICE_RATIO = 0.5 // 0-2 歲

/** 長包折扣（每人每日，THB） */
export const LONG_TRIP_DISCOUNTS = [
  { minDays: 5, perPersonPerDay: 100 },
  { minDays: 3, perPersonPerDay: 50 },
]

/** 加購項（實收） */
export const CHILD_SEAT_FEE_PER_DAY = 500
export const INSURANCE_FEE_PER_PERSON = 100
export const DRIVER_GUIDE_ROOM_FEE_PER_NIGHT = 750

/**
 * 匯率 fallback（TWD = THB ÷ rate）。
 * 前後台統一用這個值；後台舊值 0.93 是方向錯誤（會把 TWD 灌水），一律改用本常數。
 */
export const DEFAULT_THB_PER_TWD = 1.1

export interface Fleet {
  vehicle: Vehicle
  carCount: number
  guideRequired: boolean
  guideAllowed: boolean
}

/** 配車規則：2-3 轎車；4-9 一台 van；10+ 兩台 van。中文導遊皆可選配。 */
export function resolveFleet(occupiedSeats: number): Fleet {
  if (!Number.isInteger(occupiedSeats) || occupiedSeats < 1) {
    throw new Error(`佔位人數無效：${occupiedSeats}`)
  }
  if (occupiedSeats <= 3) {
    return { vehicle: 'sedan', carCount: 1, guideRequired: false, guideAllowed: true }
  }
  if (occupiedSeats <= 7) {
    return { vehicle: 'van', carCount: 1, guideRequired: false, guideAllowed: true }
  }
  if (occupiedSeats <= 9) {
    return { vehicle: 'van', carCount: 1, guideRequired: false, guideAllowed: true }
  }
  return { vehicle: 'van', carCount: 2, guideRequired: false, guideAllowed: true }
}

/** 平均配車後，計算有幾台車載客達 7 位，需要逐台確認行李空間。 */
export function countLuggageCheckCars(occupiedSeats: number, carCount: number): number {
  if (!Number.isInteger(occupiedSeats) || occupiedSeats < 0) {
    throw new Error(`佔位人數無效：${occupiedSeats}`)
  }
  if (!Number.isInteger(carCount) || carCount < 1) {
    throw new Error(`車輛數無效：${carCount}`)
  }

  const basePerCar = Math.floor(occupiedSeats / carCount)
  const remainder = occupiedSeats % carCount
  let checkCount = 0
  for (let index = 0; index < carCount; index += 1) {
    const passengers = basePerCar + (index < remainder ? 1 : 0)
    if (passengers >= LUGGAGE_VAN_SEAT_THRESHOLD) checkCount += 1
  }
  return checkCount
}

export function roundUpTo50(amount: number): number {
  return Math.ceil(amount / 50) * 50
}

/** 依座位規則收斂實際是否配導遊 */
function effectiveWithGuide(fleet: Fleet, withGuide: boolean): boolean {
  if (fleet.guideRequired) return true
  if (!fleet.guideAllowed) return false
  return withGuide
}

function dayTotalThb(
  tier: Tier,
  groupSize: number,
  withGuide: boolean,
  extraThb = 0,
): number {
  const fleet = resolveFleet(groupSize)
  const guided = effectiveWithGuide(fleet, withGuide)
  return (
    TIER_BASE_PRICES[tier][fleet.vehicle] +
    (guided ? GUIDE_FEE_PER_DAY : 0) +
    CAR_DAY_MARKUP[tier] +
    groupSize * PER_PERSON_DAY_MARKUP +
    extraThb
  )
}

/** 每人日價（framework 第 6 節價目表由此公式推導） */
export function calcPerPersonDay(
  tier: Tier,
  groupSize: number,
  withGuide: boolean,
): number {
  return roundUpTo50(dayTotalThb(tier, groupSize, withGuide) / groupSize)
}

export interface TripDay {
  tier: Tier
  isAirportDay?: boolean
}

export interface TripAddons {
  /** 兒童安全座椅張數（500/日/張 × 全程天數） */
  childSeats?: number
  /** 投保人數（100/人/趟） */
  insurancePersons?: number
  /** 司導過夜房數合計（750/房/晚，攤入每人價） */
  overnightRoomNights?: number
  /** 每個含機場接送的行程日，已向客人確認需要的行李車台數 */
  luggageVansPerAirportDay?: number
}

export interface TripInput {
  days: TripDay[]
  adults: number
  children: number // 3-11 歲
  infants: number // 0-2 歲
  withGuide: boolean
  addons?: TripAddons
}

export interface QuoteItem {
  label: string
  quantity: number
  unitPriceThb: number
  subtotalThb: number
}

export interface TripQuote {
  occupiedSeats: number
  fleet: Fleet & { withGuide: boolean }
  /** 大人每日價（含長包折扣、機場日行李車攤提） */
  perPersonDayPrices: number[]
  perPerson: { adult: number; child: number; infant: number }
  items: QuoteItem[]
  totalThb: number
}

function longTripDiscountPerDay(dayCount: number): number {
  for (const { minDays, perPersonPerDay } of LONG_TRIP_DISCOUNTS) {
    if (dayCount >= minDays) return perPersonPerDay
  }
  return 0
}

export function calcTrip(input: TripInput): TripQuote {
  const { days, adults, children, infants, withGuide, addons = {} } = input
  if (days.length === 0) throw new Error('至少需要一天行程')

  const occupiedSeats = adults + children + infants
  const fleet = resolveFleet(occupiedSeats)
  if (fleet.carCount > 1) {
    throw new Error('10 人以上需兩台車，請拆成兩張單各自計價')
  }
  const guided = effectiveWithGuide(fleet, withGuide)
  const discount = longTripDiscountPerDay(days.length)

  const perPersonDayPrices = days.map((day) => {
    const confirmedLuggageVans = addons.luggageVansPerAirportDay ?? 0
    const luggage = day.isAirportDay
      ? Math.max(0, confirmedLuggageVans) * LUGGAGE_VAN_FEE
      : 0
    const total = dayTotalThb(day.tier, occupiedSeats, guided, luggage)
    return roundUpTo50(total / occupiedSeats) - discount
  })

  const roomNights = addons.overnightRoomNights ?? 0
  const roomSharePerPerson =
    roomNights > 0
      ? roundUpTo50((roomNights * DRIVER_GUIDE_ROOM_FEE_PER_NIGHT) / occupiedSeats)
      : 0

  const adultTotal =
    perPersonDayPrices.reduce((sum, p) => sum + p, 0) + roomSharePerPerson
  const childTotal = adultTotal * CHILD_PRICE_RATIO
  const infantTotal = adultTotal * INFANT_PRICE_RATIO

  const items: QuoteItem[] = []
  const pushItem = (label: string, quantity: number, unitPriceThb: number) => {
    if (quantity > 0) {
      items.push({
        label,
        quantity,
        unitPriceThb,
        subtotalThb: quantity * unitPriceThb,
      })
    }
  }
  pushItem('大人', adults, adultTotal)
  pushItem('兒童（3-11歲）', children, childTotal)
  pushItem('嬰兒（0-2歲）', infants, infantTotal)
  pushItem('兒童安全座椅', addons.childSeats ?? 0, CHILD_SEAT_FEE_PER_DAY * days.length)
  pushItem('旅遊保險', addons.insurancePersons ?? 0, INSURANCE_FEE_PER_PERSON)

  const totalThb = items.reduce((sum, i) => sum + i.subtotalThb, 0)

  return {
    occupiedSeats,
    fleet: { ...fleet, withGuide: guided },
    perPersonDayPrices,
    perPerson: { adult: adultTotal, child: childTotal, infant: infantTotal },
    items,
    totalThb,
  }
}
