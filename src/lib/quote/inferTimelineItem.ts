export type ItemKind = 'transport' | 'meal' | 'snack' | 'activity' | 'stop'

export interface TimelineItem {
  label: string
  kind: ItemKind
  icon: string
  time: string // "HH:MM" format
}

// --- Keyword rules (order matters: first match wins) ---

const kindRules: { kind: ItemKind; pattern: RegExp }[] = [
  { kind: 'transport', pattern: /接機|送機|機場|出發|check\s?out|checkout|車程|搭車|前往/i },
  { kind: 'meal',      pattern: /午餐|晚餐|早餐|用餐|餐廳|吃到飽|火鍋|燒烤|buffet|米其林|帝王餐/i },
  { kind: 'snack',     pattern: /下午茶|甜點|咖啡|冰淇淋|芒果|奶茶|點心/i },
  { kind: 'stop',      pattern: /check\s?in|checkin|飯店|入住|採買|商場|市場|換匯|超市|big\s?c|7-11|紀念品/i },
]

function inferKind(text: string): ItemKind {
  for (const rule of kindRules) {
    if (rule.pattern.test(text)) return rule.kind
  }
  return 'activity'
}

// --- Icon logic ---

const defaultIcons: Record<ItemKind, string> = {
  transport: 'Car',
  meal: 'UtensilsCrossed',
  snack: 'Coffee',
  activity: 'Sparkles',
  stop: 'MapPin',
}

const iconOverrides: { pattern: RegExp; icon: string }[] = [
  { pattern: /接機|送機|機場|航班|飛機/i, icon: 'Plane' },
  { pattern: /大象/i,                     icon: 'Heart' },
  { pattern: /瀑布|水上|泳/i,             icon: 'Droplets' },
  { pattern: /動物園|safari/i,            icon: 'Moon' },
  { pattern: /夜市/i,                     icon: 'ShoppingBag' },
  { pattern: /寺|廟|temple|博物館|黑屋/i,   icon: 'Building' },
  { pattern: /攀岩|冒險|繩索|溜索/i,       icon: 'MountainSnow' },
  { pattern: /泰服|拍照|攝影/i,            icon: 'Camera' },
  { pattern: /按摩|spa/i,                 icon: 'Heart' },
  { pattern: /換匯/i,                     icon: 'Coins' },
]

function inferIcon(text: string, kind: ItemKind): string {
  for (const override of iconOverrides) {
    if (override.pattern.test(text)) return override.icon
  }
  return defaultIcons[kind]
}

// --- Time estimation (kind-aware) ---

/**
 * Extract time from text. Special handling:
 * - 接機/航班 "7:20~10:35" → 取到達時間 10:35 + 30 分鐘（出關領行李）
 * - 送機 "11:50~16:30" → 取起飛前 2 小時 = 09:50（提前到機場）
 * - 一般 "已預約17:00" → 直接用
 */
function extractTime(text: string, kind: ItemKind): string | null {
  // 航班時間格式：7:20~10:35 或 7:20-10:35
  const flightMatch = text.match(/(\d{1,2})[：:](\d{2})\s*[~\-]\s*(\d{1,2})[：:](\d{2})/)
  if (flightMatch) {
    if (/接機|抵達/.test(text)) {
      // 接機：到達時間 + 30 分鐘
      const h = parseInt(flightMatch[3], 10)
      const m = parseInt(flightMatch[4], 10) + 30
      const totalMin = h * 60 + m
      return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
    }
    if (/送機/.test(text)) {
      // 送機：起飛時間 - 2 小時
      const h = parseInt(flightMatch[1], 10)
      const m = parseInt(flightMatch[2], 10)
      const totalMin = Math.max(h * 60 + m - 120, 7 * 60)
      return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
    }
  }

  // 一般時間：取最後一個出現的時間（避免抓到起飛時間）
  const matches = Array.from(text.matchAll(/(\d{1,2})[：:](\d{2})/g))
  if (matches.length === 0) return null
  const last = matches[matches.length - 1]
  const h = parseInt(last[1], 10)
  const m = parseInt(last[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Smart time estimation based on item kind and position.
 * Uses realistic travel schedule anchors:
 *   早餐 ~07:30, 出發 ~08:00-09:00, 午餐 ~12:00, 下午茶 ~15:00,
 *   晚餐 ~18:30, check in ~16:00-17:00, 夜間活動 ~19:00-20:00
 */
function inferSmartTime(kind: ItemKind, text: string, index: number, total: number): string {
  // Anchor times for known meal types
  if (/早餐/.test(text)) return '07:30'
  if (/午餐/.test(text)) return '12:00'
  if (/下午茶|芒果|甜點|點心/.test(text)) return '15:00'
  if (/晚餐/.test(text)) return '18:30'
  if (/人妖秀|夜間|night/i.test(text)) return '20:00'
  if (/check\s*in|入住/i.test(text)) return '16:00'
  if (/按摩|spa/i.test(text)) return '17:00'

  // For non-anchored items, distribute based on position in the day
  // Morning items (before lunch): 08:00 - 11:30
  // Afternoon items (after lunch): 13:30 - 17:30

  // Find how many non-meal items there are and this item's position among them
  const morningEnd = 11 * 60 + 30  // 11:30
  const afternoonStart = 13 * 60 + 30  // 13:30
  const eveningStart = 17 * 60 + 30  // 17:30

  // Simple distribution: spread items across the day
  const dayStart = 8 * 60  // 08:00
  const dayEnd = 18 * 60   // 18:00
  const slot = total > 1
    ? dayStart + (index / (total - 1)) * (dayEnd - dayStart)
    : dayStart + 60

  // Skip lunch zone (12:00-13:00)
  let adjusted = slot
  if (adjusted >= 12 * 60 && adjusted < 13 * 60) {
    adjusted = index < total / 2 ? 11 * 60 + 30 : 13 * 60 + 30
  }

  const capped = Math.min(Math.max(adjusted, dayStart), 21 * 60)
  const h = Math.floor(capped / 60)
  const m = Math.round((capped % 60) / 30) * 30
  return `${String(h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`
}

export function inferTimelineItem(text: string, index: number, total?: number): TimelineItem {
  const kind = inferKind(text)
  const icon = inferIcon(text, kind)
  const time = extractTime(text, kind) || inferSmartTime(kind, text, index, total ?? (index + 3))

  return {
    label: text,
    kind,
    icon,
    time,
  }
}
