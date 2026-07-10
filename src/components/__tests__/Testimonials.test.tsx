import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('embla-carousel-react', () => ({
  default: () => [() => undefined, undefined],
}))

import Testimonials from '@/components/sections/Testimonials'

describe('Testimonials service context', () => {
  it('keeps the original review wording and adds a clear staffing disclaimer', () => {
    const html = renderToStaticMarkup(<Testimonials />)

    expect(html).toContain('司機兼導遊中文非常好')
    expect(html).toContain('評價反映各次實際安排')
    expect(html).toContain('標準服務為泰國司機')
    expect(html).toContain('中文導遊依方案選配')
  })
})
