// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PerPersonPricingTable from '../PerPersonPricingTable'

function renderPricingCopy() {
  const { container } = render(<PerPersonPricingTable />)
  return container.textContent ?? ''
}

describe('PerPersonPricingTable', () => {
  it('renders the three public price cards with the current engine prices', () => {
    const text = renderPricingCopy()

    expect(text).toContain('轎車＋泰國司機')
    expect(text).toContain('2–3 人')
    expect(text).toContain('Van＋泰國司機')
    expect(text).toContain('4–9 人')
    expect(text).toContain('Van＋泰國司機＋中文導遊')

    // 轎車：2 人 T1 = 2,300；3 人 T4 = 2,400
    expect(text).toContain('2,300')
    expect(text).toContain('2,400')
    // Van 不含導遊的新 8、9 人引擎數字
    expect(text).toContain('800')
    expect(text).toContain('750')
    // Van 含導遊：4 人 T1 = 2,050；9 人 T1 = 1,000
    expect(text).toContain('2,050')
    expect(text).toContain('1,000')
  })

  it('states the driver, optional-guide and fleet rules without legacy claims', () => {
    const text = renderPricingCopy()

    expect(text).toContain('標準安排為泰國司機')
    expect(text).toMatch(/中文導遊.*(?:選配|加聘)/)
    expect(text).toContain('4–9 人')
    expect(text).toMatch(/10–18 人.*(?:Van×2|兩台 Van)/)
    expect(text).toMatch(/10–18 人.*LINE.*整團報價/)
    expect(text).toMatch(/19 人以上.*人工報價/)
    expect(text).toMatch(/2–3 人.*中文導遊.*確認車型/)
    expect(text).toMatch(/10–18 人.*中文導遊.*共用一位/)

    expect(text).not.toContain('泰國法規')
    expect(text).not.toContain('必配持證')
    expect(text).not.toContain('拆兩張單')
    expect(text).not.toMatch(/(?:提供|安排|保證)中文司機/)
  })

  it('labels child rates as estimates protected by family composition and the minimum group price', () => {
    const text = renderPricingCopy()

    expect(text).toContain('嬰幼兒皆佔位')
    expect(text).toContain('兒童優惠試算')
    expect(text).toContain('8 折試算')
    expect(text).toContain('半價試算')
    expect(text).toContain('家庭組合')
    expect(text).toContain('最低成團價')
    expect(text).toContain('正式報價')
  })

  it('lists paid add-ons and overtime with their exact units', () => {
    const text = renderPricingCopy()

    expect(text).toContain('費用不含')
    expect(text).toMatch(/300\s*／小時／台/)
    expect(text).toMatch(/500\s*／日／張/)
    expect(text).toMatch(/100\s*／人／趟/)
    expect(text).toContain('轎車 THB 500／Van THB 700')
    expect(text).toContain('安全座椅也佔一個座位')
    expect(text).toContain('10 小時')
    expect(text).toContain('12 小時')
    expect(text).not.toContain('包含超時')
  })

  it('renders Sanity footnotes without reviving disallowed guide copy', () => {
    const { container } = render(
      <PerPersonPricingTable footnotes={['測試備註一則']} />
    )
    const text = container.textContent ?? ''

    expect(text).toContain('測試備註一則')
    expect(text).not.toContain('中英泰文')
  })
})
