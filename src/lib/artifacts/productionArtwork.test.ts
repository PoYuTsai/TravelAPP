import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DAY_TOUR_ARTWORK_TIERS,
  RICH_MENU_SPEC,
  assertRichMenuCoverage,
} from './productionArtwork'
import {
  buildPricingArtworkOverlaySvg,
  buildRichMenuSvg,
  PRICING_ARTWORK_CTA_CONTENT_BOUNDS,
  PRICING_ARTWORK_HEADLINE_CONTENT_BOUNDS,
  PRICING_ARTWORK_LOGO_PLACEMENT,
  PRICING_ARTWORK_SAFE_AREA,
  renderArtworkSvgWithFont,
  renderPricingArtworkPng,
  renderRichMenuPng,
} from './productionArtworkRenderer'
import sharp from 'sharp'

const ARTWORK_FONT_PATHS = ['Regular', 'Bold', 'Black'].map((weight) =>
  resolve(
    process.cwd(),
    `public/fonts/ChiangwayArtworkSans-${weight}-subset.ttf`,
  ),
)

describe('production artwork data', () => {
  it('derives every public day-tour artwork price from the canonical engine', () => {
    expect(DAY_TOUR_ARTWORK_TIERS).toEqual([
      {
        tier: 'T1',
        title: '市區線',
        routes: '泰服體驗',
        sedan: [
          { people: 2, thb: 2300 },
          { people: 3, thb: 1600 },
        ],
        guidedSedan: [
          { people: 2, thb: 3550 },
          { people: 3, thb: 2450 },
        ],
        guidedVan: [
          { people: 4, thb: 2050 },
          { people: 5, thb: 1650 },
          { people: 6, thb: 1400 },
          { people: 7, thb: 1250 },
          { people: 8, thb: 1100 },
          { people: 9, thb: 1000 },
        ],
      },
      {
        tier: 'T2',
        title: '近郊線',
        routes: '大象保護營・茵他儂・南邦・南奔',
        sedan: [
          { people: 2, thb: 2550 },
          { people: 3, thb: 1750 },
        ],
        guidedSedan: [
          { people: 2, thb: 3800 },
          { people: 3, thb: 2600 },
        ],
        guidedVan: [
          { people: 4, thb: 2250 },
          { people: 5, thb: 1850 },
          { people: 6, thb: 1550 },
          { people: 7, thb: 1350 },
          { people: 8, thb: 1200 },
          { people: 9, thb: 1100 },
        ],
      },
      {
        tier: 'T3',
        title: '清萊線',
        routes: '清萊白廟（12 小時日）',
        sedan: [
          { people: 2, thb: 3200 },
          { people: 3, thb: 2200 },
        ],
        guidedSedan: [
          { people: 2, thb: 4450 },
          { people: 3, thb: 3050 },
        ],
        guidedVan: [
          { people: 4, thb: 2550 },
          { people: 5, thb: 2100 },
          { people: 6, thb: 1750 },
          { people: 7, thb: 1550 },
          { people: 8, thb: 1350 },
          { people: 9, thb: 1250 },
        ],
      },
    ])
  })

  it('defines the exact 2x3 LINE menu with five URI actions and one inquiry message', () => {
    expect(RICH_MENU_SPEC.size).toEqual({ width: 2500, height: 1686 })
    expect(RICH_MENU_SPEC.areas).toHaveLength(6)
    expect(RICH_MENU_SPEC.areas.filter(({ action }) => action.type === 'uri')).toHaveLength(5)
    expect(RICH_MENU_SPEC.areas.filter(({ action }) => action.type === 'message')).toEqual([
      expect.objectContaining({
        action: {
          type: 'message',
          label: '開始詢價',
          text: '我要詢價',
        },
      }),
    ])

    expect(RICH_MENU_SPEC.areas.map(({ action }) => action)).toEqual([
      {
        type: 'uri',
        label: '一日遊',
        uri: 'https://chiangway-travel.com/tours#day-tours',
      },
      {
        type: 'uri',
        label: '多日客製',
        uri: 'https://chiangway-travel.com/tours#packages',
      },
      {
        type: 'uri',
        label: '包車價格',
        uri: 'https://chiangway-travel.com/services/car-charter#pricing',
      },
      {
        type: 'uri',
        label: '用車須知',
        uri: 'https://chiangway-travel.com/services/car-charter#faq',
      },
      {
        type: 'uri',
        label: '爸媽開的',
        uri: 'https://chiangway-travel.com/blog/eric-story-taiwan-to-chiang-mai',
      },
      {
        type: 'message',
        label: '開始詢價',
        text: '我要詢價',
      },
    ])

    expect(RICH_MENU_SPEC.areas.map(({ bounds }) => bounds)).toEqual([
      { x: 0, y: 0, width: 833, height: 843 },
      { x: 833, y: 0, width: 834, height: 843 },
      { x: 1667, y: 0, width: 833, height: 843 },
      { x: 0, y: 843, width: 833, height: 843 },
      { x: 833, y: 843, width: 834, height: 843 },
      { x: 1667, y: 843, width: 833, height: 843 },
    ])
  })

  it('covers all 2500x1686 pixels exactly once', () => {
    expect(() => assertRichMenuCoverage(RICH_MENU_SPEC)).not.toThrow()

    const overlapping = {
      ...RICH_MENU_SPEC,
      areas: RICH_MENU_SPEC.areas.map((area, index) =>
        index === 1
          ? { ...area, bounds: { ...area.bounds, x: area.bounds.x - 1 } }
          : area,
      ),
    }

    expect(() => assertRichMenuCoverage(overlapping)).toThrow(/coverage/i)
  })

  it('uses supplied artwork fonts with distinct weights instead of system fallbacks', async () => {
    const realFont = await renderRichMenuPng(ARTWORK_FONT_PATHS)
    const glyphProbe = (fontWeight: number) => renderArtworkSvgWithFont(
      `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120">
        <text x="10" y="90" font-family="Chiangway Artwork Sans" font-size="72" font-weight="${fontWeight}">清微旅行</text>
      </svg>`,
      ARTWORK_FONT_PATHS,
    )
    const regularStats = await sharp(glyphProbe(400)).ensureAlpha().stats()
    const boldStats = await sharp(glyphProbe(900)).ensureAlpha().stats()

    expect(realFont.byteLength).toBeGreaterThan(0)
    expect(regularStats.channels[3].max).toBeGreaterThan(0)
    expect(boldStats.channels[3].sum).toBeGreaterThan(
      regularStats.channels[3].sum * 1.2,
    )
    await expect(renderRichMenuPng(
      [resolve(process.cwd(), 'public/fonts/missing-font.ttf')],
    )).rejects.toThrow(/artwork font/i)
    expect(() => renderArtworkSvgWithFont(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      [resolve(process.cwd(), 'public/fonts/OFL.txt')],
    )).toThrow(/valid TrueType/i)
  })

  it('renders a LINE-ready PNG under the platform byte limit', async () => {
    const svg = buildRichMenuSvg()
    const png = await renderRichMenuPng(ARTWORK_FONT_PATHS)
    const metadata = await sharp(png).metadata()

    expect(svg).toContain('.tileTitle { font-size: 112px')
    expect(svg).toContain('.tileSubtitle { font-size: 80px')
    expect(svg).toContain("font-family: 'Chiangway Artwork Sans'")
    expect(svg).not.toContain('@font-face')
    expect(svg).not.toContain('data:font/')
    expect(svg).not.toContain('tileBrand')
    expect(svg).not.toContain('清微旅行・CHIANGWAY')
    expect(metadata).toMatchObject({ width: 2500, height: 1686, format: 'png' })
    expect(png.byteLength).toBeLessThan(1_000_000)
    expect(80 * (375 / 2500)).toBeGreaterThanOrEqual(12)

    const persistedJson = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'scripts/line/rich-menu-main-v2026-07-10.json'),
        'utf8',
      ),
    )
    const persistedPng = readFileSync(
      resolve(process.cwd(), 'public/images/line/rich-menu-main-v2026-07-10.png'),
    )
    const persistedPreview = readFileSync(
      resolve(
        process.cwd(),
        'public/images/line/rich-menu-main-v2026-07-10-preview.png',
      ),
    )
    const expectedPreview = await sharp(png)
      .resize(1250, 843, { fit: 'fill' })
      .png({ compressionLevel: 9, palette: true, colours: 128 })
      .toBuffer()
    expect(persistedJson).toEqual(RICH_MENU_SPEC)
    expect(persistedPng.equals(png)).toBe(true)
    expect(persistedPreview.equals(expectedPreview)).toBe(true)
  })

  it('keeps the logo and CTA content inside the 4:5 production safe area', () => {
    const { left, top, right, bottom } = PRICING_ARTWORK_SAFE_AREA
    const headline = PRICING_ARTWORK_HEADLINE_CONTENT_BOUNDS
    const logo = PRICING_ARTWORK_LOGO_PLACEMENT
    const cta = PRICING_ARTWORK_CTA_CONTENT_BOUNDS

    expect(headline.left).toBeGreaterThanOrEqual(left)
    expect(headline.top).toBeGreaterThanOrEqual(top)
    expect(headline.right).toBeLessThanOrEqual(right)
    expect(headline.bottom).toBeLessThanOrEqual(bottom)
    expect(logo.left).toBeGreaterThanOrEqual(left)
    expect(logo.top).toBeGreaterThanOrEqual(top)
    expect(logo.left + logo.width).toBeLessThanOrEqual(right)
    expect(logo.top + logo.height).toBeLessThanOrEqual(bottom)
    expect(cta.left).toBeGreaterThanOrEqual(left)
    expect(cta.top).toBeGreaterThanOrEqual(top)
    expect(cta.right).toBeLessThanOrEqual(right)
    expect(cta.bottom).toBeLessThanOrEqual(bottom)
  })

  it('typesets canonical pricing into a deterministic 4:5 overlay', async () => {
    const svg = buildPricingArtworkOverlaySvg()

    expect(svg).toContain('市區線')
    expect(svg).toContain('2人 2,300')
    expect(svg).toContain('2人 3,550')
    expect(svg).toContain('3人 2,450')
    expect(svg).toContain('9人 1,000')
    expect(svg).toContain('近郊線')
    expect(svg).toContain('2人 3,800')
    expect(svg).toContain('3人 2,600')
    expect(svg).toContain('4人 2,250')
    expect(svg).toContain('清萊線')
    expect(svg).toContain('2人 4,450')
    expect(svg).toContain('3人 2,200')
    expect(svg).toContain('3人 3,050')
    expect(svg).toContain('選配・不強制')
    expect(svg).toContain('4–9人｜Van＋導遊')
    expect(svg).toContain('泰國司機・導遊選配')
    expect(svg).toContain('3–11 歲 8 折試算')
    expect(svg).toContain('0–2 歲半價試算')
    expect(svg).toContain('每位乘客（含嬰幼兒）各佔一席')
    expect(svg).toContain('安全座椅 THB 500／日／張')
    expect(svg).toContain('裝在孩子座位，不另加算一人')
    expect(svg).toContain('最低成團價')
    expect(svg).toContain('10–18人｜兩台 Van')
    expect(svg).toContain('19人以上人工確認')
    expect(svg).not.toContain('SUV')
    expect(svg).toContain('.smallGroupPrice { font-size: 76px')
    expect(svg).toContain('.vanCellPrice { font-size: 62px')
    expect(svg).toContain('.infoBody { font-size: 58px')
    expect(svg).toContain('.planTitle { font-size: 58px')
    expect(svg).toContain('.vanPlanTitle { font-size: 58px')
    expect(svg).toContain('.planMeta { font-size: 58px')
    expect(svg).toContain('.peopleLabel { font-size: 58px')
    expect(svg).toContain('.vanPeople { font-size: 58px')
    expect(svg).toContain('.ctaSub { font-size: 58px')
    expect(svg).toContain('.lineId { font-size: 58px')
    expect(svg).not.toContain('buttonKicker')
    expect(svg).toContain('<text x="160" y="235" class="hero">')
    expect(76 * (375 / 2160)).toBeGreaterThanOrEqual(13)
    expect(62 * (375 / 2160)).toBeGreaterThanOrEqual(10)
    expect(58 * (375 / 2160)).toBeGreaterThanOrEqual(10)

    const png = await renderPricingArtworkPng({ fontPaths: ARTWORK_FONT_PATHS })
    const metadata = await sharp(png).metadata()
    expect(metadata).toMatchObject({ width: 2160, height: 2700, format: 'png' })
  }, 15_000)
})
