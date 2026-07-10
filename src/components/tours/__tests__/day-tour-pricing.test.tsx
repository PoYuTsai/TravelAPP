// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
  familyCount: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: () => null,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/sanity/client', () => ({
  client: { fetch: mocks.sanityFetch },
  urlFor: vi.fn(),
}))

vi.mock('@/lib/notion', () => ({
  fetchTotalFamilyCount: mocks.familyCount,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

vi.mock('@/components/tours/StopsCarousel', () => ({ default: () => null }))
vi.mock('@/components/tours/TourViewTracker', () => ({ default: () => null }))
vi.mock('@/components/tours/RelatedTours', () => ({ default: () => null }))
vi.mock('@/components/tours/RelatedBlogPosts', () => ({ default: () => null }))
vi.mock('@/components/tours/OverviewVideo', () => ({ default: () => null }))
vi.mock('@/components/ui/Breadcrumb', () => ({ default: () => null }))
vi.mock('@/components/sections/TrustNumbers', () => ({ default: () => null }))

import DayTourCard from '@/components/tours/DayTourCard'
import ToursPageClient from '@/app/tours/ToursPageClient'
import ToursPage from '@/app/tours/page'
import TourDetailPage from '@/app/tours/[slug]/page'
import dayTourSchema from '@/sanity/schemas/dayTour'

const hostileDayTour = {
  _type: 'dayTour' as const,
  title: '茵他儂一日遊',
  slug: 'doi-inthanon-day-tour',
  subtitle: '親子高山推薦範本',
  description: '可依家庭步調調整。',
  location: 'doi-inthanon',
  pricingTier: 'T2',
  basePrice: 3200,
  priceUnit: '/團',
  priceNote: '舊包車固定團價',
  guidePrice: 2500,
  includes: ['中文導遊全程陪伴', '門票、餐食全包', '免費兒童安全座椅'],
  excludes: ['油資另計', '停車費另計'],
}

beforeEach(() => {
  mocks.sanityFetch.mockReset()
  mocks.familyCount.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('day-tour canonical public pricing', () => {
  it('renders per-occupant pricing copy and ignores hostile legacy price props', () => {
    const HostileCard = DayTourCard as unknown as React.ComponentType<Record<string, unknown>>
    const { container } = render(
      <HostileCard
        {...hostileDayTour}
        priceFrom={hostileDayTour.basePrice}
      />
    )

    const text = container.textContent ?? ''
    expect(text).toContain('私家半客製一日遊｜依總佔位人數計價')
    expect(text).not.toContain('3,200')
    expect(text).not.toContain('2,500')
    expect(text).not.toContain('起/團')
    expect(text).not.toContain('中文導遊加購')
  })

  it('renders canonical detail disclosure, inclusions and TouristTrip schema despite hostile CMS fields', async () => {
    mocks.sanityFetch.mockImplementation(async (query: string) => {
      if (query.includes('_type == "tourPackage"')) return null
      if (query.includes('_type == "dayTour"')) return hostileDayTour
      return null
    })

    const page = await TourDetailPage({
      params: Promise.resolve({ slug: hostileDayTour.slug }),
    })
    const { container } = render(page)
    const text = container.textContent ?? ''

    expect(text).toContain('推薦範本可自由換點')
    expect(text).toContain('團費依總佔位人數與服務區域')
    expect(text).toContain('標準泰國司機、中文導遊選配')
    expect(text).toContain('門票、餐食另計')
    expect(container.querySelector('a[href="/services/car-charter#pricing"]')).not.toBeNull()

    for (const included of ['車輛', '泰國司機', '油資', '過路費', '停車費', 'LINE 中文支援']) {
      expect(text).toContain(included)
    }
    for (const excluded of ['門票', '餐食', '兒童安全座椅', '超時費']) {
      expect(text).toContain(excluded)
    }

    expect(text).not.toContain('3,200')
    expect(text).not.toContain('2,500')
    expect(text).not.toContain('舊包車固定團價')
    expect(text).not.toContain('中文導遊全程陪伴')
    expect(text).not.toContain('門票、餐食全包')
    expect(text).not.toContain('油資另計')
    expect(text).not.toContain('停車費另計')
    expect(text).toContain('只有選配中文導遊的方案才包含導遊')

    const schemas = Array.from(
      container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent || '{}'))
    const schema = schemas.find((item) => item.name === hostileDayTour.title)
    expect(schema?.['@type']).toBe('TouristTrip')
    expect(schema).not.toHaveProperty('offers')
    expect(JSON.stringify(schema)).not.toMatch(/3200|"price(?:Currency)?"|"offers"/)

    const detailQuery = mocks.sanityFetch.mock.calls
      .map(([query]) => query as string)
      .find((query) => query.includes('_type == "dayTour"'))
    expect(detailQuery).toContain('pricingTier')
    for (const legacyField of ['basePrice', 'priceUnit', 'priceNote', 'guidePrice']) {
      expect(detailQuery).not.toContain(legacyField)
    }
  })

  it('uses real package and day-tour section anchors without leaking listing prices', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    const { container } = render(
      <ToursPageClient
        packages={[{ title: '清邁親子套餐', slug: 'family-package' }]}
        dayTours={[hostileDayTour] as never[]}
      />
    )

    expect(container.querySelector('#packages')?.tagName).toBe('SECTION')
    expect(container.querySelector('#day-tours')?.tagName).toBe('SECTION')
    expect(container.textContent).not.toContain('3,200')
  })

  it('keeps both deep-link sections available when Sanity returns empty arrays', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    const { container } = render(
      <ToursPageClient packages={[]} dayTours={[]} />
    )

    expect(container.querySelector('#packages')?.tagName).toBe('SECTION')
    expect(container.querySelector('#day-tours')?.tagName).toBe('SECTION')
    expect(container.textContent).toContain('行程範例整理中，先看包車價格')
    expect(container.textContent).toContain('一日遊範例整理中，歡迎先用 LINE 詢問')
    expect(container.querySelector('a[href="/services/car-charter#pricing"]')).not.toBeNull()
    expect(container.querySelector('a[href="https://line.me/R/ti/p/@037nyuwk"]')).not.toBeNull()
  })

  it('fetches only pricingTier for day tours on the listing page', async () => {
    mocks.sanityFetch.mockResolvedValue([])
    mocks.familyCount.mockResolvedValue(110)

    await ToursPage()

    const listingQuery = mocks.sanityFetch.mock.calls
      .map(([query]) => query as string)
      .find((query) => query.includes('_type == "dayTour"'))
    expect(listingQuery).toContain('pricingTier')
    expect(listingQuery).not.toContain('basePrice')
  })

  it('requires pricingTier and locks deprecated legacy price fields in Studio', () => {
    const fields = dayTourSchema.fields as Array<Record<string, any>>
    const tier = fields.find((field) => field.name === 'pricingTier')

    expect(tier).toMatchObject({ type: 'string', group: 'pricing' })
    expect(tier?.options?.list).toEqual([
      { title: 'T1 市區', value: 'T1' },
      { title: 'T2 近郊', value: 'T2' },
      { title: 'T3 清萊', value: 'T3' },
      { title: 'T4 金三角', value: 'T4' },
    ])
    expect(tier?.validation).toEqual(expect.any(Function))

    for (const name of ['basePrice', 'priceUnit', 'priceNote', 'guidePrice']) {
      const legacy = fields.find((field) => field.name === name)
      expect(legacy).toMatchObject({ hidden: true, readOnly: true })
      expect(legacy?.description).toMatch(/deprecated/i)
    }
  })
})
