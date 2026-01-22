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
    totalPrice: 10000,
    priceIncludes: '油費\n停車費',
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
    expect(html).toContain('2 大 1 小（5歲）')
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

  it('生成包含費用的 HTML', () => {
    const html = generateItineraryHTML(mockData)
    expect(html).toContain('NT$10,000')
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

  it('處理無費用資訊', () => {
    const noPrice = {
      ...mockData,
      totalPrice: 0,
      priceIncludes: undefined,
      priceExcludes: undefined,
      days: [
        {
          date: '2026-02-12',
          title: '測試',
          carPrice: 0,
          guidePrice: 0,
        },
      ],
    }
    const html = generateItineraryHTML(noPrice)
    // 應該不會出錯
    expect(html).toContain('測試')
  })
})
