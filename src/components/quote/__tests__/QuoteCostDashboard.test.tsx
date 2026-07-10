// @vitest-environment jsdom

import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// jsdom 沒有 IntersectionObserver，whileInView 會炸；動畫非受測點，降級為純 DOM 元素
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          initial: _i,
          whileInView: _w,
          viewport: _v,
          transition: _t,
          animate: _a,
          ...props
        }: Record<string, unknown>) =>
          createElement(tag, props),
    }
  ),
}))

import { QuoteCostDashboard } from '../QuoteCostDashboard'
import type { QuoteData } from '@/lib/quote/types'

function buildQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    name: '王小明',
    publicSlug: 'test-quote',
    createdAt: '2026-07-10T00:00:00Z',
    adults: 4,
    children: 2,
    tripDays: 5,
    tripNights: 4,
    exchangeRate: 1.1,
    itinerary: [],
    quote: {
      items: [
        {
          label: '大人',
          amountTHB: 22000,
          amountTWD: 20000,
          description: '4 位 × 5,500',
        },
      ],
      included: ['車資油費過路停車'],
      excluded: ['午晚餐'],
      paymentNotes: [],
      totalTHB: 25300,
      totalTWD: 23000,
    },
    collectDeposit: false,
    hotelsWithDeposit: [],
    totalDeposit: 0,
    carCount: 1,
    photos: [],
    publicPageMode: 'quote',
    isSample: false,
    ...overrides,
  }
}

describe('QuoteCostDashboard 幣別主次分流', () => {
  it('perPerson 快照：主金額 THB 大字、TWD 縮為約值註記', () => {
    render(<QuoteCostDashboard quote={buildQuote({ pricingModel: 'perPerson' })} />)

    // 總價大字 = THB
    expect(screen.getByText(/THB 25,300/)).toBeTruthy()
    // TWD 降為小字約值
    expect(screen.getByText(/約 NT\$ 23,000/)).toBeTruthy()
    // 不得再出現舊版「NT$ 大字＋約 X 泰銖」組合
    expect(screen.queryByText(/約 25,300 泰銖/)).toBeNull()

    // 明細列：THB 為主
    expect(screen.getByText('22,000 THB')).toBeTruthy()
  })

  it('舊快照（無 pricingModel）：維持 NT$ 大字現行渲染', () => {
    render(<QuoteCostDashboard quote={buildQuote()} />)

    expect(screen.getByText(/NT\$ 23,000/)).toBeTruthy()
    expect(screen.getByText(/約 25,300 泰銖/)).toBeTruthy()
    // 明細列：TWD 為主
    expect(screen.getByText('NT$ 20,000')).toBeTruthy()
  })
})
