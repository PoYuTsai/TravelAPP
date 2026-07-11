// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PerPersonPricingTable from '../PerPersonPricingTable'

function renderPricingCopy() {
  const { container } = render(<PerPersonPricingTable />)
  return container.textContent ?? ''
}

function rateRowsFor(title: string) {
  const { container } = render(<PerPersonPricingTable />)
  const heading = Array.from(container.querySelectorAll('h3')).find(
    (element) => element.textContent === title,
  )
  const card = heading?.closest('article')
  if (!card) throw new Error(`Missing rate card: ${title}`)

  return Array.from(card.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim()),
  )
}

describe('PerPersonPricingTable', () => {
  it('organizes every public rate under exactly two service plans', () => {
    const { container } = render(<PerPersonPricingTable />)
    const planCards = container.querySelectorAll('article[data-pricing-plan]')

    expect(planCards).toHaveLength(2)
    expect(Array.from(planCards).map((card) => card.querySelector('h3')?.textContent)).toEqual([
      '方案 A｜泰國司機包車',
      '方案 B｜泰國司機＋中文導遊同行',
    ])
    expect(Array.from(planCards).every((card) => card.querySelectorAll('tbody tr').length === 8)).toBe(true)
  })

  it('publishes complete driver and guided prices including guided sedan rates', () => {
    const text = renderPricingCopy()

    expect(text).toContain('方案 A｜泰國司機包車')
    expect(text).toContain('方案 B｜泰國司機＋中文導遊同行')
    expect(text).toContain('2–3 人使用轎車')
    expect(text).toContain('4–9 人使用 Van')

    // 轎車：2 人 T1 = 2,300；3 人 T4 = 2,400
    expect(text).toContain('2,300')
    expect(text).toContain('2,400')
    // Van 不含導遊的新 8、9 人引擎數字
    expect(text).toContain('800')
    expect(text).toContain('750')
    // Van 含導遊：4 人 T1 = 2,050；9 人 T1 = 1,000
    expect(text).toContain('2,050')
    expect(text).toContain('1,000')

    expect(rateRowsFor('方案 B｜泰國司機＋中文導遊同行').slice(0, 2)).toEqual([
      ['2 人', '轎車', '3,550', '3,800', '4,450', '4,750'],
      ['3 人', '轎車', '2,450', '2,600', '3,050', '3,250'],
    ])
  })

  it('tells mobile visitors that every regional price remains available by horizontal scroll', () => {
    const text = renderPricingCopy()

    expect(text.match(/左右滑動查看全部地區價格/g)).toHaveLength(2)
  })

  it('states the driver, optional-guide and fleet rules without legacy claims', () => {
    const text = renderPricingCopy()

    expect(text).toContain('標準安排為泰國司機')
    expect(text).toMatch(/中文導遊.*(?:選配|加聘)/)
    expect(text).toContain('4–9 人')
    expect(text).toMatch(/10–18 人.*(?:Van×2|兩台 Van)/)
    expect(text).toMatch(/10–18 人.*LINE.*整團報價/)
    expect(text).toMatch(/19 人以上.*人工報價/)
    expect(text).toMatch(/2–3 人.*中文導遊.*選配/)
    expect(text).toMatch(/3 人.*導遊.*一般 5 人座.*剛好滿/)
    expect(text).toMatch(/座位.*安全座椅.*行李.*舒適度.*調度.*確認車型/)
    expect(text).toMatch(/10–18 人.*中文導遊.*共用一位/)
    expect(text).toContain('8 人（含）以上同行，建議安排中文導遊')
    expect(text).toContain('親子家庭、8 人（含）以上推薦')

    expect(text).not.toContain('泰國法規')
    expect(text).not.toContain('必配持證')
    expect(text).not.toContain('拆兩張單')
    expect(text).not.toMatch(/(?:提供|安排|保證)中文司機/)
    expect(text).not.toMatch(/SUV/i)
  })

  it('shows adult per-person references but gives families one total instead of child unit prices', () => {
    const text = renderPricingCopy()

    expect(text).toContain('全成人同行參考')
    expect(text).toContain('以下金額皆為 THB／人／日')
    expect(text).toContain('嬰幼兒皆佔位')
    expect(text).toContain('有小朋友？不用自己拆帳')
    expect(text).toContain('親子優惠')
    expect(text).toContain('全家包車總價')
    expect(text).toContain('成人幾位')
    expect(text).toContain('小孩年齡')
    expect(text).toContain('安全座椅')

    expect(text).not.toContain('8 折試算')
    expect(text).not.toContain('半價試算')
    expect(text).not.toContain('最低成團價')
  })

  it('lists paid add-ons and overtime with their exact units', () => {
    const text = renderPricingCopy()

    expect(text).toContain('費用不含')
    expect(text).toMatch(/300\s*／小時／台/)
    expect(text).toMatch(/500\s*／日／張/)
    expect(text).toMatch(/100\s*／人／趟/)
    expect(text).toContain('轎車 THB 500／Van THB 700')
    expect(text).toContain('每位乘客（含嬰幼兒）各佔一席')
    expect(text).toContain('安全座椅安裝於該乘客座位，不另加算一人')
    expect(text).toContain('需納入車內座位配置')
    expect(text).toContain('10 小時')
    expect(text).toContain('12 小時')
    expect(text).toContain('30 分鐘彈性')
    expect(text).toContain('導遊不另收超時費')
    expect(text).toContain('6–7 人不加行李車')
    expect(text).toContain('8–9 人固定加派 1 台')
    expect(text).toContain('10–14 人不加')
    expect(text).toContain('15–18 人固定加派 1 台')
    expect(text).toContain('THB 500／台／趟')
    expect(text).toContain('僅提供 0–2 歲嬰幼兒安全座椅')
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
