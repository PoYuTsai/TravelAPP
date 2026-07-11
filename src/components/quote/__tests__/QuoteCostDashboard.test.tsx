// @vitest-environment jsdom

import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  it('套餐模式只以同行人數、兒童年齡、車數與加購需求說明價格變動', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/quote/QuoteCostDashboard.tsx'),
      'utf8'
    )

    expect(source).toContain('同行總人數、兒童年齡、車數與加購需求')
    expect(source).not.toContain('住宿等級、是否含導遊')
  })

  it('derives overtime numbers from the canonical public policy', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/quote/QuoteCostDashboard.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/lib/pricing/publicPolicy'")
    for (const field of [
      'chiangMaiHours',
      'chiangRaiGoldenTriangleHours',
      'graceMinutes',
      'feeThbPerHourPerCar',
      'guideFeeThbPerHour',
    ]) {
      expect(source).toContain(`CHARTER_OVERTIME_POLICY.${field}`)
    }
    expect(source).not.toMatch(/(?:10|12) 小時|30 分鐘|THB 300/)
  })

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

  it('perPerson 單車報價仍顯示每台超時單位與區域時數', () => {
    render(<QuoteCostDashboard quote={buildQuote({ pricingModel: 'perPerson', carCount: 1 })} />)

    expect(screen.getByText(/清邁用車 10 小時/)).toBeTruthy()
    expect(screen.getByText(/清萊／金三角用車 12 小時/)).toBeTruthy()
    expect(screen.getByText(/THB 300／小時／台/)).toBeTruthy()
    expect(screen.getByText(/中文導遊不另收超時費/)).toBeTruthy()
    expect(screen.getByText(/30 分鐘彈性/)).toBeTruthy()
    expect(screen.queryByText(/300 泰銖\/小時/)).toBeNull()
  })

  it('套餐展示頁（package mode）：不露價格明細區塊', () => {
    render(
      <QuoteCostDashboard
        quote={buildQuote({ pricingModel: 'perPerson', publicPageMode: 'package' })}
      />
    )

    expect(screen.queryByText('參考價格明細')).toBeNull()
    expect(screen.queryByText('價格明細')).toBeNull()
    // 總價卡仍在
    expect(screen.getByText(/THB 25,300/)).toBeTruthy()
  })

  it('舊快照（無 pricingModel）：維持 NT$ 大字現行渲染', () => {
    render(<QuoteCostDashboard quote={buildQuote()} />)

    expect(screen.getByText(/NT\$ 23,000/)).toBeTruthy()
    expect(screen.getByText(/約 25,300 泰銖/)).toBeTruthy()
    // 明細列：TWD 為主
    expect(screen.getByText('NT$ 20,000')).toBeTruthy()
  })
})

describe('QuoteCostDashboard 現場付標註', () => {
  it('payOnSite item 顯示「現場付」徽章，金額照列', () => {
    const base = buildQuote({ pricingModel: 'perPerson' })
    render(
      <QuoteCostDashboard
        quote={{
          ...base,
          quote: {
            ...base.quote!,
            items: [
              ...base.quote!.items,
              {
                label: '大象保護營門票',
                amountTHB: 3200,
                amountTWD: 2909,
                description: '2 位 × 1,600',
                payOnSite: true,
              },
            ],
          },
        }}
      />
    )

    expect(screen.getByText('現場付')).toBeTruthy()
    expect(screen.getByText('大象保護營門票')).toBeTruthy()
    // 金額照常顯示（perPerson：THB 為主）
    expect(screen.getByText('3,200 THB')).toBeTruthy()
  })

  it('無 payOnSite 的 item 不顯示徽章', () => {
    render(<QuoteCostDashboard quote={buildQuote({ pricingModel: 'perPerson' })} />)

    expect(screen.queryByText('現場付')).toBeNull()
  })
})
