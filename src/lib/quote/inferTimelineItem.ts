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
  { pattern: /寺|廟|temple/i,             icon: 'Building' },
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

// --- Time estimation ---

const DAY_START_HOUR = 8
const DAY_START_MIN = 30
const GAP_MINUTES = 100 // ~1h40m between items
const MAX_HOUR = 21

function inferTime(index: number): string {
  const totalMinutes = DAY_START_HOUR * 60 + DAY_START_MIN + index * GAP_MINUTES
  const capped = Math.min(totalMinutes, MAX_HOUR * 60)
  const h = Math.floor(capped / 60)
  const m = capped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// --- Main export ---

export function inferTimelineItem(text: string, index: number): TimelineItem {
  const kind = inferKind(text)
  const icon = inferIcon(text, kind)
  const time = inferTime(index)

  return {
    label: text,
    kind,
    icon,
    time,
  }
}
