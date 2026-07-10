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
} from '@/lib/pricing/perPersonRates'
import {
  CHARTER_OVERTIME_POLICY,
  PUBLIC_PRICE_RANGE,
} from '@/lib/pricing/publicPolicy'

const ARTWORK_FONT_FAMILY = 'Chiangway Artwork Sans'
const PRICE_WIDTH = 2160
const PRICE_HEIGHT = 2700

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

function richMenuIcon(index: number, x: number, y: number, stroke: string): string {
  const common = `fill="none" stroke="${stroke}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"`
  const icons = [
    `<path ${common} d="M100 18c-35 0-64 28-64 63 0 49 64 111 64 111s64-62 64-111c0-35-29-63-64-63Z"/><circle ${common} cx="100" cy="80" r="22"/>`,
    `<rect ${common} x="24" y="42" width="152" height="132" rx="20"/><path ${common} d="M24 78h152M62 20v42M138 20v42M61 112h28M111 112h28M61 143h28"/>`,
    `<path ${common} d="M24 76h135l24 35v53H24Z"/><path ${common} d="M48 76l17-39h73l21 39"/><circle ${common} cx="62" cy="166" r="19"/><circle ${common} cx="149" cy="166" r="19"/><path ${common} d="M77 111h55"/>`,
    `<circle ${common} cx="100" cy="100" r="78"/><path ${common} d="M100 88v55M100 56h.1"/>`,
    `<path ${common} d="M26 91 100 28l74 63v83H55V95"/><path ${common} d="M100 145s-39-22-39-50c0-20 25-27 39-8 14-19 39-12 39 8 0 28-39 50-39 50Z"/>`,
    `<path ${common} d="M26 31h148v111H86l-42 30v-30H26Z"/><path ${common} d="M62 83h76M100 60v46"/>`,
  ]

  return `<g transform="translate(${x} ${y})">${icons[index]}</g>`
}

const RICH_MENU_TILES = [
  { title: '一日遊', subtitle: '看私家路線', background: '#FFF0A6', text: '#181512' },
  { title: '多日客製', subtitle: '依你們家安排', background: '#FFFCED', text: '#181512' },
  { title: '包車價格', subtitle: '看每人 THB', background: '#DDE8CF', text: '#181512' },
  { title: '用車須知', subtitle: '時數・加購・座位', background: '#F4DECB', text: '#181512' },
  { title: '爸媽開的', subtitle: 'Eric × Min 的故事', background: '#DDE9E8', text: '#181512' },
  { title: '開始詢價', subtitle: '送出詢價訊息', background: '#181512', text: '#F7C009' },
] as const

export function buildRichMenuSvg(): string {
  const tiles = RICH_MENU_SPEC.areas.map(({ bounds }, index) => {
    const tile = RICH_MENU_TILES[index]
    const centerX = bounds.x + bounds.width / 2
    const iconX = Math.round(centerX - 100)
    const iconY = bounds.y + 112
    const titleY = bounds.y + 520
    const subtitleY = bounds.y + 660

    return `
      <g>
        <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${tile.background}"/>
        ${richMenuIcon(index, iconX, iconY, tile.text)}
        <text x="${centerX}" y="${titleY}" text-anchor="middle" class="tileTitle" fill="${tile.text}">${tile.title}</text>
        <text x="${centerX}" y="${subtitleY}" text-anchor="middle" class="tileSubtitle" fill="${tile.text}">${tile.subtitle}</text>
      </g>`
  }).join('')

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
    <style>
      text { font-family: '${ARTWORK_FONT_FAMILY}'; }
      .tileTitle { font-size: 112px; font-weight: 900; letter-spacing: 4px; }
      .tileSubtitle { font-size: 80px; font-weight: 700; opacity: 0.88; }
    </style>
    ${tiles}
    <path d="M833 0V1686M1667 0V1686M0 843H2500" stroke="#FFFFFF" stroke-width="12"/>
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
