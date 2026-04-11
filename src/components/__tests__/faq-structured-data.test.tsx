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
  })
})
