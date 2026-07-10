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
  it('renders Thai-driver and Mandarin-guide prices from the shared engine', () => {
    const { container } = render(<PerPersonPricingTable />)
    const text = container.textContent ?? ''

    expect(text).toContain('泰國司機方案')
    expect(text).toContain('中文導遊方案')
    // 2 人不含導遊 T1 = 2,300；2 人含導遊 T1 = 3,550
    expect(text).toContain('2,300')
    expect(text).toContain('3,550')
    // 8 人可選司機方案 T1 = 800；9 人含導遊 T4 = 1,350
    expect(text).toContain('800')
    expect(text).toContain('1,350')
  })

  it('explains the public guide policy without making an unverified legal claim', () => {
    const { container } = render(<PerPersonPricingTable />)
    const text = container.textContent ?? ''

    expect(text).toContain('2–3 人也可選配中文導遊')
    expect(text).toContain('8 人（含）以上建議安排中文導遊')
    expect(text).toContain('10 人以上請直接詢問整團報價')
    expect(text).not.toContain('依法')
    expect(text).not.toContain('必配')
  })

  it('asks for child ages and reports one family total without exposing discount ratios', () => {
    const { container } = render(<PerPersonPricingTable />)
    const text = container.textContent ?? ''

    expect(text).toContain('成人、兒童與嬰幼兒都需要計入座位')
    expect(text).toContain('有小朋友不用自己折算')
    expect(text).toContain('全家總價')
    expect(text).not.toContain('8 折')
    expect(text).not.toContain('半價')
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
    expect(text).toContain('0–2 歲嬰幼兒安全座椅')
    expect(text).toContain('每台載客達 7 位')
    expect(text).toContain('確認需要後')
    expect(text).not.toContain('8 人以上加派行李車')
    expect(text).toContain('測試備註一則')
    // 品牌紅線：絕不寫「中英泰文導遊」
    expect(text).not.toContain('中英泰文')
  })
})
