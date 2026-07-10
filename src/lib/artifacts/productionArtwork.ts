import { calcPerPersonDay, type Tier } from '@/lib/pricing/perPersonRates'

export interface ArtworkPrice {
  people: number
  thb: number
}

export interface DayTourArtworkTier {
  tier: Extract<Tier, 'T1' | 'T2' | 'T3'>
  title: string
  routes: string
  sedan: ArtworkPrice[]
  guidedSedan: ArtworkPrice[]
  guidedVan: ArtworkPrice[]
}

const DAY_TOUR_ARTWORK_META = [
  { tier: 'T1', title: '市區線', routes: '泰服體驗' },
  { tier: 'T2', title: '近郊線', routes: '大象保護營・茵他儂・南邦・南奔' },
  { tier: 'T3', title: '清萊線', routes: '清萊白廟（12 小時日）' },
] as const

function pricesFor(
  tier: DayTourArtworkTier['tier'],
  people: readonly number[],
  withGuide: boolean,
): ArtworkPrice[] {
  return people.map((count) => ({
    people: count,
    thb: calcPerPersonDay(tier, count, withGuide),
  }))
}

/**
 * The artwork never owns price literals. Every displayed number is evaluated
 * from the same engine used by the quote calculator and public price table.
 */
export const DAY_TOUR_ARTWORK_TIERS: DayTourArtworkTier[] =
  DAY_TOUR_ARTWORK_META.map(({ tier, title, routes }) => ({
    tier,
    title,
    routes,
    sedan: pricesFor(tier, [2, 3], false),
    guidedSedan: pricesFor(tier, [2, 3], true),
    guidedVan: pricesFor(tier, [4, 5, 6, 7, 8, 9], true),
  }))

export interface RichMenuBounds {
  x: number
  y: number
  width: number
  height: number
}

export type RichMenuAction =
  | { type: 'uri'; label: string; uri: string }
  | { type: 'message'; label: string; text: string }

export interface RichMenuSpec {
  size: { width: number; height: number }
  selected: boolean
  name: string
  chatBarText: string
  areas: Array<{ bounds: RichMenuBounds; action: RichMenuAction }>
}

export const RICH_MENU_SPEC: RichMenuSpec = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'chiangway-main-2026-07-10-v1',
  chatBarText: '清微旅行選單',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: '一日遊',
        uri: 'https://chiangway-travel.com/tours#day-tours',
      },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: {
        type: 'uri',
        label: '多日客製',
        uri: 'https://chiangway-travel.com/tours#packages',
      },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: '包車價格',
        uri: 'https://chiangway-travel.com/services/car-charter#pricing',
      },
    },
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: '用車須知',
        uri: 'https://chiangway-travel.com/services/car-charter#faq',
      },
    },
    {
      bounds: { x: 833, y: 843, width: 834, height: 843 },
      action: {
        type: 'uri',
        label: '爸媽開的',
        uri: 'https://chiangway-travel.com/blog/eric-story-taiwan-to-chiang-mai',
      },
    },
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: {
        type: 'message',
        label: '開始詢價',
        text: '我要詢價',
      },
    },
  ],
}

function rectanglesOverlap(a: RichMenuBounds, b: RichMenuBounds) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/** Assert the API areas tile the entire image without gaps or overlaps. */
export function assertRichMenuCoverage(spec: RichMenuSpec): void {
  const { width, height } = spec.size
  let coveredArea = 0

  spec.areas.forEach(({ bounds }, index) => {
    const insideCanvas =
      Number.isInteger(bounds.x) &&
      Number.isInteger(bounds.y) &&
      Number.isInteger(bounds.width) &&
      Number.isInteger(bounds.height) &&
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.x + bounds.width <= width &&
      bounds.y + bounds.height <= height

    if (!insideCanvas) {
      throw new Error(`Rich-menu coverage is outside the canvas at area ${index + 1}`)
    }

    for (let otherIndex = index + 1; otherIndex < spec.areas.length; otherIndex += 1) {
      if (rectanglesOverlap(bounds, spec.areas[otherIndex].bounds)) {
        throw new Error(
          `Rich-menu coverage overlaps between areas ${index + 1} and ${otherIndex + 1}`,
        )
      }
    }

    coveredArea += bounds.width * bounds.height
  })

  if (coveredArea !== width * height) {
    throw new Error(
      `Rich-menu coverage has gaps: ${coveredArea} of ${width * height} pixels covered`,
    )
  }
}
