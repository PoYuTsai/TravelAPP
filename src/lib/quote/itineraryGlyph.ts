type GlyphItem = string | { label?: string; title?: string }

export interface ItineraryGlyphSource {
  title: string
  items?: GlyphItem[]
}

const ARRIVAL_RULES: [RegExp, string][] = [
  [/火車站|夜火車|火車|接站/i, '🚉'],
  [/送機|回國|返程|離境/i, '✈️'],
  [/抵達|機場|接機/i, '🛬'],
]

const DESTINATION_RULES: [RegExp, string][] = [
  [/南邦|馬車/i, '🐴'],
  [/金三角|湄公河|遊船|寮國|美塞|天空步道/i, '🚤'],
  [/茵他儂|主峰|雙龍塔|瓦吉拉|高山/i, '🏔️'],
  [/湄康蓬|愛泰村|拜縣|茶園|芳縣/i, '🌿'],
]

const ACTIVITY_RULES: [RegExp, string][] = [
  [/清萊一日|白廟|藍廟|黑廟|黑屋|長頸|觀音寺|寺|廟|temple/i, '🏛️'],
  [/大象(?!民宿)|象園|象保護|象互動/i, '🐘'],
  [/動物園|safari/i, '🦁'],
  [/泰服|攝影|拍照/i, '📸'],
  [/水上|泳|水樂園|峽谷/i, '🏊'],
  [/冒險|攀岩|繩索|叢林|Phoenix/i, '🎢'],
  [/瀑布|黏黏/i, '💦'],
  [/夜市|市集|週末|週日|週六|市場|Big\s?C/i, '🛍️'],
  [/按摩|spa|SPA|放鬆/i, '💆'],
  [/咖啡|下午茶/i, '☕'],
  [/料理|烹飪|廚藝|餐/i, '🍽️'],
]

function itemToText(item: GlyphItem) {
  if (typeof item === 'string') return item
  return [item.title, item.label].filter(Boolean).join(' ')
}

function matchGlyph(text: string, rules: [RegExp, string][]) {
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

export function inferItineraryGlyph(day: ItineraryGlyphSource, _index: number) {
  const title = day.title ?? ''
  const itemText = (day.items ?? []).map(itemToText).join(' ')
  const combinedText = `${title} ${itemText}`

  const arrivalGlyph = matchGlyph(title, ARRIVAL_RULES)
  if (arrivalGlyph) return arrivalGlyph

  const destinationGlyph = matchGlyph(combinedText, DESTINATION_RULES)
  if (destinationGlyph) return destinationGlyph

  // Route-only titles should feel like a chauffeured transfer, not a random activity.
  if (/(->|→|＞|>|到|前往)/.test(title)) return '🚐'

  const activityGlyph = matchGlyph(combinedText, ACTIVITY_RULES)
  if (activityGlyph) return activityGlyph

  return '🚐'
}
