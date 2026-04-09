import type { ParsedDay } from '@/lib/itinerary'

type ThaiDressPhotographerOptions = {
  isSelected: boolean
  people: number
  includeExtraPhotographer: boolean
}

const THAI_DRESS_KEYWORDS = [
  '泰服',
  'thai dress',
  '泰服體驗',
  '專業攝影師拍攝',
  '攝影師拍攝',
]

export function isThaiDressText(text: string) {
  const normalized = text.toLowerCase()

  return THAI_DRESS_KEYWORDS.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  )
}

export function detectThaiDressDay(days: ParsedDay[]) {
  for (const day of days) {
    const texts = [
      day.title,
      day.morning,
      day.afternoon,
      day.evening,
      day.lunch,
      day.dinner,
      day.accommodation,
      day.rawText,
      ...day.activities.map((activity) => activity.content),
    ].filter((value): value is string => Boolean(value?.trim()))

    if (texts.some((text) => isThaiDressText(text))) {
      return day.dayNumber
    }
  }

  return null
}

export function shouldOfferExtraPhotographer(people: number) {
  return people > 10
}

export function getThaiDressPhotographerCount({
  isSelected,
  people,
  includeExtraPhotographer,
}: ThaiDressPhotographerOptions) {
  if (!isSelected) return 0

  return 1 + (shouldOfferExtraPhotographer(people) && includeExtraPhotographer ? 1 : 0)
}

export function getThaiDressPhotographerLabel(count: number) {
  if (count <= 1) {
    return '攝影師 1 小時（1位，最多服務 10 位）'
  }

  return `攝影師 1 小時（${count}位，每位最多服務 10 位）`
}
