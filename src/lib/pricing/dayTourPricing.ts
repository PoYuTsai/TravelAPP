export type DayTourPricingTier = 'T1' | 'T2' | 'T3' | 'T4'

export const DAY_TOUR_PRICING_TIER_LABELS: Record<DayTourPricingTier, string> = {
  T1: 'T1 市區',
  T2: 'T2 近郊',
  T3: 'T3 清萊',
  T4: 'T4 金三角',
}

const DAY_TOUR_PRICING_TIERS: readonly DayTourPricingTier[] = ['T1', 'T2', 'T3', 'T4']
const DEFAULT_DAY_TOUR_PRICING_TIER: DayTourPricingTier = 'T1'

export function isDayTourPricingTier(value: unknown): value is DayTourPricingTier {
  return (
    typeof value === 'string' &&
    (DAY_TOUR_PRICING_TIERS as readonly string[]).includes(value)
  )
}

export function normalizeDayTourPricingTier(value: unknown): DayTourPricingTier {
  return isDayTourPricingTier(value) ? value : DEFAULT_DAY_TOUR_PRICING_TIER
}

export function getDayTourPricingTierLabel(value: unknown): string {
  return DAY_TOUR_PRICING_TIER_LABELS[normalizeDayTourPricingTier(value)]
}

/** Public day-tour pricing promises are code-owned; Sanity only selects a tier. */
export const DAY_TOUR_PUBLIC_PRICING = {
  cardLabel: '私家半客製一日遊｜依總佔位人數計價',
  disclosure: [
    '推薦範本可自由換點',
    '團費依總佔位人數與服務區域',
    '標準泰國司機、中文導遊選配',
    '門票、餐食另計',
  ],
  pricingHref: '/services/car-charter#pricing',
  included: ['車輛', '泰國司機', '油資、過路費與停車費', 'LINE 中文支援'],
  excluded: ['景點門票', '餐食', '兒童安全座椅', '超時費'],
  guideNote: '只有選配中文導遊的方案才包含導遊。',
} as const

export const DAY_TOUR_ROUTE_TIER_PROPOSALS = [
  { route: 'thai-dress', label: '泰服', tier: 'T1', patterns: ['泰服', 'thai-dress', 'thai dress'] },
  { route: 'elephant', label: '大象', tier: 'T2', patterns: ['大象', 'elephant'] },
  { route: 'doi-inthanon', label: '茵他儂', tier: 'T2', patterns: ['茵他儂', 'doi-inthanon', 'doi inthanon'] },
  { route: 'lampang', label: '南邦', tier: 'T2', patterns: ['南邦', 'lampang'] },
  { route: 'lamphun', label: '南奔', tier: 'T2', patterns: ['南奔', 'lamphun'] },
  { route: 'chiang-rai', label: '清萊', tier: 'T3', patterns: ['清萊', 'chiang-rai', 'chiang rai'] },
] as const satisfies ReadonlyArray<{
  route: string
  label: string
  tier: DayTourPricingTier
  patterns: readonly string[]
}>

export interface DayTourRouteIdentity {
  title?: string | null
  slug?: string | null
}

export type DayTourTierProposal =
  | {
      status: 'proposed'
      route: string
      proposedTier: DayTourPricingTier
    }
  | {
      status: 'manual'
      route: null
      proposedTier: null
    }

export function proposeDayTourPricingTier({
  title,
  slug,
}: DayTourRouteIdentity): DayTourTierProposal {
  const identity = `${title ?? ''} ${slug ?? ''}`.toLocaleLowerCase('en-US')
  const matches = DAY_TOUR_ROUTE_TIER_PROPOSALS.filter((proposal) =>
    proposal.patterns.some((pattern) => identity.includes(pattern))
  )

  if (matches.length !== 1) {
    return { status: 'manual', route: null, proposedTier: null }
  }

  return {
    status: 'proposed',
    route: matches[0].route,
    proposedTier: matches[0].tier,
  }
}
