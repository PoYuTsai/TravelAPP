/** Canonical per-person pricing for Chiangway Travel charter quotes. */

export type Tier = 'T1' | 'T2' | 'T3' | 'T4'
export type Vehicle = 'sedan' | 'van'

export const TIER_BASE_PRICES: Record<Tier, { sedan: number; van: number }> = {
  T1: { sedan: 3300, van: 4000 },
  T2: { sedan: 3800, van: 4800 },
  T3: { sedan: 4600, van: 5600 },
  T4: { sedan: 5200, van: 6600 },
}

/** Per-car, per-day operating markup. */
export const CAR_DAY_MARKUP: Record<Tier, number> = {
  T1: 1000,
  T2: 1000,
  T3: 1500,
  T4: 1500,
}

export const PER_PERSON_DAY_MARKUP = 150

/** Kept as the public one/two-car guide sell anchor for existing consumers. */
export const GUIDE_FEE_PER_DAY = 2500

export const VAN_GUEST_CAPACITY = 9
export const MAX_VANS_PER_GUIDE = 3

export const GUIDE_PRICING = {
  1: { guideCostThb: 1500, guideSellThb: 2500 },
  2: { guideCostThb: 2000, guideSellThb: 2500 },
  3: { guideCostThb: 2500, guideSellThb: null },
} as const

export const LUGGAGE_VAN_FEE = 700
/** A Van carrying this many guests requires a luggage-space confirmation. */
export const LUGGAGE_VAN_SEAT_THRESHOLD = 7

export const AIRPORT_TRANSFER_FEES: Record<Vehicle, number> = {
  sedan: 500,
  van: 700,
}

export const CHILD_PRICE_RATIO = 0.8
export const INFANT_PRICE_RATIO = 0.5

export const LONG_TRIP_DISCOUNTS = [
  { minDays: 5, perPersonPerDay: 100 },
  { minDays: 3, perPersonPerDay: 50 },
]

export const CHILD_SEAT_FEE_PER_DAY = 500
export const INSURANCE_FEE_PER_PERSON = 100
export const DRIVER_GUIDE_ROOM_FEE_PER_NIGHT = 750

/** Fallback conversion: TWD = THB / rate. */
export const DEFAULT_THB_PER_TWD = 1

export type ManualQuoteReason =
  /** @deprecated Retained so serialized legacy quotes can still be gated safely. */
  | 'guided-sedan-requires-vehicle-confirmation'
  | 'group-size-requires-manual-quote'
  | 'guide-sell-price-unset'
  | 'guide-capacity-requires-manual-quote'

export interface Fleet {
  vehicle: Vehicle
  carCount: number
  /** Retained for compatibility; passenger count never forces guide service. */
  guideRequired: boolean
  guideAllowed: boolean
  manualQuoteRequired: boolean
  manualQuoteReason: ManualQuoteReason | null
}

/** Resolve occupied seats into vehicles. Every passenger, including infants, occupies a seat. */
export function resolveFleet(occupiedSeats: number): Fleet {
  if (!Number.isInteger(occupiedSeats) || occupiedSeats < 1) {
    throw new Error(`Invalid occupied-seat count: ${occupiedSeats}`)
  }

  if (occupiedSeats <= 3) {
    return {
      vehicle: 'sedan',
      carCount: 1,
      guideRequired: false,
      guideAllowed: true,
      manualQuoteRequired: false,
      manualQuoteReason: null,
    }
  }

  const carCount = Math.ceil(occupiedSeats / VAN_GUEST_CAPACITY)
  const manualQuoteRequired = occupiedSeats >= 19

  return {
    vehicle: 'van',
    carCount,
    guideRequired: false,
    guideAllowed: true,
    manualQuoteRequired,
    manualQuoteReason: manualQuoteRequired
      ? 'group-size-requires-manual-quote'
      : null,
  }
}

/**
 * Distribute guests as evenly as possible and count how many Vans carry at
 * least seven guests. Each matching Van must be confirmed independently.
 */
export function countLuggageCheckCars(
  occupiedSeats: number,
  carCount: number,
): number {
  if (!Number.isInteger(occupiedSeats) || occupiedSeats < 0) {
    throw new Error(`Invalid occupied-seat count: ${occupiedSeats}`)
  }
  if (!Number.isInteger(carCount) || carCount < 1) {
    throw new Error(`Invalid car count: ${carCount}`)
  }

  const guestsPerCar = Math.floor(occupiedSeats / carCount)
  const carsWithExtraGuest = occupiedSeats % carCount
  let checkCount = 0

  for (let index = 0; index < carCount; index += 1) {
    const guests = guestsPerCar + (index < carsWithExtraGuest ? 1 : 0)
    if (guests >= LUGGAGE_VAN_SEAT_THRESHOLD) checkCount += 1
  }

  return checkCount
}

export interface GuidePricing {
  guideCostThb: number | null
  guideSellThb: number | null
  manualQuoteRequired: boolean
  manualQuoteReason: ManualQuoteReason | null
}

/** Resolve internal guide cost separately from the public sell anchor. */
export function resolveGuidePricing(
  carCount: number,
  withGuide: boolean,
): GuidePricing {
  if (!Number.isInteger(carCount) || carCount < 1) {
    throw new Error(`Invalid car count: ${carCount}`)
  }

  if (!withGuide) {
    return {
      guideCostThb: 0,
      guideSellThb: 0,
      manualQuoteRequired: false,
      manualQuoteReason: null,
    }
  }

  if (carCount <= MAX_VANS_PER_GUIDE) {
    const anchor = GUIDE_PRICING[carCount as keyof typeof GUIDE_PRICING]
    const manualQuoteRequired = anchor.guideSellThb === null
    return {
      guideCostThb: anchor.guideCostThb,
      guideSellThb: anchor.guideSellThb,
      manualQuoteRequired,
      manualQuoteReason: manualQuoteRequired ? 'guide-sell-price-unset' : null,
    }
  }

  return {
    guideCostThb: null,
    guideSellThb: null,
    manualQuoteRequired: true,
    manualQuoteReason: 'guide-capacity-requires-manual-quote',
  }
}

export function roundUpTo50(amount: number): number {
  return Math.ceil(amount / 50) * 50
}

function coreFixedDayThb(
  tier: Tier,
  fleet: Fleet,
  guideSellThb: number,
): number {
  return (
    fleet.carCount * (TIER_BASE_PRICES[tier][fleet.vehicle] + CAR_DAY_MARKUP[tier]) +
    guideSellThb
  )
}

function automaticPricingContext(groupSize: number, withGuide: boolean) {
  const fleet = resolveFleet(groupSize)
  if (groupSize < 2) {
    throw new Error('At least two travelers are required for automatic pricing')
  }
  if (fleet.manualQuoteRequired) {
    throw new Error('此人數需人工報價（manual quote）')
  }

  const guidePricing = resolveGuidePricing(fleet.carCount, withGuide)
  const { guideSellThb } = guidePricing
  if (guidePricing.manualQuoteRequired || guideSellThb === null) {
    throw new Error('導遊售價需人工報價（manual quote）')
  }

  return { fleet, guidePricing, guideSellThb }
}

export function calcPerPersonDay(
  tier: Tier,
  groupSize: number,
  withGuide: boolean,
): number {
  const { fleet, guideSellThb } = automaticPricingContext(groupSize, withGuide)
  const coreFixed = coreFixedDayThb(tier, fleet, guideSellThb)
  return roundUpTo50(
    (coreFixed + groupSize * PER_PERSON_DAY_MARKUP) / groupSize,
  )
}

export interface TripDay {
  tier: Tier
  isAirportDay?: boolean
}

export interface TripAddons {
  /** THB 500 per seat per trip day. */
  childSeats?: number
  /** THB 100 per insured traveler per trip. */
  insurancePersons?: number
  /** THB 750 per room-night. */
  overnightRoomNights?: number
  /** Confirmed luggage Vans required for each airport service day. */
  luggageVansPerAirportDay?: number
}

export interface TripInput {
  days: TripDay[]
  adults: number
  children: number
  infants: number
  withGuide: boolean
  addons?: TripAddons
}

export interface QuoteItem {
  label: string
  quantity: number
  unitPriceThb: number
  subtotalThb: number
}

export interface FareProtection {
  provisionalThb: number
  coreFloorThb: number
  monotonicFloorThb: number
  finalThb: number
  appliedRule: 'provisional' | 'core-floor' | 'monotonic-floor'
}

export interface TripQuoteBase {
  occupiedSeats: number
  fleet: Fleet & { withGuide: boolean }
  /** Internal-only actual guide cost for all priced trip days. */
  guideCostThb: number | null
  perPersonDayPrices: number[]
  perPerson: { adult: number; child: number; infant: number }
  items: QuoteItem[]
}

export interface ManualTripQuote extends TripQuoteBase {
  manualQuoteRequired: true
  manualQuoteReason: ManualQuoteReason
  fareProtection: null
  /** Null means no automatic final price may be presented. */
  totalThb: null
}

export interface AutomaticTripQuote extends TripQuoteBase {
  manualQuoteRequired: false
  manualQuoteReason: null
  guideCostThb: number
  fareProtection: FareProtection
  totalThb: number
}

export type TripQuote = ManualTripQuote | AutomaticTripQuote

function longTripDiscountPerDay(dayCount: number): number {
  for (const { minDays, perPersonPerDay } of LONG_TRIP_DISCOUNTS) {
    if (dayCount >= minDays) return perPersonPerDay
  }
  return 0
}

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

function validateTripInput(input: TripInput) {
  if (input.days.length === 0) throw new Error('At least one trip day is required')

  assertNonNegativeInteger(input.adults, 'adults')
  assertNonNegativeInteger(input.children, 'children')
  assertNonNegativeInteger(input.infants, 'infants')

  const addons = input.addons ?? {}
  for (const addonKey of [
    'childSeats',
    'insurancePersons',
    'overnightRoomNights',
    'luggageVansPerAirportDay',
  ] as const) {
    const value = addons[addonKey]
    if (value !== undefined) assertNonNegativeInteger(value, addonKey)
  }

  if (input.adults < 1) throw new Error('At least one adult is required')
  if (input.adults + input.children + input.infants < 2) {
    throw new Error('At least two travelers are required')
  }
}

function manualTripQuote(
  occupiedSeats: number,
  fleet: Fleet,
  withGuide: boolean,
  reason: ManualQuoteReason,
  guideCostThb: number | null,
): ManualTripQuote {
  return {
    occupiedSeats,
    fleet: { ...fleet, withGuide },
    manualQuoteRequired: true,
    manualQuoteReason: reason,
    guideCostThb,
    perPersonDayPrices: [],
    perPerson: { adult: 0, child: 0, infant: 0 },
    fareProtection: null,
    items: [],
    totalThb: null,
  }
}

interface ProtectedCoreCalculation {
  perPersonDayPrices: number[]
  perPerson: { adult: number; child: number; infant: number }
  fareProtection: FareProtection
}

function calculateProtectedCore(
  days: TripDay[],
  adults: number,
  children: number,
  infants: number,
  withGuide: boolean,
): ProtectedCoreCalculation {
  const discount = longTripDiscountPerDay(days.length)
  const memo = new Map<string, ProtectedCoreCalculation | null>()

  const calculate = (
    currentAdults: number,
    currentChildren: number,
    currentInfants: number,
  ): ProtectedCoreCalculation | null => {
    const key = `${currentAdults}:${currentChildren}:${currentInfants}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached

    const occupiedSeats = currentAdults + currentChildren + currentInfants
    if (currentAdults < 1 || occupiedSeats < 2) {
      memo.set(key, null)
      return null
    }

    const fleet = resolveFleet(occupiedSeats)
    if (fleet.manualQuoteRequired) {
      memo.set(key, null)
      return null
    }

    const guidePricing = resolveGuidePricing(fleet.carCount, withGuide)
    if (guidePricing.manualQuoteRequired || guidePricing.guideSellThb === null) {
      memo.set(key, null)
      return null
    }

    const coreFixedDays = days.map((day) =>
      coreFixedDayThb(day.tier, fleet, guidePricing.guideSellThb as number),
    )
    const perPersonDayPrices = coreFixedDays.map(
      (coreFixed) =>
        roundUpTo50(
          (coreFixed + occupiedSeats * PER_PERSON_DAY_MARKUP) / occupiedSeats,
        ) - discount,
    )
    const adult = perPersonDayPrices.reduce((sum, price) => sum + price, 0)
    const child = adult * CHILD_PRICE_RATIO
    const infant = adult * INFANT_PRICE_RATIO
    const provisionalThb =
      currentAdults * adult + currentChildren * child + currentInfants * infant
    const coreFloorThb = coreFixedDays.reduce((sum, amount) => sum + amount, 0)

    const predecessors: Array<ProtectedCoreCalculation | null> = []
    if (currentAdults > 1) {
      predecessors.push(calculate(currentAdults - 1, currentChildren, currentInfants))
    }
    if (currentChildren > 0) {
      predecessors.push(calculate(currentAdults, currentChildren - 1, currentInfants))
    }
    if (currentInfants > 0) {
      predecessors.push(calculate(currentAdults, currentChildren, currentInfants - 1))
    }

    const monotonicFloorThb = predecessors.reduce(
      (highest, predecessor) =>
        Math.max(highest, predecessor?.fareProtection.finalThb ?? 0),
      0,
    )
    const finalThb = Math.max(provisionalThb, coreFloorThb, monotonicFloorThb)
    const appliedRule: FareProtection['appliedRule'] =
      provisionalThb >= coreFloorThb && provisionalThb >= monotonicFloorThb
        ? 'provisional'
        : coreFloorThb >= monotonicFloorThb
          ? 'core-floor'
          : 'monotonic-floor'

    const result: ProtectedCoreCalculation = {
      perPersonDayPrices,
      perPerson: { adult, child, infant },
      fareProtection: {
        provisionalThb,
        coreFloorThb,
        monotonicFloorThb,
        finalThb,
        appliedRule,
      },
    }
    memo.set(key, result)
    return result
  }

  const result = calculate(adults, children, infants)
  if (!result) throw new Error('Trip combination cannot be priced automatically')
  return result
}

export function calcTrip(input: TripInput): TripQuote {
  validateTripInput(input)

  const { days, adults, children, infants, withGuide, addons = {} } = input
  const occupiedSeats = adults + children + infants
  const fleet = resolveFleet(occupiedSeats)
  const confirmedLuggageVans = addons.luggageVansPerAirportDay ?? 0
  if (confirmedLuggageVans > fleet.carCount) {
    throw new Error('luggageVansPerAirportDay cannot exceed the passenger vehicle count')
  }
  const guidePricing = resolveGuidePricing(fleet.carCount, withGuide)
  const guideCostThb =
    guidePricing.guideCostThb === null
      ? null
      : guidePricing.guideCostThb * days.length

  if (fleet.manualQuoteRequired) {
    return manualTripQuote(
      occupiedSeats,
      fleet,
      withGuide,
      fleet.manualQuoteReason ?? 'group-size-requires-manual-quote',
      guideCostThb,
    )
  }

  if (
    guidePricing.manualQuoteRequired ||
    guidePricing.guideSellThb === null ||
    guideCostThb === null
  ) {
    return manualTripQuote(
      occupiedSeats,
      fleet,
      withGuide,
      guidePricing.manualQuoteReason ?? 'guide-sell-price-unset',
      guideCostThb,
    )
  }

  const protectedCore = calculateProtectedCore(
    days,
    adults,
    children,
    infants,
    withGuide,
  )
  const { perPersonDayPrices, perPerson, fareProtection } = protectedCore

  const items: QuoteItem[] = []
  const pushItem = (label: string, quantity: number, unitPriceThb: number) => {
    if (quantity <= 0) return
    items.push({
      label,
      quantity,
      unitPriceThb,
      subtotalThb: quantity * unitPriceThb,
    })
  }

  if (fareProtection.appliedRule === 'provisional') {
    pushItem('成人', adults, perPerson.adult)
    pushItem('兒童（3–11 歲）', children, perPerson.child)
    pushItem('嬰幼兒（0–2 歲）', infants, perPerson.infant)
  } else {
    pushItem('親子包車團費（家庭優惠後）', 1, fareProtection.finalThb)
  }

  const airportServiceDays = days.filter((day) => day.isAirportDay).length
  pushItem(
    '機場行李車',
    airportServiceDays * confirmedLuggageVans,
    LUGGAGE_VAN_FEE,
  )
  pushItem(
    '兒童安全座椅',
    addons.childSeats ?? 0,
    CHILD_SEAT_FEE_PER_DAY * days.length,
  )
  pushItem('旅遊保險', addons.insurancePersons ?? 0, INSURANCE_FEE_PER_PERSON)
  pushItem(
    '外地過夜司機／導遊房費',
    addons.overnightRoomNights ?? 0,
    DRIVER_GUIDE_ROOM_FEE_PER_NIGHT,
  )

  return {
    occupiedSeats,
    fleet: { ...fleet, withGuide },
    manualQuoteRequired: false,
    manualQuoteReason: null,
    guideCostThb,
    perPersonDayPrices,
    perPerson,
    fareProtection,
    items,
    totalThb: items.reduce((sum, item) => sum + item.subtotalThb, 0),
  }
}
