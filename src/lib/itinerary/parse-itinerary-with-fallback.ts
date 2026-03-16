import type { ParseResult, ParsedDay } from './types'
import { parseItineraryText as parseItineraryTextBase } from './parser'

const STANDALONE_DATE_RE = /^(\d{1,2})\/(\d{1,2})\s*(?:\([^)]*\))?$/
const DAY_TITLE_RE = /^Day\s*(\d+)(?:\s*[|｜:：-]\s*)?(.*)$/i

function countStandaloneDateLines(text: string): number {
  return text
    .split('\n')
    .filter((line) => STANDALONE_DATE_RE.test(line.trim()))
    .length
}

function stripBullet(line: string): string {
  return line.trim().replace(/^[\s\-•●▪■◆◇☆★☑✓✔►▶▸▹▷→]+/, '').trim()
}

function parseMeal(line: string): { type: 'lunch' | 'dinner'; content: string } | null {
  const trimmed = stripBullet(line)

  if (/^(午餐|lunch|afternoon tea|下午茶)\s*[:：]?\s*/i.test(trimmed)) {
    return {
      type: 'lunch',
      content: trimmed.replace(/^(午餐|lunch|afternoon tea|下午茶)\s*[:：]?\s*/i, '').trim(),
    }
  }

  if (/^(晚餐|dinner)\s*[:：]?\s*/i.test(trimmed)) {
    return {
      type: 'dinner',
      content: trimmed.replace(/^(晚餐|dinner)\s*[:：]?\s*/i, '').trim(),
    }
  }

  return null
}

function parseAccommodation(line: string): string | null {
  const trimmed = stripBullet(line)
  const match = trimmed.match(/^(住宿|accommodation|hotel)\s*[:：]?\s*(.+)$/i)
  return match?.[2]?.trim() || null
}

function isEveningOnly(content: string): boolean {
  const normalized = content.toLowerCase()
  return normalized.includes('夜市') || normalized.includes('night market')
}

function distributeActivities(
  activities: string[],
  dinner?: string
): { morning: string; afternoon: string; evening: string } {
  const morningItems: string[] = []
  const afternoonItems: string[] = []
  const eveningItems: string[] = []
  const regularActivities: string[] = []

  for (const activity of activities) {
    if (isEveningOnly(activity)) {
      eveningItems.push(activity)
    } else {
      regularActivities.push(activity)
    }
  }

  const midpoint = Math.ceil(regularActivities.length / 2)
  regularActivities.forEach((activity, index) => {
    if (index < midpoint) {
      morningItems.push(activity)
    } else {
      afternoonItems.push(activity)
    }
  })

  if (dinner) {
    eveningItems.push(`晚餐：${dinner}`)
  }

  return {
    morning: morningItems.join('\n'),
    afternoon: afternoonItems.join('\n'),
    evening: eveningItems.join('\n'),
  }
}

function buildDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fallbackParseItineraryText(text: string, year?: number): ParseResult {
  const detectedYear = year || new Date().getFullYear()
  const lines = text.split('\n')
  const days: ParsedDay[] = []

  let currentDay: {
    month: number
    day: number
    dayNumber: number
    title: string
    lunch?: string
    dinner?: string
    accommodation?: string
    rawLines: string[]
    activities: string[]
    parsedActivities: { content: string }[]
  } | null = null

  const finalizeDay = () => {
    if (!currentDay) return

    const distributed = distributeActivities(currentDay.activities, currentDay.dinner)
    days.push({
      date: buildDate(detectedYear, currentDay.month, currentDay.day),
      dayNumber: currentDay.dayNumber,
      title: currentDay.title,
      morning: distributed.morning,
      afternoon: distributed.afternoon,
      evening: distributed.evening,
      lunch: currentDay.lunch,
      dinner: currentDay.dinner,
      accommodation: currentDay.accommodation,
      activities: currentDay.parsedActivities,
      rawText: currentDay.rawLines.join('\n'),
    })

    currentDay = null
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()

    if (!trimmed) {
      if (currentDay) {
        currentDay.rawLines.push(rawLine)
      }
      continue
    }

    const dateMatch = trimmed.match(STANDALONE_DATE_RE)
    if (dateMatch) {
      finalizeDay()
      currentDay = {
        month: parseInt(dateMatch[1], 10),
        day: parseInt(dateMatch[2], 10),
        dayNumber: days.length + 1,
        title: '',
        rawLines: [rawLine],
        activities: [],
        parsedActivities: [],
      }
      continue
    }

    if (!currentDay) {
      continue
    }

    currentDay.rawLines.push(rawLine)

    const dayTitle = trimmed.match(DAY_TITLE_RE)
    if (dayTitle) {
      currentDay.dayNumber = parseInt(dayTitle[1], 10)
      currentDay.title = dayTitle[2]?.trim() || ''
      continue
    }

    const meal = parseMeal(trimmed)
    if (meal) {
      if (meal.type === 'lunch') {
        currentDay.lunch = meal.content
      } else {
        currentDay.dinner = meal.content
      }
      currentDay.parsedActivities.push({ content: trimmed })
      continue
    }

    const accommodation = parseAccommodation(trimmed)
    if (accommodation) {
      currentDay.accommodation = accommodation
      currentDay.parsedActivities.push({ content: `住宿: ${accommodation}` })
      continue
    }

    const cleaned = stripBullet(trimmed)
    if (cleaned) {
      currentDay.activities.push(cleaned)
      currentDay.parsedActivities.push({ content: cleaned })
    }
  }

  finalizeDay()

  return {
    success: days.length > 0,
    days,
    errors: [],
    warnings: [],
    year: detectedYear,
  }
}

export function parseItineraryText(text: string, year?: number): ParseResult {
  const baseResult = parseItineraryTextBase(text, year)
  const standaloneDateCount = countStandaloneDateLines(text)

  if (standaloneDateCount === 0 || baseResult.days.length >= standaloneDateCount) {
    return baseResult
  }

  const fallbackResult = fallbackParseItineraryText(text, year)
  return fallbackResult.days.length > baseResult.days.length ? fallbackResult : baseResult
}
