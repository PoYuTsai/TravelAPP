import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/script', () => ({
  default: ({ children: _children, ...props }: React.ComponentProps<'script'>) => <script {...props} />,
}))

import CancellationPage from '@/app/cancellation/page'
import TermsPage from '@/app/terms/page'

function renderedText(page: React.ReactElement) {
  return renderToStaticMarkup(page).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

describe('public charter policy pages', () => {
  it.each([
    ['cancellation page', 'src/app/cancellation/page.tsx'],
    ['terms page', 'src/app/terms/page.tsx'],
  ])('derives overtime numbers from the canonical policy in the %s', (_label, relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8')

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

  it('renders the canonical driver and overtime policy on the cancellation page', () => {
    const text = renderedText(<CancellationPage />)

    expect(text).toContain('標準服務安排泰國司機，通常不以中文服務')
    expect(text).toContain('行程會在出發前確認')
    expect(text).toContain('LINE 中文支援')
    expect(text).toContain('需要隨車中文溝通或導覽時，再選配中文導遊')
    expect(text).toContain('清萊／金三角用車：12 小時')
    expect(text).toContain('THB 300／小時／台')
    expect(text).toContain('中文導遊不另收超時費')
    expect(text).toContain('彈性 30 分鐘')
    expect(text).toContain('一台車超時費 THB 300')
    expect(text).toContain('範例（訂單 THB 10,000）')
    expect(text).toContain('範例（訂單 THB 6,000）')
    expect(text).not.toMatch(/(?:10,000|6,000|5,000|3,000|1,800)\s*元/)

    expect(text).not.toContain('各 200 泰銖/小時')
    expect(text).not.toContain('400 泰銖/小時')
  })

  it('renders exact standard inclusions, paid child seats and overtime terms', () => {
    const html = renderToStaticMarkup(<TermsPage />)
    const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    expect(text).toContain('最後更新日期：2026 年 7 月')
    expect(html).toContain('2026-07')
    expect(text).toContain('車輛、泰國司機、油資、過路費、停車費與 LINE 中文支援')
    expect(text).toContain('中文導遊僅在選配方案中包含')
    expect(text).toContain('兒童安全座椅為 THB 500／日／張')
    expect(text).toContain('每位乘客（含嬰幼兒）各佔一席')
    expect(text).toContain('安全座椅安裝於該乘客座位，不另加算一人')
    expect(text).toContain('需納入車內座位配置')
    expect(text).not.toContain('且佔一個座位')
    expect(text).toContain('清邁 10 小時；清萊／金三角 12 小時')
    expect(text).toContain('THB 300／小時／台')
    expect(text).toContain('中文導遊不另收超時費')
    expect(text).toContain('基本用車時間用完後，另有 30 分鐘彈性')
  })
})
