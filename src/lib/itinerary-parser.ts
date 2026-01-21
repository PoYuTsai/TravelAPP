// src/lib/itinerary-parser.ts
// 解析純文字行程格式，轉換成結構化資料

export interface ParsedActivity {
  time?: string
  content: string
}

export interface ParsedDay {
  date: string // YYYY-MM-DD
  dayNumber: number
  title: string
  morning: string
  afternoon: string
  evening: string
  lunch?: string
  dinner?: string
  activities: ParsedActivity[]
  rawText: string // 保留原始文字
}

export interface ParseResult {
  success: boolean
  days: ParsedDay[]
  errors: string[]
  year: number
}

// 星期對照表
const weekdayMap: Record<string, number> = {
  '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
  'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
}

/**
 * 解析日期字串，例如 "2/1 (日)" 或 "2/1(日)"
 */
function parseDateLine(line: string, year: number): { month: number; day: number } | null {
  // 匹配 "2/1" 或 "2/1 (日)" 或 "2/1(日)"
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
  // 匹配 "Day 1｜標題" 或 "Day 1|標題" 或 "Day1｜標題"
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
  const trimmed = line.trim()

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
 * 判斷是否為活動行（以 ・ 或 - 或 • 開頭）
 */
function isActivityLine(line: string): boolean {
  const trimmed = line.trim()
  return /^[・\-•·]/.test(trimmed)
}

/**
 * 判斷是否為晚上專屬內容（晚餐、住宿）
 */
function isEveningOnly(content: string): boolean {
  const eveningOnlyKeywords = ['晚餐', '住宿', 'dinner', 'hotel', 'check-in', 'checkin']
  for (const kw of eveningOnlyKeywords) {
    if (content.includes(kw) || content.toLowerCase().includes(kw)) {
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
 * 規則：
 * 1. 有午餐：午餐前→早，午餐後到晚餐前→午，晚餐和住宿→晚
 * 2. 沒午餐：自動分配讓午不為空，晚餐和住宿→晚
 */
function distributeActivities(
  activities: string[],
  lunch: string | undefined,
  dinner: string | undefined
): { morning: string; afternoon: string; evening: string } {
  const result = { morning: '', afternoon: '', evening: '' }

  if (activities.length === 0) return result

  // 找出午餐和晚餐的位置
  let lunchIndex = -1
  let dinnerIndex = -1

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i]
    if (lunchIndex === -1 && (act.includes('午餐') || act.match(/^(中餐|lunch)[：:]/i))) {
      lunchIndex = i
    }
    if (dinnerIndex === -1 && (act.includes('晚餐') || act.match(/^dinner[：:]/i))) {
      dinnerIndex = i
    }
  }

  // 分配活動
  const morningItems: string[] = []
  const afternoonItems: string[] = []
  const eveningItems: string[] = []

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i]

    // 晚餐和住宿固定放晚上
    if (isEveningOnly(act)) {
      eveningItems.push(act)
      continue
    }

    if (lunchIndex !== -1) {
      // 有午餐的情況
      if (i < lunchIndex) {
        morningItems.push(act)
      } else if (i === lunchIndex) {
        // 午餐本身可以放午，或不放（因為有 lunch 欄位）
        continue
      } else if (dinnerIndex !== -1 && i >= dinnerIndex) {
        eveningItems.push(act)
      } else {
        afternoonItems.push(act)
      }
    } else {
      // 沒有午餐的情況：自動分配
      if (dinnerIndex !== -1 && i >= dinnerIndex) {
        eveningItems.push(act)
      } else {
        // 計算應該放在早上還是下午
        // 晚餐前的活動，前半放早上，後半放下午
        const beforeDinner = dinnerIndex !== -1 ? dinnerIndex : activities.length
        const midPoint = Math.ceil(beforeDinner / 2)

        if (i < midPoint) {
          morningItems.push(act)
        } else {
          afternoonItems.push(act)
        }
      }
    }
  }

  result.morning = morningItems.join('\n')
  result.afternoon = afternoonItems.join('\n')
  result.evening = eveningItems.join('\n')

  return result
}

/**
 * 主解析函數
 */
export function parseItineraryText(text: string, year?: number): ParseResult {
  const lines = text.split('\n')
  const days: ParsedDay[] = []
  const errors: string[] = []

  // 自動判斷年份（預設使用今年或明年）
  const currentYear = new Date().getFullYear()
  const detectedYear = year || currentYear

  let currentDay: ParsedDay | null = null
  let dayRawLines: string[] = []
  let dayActivities: string[] = [] // 收集當天所有活動

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // 跳過空行
    if (!trimmedLine) {
      if (currentDay) dayRawLines.push(line)
      continue
    }

    // 檢查是否為日期行
    const dateInfo = parseDateLine(trimmedLine, detectedYear)
    if (dateInfo) {
      // 儲存前一天（先分配活動到時段）
      if (currentDay) {
        const distributed = distributeActivities(dayActivities, currentDay.lunch, currentDay.dinner)
        currentDay.morning = distributed.morning
        currentDay.afternoon = distributed.afternoon
        currentDay.evening = distributed.evening
        currentDay.rawText = dayRawLines.join('\n')
        days.push(currentDay)
      }

      // 開始新的一天
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

    // 如果還沒有開始任何一天，跳過
    if (!currentDay) continue

    dayRawLines.push(line)

    // 檢查是否為 Day 標題行
    const dayTitle = parseDayTitle(trimmedLine)
    if (dayTitle) {
      currentDay.dayNumber = dayTitle.dayNumber
      currentDay.title = dayTitle.title
      continue
    }

    // 檢查是否為餐點行
    const meal = parseMealLine(trimmedLine)
    if (meal) {
      if (meal.type === 'lunch' || meal.type === 'afternoon_tea') {
        currentDay.lunch = meal.content
      } else if (meal.type === 'dinner') {
        currentDay.dinner = meal.content
      }
      // 餐點也加入活動列表（用於分配判斷）
      dayActivities.push(trimmedLine)
      currentDay.activities.push({ content: trimmedLine })
      continue
    }

    // 檢查是否為活動行
    if (isActivityLine(trimmedLine)) {
      const content = cleanActivityContent(trimmedLine)
      dayActivities.push(content)
      currentDay.activities.push({ content })
      continue
    }

    // 其他行視為備註
    if (trimmedLine) {
      dayActivities.push(trimmedLine)
      currentDay.activities.push({ content: trimmedLine })
    }
  }

  // 儲存最後一天
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
 * 將結構化資料轉回 LINE 純文字格式
 */
export function formatToLineText(days: ParsedDay[]): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']

  return days.map((day) => {
    const date = new Date(day.date)
    const month = date.getMonth() + 1
    const dayNum = date.getDate()
    const weekday = weekdays[day.date ? new Date(day.date).getDay() : 0]

    let text = `${month}/${dayNum} (${weekday})\n`
    text += `Day ${day.dayNumber}｜${day.title}\n`

    // 早上活動
    if (day.morning) {
      day.morning.split('\n').forEach((line) => {
        if (line.trim()) text += `・${line.trim()}\n`
      })
    }

    // 午餐
    if (day.lunch) {
      text += `午餐：${day.lunch}\n`
    }

    // 下午活動
    if (day.afternoon) {
      day.afternoon.split('\n').forEach((line) => {
        if (line.trim()) text += `・${line.trim()}\n`
      })
    }

    // 晚餐
    if (day.dinner) {
      text += `晚餐：${day.dinner}\n`
    }

    // 晚上活動
    if (day.evening) {
      day.evening.split('\n').forEach((line) => {
        if (line.trim()) text += `・${line.trim()}\n`
      })
    }

    return text
  }).join('\n')
}

// ============================================
// 基本資訊解析
// ============================================

export interface ParsedBasicInfo {
  clientName?: string
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  adults?: number
  children?: number
  childrenAges?: string
  groupType?: string
  totalPeople?: number
  luggageNote?: string
  vehicleNote?: string
  guideNote?: string
}

/**
 * 解析基本資訊文字
 * 格式範例:
 * 客戶: 王小明
 * 日期: 2026/4/2~4/7
 * 人數: 4大2小 (5歲、3歲)
 * 團型: 親子團
 * 行李: 1台大約可以放6~7顆28~30吋
 * 包車: 2台10人座大車
 * 導遊: 中英泰導遊 1位
 */
export function parseBasicInfoText(text: string): ParsedBasicInfo {
  const result: ParsedBasicInfo = {}
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 客戶名稱：支援「客戶: xxx」或「客戶姓名: xxx」或「姓名: xxx」
    const clientMatch = trimmed.match(/^(客戶姓名|客戶|客人|姓名)[：:\s]\s*(.+)/i)
    if (clientMatch) {
      result.clientName = clientMatch[2].trim()
      continue
    }

    // 日期範圍: 2026/4/2~4/7 或 2026/4/2-4/7 或 2026-04-02~2026-04-07
    // 也支援「日期 2026/4/2~4/7」（沒有冒號）
    const dateMatch = trimmed.match(/^日期[：:\s]\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*[~\-～]\s*(?:(\d{4})[\/\-])?(\d{1,2})[\/\-]?(\d{1,2})?/i)
    if (dateMatch) {
      const startYear = dateMatch[1]
      const startMonth = dateMatch[2].padStart(2, '0')
      const startDay = dateMatch[3].padStart(2, '0')
      result.startDate = `${startYear}-${startMonth}-${startDay}`

      // 結束日期可能省略年份
      const endYear = dateMatch[4] || startYear
      const endMonth = dateMatch[5]?.padStart(2, '0') || startMonth
      const endDay = dateMatch[6]?.padStart(2, '0') || dateMatch[5]?.padStart(2, '0')
      if (endMonth && endDay) {
        result.endDate = `${endYear}-${endMonth}-${endDay}`
      }
      continue
    }

    // 人數: 4大2小 或 2大1小(5歲) 或 4大2小 (5歲、3歲)
    // 也支援沒有前綴的格式：4大2小
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

    // 支援: 成人3 小朋友2 或 成人3 (1長者) 小朋友2 (國中生*2)
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

    // 支援: 人數: 5人 或 總人數: 6
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

// ============================================
// 報價明細解析
// ============================================

export interface ParsedQuotationItem {
  date?: string // YYYY-MM-DD
  description: string
  unitPrice: number
  quantity: number
  unit?: string
}

export interface ParsedQuotation {
  items: ParsedQuotationItem[]
  total?: number
  note?: string
}

/**
 * 解析報價文字
 * 格式範例:
 * 2/12 接機+市區 3200
 * 2/13 湄康蓬 3800
 * 導遊 2500*6天
 * 保險 500
 * 小計: 38700
 */
export function parseQuotationText(text: string, year?: number): ParsedQuotation {
  const result: ParsedQuotation = { items: [] }
  const lines = text.split('\n')
  const currentYear = year || new Date().getFullYear()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳過總計、共、優惠等行
    if (trimmed.match(/^(共|=|給優惠|車[：:]|導遊\d|總計)/)) {
      continue
    }

    // 小計行: 車費+導遊費小計: 84000 或 小計: 38700
    const totalMatch = trimmed.match(/小計[：:]\s*([\d,]+)/i)
    if (totalMatch) {
      result.total = parseInt(totalMatch[1].replace(/,/g, ''), 10)
      continue
    }

    // 備註行
    if (trimmed.startsWith('備註') || trimmed.startsWith('注意')) {
      result.note = trimmed.replace(/^(備註|注意)[：:]?\s*/i, '')
      continue
    }

    // 格式1: 日期 項目 單價*數量單位 (例: 導遊 2500*6天)
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

    // 格式2: 日期 項目 金額 (例: 2/12 接機+市區 3200)
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

    // 格式3: 項目 金額 (例: 保險 500)
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

/**
 * 從 Sanity 資料格式轉成 LINE 純文字
 */
export function sanityToLineText(itinerary: {
  clientName?: string
  days?: Array<{
    date: string
    title: string
    morning?: string
    afternoon?: string
    evening?: string
    lunch?: string
    dinner?: string
  }>
}): string {
  if (!itinerary.days || itinerary.days.length === 0) {
    return '（無行程資料）'
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六']

  const lines: string[] = []

  if (itinerary.clientName) {
    lines.push(`【${itinerary.clientName} 行程】\n`)
  }

  itinerary.days.forEach((day, index) => {
    const date = new Date(day.date)
    const month = date.getMonth() + 1
    const dayNum = date.getDate()
    const weekday = weekdays[date.getDay()]

    lines.push(`${month}/${dayNum} (${weekday})`)
    lines.push(`Day ${index + 1}｜${day.title || ''}`)

    // 早上
    if (day.morning) {
      day.morning.split('\n').forEach((line) => {
        if (line.trim()) lines.push(`・${line.trim()}`)
      })
    }

    // 午餐
    if (day.lunch) {
      lines.push(`午餐：${day.lunch}`)
    }

    // 下午
    if (day.afternoon) {
      day.afternoon.split('\n').forEach((line) => {
        if (line.trim()) lines.push(`・${line.trim()}`)
      })
    }

    // 晚餐
    if (day.dinner) {
      lines.push(`晚餐：${day.dinner}`)
    }

    // 晚上
    if (day.evening) {
      day.evening.split('\n').forEach((line) => {
        if (line.trim()) lines.push(`・${line.trim()}`)
      })
    }

    lines.push('') // 空行分隔
  })

  return lines.join('\n')
}

/**
 * 從 Sanity 資料格式轉成基本資訊文字
 */
export function sanityToBasicInfoText(data: {
  clientName?: string
  startDate?: string
  endDate?: string
  adults?: number
  children?: number
  childrenAges?: string
  totalPeople?: number
  luggageNote?: string
  vehicleNote?: string
  guideNote?: string
}): string {
  const lines: string[] = []

  if (data.clientName) {
    lines.push(`客戶姓名: ${data.clientName}`)
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    const startStr = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()}`
    const endStr = `${end.getMonth() + 1}/${end.getDate()}`
    lines.push(`日期: ${startStr}~${endStr}`)
  }

  if (data.adults || data.children) {
    let peopleStr = ''
    if (data.adults) peopleStr += `成人${data.adults}`
    if (data.children) {
      peopleStr += ` 小朋友${data.children}`
      if (data.childrenAges) peopleStr += ` (${data.childrenAges})`
    }
    lines.push(`人數: ${data.totalPeople || (data.adults || 0) + (data.children || 0)}人`)
    lines.push(peopleStr)
  }

  if (data.luggageNote) {
    lines.push(`行李: ${data.luggageNote}`)
  }

  if (data.vehicleNote) {
    lines.push(`包車: ${data.vehicleNote}`)
  }

  if (data.guideNote) {
    lines.push(`導遊: ${data.guideNote}`)
  }

  return lines.join('\n')
}

/**
 * 從 Sanity 資料格式轉成報價文字
 */
export function sanityToQuotationText(items: Array<{
  date?: string
  description: string
  unitPrice: number
  quantity: number
  unit?: string
}>, total?: number): string {
  const lines: string[] = []

  items.forEach((item) => {
    let line = ''

    // 有日期的項目
    if (item.date) {
      const date = new Date(item.date)
      const month = date.getMonth() + 1
      const day = date.getDate()
      line += `${month}/${day} `
    }

    line += item.description

    // 有數量的項目
    if (item.quantity > 1) {
      line += ` ${item.unitPrice}*${item.quantity}${item.unit || '天'}`
    } else {
      line += ` ${item.unitPrice}`
    }

    lines.push(line)
  })

  if (total) {
    lines.push(`小計: ${total}`)
  }

  return lines.join('\n')
}
