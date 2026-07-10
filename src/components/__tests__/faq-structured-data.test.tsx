import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/script', () => ({
  default: ({ children, ...props }: Record<string, unknown>) => (
    <script {...props}>{children}</script>
  ),
}))

vi.mock('@/components/Header', () => ({
  default: () => <header>header</header>,
}))

vi.mock('@/components/Footer', () => ({
  default: () => <footer>footer</footer>,
}))

vi.mock('@/components/ui/FloatingLineButton', () => ({
  default: () => <div>floating-line</div>,
}))

import FAQSection from '@/components/cms/FAQSection'
import RootLayout from '@/app/layout'
import HomePageFaqSchema from '@/components/schema/HomePageFaqSchema'

const faqItems = [
  {
    question: '清邁包車要先預約嗎？',
    answer: '建議先預約。',
  },
]

function countFaqPages(html: string) {
  return (html.match(/"@type":"FAQPage"/g) ?? []).length
}

describe('FAQ structured data deduplication', () => {
  it('does not emit FAQPage schema from FAQSection by default', () => {
    const html = renderToStaticMarkup(<FAQSection items={faqItems} />)

    expect(countFaqPages(html)).toBe(0)
  })

  it('does not emit FAQPage schema globally from the root layout', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>page</main>
      </RootLayout>
    )

    expect(countFaqPages(html)).toBe(0)
  })

  it('keeps homepage FAQPage schema available in a homepage-only component', () => {
    const html = renderToStaticMarkup(<HomePageFaqSchema />)

    expect(countFaqPages(html)).toBe(1)
    expect(html).toContain('總佔位人數')
    expect(html).toContain('THB 750–3,500')
    expect(html).toContain('標準安排泰國司機')
    expect(html).toContain('LINE 中文支援')
    expect(html).toContain('中文導遊')
    expect(html).toContain('THB 500／日／張')
    expect(html).toContain('佔一個座位')
    expect(html).toContain('每位乘客（含嬰幼兒）各佔一席')
    expect(html).toContain('安全座椅安裝於該乘客座位，不另加算一人')
    expect(html).not.toContain('成人、兒童及安全座椅皆計入')
  })
})
