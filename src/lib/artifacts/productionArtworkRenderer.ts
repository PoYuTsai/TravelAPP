import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'node:fs'
import {
  DAY_TOUR_ARTWORK_TIERS,
  RICH_MENU_SPEC,
  assertRichMenuCoverage,
  type DayTourArtworkTier,
} from './productionArtwork'
import {
  CHILD_PRICE_RATIO,
  CHILD_SEAT_FEE_PER_DAY,
  INFANT_PRICE_RATIO,
  INSURANCE_FEE_PER_PERSON,
  calcPerPersonDay,
  type Tier,
} from '@/lib/pricing/perPersonRates'
import {
  CHARTER_OVERTIME_POLICY,
  PUBLIC_PRICE_RANGE,
} from '@/lib/pricing/publicPolicy'

const ARTWORK_FONT_FAMILY = 'Chiangway Artwork Sans'
const PRICE_WIDTH = 2160
const PRICE_HEIGHT = 2700
const LINE_PRICE_WIDTH = 1080
const LINE_PRICE_HEIGHT = 1350

export const PRICING_ARTWORK_SAFE_AREA = {
  left: 144,
  top: 135,
  right: 2016,
  bottom: 2565,
} as const

export const PRICING_ARTWORK_LOGO_PLACEMENT = {
  left: 1780,
  top: 135,
  width: 220,
  height: 185,
} as const

export const PRICING_ARTWORK_HEADLINE_CONTENT_BOUNDS = {
  left: 160,
  top: 144,
  right: 2000,
  bottom: 320,
} as const

export const PRICING_ARTWORK_CTA_CONTENT_BOUNDS = {
  left: 180,
  top: 2418,
  right: 1990,
  bottom: 2548,
} as const

function assertTrueTypeFont(fontPath: string): void {
  let signature: Buffer

  try {
    signature = readFileSync(fontPath).subarray(0, 4)
  } catch (cause) {
    throw new Error(`Artwork font could not be read: ${fontPath}`, { cause })
  }

  if (!signature.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))) {
    throw new Error(`Artwork font is not a valid TrueType file: ${fontPath}`)
  }
}

/** @internal Render SVG text using only the versioned project font. */
export function renderArtworkSvgWithFont(
  svg: string,
  fontPaths: readonly string[],
  outputWidth?: number,
): Buffer {
  if (fontPaths.length === 0) {
    throw new Error('Artwork font list cannot be empty')
  }
  fontPaths.forEach(assertTrueTypeFont)
  const renderer = new Resvg(svg, {
    font: {
      fontFiles: [...fontPaths],
      loadSystemFonts: false,
      defaultFontFamily: ARTWORK_FONT_FAMILY,
      sansSerifFamily: ARTWORK_FONT_FAMILY,
    },
    shapeRendering: 2,
    textRendering: 2,
    ...(outputWidth
      ? { fitTo: { mode: 'width' as const, value: outputWidth } }
      : {}),
  })

  return renderer.render().asPng()
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function formatThb(value: number): string {
  return value.toLocaleString('en-US')
}

function pricingCard(tier: DayTourArtworkTier, y: number, accent: string): string {
  const smallGroupRows = (
    prices: DayTourArtworkTier['sedan'] | DayTourArtworkTier['guidedSedan'],
    x: number,
  ) =>
    prices
      .map(
        ({ people, thb }, index) => `
          <g aria-label="${people}人 ${formatThb(thb)}">
            <text x="${x}" y="${y + 310 + index * 85}" class="peopleLabel">${people}人</text>
            <text x="${x + 135}" y="${y + 310 + index * 85}" class="smallGroupPrice">${formatThb(thb)}</text>
          </g>`,
      )
      .join('')

  const vanGrid = tier.guidedVan
    .map(({ people, thb }, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = 1335 + column * 300
      const cellY = y + 290 + row * 65
      return `
        <g aria-label="${people}人 ${formatThb(thb)}">
          <text x="${x}" y="${cellY}" class="vanPeople">${people}人</text>
          <text x="${x + 90}" y="${cellY}" class="vanCellPrice">${formatThb(thb)}</text>
        </g>`
    })
    .join('')

  return `
    <g>
      <rect x="120" y="${y}" width="1920" height="440" rx="38" fill="#FFFEFA" fill-opacity="0.97" filter="url(#cardShadow)"/>
      <rect x="120" y="${y}" width="18" height="440" rx="9" fill="${accent}"/>
      <text x="180" y="${y + 75}" class="cardTitle">${escapeXml(tier.title)}</text>
      <text x="455" y="${y + 72}" class="routeText">${escapeXml(tier.routes)}</text>
      <line x1="180" y1="${y + 105}" x2="1980" y2="${y + 105}" stroke="#E8E0CE" stroke-width="3"/>
      <line x1="715" y1="${y + 128}" x2="715" y2="${y + 420}" stroke="#E8E0CE" stroke-width="3"/>
      <line x1="1270" y1="${y + 128}" x2="1270" y2="${y + 420}" stroke="#E8E0CE" stroke-width="3"/>

      <text x="180" y="${y + 160}" class="planTitle">2–3人｜泰國司機</text>
      <text x="180" y="${y + 225}" class="planMeta">標準・不含導遊</text>
      ${smallGroupRows(tier.sedan, 180)}

      <rect x="750" y="${y + 120}" width="480" height="120" rx="25" fill="#FFF3C4"/>
      <text x="785" y="${y + 160}" class="planTitle">2–3人｜中文導遊</text>
      <text x="785" y="${y + 225}" class="planMeta">選配・不強制</text>
      ${smallGroupRows(tier.guidedSedan, 785)}

      <rect x="1305" y="${y + 120}" width="645" height="120" rx="25" fill="#FFF3C4"/>
      <text x="1335" y="${y + 160}" class="vanPlanTitle">4–9人｜Van＋導遊</text>
      <text x="1335" y="${y + 225}" class="planMeta">泰國司機・導遊選配</text>
      ${vanGrid}
    </g>`
}

export function buildPricingArtworkOverlaySvg(): string {
  const accents = ['#F7C009', '#C96F45', '#4F7A63']
  const cards = DAY_TOUR_ARTWORK_TIERS.map((tier, index) =>
    pricingCard(tier, 360 + index * 465, accents[index]),
  ).join('')

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${PRICE_WIDTH}" height="${PRICE_HEIGHT}" viewBox="0 0 ${PRICE_WIDTH} ${PRICE_HEIGHT}">
    <defs>
      <filter id="cardShadow" x="-10%" y="-20%" width="120%" height="150%">
        <feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#463D2B" flood-opacity="0.13"/>
      </filter>
      <linearGradient id="headerGlow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFF8D6" stop-opacity="0.97"/>
        <stop offset="1" stop-color="#FDF8EA" stop-opacity="0.90"/>
      </linearGradient>
      <style>
        text { font-family: '${ARTWORK_FONT_FAMILY}'; fill: #171512; }
        .brand { font-size: 46px; font-weight: 850; letter-spacing: 4px; }
        .hero { font-size: 90px; font-weight: 900; letter-spacing: 1px; }
        .heroSub { font-size: 58px; font-weight: 650; fill: #544D40; }
        .cardTitle { font-size: 68px; font-weight: 900; }
        .routeText { font-size: 48px; font-weight: 700; fill: #675F50; }
        .planTitle { font-size: 58px; font-weight: 900; }
        .vanPlanTitle { font-size: 58px; font-weight: 900; }
        .planMeta { font-size: 58px; font-weight: 700; fill: #665C4A; }
        .peopleLabel { font-size: 58px; font-weight: 800; fill: #665C4A; }
        .smallGroupPrice { font-size: 76px; font-weight: 900; font-variant-numeric: tabular-nums; }
        .vanPeople { font-size: 58px; font-weight: 800; fill: #665C4A; }
        .vanCellPrice { font-size: 62px; font-weight: 900; font-variant-numeric: tabular-nums; }
        .infoTitle { font-size: 64px; font-weight: 900; }
        .infoBody { font-size: 58px; font-weight: 650; fill: #3F3A32; }
        .infoSmall { font-size: 56px; font-weight: 700; fill: #5F574A; }
        .notice { font-size: 54px; font-weight: 850; fill: #604C00; }
        .ctaMain { font-size: 64px; font-weight: 900; fill: #FFF9E1; }
        .ctaSub { font-size: 58px; font-weight: 650; fill: #F4EBCB; }
        .lineId { font-size: 58px; font-weight: 900; fill: #171512; }
      </style>
    </defs>

    <rect width="2160" height="2700" fill="#FDF8EA" fill-opacity="0.88"/>
    <rect x="80" y="50" width="2000" height="290" rx="48" fill="url(#headerGlow)"/>
    <rect x="120" y="78" width="670" height="66" rx="33" fill="#F7C009"/>
    <text x="160" y="128" class="brand">清微旅行｜清邁私家一日遊</text>
    <text x="${PRICING_ARTWORK_HEADLINE_CONTENT_BOUNDS.left}" y="235" class="hero">成人參考價 ${PUBLIC_PRICE_RANGE}</text>
    <text x="${PRICING_ARTWORK_HEADLINE_CONTENT_BOUNDS.left}" y="312" class="heroSub">不併團・行程可調整・爸媽開的親子包車</text>

    ${cards}

    <rect x="120" y="1745" width="1920" height="645" rx="38" fill="#FFFEFA" fill-opacity="0.96" filter="url(#cardShadow)"/>
    <line x1="1080" y1="1795" x2="1080" y2="2345" stroke="#E8E0CE" stroke-width="3"/>

    <text x="180" y="1825" class="infoTitle">包含</text>
    <text x="180" y="1888" class="infoBody">車輛・泰國司機・油費</text>
    <text x="180" y="1948" class="infoBody">過路費・停車費・行程事先確認</text>
    <text x="180" y="2008" class="infoBody">LINE 中文支援</text>
    <text x="180" y="2068" class="infoSmall">＋中文導遊＝選配・不依人數強制</text>

    <text x="180" y="2120" class="infoTitle">另計</text>
    <text x="180" y="2185" class="infoBody">門票・餐食・小費</text>
    <text x="180" y="2245" class="infoBody">旅遊保險 THB ${formatThb(INSURANCE_FEE_PER_PERSON)}／人／趟</text>
    <text x="180" y="2305" class="infoBody">兒童安全座椅 THB ${formatThb(CHILD_SEAT_FEE_PER_DAY)}／日／張</text>
    <text x="180" y="2365" class="infoSmall">裝在孩子座位，不另加算一人</text>

    <text x="1140" y="1825" class="infoTitle">親子試算・團費保護</text>
    <text x="1140" y="1888" class="infoBody">3–11 歲 ${CHILD_PRICE_RATIO * 10} 折試算</text>
    <text x="1140" y="1948" class="infoBody">0–2 歲半價試算（× ${INFANT_PRICE_RATIO}）</text>
    <text x="1140" y="2008" class="infoBody">每位乘客（含嬰幼兒）各佔一席</text>
    <rect x="1125" y="2040" width="855" height="130" rx="24" fill="#FFF3C4"/>
    <text x="1160" y="2092" class="notice">正式報價依家庭組合與最低成團價</text>
    <text x="1160" y="2148" class="notice">保護後確認；加購項目不打折</text>

    <text x="1140" y="2215" class="infoTitle">用車時間</text>
    <text x="1140" y="2280" class="infoBody">清邁 ${CHARTER_OVERTIME_POLICY.chiangMaiHours} 小時｜清萊 ${CHARTER_OVERTIME_POLICY.chiangRaiGoldenTriangleHours} 小時</text>
    <text x="1140" y="2332" class="infoBody">保留 ${CHARTER_OVERTIME_POLICY.graceMinutes} 分鐘彈性</text>
    <text x="1140" y="2380" class="infoSmall">其後超時 THB ${formatThb(CHARTER_OVERTIME_POLICY.feeThbPerHourPerCar)}／小時／台</text>

    <rect x="120" y="2400" width="1920" height="165" rx="42" fill="#171512"/>
    <text x="180" y="2462" class="ctaMain">10–18人｜兩台 Van・LINE 整團報價</text>
    <text x="180" y="2523" class="ctaSub">19人以上人工確認｜純司機方案見官網</text>
    <rect x="1500" y="2418" width="480" height="130" rx="32" fill="#F7C009"/>
    <text x="1740" y="2505" text-anchor="middle" class="lineId">@037nyuwk</text>

    <text x="1080" y="2635" text-anchor="middle" class="infoSmall">以上為行程範例・停點可依家庭需求調整</text>
  </svg>`
}

export type LinePricingSheet = 'chiang-mai' | 'chiang-rai'

interface LineRouteColumn {
  tier: Tier
  label: string
  hours: number
}

const LINE_PRICING_SHEETS: Record<
  LinePricingSheet,
  { title: string; routes: [LineRouteColumn, LineRouteColumn] }
> = {
  'chiang-mai': {
    title: '清邁市區・近郊',
    routes: [
      { tier: 'T1', label: '清邁市區', hours: 10 },
      { tier: 'T2', label: '清邁近郊', hours: 10 },
    ],
  },
  'chiang-rai': {
    title: '清萊・金三角',
    routes: [
      { tier: 'T3', label: '清萊', hours: 12 },
      { tier: 'T4', label: '金三角', hours: 12 },
    ],
  },
}

function linePricingTable(
  y: number,
  title: string,
  withGuide: boolean,
  accent: string,
  routes: readonly [LineRouteColumn, LineRouteColumn],
  recommendation?: string,
): string {
  const columnCenters = [480, 820]
  const rows = Array.from({ length: 8 }, (_, index) => index + 2)
    .map((people, rowIndex) => {
      const rowTop = y + 168 + rowIndex * 40
      const baseline = y + 198 + rowIndex * 40
      const values = routes.map((route, columnIndex) => {
        const price = calcPerPersonDay(route.tier, people, withGuide)
        const planLabel = withGuide ? '含中文導遊' : '泰國司機'
        return `
          <text
            x="${columnCenters[columnIndex]}"
            y="${baseline}"
            text-anchor="middle"
            class="linePrice"
            aria-label="${route.tier} ${people}人 ${planLabel} ${formatThb(price)}"
          >${formatThb(price)}</text>`
      }).join('')

      return `
        <g>
          <rect x="72" y="${rowTop}" width="936" height="40" rx="10" fill="${rowIndex % 2 === 0 ? '#FFFDF7' : '#F8F2E5'}"/>
          <text x="150" y="${baseline}" text-anchor="middle" class="linePeople">${people}人</text>
          ${values}
        </g>`
    })
    .join('')

  return `
    <g>
      <rect x="48" y="${y}" width="984" height="505" rx="30" fill="#FFFEFA" filter="url(#lineCardShadow)"/>
      <rect x="48" y="${y}" width="14" height="505" rx="7" fill="${accent}"/>
      <text x="84" y="${y + 46}" class="linePlanTitle">${escapeXml(title)}</text>
      <text x="84" y="${y + 82}" class="linePlanMeta">2–3人轎車・4–9人 Van</text>
      ${recommendation
        ? `<rect x="650" y="${y + 54}" width="350" height="36" rx="18" fill="#F4B918"/>
           <text x="825" y="${y + 79}" text-anchor="middle" class="lineRecommend">${escapeXml(recommendation)}</text>`
        : ''}
      <rect x="72" y="${y + 102}" width="936" height="62" rx="15" fill="${accent}" fill-opacity="0.18"/>
      <text x="150" y="${y + 142}" text-anchor="middle" class="lineTableHead">人數</text>
      ${routes
        .map(
          (route, index) => `
            <text x="${columnCenters[index]}" y="${y + 132}" text-anchor="middle" class="lineTableHead">${escapeXml(route.label)}</text>
            <text x="${columnCenters[index]}" y="${y + 157}" text-anchor="middle" class="lineTableSub">${route.hours} 小時</text>`,
        )
        .join('')}
      ${rows}
      <line x1="72" y1="${y + 248}" x2="1008" y2="${y + 248}" stroke="${accent}" stroke-width="3" stroke-dasharray="10 10"/>
    </g>`
}

/** LINE-chat price sheet: one route pair per readable 4:5 image. */
export function buildLinePricingArtworkSvg(sheet: LinePricingSheet): string {
  const config = LINE_PRICING_SHEETS[sheet]
  const unguided = linePricingTable(
    215,
    '方案 A｜泰國司機包車',
    false,
    '#29465F',
    config.routes,
  )
  const guided = linePricingTable(
    735,
    '方案 B｜泰國司機＋中文導遊',
    true,
    '#D77532',
    config.routes,
    '親子家庭・8人（含）以上推薦',
  )

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${LINE_PRICE_WIDTH}" height="${LINE_PRICE_HEIGHT}" viewBox="0 0 ${LINE_PRICE_WIDTH} ${LINE_PRICE_HEIGHT}">
    <defs>
      <filter id="lineCardShadow" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#463D2B" flood-opacity="0.12"/>
      </filter>
      <linearGradient id="lineBackground" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFF9E8"/>
        <stop offset="0.58" stop-color="#FBF6EC"/>
        <stop offset="1" stop-color="#EAF1E8"/>
      </linearGradient>
      <style>
        text { font-family: '${ARTWORK_FONT_FAMILY}'; fill: #171512; }
        .lineBrand { font-size: 25px; font-weight: 900; letter-spacing: 2px; }
        .lineHero { font-size: 54px; font-weight: 900; }
        .lineUnit { font-size: 34px; font-weight: 900; fill: #493900; }
        .linePlanTitle { font-size: 34px; font-weight: 900; }
        .linePlanMeta { font-size: 26px; font-weight: 750; fill: #62594B; }
        .lineRecommend { font-size: 18px; font-weight: 900; fill: #171512; }
        .lineTableHead { font-size: 28px; font-weight: 900; }
        .lineTableSub { font-size: 20px; font-weight: 700; fill: #6C6252; }
        .linePeople { font-size: 32px; font-weight: 850; fill: #5C5346; }
        .linePrice { font-size: 40px; font-weight: 900; font-variant-numeric: tabular-nums; }
        .lineFootStrong { font-size: 23px; font-weight: 900; fill: #263F51; }
        .lineFoot { font-size: 21px; font-weight: 750; fill: #645C50; }
      </style>
    </defs>

    <rect width="1080" height="1350" fill="url(#lineBackground)"/>
    <path d="M760 0C820 56 900 64 1080 38" fill="none" stroke="#DDE8D6" stroke-width="28" opacity="0.65"/>
    <path d="M840 84C930 128 1000 98 1080 134" fill="none" stroke="#F5D97D" stroke-width="12" opacity="0.45"/>
    <circle cx="1010" cy="75" r="12" fill="#D77532" opacity="0.35"/>
    <rect x="48" y="24" width="365" height="44" rx="22" fill="#F4BE19"/>
    <text x="72" y="55" class="lineBrand">清微旅行 CHIANGWAY</text>
    <text x="48" y="125" class="lineHero">${escapeXml(config.title)}</text>
    <rect x="48" y="146" width="984" height="54" rx="20" fill="#FFF1AA"/>
    <text x="540" y="182" text-anchor="middle" class="lineUnit">全成人同行參考｜以下皆為 THB／人／日</text>

    ${unguided}
    ${guided}

    <text x="540" y="1288" text-anchor="middle" class="lineFootStrong">8人（含）以上同行，建議安排中文導遊</text>
    <text x="540" y="1322" text-anchor="middle" class="lineFoot">有小朋友？提供年齡，直接報全家總價｜10人以上 LINE 整團報價</text>
  </svg>`
}

export async function renderLinePricingArtworkPng(
  sheet: LinePricingSheet,
  fontPaths: readonly string[],
): Promise<Buffer> {
  return renderArtworkSvgWithFont(
    buildLinePricingArtworkSvg(sheet),
    fontPaths,
    LINE_PRICE_WIDTH * 2,
  )
}

type RichMenuIconKind = 'vehicle' | 'itinerary' | 'camera'

function richMenuIcon(kind: RichMenuIconKind, x: number, y: number, stroke: string): string {
  const common = `fill="none" stroke="${stroke}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"`
  const icons: Record<RichMenuIconKind, string> = {
    vehicle: `<path ${common} d="M24 76h135l24 35v53H24Z"/><path ${common} d="M48 76l17-39h73l21 39"/><circle ${common} cx="62" cy="166" r="19"/><circle ${common} cx="149" cy="166" r="19"/><path ${common} d="M77 111h55"/>`,
    itinerary: `<path ${common} d="M20 42 73 20l54 22 53-22v140l-53 22-54-22-53 22Z"/><path ${common} d="M73 20v140M127 42v140"/><path ${common} d="M94 91c0-20 15-35 33-35s33 15 33 35c0 25-33 53-33 53S94 116 94 91Z"/><circle ${common} cx="127" cy="91" r="10"/>`,
    camera: `<path ${common} d="M24 65h38l18-28h47l18 28h31v107H24Z"/><circle ${common} cx="100" cy="116" r="38"/><path ${common} d="M148 88h2"/>`,
  }

  return `<g transform="translate(${x} ${y})">${icons[kind]}</g>`
}

const RICH_MENU_TILES = [
  { title: '車輛實拍', subtitle: '看看實際車內', icon: 'vehicle', background: '#F9DA55', text: '#5A4637' },
  { title: '招牌行程', subtitle: '三個人氣路線', icon: 'itinerary', background: '#FFF9E9', text: '#5A4637' },
  { title: '家庭實拍', subtitle: '旅途中的真實片刻', icon: 'camera', background: '#F6C35D', text: '#5A4637' },
] as const

export function buildRichMenuSvg(): string {
  const tiles = RICH_MENU_SPEC.areas.slice(1).map(({ bounds }, index) => {
    const tile = RICH_MENU_TILES[index]
    const centerX = bounds.x + bounds.width / 2
    const iconX = Math.round(centerX - 100)
    const iconY = bounds.y + 128
    const titleY = bounds.y + 520
    const subtitleY = bounds.y + 660

    return `
      <g>
        <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${tile.background}"/>
        ${richMenuIcon(tile.icon, iconX, iconY, tile.text)}
        <text x="${centerX}" y="${titleY}" text-anchor="middle" class="tileTitle" fill="${tile.text}">${tile.title}</text>
        <text x="${centerX}" y="${subtitleY}" text-anchor="middle" class="tileSubtitle" fill="${tile.text}">${tile.subtitle}</text>
      </g>`
  }).join('')

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
    <defs>
      <linearGradient id="brandBackground" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFDF5"/>
        <stop offset="1" stop-color="#F7ECD5"/>
      </linearGradient>
    </defs>
    <style>
      text { font-family: '${ARTWORK_FONT_FAMILY}'; }
      .brandKicker { font-size: 58px; font-weight: 900; letter-spacing: 8px; }
      .brandTitle { font-size: 168px; font-weight: 900; letter-spacing: 3px; }
      .brandSubtitle { font-size: 72px; font-weight: 800; letter-spacing: 3px; }
      .brandService { font-size: 48px; font-weight: 700; letter-spacing: 2px; }
      .tileTitle { font-size: 112px; font-weight: 900; letter-spacing: 4px; }
      .tileSubtitle { font-size: 50px; font-weight: 700; opacity: 0.88; }
    </style>
    <rect x="0" y="0" width="2500" height="843" fill="url(#brandBackground)"/>
    <path d="M0 700C470 590 690 820 1130 700s760-230 1370-45" fill="none" stroke="#F1C967" stroke-width="24" opacity="0.35"/>
    <circle cx="2180" cy="150" r="105" fill="#F6C35D" opacity="0.28"/>
    <circle cx="2280" cy="260" r="44" fill="#D8B887" opacity="0.28"/>
    <text x="1250" y="180" text-anchor="middle" class="brandKicker" fill="#7A5D43">清微旅行 CHIANGWAY</text>
    <text x="1250" y="440" text-anchor="middle" class="brandTitle" fill="#5A4637">Eric &amp; Min</text>
    <text x="1250" y="590" text-anchor="middle" class="brandSubtitle" fill="#6B5543">台灣爸爸 × 泰國媽媽</text>
    <rect x="720" y="655" width="1060" height="104" rx="52" fill="#FFFFFF" opacity="0.82"/>
    <text x="1250" y="725" text-anchor="middle" class="brandService" fill="#6B5543">親子包車・客製行程・中文導遊</text>
    <g transform="translate(1940 360) scale(1.15)" opacity="0.42">${richMenuIcon('vehicle', 0, 0, '#9A704A')}</g>
    ${tiles}
    <path d="M0 843H2500M833 843V1686M1667 843V1686" stroke="#FFFFFF" stroke-width="12"/>
    <rect x="6" y="6" width="2488" height="1674" fill="none" stroke="#FFFFFF" stroke-width="12"/>
  </svg>`
}

export async function renderRichMenuPng(fontPaths: readonly string[]): Promise<Buffer> {
  assertRichMenuCoverage(RICH_MENU_SPEC)

  return renderArtworkSvgWithFont(buildRichMenuSvg(), fontPaths)
}

export interface PricingArtworkRenderOptions {
  fontPaths: readonly string[]
  backgroundPath?: string
  logoPath?: string
}

export async function renderPricingArtworkPng(
  options: PricingArtworkRenderOptions,
): Promise<Buffer> {
  const background = options.backgroundPath
    ? await sharp(options.backgroundPath)
        .resize(PRICE_WIDTH, PRICE_HEIGHT, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()
    : await sharp({
        create: {
          width: PRICE_WIDTH,
          height: PRICE_HEIGHT,
          channels: 4,
          background: '#FDF8EA',
        },
      })
        .png()
        .toBuffer()

  const composites: sharp.OverlayOptions[] = [
    {
      input: renderArtworkSvgWithFont(buildPricingArtworkOverlaySvg(), options.fontPaths),
      left: 0,
      top: 0,
    },
  ]

  if (options.logoPath) {
    const logo = await sharp(options.logoPath)
      .resize({
        width: PRICING_ARTWORK_LOGO_PLACEMENT.width,
        height: PRICING_ARTWORK_LOGO_PLACEMENT.height,
        fit: 'fill',
      })
      .png()
      .toBuffer()
    composites.push({
      input: logo,
      left: PRICING_ARTWORK_LOGO_PLACEMENT.left,
      top: PRICING_ARTWORK_LOGO_PLACEMENT.top,
    })
  }

  return sharp(background)
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer()
}
