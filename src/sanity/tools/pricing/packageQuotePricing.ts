import {
  LUGGAGE_VAN_FEE,
  countLuggageCheckCars,
} from '@/lib/pricing/perPersonRates'

export type PublishedPackageId =
  | 'chiang-mai-5d4n'
  | 'chiang-rai-2d1n'
  | 'northern-thailand-6d5n'

type PackageRate = {
  adult: number
  child: number
  infant: number
}

type QuoteItem = {
  label: string
  amountTHB: number
  amountTWD: number
  description?: string
  payOnSite?: boolean
}

type OptionalQuoteItem = Omit<QuoteItem, 'amountTWD'>

export type PublishedPackageSnapshot = {
  pricingModel: 'perPerson'
  externalQuote: {
    items: QuoteItem[]
    included: string[]
    excluded: string[]
    paymentNotes: string[]
    totalTHB: number
    totalTWD: number
  }
  collectDeposit: false
  hotelsWithDeposit: []
  totalDeposit: 0
  carCount: number
  travelerLabel?: string
}

const CHIANG_MAI_5D4N_RATES: Record<number, PackageRate> = {
  2: { adult: 15_000, child: 12_000, infant: 7_500 },
  3: { adult: 10_250, child: 8_200, infant: 5_150 },
  4: { adult: 8_800, child: 7_050, infant: 4_400 },
  5: { adult: 7_150, child: 5_750, infant: 3_600 },
  6: { adult: 6_000, child: 4_800, infant: 3_000 },
  7: { adult: 5_200, child: 4_200, infant: 2_600 },
  8: { adult: 4_600, child: 3_700, infant: 2_300 },
  9: { adult: 4_200, child: 3_400, infant: 2_100 },
  10: { adult: 6_150, child: 4_950, infant: 3_100 },
  11: { adult: 5_600, child: 4_500, infant: 2_800 },
  12: { adult: 5_200, child: 4_200, infant: 2_600 },
  13: { adult: 4_850, child: 3_900, infant: 2_450 },
  14: { adult: 4_550, child: 3_650, infant: 2_300 },
  15: { adult: 4_250, child: 3_400, infant: 2_150 },
  16: { adult: 4_000, child: 3_200, infant: 2_000 },
  17: { adult: 3_800, child: 3_050, infant: 1_900 },
  18: { adult: 3_600, child: 2_900, infant: 1_800 },
}

const CHIANG_RAI_2D1N_RATES: Record<number, PackageRate> = {
  2: { adult: 9_650, child: 7_750, infant: 4_850 },
  3: { adult: 6_600, child: 5_300, infant: 3_300 },
  4: { adult: 5_500, child: 4_400, infant: 2_750 },
  5: { adult: 4_500, child: 3_600, infant: 2_250 },
  6: { adult: 3_750, child: 3_000, infant: 1_900 },
  7: { adult: 3_350, child: 2_700, infant: 1_700 },
  8: { adult: 2_900, child: 2_350, infant: 1_450 },
  9: { adult: 2_700, child: 2_200, infant: 1_350 },
  10: { adult: 3_950, child: 3_200, infant: 2_000 },
  11: { adult: 3_650, child: 2_950, infant: 1_850 },
  12: { adult: 3_300, child: 2_650, infant: 1_650 },
  13: { adult: 3_100, child: 2_500, infant: 1_550 },
  14: { adult: 2_900, child: 2_350, infant: 1_450 },
  15: { adult: 2_750, child: 2_200, infant: 1_400 },
  16: { adult: 2_550, child: 2_050, infant: 1_300 },
  17: { adult: 2_450, child: 2_000, infant: 1_250 },
  18: { adult: 2_350, child: 1_900, infant: 1_200 },
}

const NORTHERN_THAILAND_6D5N_RATES: Record<number, PackageRate> = {
  2: { adult: 21_750, child: 17_400, infant: 10_900 },
  3: { adult: 14_750, child: 11_800, infant: 7_400 },
  4: { adult: 12_450, child: 10_000, infant: 6_250 },
  5: { adult: 10_150, child: 8_150, infant: 5_100 },
  6: { adult: 8_450, child: 6_800, infant: 4_250 },
  7: { adult: 7_350, child: 5_900, infant: 3_700 },
  8: { adult: 6_400, child: 5_150, infant: 3_200 },
  9: { adult: 5_800, child: 4_650, infant: 2_900 },
  10: { adult: 8_850, child: 7_100, infant: 4_450 },
  11: { adult: 8_050, child: 6_450, infant: 4_050 },
  12: { adult: 7_400, child: 5_950, infant: 3_700 },
  13: { adult: 6_800, child: 5_450, infant: 3_400 },
  14: { adult: 6_400, child: 5_150, infant: 3_200 },
  15: { adult: 5_950, child: 4_800, infant: 3_000 },
  16: { adult: 5_600, child: 4_500, infant: 2_800 },
  17: { adult: 5_300, child: 4_250, infant: 2_650 },
  18: { adult: 5_050, child: 4_050, infant: 2_550 },
}

const PACKAGE_RATES: Record<PublishedPackageId, Record<number, PackageRate>> = {
  'chiang-mai-5d4n': CHIANG_MAI_5D4N_RATES,
  'chiang-rai-2d1n': CHIANG_RAI_2D1N_RATES,
  'northern-thailand-6d5n': NORTHERN_THAILAND_6D5N_RATES,
}

const PACKAGE_BY_SLUG: Record<string, PublishedPackageId> = {
  k8oeyepp: 'chiang-mai-5d4n',
  uao33058: 'chiang-rai-2d1n',
  lyx5aysy: 'northern-thailand-6d5n',
}

const PACKAGE_IDS = new Set<PublishedPackageId>([
  'chiang-mai-5d4n',
  'chiang-rai-2d1n',
  'northern-thailand-6d5n',
])

const PACKAGE_AIRPORT_TRANSFER_TRIPS: Record<PublishedPackageId, number> = {
  'chiang-mai-5d4n': 2,
  'chiang-rai-2d1n': 0,
  'northern-thailand-6d5n': 2,
}

function toTwd(amountTHB: number, exchangeRate: number) {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error('匯率必須大於 0')
  }
  return Math.round(amountTHB / exchangeRate)
}

function createItem(
  label: string,
  quantity: number,
  unitPrice: number,
  exchangeRate: number
): QuoteItem | null {
  if (quantity <= 0) return null
  const amountTHB = quantity * unitPrice
  return {
    label,
    amountTHB,
    amountTWD: toTwd(amountTHB, exchangeRate),
    description: `${quantity} 人 × THB ${unitPrice.toLocaleString('en-US')}`,
  }
}

export function getPublishedPackageId(
  persistedId?: string,
  publicSlug?: string
): PublishedPackageId | null {
  if (persistedId && PACKAGE_IDS.has(persistedId as PublishedPackageId)) {
    return persistedId as PublishedPackageId
  }
  return publicSlug ? PACKAGE_BY_SLUG[publicSlug] ?? null : null
}

export function formatPackageTravelerLabel(
  adults: number,
  children: number,
  infants: number
) {
  if (children === 0 && infants === 0) return `${adults} 位成人`
  const parts = [`${adults} 大`]
  if (children > 0) parts.push(`${children} 小（3–11 歲）`)
  if (infants > 0) parts.push(`${infants} 嬰（0–2 歲）`)
  return parts.join('＋')
}

export function buildPublishedPackageSnapshot(input: {
  packageId: PublishedPackageId
  adults: number
  children: number
  infants: number
  exchangeRate: number
  travelerLabel?: string
  included?: string[]
  excluded?: string[]
  paymentNotes?: string[]
  optionalItems?: OptionalQuoteItem[]
}): PublishedPackageSnapshot {
  const people = input.adults + input.children + input.infants
  const rate = PACKAGE_RATES[input.packageId][people]
  if (!rate) {
    throw new Error('固定套餐查價僅支援總佔位 2–18 人；其他人數請另行核價')
  }

  const items = [
    createItem('成人', input.adults, rate.adult, input.exchangeRate),
    createItem('3–11 歲', input.children, rate.child, input.exchangeRate),
    createItem('0–2 歲', input.infants, rate.infant, input.exchangeRate),
  ].filter((item): item is QuoteItem => item !== null)

  if (input.packageId === 'northern-thailand-6d5n') {
    const rooms = Math.ceil((input.adults + input.children) / 2)
    const amountTHB = rooms * 1_500
    items.push({
      label: '芳縣住宿（第一晚）',
      amountTHB,
      amountTWD: toTwd(amountTHB, input.exchangeRate),
      description: `${rooms} 房 × THB 1,500`,
    })
  }

  const carCount = people >= 10 ? 2 : 1
  const requiredLuggageVans = countLuggageCheckCars(people, carCount)
  const airportTransferTrips = requiredLuggageVans > 0
    ? PACKAGE_AIRPORT_TRANSFER_TRIPS[input.packageId]
    : 0
  if (airportTransferTrips > 0) {
    const amountTHB = airportTransferTrips * LUGGAGE_VAN_FEE
    items.push({
      label: '接送機行李車',
      amountTHB,
      amountTWD: toTwd(amountTHB, input.exchangeRate),
      description: `${airportTransferTrips} 趟 × THB ${LUGGAGE_VAN_FEE}`,
    })
  }

  for (const item of input.optionalItems ?? []) {
    if (!Number.isFinite(item.amountTHB) || item.amountTHB <= 0) continue
    items.push({
      ...item,
      amountTWD: toTwd(item.amountTHB, input.exchangeRate),
    })
  }

  const totalTHB = items.reduce((sum, item) => sum + item.amountTHB, 0)

  return {
    pricingModel: 'perPerson',
    externalQuote: {
      items,
      included: [...(input.included ?? [])],
      excluded: [...(input.excluded ?? [])],
      paymentNotes: [...(input.paymentNotes ?? [])],
      totalTHB,
      totalTWD: toTwd(totalTHB, input.exchangeRate),
    },
    collectDeposit: false,
    hotelsWithDeposit: [],
    totalDeposit: 0,
    carCount,
    travelerLabel: input.travelerLabel || undefined,
  }
}

type PackageStructure = {
  includeGuide?: boolean
  includeAccommodation?: boolean
  includeMeals?: boolean
  outboundStayEnabled?: boolean
  outboundStayPerNight?: number
  outboundStayNights?: number
  outboundStayRooms?: number
  carFees?: Array<{
    type?: string
    cost?: number
    price?: number
  }>
}

export function getPublishedPackageStructureIssue(
  original: PackageStructure,
  next: PackageStructure
): string | null {
  if (original.includeGuide !== next.includeGuide) return '中文導遊設定已變更'
  if (original.includeAccommodation !== next.includeAccommodation) return '住宿設定已變更'
  if (original.includeMeals !== next.includeMeals) return '餐食設定已變更'
  if (
    original.outboundStayEnabled !== next.outboundStayEnabled ||
    original.outboundStayPerNight !== next.outboundStayPerNight ||
    original.outboundStayNights !== next.outboundStayNights ||
    original.outboundStayRooms !== next.outboundStayRooms
  ) {
    return '司導外宿設定已變更'
  }

  const originalFees = original.carFees ?? []
  const nextFees = next.carFees ?? []
  if (originalFees.length !== nextFees.length) return '行程天數已變更'
  const changed = originalFees.some((fee, index) => {
    const nextFee = nextFees[index]
    return fee.type !== nextFee?.type || fee.cost !== nextFee?.cost || fee.price !== nextFee?.price
  })
  return changed ? '車型／路線級距或車價已變更' : null
}
