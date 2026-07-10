// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchCarCharter: vi.fn(),
  fetchFamilyCount: vi.fn(),
}))

vi.mock('@/sanity/client', () => ({
  client: { fetch: mocks.fetchCarCharter },
}))

vi.mock('@/lib/notion', () => ({
  fetchTotalFamilyCount: mocks.fetchFamilyCount,
}))

vi.mock('@/components/cms', async () => {
  const actual = await vi.importActual<typeof import('@/components/cms')>('@/components/cms')
  return {
    ...actual,
    VideoPlayer: () => null,
  }
})

import * as carCharterPageModule from '@/app/services/car-charter/page'

interface PublicCopyContract {
  startingPrices: {
    cityDayFromThb: number
    chiangRaiDayFromThb: number
  }
  metadata: {
    title: string
    description: string
    socialDescription: string
  }
  heroTitle: string
  heroSubtitle: string
  heroCtaText: string
  heroCtaLink: string
  pricingSectionTitle: string
  pricingFootnotes: string[]
  features: Array<{ icon?: string; title: string; description: string }>
  faq: Array<{ question: string; answer: string }>
  serviceSchemaDescription: string
  sectionIds: {
    pricing: string
    faq: string
  }
}

function canonicalCopy(): PublicCopyContract {
  const copy = (
    carCharterPageModule as typeof carCharterPageModule & {
      CAR_CHARTER_PUBLIC_COPY?: PublicCopyContract
    }
  ).CAR_CHARTER_PUBLIC_COPY

  expect(copy, 'page must expose its code-owned canonical public copy').toBeDefined()
  if (!copy) throw new Error('Missing CAR_CHARTER_PUBLIC_COPY')
  expect(copy.heroTitle, 'hero title must be code-owned').toEqual(expect.any(String))
  expect(copy.heroCtaText, 'hero CTA must be code-owned').toEqual(expect.any(String))
  expect(copy.heroCtaLink, 'hero CTA link must be code-owned').toEqual(expect.any(String))
  expect(copy.pricingSectionTitle, 'pricing title must be code-owned').toEqual(expect.any(String))
  expect(copy.pricingFootnotes, 'pricing footnotes must be code-owned').toEqual(expect.any(Array))
  return copy
}

const staleCmsData = {
  heroTitle: '舊版中文司機包車',
  heroSubtitle: '舊版承諾：導遊全程陪伴，並安排中文司機。',
  heroCtaText: '安排中文司機',
  heroCtaLink: 'https://example.com/legacy-booking',
  features: [
    { icon: '⚠️', title: '舊版特色', description: '安全座椅免費，導遊一定隨車。' },
  ],
  faq: [
    { question: '舊版 FAQ', answer: '每位司機都會中文。' },
  ],
  pricingSectionTitle: '泰國法規必配持證導遊價格',
  pricingFootnotes: ['10 人拆兩張單', '導遊全程陪伴'],
}

beforeEach(() => {
  mocks.fetchCarCharter.mockResolvedValue(staleCmsData)
  mocks.fetchFamilyCount.mockResolvedValue(100)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('car-charter canonical public copy', () => {
  it('defines the approved driver, guide, child-seat and included-cost promises', () => {
    const copy = canonicalCopy()
    const allCopy = [
      copy.metadata.title,
      copy.metadata.description,
      copy.metadata.socialDescription,
      copy.heroTitle,
      copy.heroSubtitle,
      copy.heroCtaText,
      copy.pricingSectionTitle,
      ...copy.pricingFootnotes,
      ...copy.features.flatMap((feature) => [feature.title, feature.description]),
      ...copy.faq.flatMap((item) => [item.question, item.answer]),
      copy.serviceSchemaDescription,
    ].join(' ')

    expect(copy.heroSubtitle).toContain('標準安排為泰國司機')
    expect(copy.heroSubtitle).toContain('LINE 中文支援')
    expect(copy.heroSubtitle).toMatch(/中文導遊.*(?:選配|加聘)/)

    expect(copy.features.map((feature) => feature.title)).toEqual(
      expect.arrayContaining([
        '標準泰國司機',
        'LINE 中文支援',
        '中文導遊選配',
        '兒童安全座椅付費加購',
      ])
    )

    const includedFaq = copy.faq.find((item) => item.question === '價格包含什麼？')
    expect(includedFaq?.answer).toContain('車輛、泰國司機、油資、過路費、停車費')
    expect(includedFaq?.answer).toContain('LINE 中文支援')
    expect(includedFaq?.answer).toMatch(/只有.*選配中文導遊.*才包含導遊/)
    expect(includedFaq?.answer).toMatch(/門票、餐食、超時費.*安全座椅.*另計/)

    const driverFaq = copy.faq.find((item) => item.question === '司機會說中文嗎？')
    expect(driverFaq?.answer).toContain('泰國司機通常不以中文服務')
    expect(driverFaq?.answer).toContain('行程會先確認')
    expect(driverFaq?.answer).toContain('LINE 中文支援')
    expect(driverFaq?.answer).toMatch(/隨車中文溝通或導覽.*中文導遊/)

    const guideFaq = copy.faq.find((item) => item.question === '中文導遊一定要加嗎？')
    expect(guideFaq?.answer).toContain('2–18 人皆可選配')
    expect(guideFaq?.answer).toMatch(/3 人.*導遊.*一般 5 人座.*剛好滿/)
    expect(guideFaq?.answer).toMatch(/安全座椅.*行李.*舒適度.*調度.*確認車型/)
    expect(guideFaq?.answer).not.toContain('需先確認車型')
    const childSeatFaq = copy.faq.find((item) => item.question === '安全座椅怎麼安排？')
    expect(childSeatFaq?.answer).toMatch(/THB 500／日／張.*付費加購/)
    expect(childSeatFaq?.answer).toContain('每位乘客（含嬰幼兒）各佔一席')
    expect(childSeatFaq?.answer).toContain('安全座椅安裝於該乘客座位，不另加算一人')
    expect(childSeatFaq?.answer).toContain('需納入車內座位配置')

    const overtimeFaq = copy.faq.find((item) => item.question === '超時怎麼計算？')
    expect(overtimeFaq?.answer).toContain('30 分鐘彈性')
    expect(overtimeFaq?.answer).toContain('THB 300／小時／台')
    expect(overtimeFaq?.answer).toContain('中文導遊不另收超時費')

    expect(copy.metadata.description).toContain('兒童安全座椅付費加購')
    expect(copy.serviceSchemaDescription).toContain('泰國司機')
    expect(copy.serviceSchemaDescription).toContain('LINE 中文支援')
    expect(copy.serviceSchemaDescription).toContain('中文導遊選配')
    expect(copy.serviceSchemaDescription).toContain('兒童安全座椅付費加購')

    expect(allCopy).not.toContain('導遊全程陪伴')
    expect(allCopy).not.toContain('泰國法規')
    expect(allCopy).not.toContain('必配持證')
    expect(allCopy).not.toMatch(/(?:提供|安排|保證)中文司機/)
    expect(allCopy).not.toMatch(/SUV/i)
  })

  it('uses the canonical metadata as the page metadata source', () => {
    const copy = canonicalCopy()
    const { metadata } = carCharterPageModule

    expect(copy.startingPrices).toEqual({
      cityDayFromThb: 750,
      chiangRaiDayFromThb: 950,
    })
    expect(copy.metadata.description).toContain('清邁市區每人每日 THB 750 起')
    expect(copy.metadata.description).toContain('清萊每人每日 THB 950 起')
    expect(metadata.title).toBe(copy.metadata.title)
    expect(metadata.description).toBe(copy.metadata.description)
    expect(metadata.openGraph?.description).toBe(copy.metadata.socialDescription)
    expect(metadata.twitter?.description).toBe(copy.metadata.socialDescription)
  })

  it('renders code-owned critical copy, real pricing and section anchors despite stale CMS data', async () => {
    const copy = canonicalCopy()
    const page = await carCharterPageModule.default()
    const { container } = render(page)
    const text = container.textContent ?? ''

    expect(text).toContain(copy.heroTitle)
    expect(text).toContain(copy.heroSubtitle)
    expect(text).toContain(copy.heroCtaText)
    expect(text).toContain(copy.pricingSectionTitle)
    copy.features.forEach((feature) => expect(text).toContain(feature.title))
    copy.faq.forEach((item) => expect(text).toContain(item.question))

    expect(text).not.toContain(staleCmsData.heroTitle)
    expect(text).not.toContain(staleCmsData.heroSubtitle)
    expect(text).not.toContain(staleCmsData.heroCtaText)
    expect(text).not.toContain('舊版特色')
    expect(text).not.toContain('舊版 FAQ')
    expect(text).not.toContain(staleCmsData.pricingSectionTitle)
    staleCmsData.pricingFootnotes.forEach((note) => expect(text).not.toContain(note))

    const cta = container.querySelector<HTMLAnchorElement>(`a[href="${copy.heroCtaLink}"]`)
    expect(cta?.textContent).toContain(copy.heroCtaText)

    expect(container.querySelector(`#${copy.sectionIds.pricing}`)?.tagName).toBe('SECTION')
    expect(container.querySelector(`#${copy.sectionIds.faq}`)?.tagName).toBe('SECTION')

    // Render the real component, rather than source-grepping for price-table words.
    expect(text).toContain('轎車＋泰國司機')
    expect(text).toContain('轎車＋泰國司機＋中文導遊')
    expect(text).toContain('Van＋泰國司機＋中文導遊')
    expect(text).toContain('最低成團價')

    const schemas = Array.from(
      container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent || '{}'))
    const serviceSchema = schemas.find((schema) => schema['@type'] === 'Service')
    const faqSchema = schemas.find((schema) => schema['@type'] === 'FAQPage')

    expect(serviceSchema?.description).toBe(copy.serviceSchemaDescription)
    expect(faqSchema?.mainEntity.map((item: { name: string }) => item.name)).toEqual(
      copy.faq.map((item) => item.question)
    )
  })
})
