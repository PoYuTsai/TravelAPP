// src/lib/itinerary/parser.ts
// 行程解析核心邏輯

import type { ParsedDay, ParseResult, ParsedBasicInfo, ParsedQuotation, ParsedQuotationItem } from './types'

/**
 * 解析日期字串，例如 "2/1 (日)" 或 "2/1(日)"
 */
function parseDateLine(line: string, year: number): { month: number; day: number } | null {
  const match = line.match(/(\d{1,2})\/(\d{1,2})/)
  if (!match) return null
  return {
    month: parseInt(match[1], 10),
    day: parseInt(match[2], 10),
  }
}

/**
 * 解析 Day 標題，例如 "Day 1｜抵達清邁・放鬆展開旅程"
 */
function parseDayTitle(line: string): { dayNumber: number; title: string } | null {
  const match = line.match(/Day\s*(\d+)[｜|]\s*(.+)/i)
  if (!match) return null
  return {
    dayNumber: parseInt(match[1], 10),
    title: match[2].trim(),
  }
}

/**
 * 判斷是否為餐點行
 */
function parseMealLine(line: string): { type: 'breakfast' | 'lunch' | 'dinner' | 'afternoon_tea'; content: string } | null {
  const trimmed = line.trim().replace(/^[・\-•\*·]\s*/, '')

  if (trimmed.match(/^(早餐|breakfast)[：:]/i)) {
    return { type: 'breakfast', content: trimmed.replace(/^(早餐|breakfast)[：:]\s*/i, '') }
  }
  if (trimmed.match(/^(午餐|中餐|lunch)[：:]/i)) {
    return { type: 'lunch', content: trimmed.replace(/^(午餐|中餐|lunch)[：:]\s*/i, '') }
  }
  if (trimmed.match(/^(晚餐|dinner)[：:]/i)) {
    return { type: 'dinner', content: trimmed.replace(/^(晚餐|dinner)[：:]\s*/i, '') }
  }
  if (trimmed.match(/^(下午茶|afternoon tea)[：:]/i)) {
    return { type: 'afternoon_tea', content: trimmed.replace(/^(下午茶|afternoon tea)[：:]\s*/i, '') }
  }

  return null
}

/**
 * 判斷是否為住宿行
 */
function parseAccommodationLine(line: string): string | null {
  const trimmed = line.trim()
  const match = trimmed.match(/^[・\-•·]?\s*(住宿|accommodation|hotel)[：:]\s*(.+)/i)
  if (match) {
    return match[2].trim()
  }
  return null
}

/**
 * 判斷是否為活動行
 */
function isActivityLine(line: string): boolean {
  const trimmed = line.trim()
  return /^[・\-•·]/.test(trimmed)
}

/**
 * 判斷是否為晚上專屬內容（夜市）
 * 注意：按摩不算，因為下午也可能去
 */
function isEveningOnly(content: string): boolean {
  const eveningOnlyKeywords = ['夜市', 'night market']
  const lowerContent = content.toLowerCase()
  for (const kw of eveningOnlyKeywords) {
    if (lowerContent.includes(kw.toLowerCase())) {
      return true
    }
  }
  return false
}

/**
 * 清理活動內容
 */
function cleanActivityContent(line: string): string {
  return line.trim().replace(/^[・\-•·]\s*/, '')
}

/**
 * 分配活動到早/午/晚時段
 * - 早：前半活動
 * - 午：後半活動
 * - 晚：夜市 + 晚餐
 */
function distributeActivities(
  activities: string[],
  lunch: string | undefined,
  dinner: string | undefined
): { morning: string; afternoon: string; evening: string } {
  const result = { morning: '', afternoon: '', evening: '' }

  const morningItems: string[] = []
  const afternoonItems: string[] = []
  const eveningItems: string[] = []

  // 分類活動：夜市歸晚上，其他平分早午
  const regularActivities: string[] = []
  for (const act of activities) {
    if (isEveningOnly(act)) {
      eveningItems.push(act)
    } else {
      regularActivities.push(act)
    }
  }

  const midPoint = Math.ceil(regularActivities.length / 2)

  regularActivities.forEach((act, i) => {
    if (i < midPoint) {
      morningItems.push(act)
    } else {
      afternoonItems.push(act)
    }
  })

  // 晚餐加到晚上
  if (dinner) {
    eveningItems.push(`晚餐：${dinner}`)
  }

  result.morning = morningItems.join('\n')
  result.afternoon = afternoonItems.join('\n')
  result.evening = eveningItems.join('\n')

  return result
}

/**
 * 主解析函數 - 解析行程文字
 */
export function parseItineraryText(text: string, year?: number): ParseResult {
  const lines = text.split('\n')
  const days: ParsedDay[] = []
  const errors: string[] = []

  const currentYear = new Date().getFullYear()
  const detectedYear = year || currentYear

  let currentDay: ParsedDay | null = null
  let dayRawLines: string[] = []
  let dayActivities: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      if (currentDay) dayRawLines.push(line)
      continue
    }

    const dateInfo = parseDateLine(trimmedLine, detectedYear)
    if (dateInfo) {
      if (currentDay) {
        const distributed = distributeActivities(dayActivities, currentDay.lunch, currentDay.dinner)
        currentDay.morning = distributed.morning
        currentDay.afternoon = distributed.afternoon
        currentDay.evening = distributed.evening
        currentDay.rawText = dayRawLines.join('\n')
        days.push(currentDay)
      }

      const dateStr = `${detectedYear}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`
      currentDay = {
        date: dateStr,
        dayNumber: days.length + 1,
        title: '',
        morning: '',
        afternoon: '',
        evening: '',
        activities: [],
        rawText: '',
      }
      dayRawLines = [line]
      dayActivities = []
      continue
    }

    if (!currentDay) continue

    dayRawLines.push(line)

    const dayTitle = parseDayTitle(trimmedLine)
    if (dayTitle) {
      currentDay.dayNumber = dayTitle.dayNumber
      currentDay.title = dayTitle.title
      continue
    }

    const meal = parseMealLine(trimmedLine)
    if (meal) {
      if (meal.type === 'lunch' || meal.type === 'afternoon_tea') {
        currentDay.lunch = meal.content
      } else if (meal.type === 'dinner') {
        currentDay.dinner = meal.content
      }
      currentDay.activities.push({ content: trimmedLine })
      continue
    }

    const accommodation = parseAccommodationLine(trimmedLine)
    if (accommodation) {
      currentDay.accommodation = accommodation
      currentDay.activities.push({ content: `住宿: ${accommodation}` })
      continue
    }

    if (isActivityLine(trimmedLine)) {
      const content = cleanActivityContent(trimmedLine)
      dayActivities.push(content)
      currentDay.activities.push({ content })
      continue
    }

    if (trimmedLine) {
      dayActivities.push(trimmedLine)
      currentDay.activities.push({ content: trimmedLine })
    }
  }

  if (currentDay) {
    const distributed = distributeActivities(dayActivities, currentDay.lunch, currentDay.dinner)
    currentDay.morning = distributed.morning
    currentDay.afternoon = distributed.afternoon
    currentDay.evening = distributed.evening
    currentDay.rawText = dayRawLines.join('\n')
    days.push(currentDay)
  }

  return {
    success: days.length > 0,
    days,
    errors,
    year: detectedYear,
  }
}

/**
 * 解析基本資訊文字
 */
export function parseBasicInfoText(text: string): ParsedBasicInfo {
  const result: ParsedBasicInfo = {}
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 客戶名稱
    const clientMatch = trimmed.match(/^(客戶姓名|客戶|客人|姓名)[：:\s]\s*(.+)/i)
    if (clientMatch) {
      result.clientName = clientMatch[2].trim()
      continue
    }

    // 日期範圍
    const dateMatch = trimmed.match(/^日期[：:\s]\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*[~\-～]\s*(?:(\d{4})[\/\-])?(\d{1,2})[\/\-]?(\d{1,2})?/i)
    if (dateMatch) {
      const startYear = dateMatch[1]
      const startMonth = dateMatch[2].padStart(2, '0')
      const startDay = dateMatch[3].padStart(2, '0')
      result.startDate = `${startYear}-${startMonth}-${startDay}`

      const endYear = dateMatch[4] || startYear
      const endMonth = dateMatch[5]?.padStart(2, '0') || startMonth
      const endDay = dateMatch[6]?.padStart(2, '0') || dateMatch[5]?.padStart(2, '0')
      if (endMonth && endDay) {
        result.endDate = `${endYear}-${endMonth}-${endDay}`
      }
      continue
    }

    // 人數: 4大2小
    const peopleMatch = trimmed.match(/^(?:人數[：:]?\s*)?(\d+)\s*大\s*(\d+)\s*小\s*(?:\(([^)]+)\))?/i)
    if (peopleMatch && (trimmed.includes('大') && trimmed.includes('小'))) {
      result.adults = parseInt(peopleMatch[1], 10)
      result.children = parseInt(peopleMatch[2], 10)
      if (peopleMatch[3]) {
        result.childrenAges = peopleMatch[3]
      }
      result.totalPeople = result.adults + result.children
      continue
    }

    // 成人/小朋友格式
    const adultChildMatch = trimmed.match(/成人\s*(\d+)\s*(?:\([^)]*\))?\s*小朋友\s*(\d+)\s*(?:\(([^)]+)\))?/i)
    if (adultChildMatch) {
      result.adults = parseInt(adultChildMatch[1], 10)
      result.children = parseInt(adultChildMatch[2], 10)
      if (adultChildMatch[3]) {
        result.childrenAges = adultChildMatch[3]
      }
      result.totalPeople = result.adults + result.children
      continue
    }

    // 總人數
    const totalMatch = trimmed.match(/^(?:總)?人數[：:]\s*(\d+)\s*人?/i)
    if (totalMatch) {
      result.totalPeople = parseInt(totalMatch[1], 10)
      continue
    }

    // 團型
    const groupMatch = trimmed.match(/^團型[：:]\s*(.+)/i)
    if (groupMatch) {
      result.groupType = groupMatch[1].trim()
      continue
    }

    // 行李
    const luggageMatch = trimmed.match(/^行李[說明]?[：:]\s*(.+)/i)
    if (luggageMatch) {
      result.luggageNote = luggageMatch[1].trim()
      continue
    }

    // 包車
    const vehicleMatch = trimmed.match(/^包車[說明]?[：:]\s*(.+)/i)
    if (vehicleMatch) {
      result.vehicleNote = vehicleMatch[1].trim()
      continue
    }

    // 導遊
    const guideMatch = trimmed.match(/^導遊[說明]?[：:]\s*(.+)/i)
    if (guideMatch) {
      result.guideNote = guideMatch[1].trim()
      continue
    }
  }

  return result
}

/**
 * 解析報價文字
 */
export function parseQuotationText(text: string, year?: number): ParsedQuotation {
  const result: ParsedQuotation = { items: [] }
  const lines = text.split('\n')
  const currentYear = year || new Date().getFullYear()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.match(/^(共|=|給優惠|車[：:]|導遊\d|總計)/)) {
      continue
    }

    const totalMatch = trimmed.match(/小計[：:]\s*([\d,]+)/i)
    if (totalMatch) {
      result.total = parseInt(totalMatch[1].replace(/,/g, ''), 10)
      continue
    }

    if (trimmed.startsWith('備註') || trimmed.startsWith('注意')) {
      result.note = trimmed.replace(/^(備註|注意)[：:]?\s*/i, '')
      continue
    }

    // 格式: 導遊 2500*6天
    const itemWithMultiply = trimmed.match(
      /^(?:(\d{1,2})[\/\-](\d{1,2})\s+)?(.+?)\s+(\d+)\s*[*×x]\s*(\d+)\s*(台|天|日|位|人)?$/i
    )
    if (itemWithMultiply) {
      const item: ParsedQuotationItem = {
        description: itemWithMultiply[3].trim(),
        unitPrice: parseInt(itemWithMultiply[4], 10),
        quantity: parseInt(itemWithMultiply[5], 10),
        unit: itemWithMultiply[6] || '',
      }

      if (itemWithMultiply[1] && itemWithMultiply[2]) {
        const month = itemWithMultiply[1].padStart(2, '0')
        const day = itemWithMultiply[2].padStart(2, '0')
        item.date = `${currentYear}-${month}-${day}`
      }

      result.items.push(item)
      continue
    }

    // 格式: 2/12 接機+市區 3200
    const itemWithDate = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})\s+(.+?)\s+([\d,]+)$/)
    if (itemWithDate) {
      const month = itemWithDate[1].padStart(2, '0')
      const day = itemWithDate[2].padStart(2, '0')
      const item: ParsedQuotationItem = {
        date: `${currentYear}-${month}-${day}`,
        description: itemWithDate[3].trim(),
        unitPrice: parseInt(itemWithDate[4].replace(/,/g, ''), 10),
        quantity: 1,
      }
      result.items.push(item)
      continue
    }

    // 格式: 保險 500
    const simpleItem = trimmed.match(/^([^\d]+?)\s+([\d,]+)$/)
    if (simpleItem && !trimmed.includes('小計') && !trimmed.includes('共')) {
      const item: ParsedQuotationItem = {
        description: simpleItem[1].trim(),
        unitPrice: parseInt(simpleItem[2].replace(/,/g, ''), 10),
        quantity: 1,
      }
      result.items.push(item)
    }
  }

  return result
}
