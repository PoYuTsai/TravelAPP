// src/lib/itinerary/activity-matcher.ts
// 智能活動匹配器 - 將行程文字中的活動匹配到資料庫

import type { ParseResult, ParsedDay } from './types'

/**
 * 活動資料庫的項目類型（來自 Sanity）
 */
export interface ActivityRecord {
  _id: string
  name: string
  keywords: string[]
  activityType: 'ticket' | 'experience' | 'free'
  location?: string
  adultPrice: number
  childPrice?: number
  rebate: number
  splitRebate: boolean
  exclusiveGroup?: string
  isDefaultInGroup?: boolean
  isActive: boolean
  sortOrder?: number
}

/**
 * 匹配結果
 */
export interface MatchedActivity {
  activityId: string
  activityName: string
  matchedText: string
  dayNumber: number
  price: number
  rebate: number
  splitRebate: boolean
  exclusiveGroup?: string
  isDefaultInGroup?: boolean
  confidence: 'high' | 'medium' | 'low'
}

export interface UnmatchedActivity {
  text: string
  dayNumber: number
  suggestedKeywords: string[]
}

export interface ExtractedDate {
  dayNumber: number
  date: string
  dayLabel: string // D1, D2, etc.
}

export interface ExtractedHotel {
  name: string
  dayNumber: number
  nights?: number
}

export interface ActivityMatchResult {
  matched: MatchedActivity[]
  unmatched: UnmatchedActivity[]
  dates: ExtractedDate[]
  hotels: ExtractedHotel[]
}

/**
 * 活動關鍵字 - 用於識別行程中的可能活動
 * 這些詞出現時表示可能是付費活動
 */
const ACTIVITY_INDICATORS = [
  // 動物相關
  '大象', 'elephant', '象營', '湄登', 'maetang',
  '夜間動物園', 'night safari', '動物園',
  '蛇園', 'snake',
  '老虎', 'tiger',

  // 冒險活動
  '射擊', 'shooting', '靶場',
  '飛索', 'zipline', 'coaster', '叢林',
  '水上樂園', 'waterpark',
  'atv', '越野',

  // 表演
  '人妖秀', '人妖', 'cabaret',

  // 景點門票
  '白廟', 'white temple',
  '藍廟', 'blue temple',
  '黑廟', 'black temple', '黑屋',
  '長頸村', 'long neck', '長頸族',

  // 體驗活動
  '泰服', 'thai dress', '攝影',
  '按摩', 'spa', 'massage',
  '烹飪', 'cooking',
  '豬豬', '溜滑梯',
]

/**
 * 從單行文字中提取可能的活動
 */
function extractPossibleActivities(line: string): string[] {
  const activities: string[] = []
  const normalized = line.toLowerCase()

  for (const indicator of ACTIVITY_INDICATORS) {
    if (normalized.includes(indicator.toLowerCase())) {
      activities.push(line.trim())
      break
    }
  }

  return activities
}

/**
 * 計算兩個字串的匹配分數
 */
function calculateMatchScore(text: string, keywords: string[]): number {
  const normalizedText = text.toLowerCase()
  let score = 0
  let matchedKeywords = 0

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase()
    if (normalizedText.includes(normalizedKeyword)) {
      // 關鍵字越長，分數越高
      score += normalizedKeyword.length
      matchedKeywords++
    }
  }

  // 如果匹配多個關鍵字，給予額外分數
  if (matchedKeywords > 1) {
    score *= 1.5
  }

  return score
}

/**
 * 判斷匹配信心度
 */
function getConfidence(score: number, keywordCount: number): 'high' | 'medium' | 'low' {
  const avgScore = score / Math.max(keywordCount, 1)
  if (avgScore >= 5) return 'high'
  if (avgScore >= 3) return 'medium'
  return 'low'
}

/**
 * 從解析後的行程中匹配活動到資料庫
 */
export function matchActivitiesToDatabase(
  parseResult: ParseResult,
  activities: ActivityRecord[]
): ActivityMatchResult {
  const matched: MatchedActivity[] = []
  const unmatched: UnmatchedActivity[] = []
  const dates: ExtractedDate[] = []
  const hotels: ExtractedHotel[] = []

  // 建立活動索引（只處理啟用的活動）
  const activeActivities = activities.filter(a => a.isActive)

  // 處理每一天
  for (const day of parseResult.days) {
    // 提取日期
    dates.push({
      dayNumber: day.dayNumber,
      date: day.date,
      dayLabel: `D${day.dayNumber}`,
    })

    // 提取住宿
    if (day.accommodation) {
      hotels.push({
        name: day.accommodation,
        dayNumber: day.dayNumber,
      })
    }

    // 處理該天的活動
    const dayActivities = [
      ...day.activities.map(a => a.content),
      day.morning,
      day.afternoon,
      day.evening,
    ].filter(Boolean)

    for (const activityText of dayActivities) {
      // 跳過餐點和住宿
      if (activityText.match(/^(早餐|午餐|晚餐|住宿)[：:]/)) continue

      // 檢查是否包含活動關鍵字
      const possibleActivities = extractPossibleActivities(activityText)
      if (possibleActivities.length === 0) continue

      // 嘗試匹配資料庫中的活動
      let bestMatch: { activity: ActivityRecord; score: number } | null = null

      for (const activity of activeActivities) {
        const score = calculateMatchScore(activityText, activity.keywords || [])

        // 也嘗試用活動名稱匹配
        const nameScore = activityText.toLowerCase().includes(activity.name.toLowerCase())
          ? activity.name.length * 2
          : 0

        const totalScore = score + nameScore

        if (totalScore > 0 && (!bestMatch || totalScore > bestMatch.score)) {
          bestMatch = { activity, score: totalScore }
        }
      }

      if (bestMatch && bestMatch.score >= 3) {
        // 檢查是否已經匹配過同一個活動
        const alreadyMatched = matched.some(
          m => m.activityId === bestMatch!.activity._id && m.dayNumber === day.dayNumber
        )

        if (!alreadyMatched) {
          matched.push({
            activityId: bestMatch.activity._id,
            activityName: bestMatch.activity.name,
            matchedText: activityText,
            dayNumber: day.dayNumber,
            price: bestMatch.activity.adultPrice,
            rebate: bestMatch.activity.rebate,
            splitRebate: bestMatch.activity.splitRebate,
            exclusiveGroup: bestMatch.activity.exclusiveGroup,
            isDefaultInGroup: bestMatch.activity.isDefaultInGroup,
            confidence: getConfidence(bestMatch.score, (bestMatch.activity.keywords || []).length),
          })
        }
      } else {
        // 未匹配的活動
        const alreadyUnmatched = unmatched.some(
          u => u.text === activityText && u.dayNumber === day.dayNumber
        )

        if (!alreadyUnmatched) {
          unmatched.push({
            text: activityText,
            dayNumber: day.dayNumber,
            suggestedKeywords: extractSuggestedKeywords(activityText),
          })
        }
      }
    }
  }

  return { matched, unmatched, dates, hotels }
}

/**
 * 從文字中提取建議的關鍵字
 */
function extractSuggestedKeywords(text: string): string[] {
  const keywords: string[] = []

  // 移除常見的非關鍵字
  const cleaned = text
    .replace(/^[・\-•·]\s*/, '')
    .replace(/[，。、]/g, ' ')
    .trim()

  // 分割成詞
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2)

  // 取前3個有意義的詞作為建議關鍵字
  for (const word of words.slice(0, 3)) {
    if (!keywords.includes(word)) {
      keywords.push(word)
    }
  }

  return keywords
}

/**
 * 直接從文字解析並匹配活動
 * 結合 parseItineraryText 和 matchActivitiesToDatabase
 */
export function parseAndMatchActivities(
  text: string,
  activities: ActivityRecord[],
  year?: number
): ActivityMatchResult {
  // 動態導入避免循環依賴
  const { parseItineraryText } = require('./parser')
  const parseResult = parseItineraryText(text, year)
  return matchActivitiesToDatabase(parseResult, activities)
}

/**
 * 處理互斥群組
 * 當選擇一個活動時，取消同群組的其他活動
 */
export function handleExclusiveGroup(
  selectedActivities: MatchedActivity[],
  newSelection: MatchedActivity
): MatchedActivity[] {
  if (!newSelection.exclusiveGroup) {
    // 沒有互斥群組，直接添加
    return [...selectedActivities, newSelection]
  }

  // 移除同群組的其他活動
  const filtered = selectedActivities.filter(
    a => a.exclusiveGroup !== newSelection.exclusiveGroup
  )

  return [...filtered, newSelection]
}

/**
 * 根據資料庫設定，取得每個互斥群組的預設選項
 */
export function getDefaultSelections(activities: ActivityRecord[]): string[] {
  const defaultIds: string[] = []
  const seenGroups = new Set<string>()

  for (const activity of activities) {
    if (activity.exclusiveGroup && activity.isDefaultInGroup && !seenGroups.has(activity.exclusiveGroup)) {
      defaultIds.push(activity._id)
      seenGroups.add(activity.exclusiveGroup)
    }
  }

  return defaultIds
}
