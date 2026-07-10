/* eslint-disable @next/next/no-img-element */
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  fetchFamilyCount: vi.fn(),
}))

vi.mock('@/sanity/client', () => ({
  client: { fetch: mocks.fetch },
  urlFor: () => ({ width: () => ({ height: () => ({ url: () => '/test.webp' }) }) }),
}))

vi.mock('@/lib/notion', () => ({ fetchTotalFamilyCount: mocks.fetchFamilyCount }))
vi.mock('@/components/sections/TrustNumbers', () => ({ default: () => null }))
vi.mock('@/components/sections/ToursPreview', () => ({ default: () => null }))
vi.mock('@/components/sections/Testimonials', () => ({ default: () => null }))
vi.mock('@/components/sections/FeaturedArticles', () => ({
  default: ({ sectionTitle, sectionSubtitle }: { sectionTitle?: string; sectionSubtitle?: string }) => (
    <section>{sectionTitle} {sectionSubtitle}</section>
  ),
}))
vi.mock('@/components/Header', () => ({ default: () => null }))
vi.mock('@/components/Footer', () => ({ default: () => null }))
vi.mock('@/components/ui/FloatingLineButton', () => ({ default: () => null }))
vi.mock('@/components/AdLineLinkSwap', () => ({ default: () => null }))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      alt={typeof props.alt === 'string' ? props.alt : ''}
      src={typeof props.src === 'string' ? props.src : undefined}
    />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>{children as React.ReactNode}</a>
  ),
}))

vi.mock('next/script', () => ({
  default: ({ children, ...props }: Record<string, unknown>) => <script {...props}>{children as React.ReactNode}</script>,
}))

import Home from '@/app/page'
import RootLayout, { metadata as rootMetadata } from '@/app/layout'

const hostileLandingPage = {
  heroBackgroundImage: {
    asset: { _ref: 'image-hostile' },
    alt: '保證會中文的司機首頁圖片',
  },
  heroTitle: '舊版中文司機包車',
  heroSubtitle: '保證中文司機，導遊全程包含',
  heroDescription: '8 人依法強制導遊，安全座椅免費。',
  heroPrimaryCta: { text: '指定中文司機', link: 'https://example.com/old' },
  whoWeAreTitle: '舊 Who 標題',
  whoWeAreSubtitle: '舊 Who 副標',
  whoWeAreDescription: '每一團都有導遊',
  whoWeAreTrustPoints: ['司機都會中文'],
  ctaTitle: '舊 CTA 標題',
  ctaDescription: 'NT$ 3,700 含中文司機與免費座椅',
  ctaPrimaryCta: { text: '預約舊方案', link: 'https://example.com/legacy' },
  whoWeAreStoryLink: '/blog/story',
  whoWeAreStoryLinkText: '保證會中文的司機品牌故事',
  articlesSectionTitle: '保證會中文的司機精選文章',
  articlesSectionSubtitle: '中文司機與導遊全程包含',
}

beforeEach(() => {
  mocks.fetch.mockResolvedValue(hostileLandingPage)
  mocks.fetchFamilyCount.mockResolvedValue(100)
})

describe('homepage canonical service copy', () => {
  it('ignores hostile CMS critical copy and stops querying retired fields', async () => {
    const html = renderToStaticMarkup(await Home())
    const query = String(mocks.fetch.mock.calls[0]?.[0] ?? '')

    expect(html).toContain('標準服務由泰國司機駕駛')
    expect(html).toContain('LINE 中文支援')
    expect(html).toContain('中文導遊依需求選配')
    expect(html).toContain('標準泰國司機通常不以中文服務')
    expect(html).toContain('需要時再選配中文導遊')
    expect(html).toContain('精選文章')
    expect(html).toContain('在地爸媽的清邁旅遊攻略')

    Object.entries(hostileLandingPage).forEach(([key, value]) => {
      if (key !== 'whoWeAreStoryLink' && typeof value === 'string') {
        expect(html).not.toContain(value)
      }
    })
    expect(html).not.toContain(hostileLandingPage.heroBackgroundImage.alt)
    expect(html).toContain('href="/blog/story"')
    expect(query).toMatch(/heroBackgroundImage\s*\{\s*asset\s*\}/)
    expect(query).not.toMatch(/heroTitle|heroSubtitle|heroDescription|heroPrimaryCta/)
    expect(query).not.toMatch(/whoWeAreTitle|whoWeAreSubtitle|whoWeAreDescription|whoWeAreTrustPoints/)
    expect(query).not.toMatch(/whoWeAreStoryLinkText/)
    expect(query).not.toMatch(/articlesSectionTitle|articlesSectionSubtitle/)
    expect(query).not.toMatch(/ctaTitle|ctaDescription|ctaPrimaryCta|ctaSecondaryCta/)
  })

  it('publishes canonical metadata and LocalBusiness/Organization policy', () => {
    const html = renderToStaticMarkup(<RootLayout><div>page</div></RootLayout>)
    const description = String(rootMetadata.description ?? '')

    expect(description).toContain('標準泰國司機')
    expect(description).toContain('LINE 中文支援')
    expect(description).toContain('中文導遊選配')
    expect(description).toContain('兒童安全座椅付費加購')
    expect(html).toContain('THB 750–4,750／人／日')
    expect(html).toContain('標準泰國司機')
    expect(html).toContain('LINE 中文支援')
    expect(html).toContain('中文導遊選配')
    expect(html).toContain('兒童安全座椅付費加購')
    expect(html).toContain('+66-63-790-0666')
  })
})
