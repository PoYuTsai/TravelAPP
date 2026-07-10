// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import PerPersonPricingTable from '../PerPersonPricingTable'

/**
 * 黃金值來源：docs/plans/2026-07-10-per-person-pricing-framework.md 第 6 節價目表。
 * 元件由 perPersonRates 引擎推導價格，這裡用 framework 文件數字交叉驗證，
 * 引擎參數若被改動而偏離定案表，本測試會抓到。
 */
describe('PerPersonPricingTable', () => {
  it('renders framework golden per-person day prices for all three tables', () => {
    const { container } = render(<PerPersonPricingTable />)
    const text = container.textContent ?? ''

    // 轎車 2-3 人：2 人 T1 = 2,300；3 人 T4 = 2,400
    expect(text).toContain('2,300')
    expect(text).toContain('2,400')
    // van 不含導遊：7 人 T1 = 900；4 人 T4 = 2,200
    expect(text).toContain('900')
    expect(text).toContain('2,200')
    // van 含導遊：4 人 T1 = 2,050；9 人 T1 = 1,000
    expect(text).toContain('2,050')
    expect(text).toContain('1,000')
  })

  it('renders seat rules, child tiers and honest notes', () => {
    const { container } = render(<PerPersonPricingTable />)
    const text = container.textContent ?? ''

    // 座位硬規則
    expect(text).toContain('必配持證中文導遊')
    expect(text).toContain('10 人以上')
    // 小孩三段
    expect(text).toContain('全價')
    expect(text).toContain('8 折')
    expect(text).toContain('半價')
    // 嬰兒佔位
    expect(text).toContain('嬰兒也需要一個座位')
    // 誠實註記
    expect(text).toContain('實際以正式報價為準')
  })

  it('lists overtime as excluded, charged per car (Eric 2026-07-10 定案)', () => {
    const { container } = render(<PerPersonPricingTable />)
    const text = container.textContent ?? ''

    expect(text).toContain('費用不含')
    expect(text).toMatch(/300\s*／小時／台/)
    expect(text).toContain('10 小時')
    expect(text).toContain('12 小時')
    // 超時費絕不出現在「包含」句
    expect(text).not.toContain('包含超時')
  })

  it('renders optional insurance including infants, and Sanity footnotes', () => {
    const { container } = render(
      <PerPersonPricingTable footnotes={['測試備註一則']} />
    )
    const text = container.textContent ?? ''

    expect(text).toContain('投保時嬰兒也投保')
    expect(text).toContain('100')
    expect(text).toContain('測試備註一則')
    // 品牌紅線：絕不寫「中英泰文導遊」
    expect(text).not.toContain('中英泰文')
  })
})
