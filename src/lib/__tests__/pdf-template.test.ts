// src/lib/__tests__/pdf-template.test.ts
import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatPeople,
  parseList,
  generateItineraryHTML,
} from '../pdf/itinerary-template'

describe('formatDate', () => {
  it('格式化日期為 M/D (週幾)', () => {
    const result = formatDate('2026-02-12')
    expect(result).toBe('2/12 (四)')
  })

  it('處理月初日期', () => {
    const result = formatDate('2026-03-01')
    expect(result).toBe('3/1 (日)')
  })

  it('處理年底日期', () => {
    const result = formatDate('2026-12-31')
    expect(result).toBe('12/31 (四)')
  })

  it('不受時區影響', () => {
    // 確保不會因為時區問題顯示前一天
    const result = formatDate('2026-01-01')
    expect(result).toContain('1/1')
  })
})

describe('formatDateRange', () => {
  it('格式化日期範圍', () => {
    const result = formatDateRange('2026-02-12', '2026-02-18')
    expect(result).toBe('2026/2/12 - 2/18')
  })

  it('處理跨月日期', () => {
    const result = formatDateRange('2026-01-28', '2026-02-03')
    expect(result).toBe('2026/1/28 - 2/3')
  })

  it('處理跨年日期', () => {
    const result = formatDateRange('2025-12-28', '2026-01-03')
    expect(result).toBe('2025/12/28 - 1/3')
  })
})

describe('formatPeople', () => {
  it('只有成人', () => {
    const result = formatPeople(4, 0)
    expect(result).toBe('4 大')
  })

  it('成人加小朋友', () => {
    const result = formatPeople(2, 2)
    expect(result).toBe('2 大 2 小')
  })

  it('成人加小朋友和年齡', () => {
    const result = formatPeople(2, 2, '5歲、3歲')
    expect(result).toBe('2 大 2 小（5歲、3歲）')
  })

  it('只有 1 大 1 小', () => {
    const result = formatPeople(1, 1, '2歲')
    expect(result).toBe('1 大 1 小（2歲）')
  })

  it('成人、小孩與嬰兒分開顯示', () => {
    const result = formatPeople(2, 1, '5歲', 1)
    expect(result).toBe('2 大 1 小（5歲） 1 嬰')
  })
})

describe('parseList', () => {
  it('解析換行分隔的列表', () => {
    const text = '油費\n停車費\n過路費'
    const result = parseList(text)
    expect(result).toEqual(['油費', '停車費', '過路費'])
  })

  it('移除列表符號', () => {
    const text = '- 油費\n• 停車費\n過路費'
    const result = parseList(text)
    expect(result).toEqual(['油費', '停車費', '過路費'])
  })

  it('過濾空行', () => {
    const text = '油費\n\n停車費\n  \n過路費'
    const result = parseList(text)
    expect(result).toEqual(['油費', '停車費', '過路費'])
  })

  it('處理空值', () => {
    expect(parseList(undefined)).toEqual([])
    expect(parseList('')).toEqual([])
  })
})

describe('generateItineraryHTML', () => {
  const mockData = {
    clientName: '王小明',
    startDate: '2026-02-12',
    endDate: '2026-02-14',
    adults: 2,
    children: 1,
    infants: 1,
    childrenAges: '5歲',
    days: [
      {
        date: '2026-02-12',
        title: '抵達清邁',
        activities: [
          { content: '機場接機' },
          { content: '泰服體驗' },
        ],
        lunch: '瓦洛洛市場',
        dinner: '黑森林餐廳',
        accommodation: 'Nimman Hotel',
        carPrice: 3200,
        guidePrice: 2500,
      },
    ],
    quotationItems: [
      {
        date: '2026-02-12',
        description: '泰國司機包車服務',
        unitPrice: 3200,
        quantity: 1,
        unit: '台',
      },
      {
        description: '兒童安全座椅',
        unitPrice: 500,
        quantity: 1,
        unit: '張',
      },
    ],
    quotationTotal: 3700,
    // Legacy pricing fields deliberately remain in the fixture. They must never
    // become a new PDF quote when canonical quotation items are available.
    totalPrice: 10000,
    priceIncludes: '油費\n停車費\n中文導遊服務（選配）\n旅遊保險（選配）',
    priceExcludes: '門票\n餐費',
  }

  it('生成包含客戶名稱的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('王小明')
  })

  it('生成包含日期範圍的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('2026/2/12 - 2/14')
  })

  it('生成包含人數的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('2 大 1 小（5歲） 1 嬰')
  })

  it('escapes child age text before inserting it into PDF HTML', () => {
    const html = generateItineraryHTML({
      ...mockData,
      childrenAges: '<script>alert("age")</script>',
    })

    expect(html).not.toContain('<script>alert("age")</script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;age&quot;)&lt;/script&gt;')
  })

  it('生成包含行程標題的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('抵達清邁')
  })

  it('生成包含餐點的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('瓦洛洛市場')
    expect(html).toContain('黑森林餐廳')
  })

  it('生成包含住宿的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('Nimman Hotel')
  })

  it('只用 canonical 報價項目顯示 THB 費用', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('泰國司機包車服務')
    expect(html).toContain('兒童安全座椅')
    expect(html).toContain('THB 3,200')
    expect(html).toContain('THB 500')
    expect(html).toContain('THB 3,700')
    expect(html).not.toContain('NT$10,000')
    expect(html).not.toContain('台幣轉帳')
  })

  it('recalculates the displayed total from canonical rows when quotationTotal is stale', () => {
    const html = generateItineraryHTML({ ...mockData, quotationTotal: 1 })

    expect(html).toContain('THB 3,700')
    expect(html).not.toContain('<td class="number">THB 1</td>')
  })

  it('只有 canonical 項目存在時才呈現導遊與保險', () => {
    const policyData = {
      ...mockData,
      priceExcludes: '門票\n餐費\n中文導遊服務（未選配）\n旅遊保險（未選配）',
    }
    const withoutOptions = generateItineraryHTML(policyData)
    expect(withoutOptions).not.toContain('中文導遊服務（選配）')
    expect(withoutOptions).not.toContain('旅遊保險（選配）')
    expect(withoutOptions).toContain('中文導遊服務（未選配）')
    expect(withoutOptions).toContain('旅遊保險（未選配）')

    const withOptions = generateItineraryHTML({
      ...policyData,
      quotationItems: [
        ...mockData.quotationItems,
        {
          description: '中文導遊（選配）',
          unitPrice: 2500,
          quantity: 1,
          unit: '日',
        },
        {
          description: '旅遊保險（選配）',
          unitPrice: 100,
          quantity: 4,
          unit: '人',
        },
      ],
      quotationTotal: 6600,
    })
    expect(withOptions).toContain('中文導遊（選配）')
    expect(withOptions).toContain('旅遊保險（選配）')
    expect(withOptions).not.toContain('中文導遊服務（未選配）')
    expect(withOptions).not.toContain('旅遊保險（未選配）')
  })

  it('生成包含費用包含/不包含的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('油費')
    expect(html).toContain('停車費')
    expect(html).toContain('門票')
    expect(html).toContain('餐費')
  })

  it('處理空行程', () => {
    const emptyData = {
      ...mockData,
      days: [],
    }
    const html = generateItineraryHTML(emptyData)
    expect(html).toContain('王小明')
    // 應該不會出錯
  })

  it('沒有 canonical 報價時只輸出行程，不回退 legacy 費用或付款區', () => {
    const noPrice = {
      ...mockData,
      quotationItems: undefined,
      quotationTotal: undefined,
      days: [
        {
          date: '2026-02-12',
          title: '測試',
          carPrice: 3200,
          guidePrice: 2500,
        },
      ],
      totalPrice: 10000,
    }
    const html = generateItineraryHTML(noPrice)
    expect(html).toContain('測試')
    expect(html).not.toContain('費用說明')
    expect(html).not.toContain('付款方式')
    expect(html).not.toContain('NT$')
  })
})
