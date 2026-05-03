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
  '鳳凰冒險', 'phoenix', 'adventure park',

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
  '泰拳', 'muay thai',
  '騎馬', 'horse', '馬場', '馬車', '馬車遊城',

  // 特色景點/活動
  '康托克', 'khantoke', '帝王餐', '帝王宴', '文化表演',
  '天使瀑布', 'dantewada', '仙境造景',
  '造紙', '粑粑', '便便', 'poop', 'paper park',
  '夜火車', '火車票', '臥鋪',
  '茵他儂', 'doi inthanon', '國王皇后雙塔', '雙塔', '雙龍塔',
  '南邦鑾寺', 'wat phra that lampang luang', 'museum lampang',
]

/**
 * 備註關鍵字 - 這些詞出現時表示該活動應該被忽略
 * 用於處理「老虎園關園」這類備註
 */
const IGNORE_INDICATORS = [
  '關園', '關閉', '停業', '暫停',
  '休息', '整修', '維修', '取消',
  '大象民宿', '大象叫澡', '大象叫早',
  '火車票代訂', '參考票價', '建議配置',
  '臥鋪冷氣」估算', '臥鋪冷氣估算',
  '若想升級', '實際票價', '開票系統',
  '無法保證', '指定車次', '指定上下舖',
  'closed', 'closed temporarily',
]

/**
 * 檢查行程文字是否應該被忽略（備註）
 */
function shouldIgnoreActivity(line: string): boolean {
  const normalized = line.toLowerCase()

  for (const indicator of IGNORE_INDICATORS) {
    if (normalized.includes(indicator.toLowerCase())) {
      return true
    }
  }

  return false
}

function normalizeMatchingText(text: string): string {
  return text.toLowerCase().replace(/(\d)\s+公里/g, '$1公里')
}

function getActivityNameDedupKey(name: string): string {
  return normalizeMatchingText(name)
    .replace(/^(票券|活動|代訂)\s*[｜|]\s*/, '')
    .replace(/(門票|票券|入場券)$/g, '')
    .replace(/\s+/g, '')
}

function isPreferredActivityMatch(
  candidate: { activity: ActivityRecord; score: number },
  current: { activity: ActivityRecord; score: number }
): boolean {
  const candidateHasChildPrice = candidate.activity.childPrice !== undefined
  const currentHasChildPrice = current.activity.childPrice !== undefined
  if (candidateHasChildPrice !== currentHasChildPrice) {
    return candidateHasChildPrice
  }

  return candidate.score > current.score
}

const DERIVED_NAME_KEYWORDS = [
  '曼谷－清邁夜火車',
  '曼谷-清邁夜火車',
  '夜火車',
  '火車票',
  '臥鋪',
  '一等',
  '二等',
  '上鋪',
  '下鋪',
  '南邦馬車遊城',
  '馬車遊城',
  '馬車',
  '3公里',
  '5公里',
  '包車自由路線',
  '茵他儂國家公園',
  '茵他儂',
  '國王皇后雙塔',
  '雙龍塔',
  '雙塔',
  '南邦鑾寺',
  'Wat Phra That Lampang Luang',
  '大象便便',
  '大象粑粑',
  '造紙',
  '鳳凰冒險公園',
]

const OPTION_DISCRIMINATORS = [
  '一等',
  '二等',
  '上鋪',
  '下鋪',
  '3公里',
  '5公里',
  '包車自由路線',
]

function getActivityKeywords(activity: ActivityRecord): string[] {
  const keywords = new Set(activity.keywords || [])
  const normalizedName = normalizeMatchingText(activity.name)

  for (const keyword of DERIVED_NAME_KEYWORDS) {
    if (normalizedName.includes(normalizeMatchingText(keyword))) {
      keywords.add(keyword)
    }
  }

  return Array.from(keywords)
}

function hasMissingRequiredOption(text: string, activityName: string): boolean {
  const normalizedText = normalizeMatchingText(text)
  const normalizedName = normalizeMatchingText(activityName)
  const requiredOptions = OPTION_DISCRIMINATORS.filter((option) =>
    normalizedName.includes(normalizeMatchingText(option))
  )

  return requiredOptions.some((option) => !normalizedText.includes(normalizeMatchingText(option)))
}

/**
 * 從單行文字中提取可能的活動
 */
function extractPossibleActivities(line: string): string[] {
  const activities: string[] = []
  const normalized = normalizeMatchingText(line)

  // 先檢查是否應該忽略（備註中的關園、關閉等）
  if (shouldIgnoreActivity(line)) {
    return activities
  }

  for (const indicator of ACTIVITY_INDICATORS) {
    if (normalized.includes(normalizeMatchingText(indicator))) {
      activities.push(line.trim())
      break
    }
  }

  return activities
}

/**
 * 計算編輯距離（Levenshtein Distance）
 * 用於處理打錯字的情況
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替換
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 刪除
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * 常見中文打錯字映射（同音字、形近字）
 */
const TYPO_MAPPINGS: Record<string, string[]> = {
  // 活動相關
  '泰拳': ['太拳', '太全', '泰全', '台拳'],
  '射擊': ['設擊', '涉擊', '社擊'],
  '大象': ['大相', '大像'],
  '飛索': ['飛鎖', '非索'],
  '夜市': ['葉市', '業市'],
  '按摩': ['安摩', '暗摩'],
  '白廟': ['白苗', '拜廟'],
  '藍廟': ['蘭廟', '蘭苗'],
  '黑廟': ['黑苗', '嘿廟'],
  '長頸族': ['長頸足', '長莖族'],
  '泰服': ['台服', '太服'],
  '動物園': ['動物原', '動物元'],
  '保護營': ['保護贏', '保護銀'],
  '叢林': ['從林', '蔥林'],
  '國家公園': ['國家公源', '國家功園'],
  '瀑布': ['瀑不', '瀑步'],
  '溫泉': ['溫全', '溫泉'],
}

/**
 * 檢查是否有常見打錯字
 */
function checkTypoMatch(text: string, keyword: string): boolean {
  // 先檢查直接包含
  if (text.includes(keyword)) return true

  // 檢查是否有已知的打錯字
  const typos = TYPO_MAPPINGS[keyword]
  if (typos) {
    for (const typo of typos) {
      if (text.includes(typo)) return true
    }
  }

  return false
}

/**
 * 模糊匹配 - 只處理已知打錯字，不使用 Levenshtein 距離
 *
 * 原因：Levenshtein 距離會造成語義不同的詞誤判
 * 例如「泰服體驗」和「泰拳體驗」距離=1，但完全是不同活動
 *
 * 只允許：
 * 1. 精確包含匹配
 * 2. TYPO_MAPPINGS 中定義的已知打錯字
 */
function fuzzyMatch(text: string, keyword: string): { matched: boolean; score: number } {
  const normalizedText = normalizeMatchingText(text)
  const normalizedKeyword = normalizeMatchingText(keyword)

  // 直接包含（精確匹配）
  if (normalizedText.includes(normalizedKeyword)) {
    return { matched: true, score: normalizedKeyword.length * 2 }
  }

  // 對於中文，只檢查已知的打錯字映射
  // 不使用 Levenshtein 距離，避免「泰服」→「泰拳」這類誤判
  if (checkTypoMatch(text, keyword)) {
    return { matched: true, score: keyword.length * 1.5 }
  }

  return { matched: false, score: 0 }
}

/**
 * 計算兩個字串的匹配分數（含模糊匹配）
 */
function calculateMatchScore(text: string, keywords: string[]): number {
  const normalizedText = normalizeMatchingText(text)
  let score = 0
  let matchedKeywords = 0

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeMatchingText(keyword)

    // 先嘗試精確匹配
    if (normalizedText.includes(normalizedKeyword)) {
      score += normalizedKeyword.length * 2
      matchedKeywords++
      continue
    }

    // 嘗試模糊匹配
    const fuzzyResult = fuzzyMatch(text, keyword)
    if (fuzzyResult.matched) {
      score += fuzzyResult.score
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

      // 嘗試匹配資料庫中的活動；同一行可能包含多個票券，例如「茵他儂 + 雙塔」。
      const scoredMatches: { activity: ActivityRecord; score: number; keywordCount: number }[] = []

      // DEBUG: 顯示正在匹配的文字
      console.log(`[Matcher] 嘗試匹配: "${activityText.slice(0, 30)}..."`)

      for (const activity of activeActivities) {
        if (hasMissingRequiredOption(activityText, activity.name)) {
          continue
        }

        const keywords = getActivityKeywords(activity)
        const score = calculateMatchScore(activityText, keywords)

        // 也嘗試用活動名稱匹配
        const nameScore = normalizeMatchingText(activityText).includes(normalizeMatchingText(activity.name))
          ? activity.name.length * 2
          : 0

        const totalScore = score + nameScore

        // DEBUG: 只顯示有分數的活動
        if (totalScore > 0) {
          console.log(`  → ${activity.name}: keywordScore=${score}, nameScore=${nameScore}, total=${totalScore}`)
        }

        if (totalScore > 0) {
          scoredMatches.push({ activity, score: totalScore, keywordCount: keywords.length })
        }
      }

      const bestScore = Math.max(0, ...scoredMatches.map((match) => match.score))
      const dedupedMatches = new Map<string, { activity: ActivityRecord; score: number; keywordCount: number }>()
      scoredMatches
        .filter((match) => match.score >= 6 || (match.score >= 3 && match.score >= bestScore * 0.5))
        .forEach((match) => {
          const dedupKey = getActivityNameDedupKey(match.activity.name)
          const currentMatch = dedupedMatches.get(dedupKey)
          if (!currentMatch || isPreferredActivityMatch(match, currentMatch)) {
            dedupedMatches.set(dedupKey, match)
          }
        })

      const matchesToAdd = Array.from(dedupedMatches.values()).sort((a, b) => b.score - a.score)

      // DEBUG: 顯示最終匹配結果
      if (matchesToAdd.length > 0) {
        console.log(`  ✓ 匹配: ${matchesToAdd.map((match) => `${match.activity.name} (${match.score})`).join('、')}`)
      } else {
        console.log(`  ✗ 無匹配`)
      }

      if (matchesToAdd.length > 0) {
        const addedExclusiveGroups = new Set<string>()
        for (const match of matchesToAdd) {
          if (match.activity.exclusiveGroup && addedExclusiveGroups.has(match.activity.exclusiveGroup)) {
            continue
          }

          // 同一天同名活動只保留最高分那筆，避免自訂票券和預設票券重複計算。
          const currentNameKey = getActivityNameDedupKey(match.activity.name)
          const alreadyMatched = matched.some((m) => (
            m.dayNumber === day.dayNumber &&
            (m.activityId === match.activity._id || getActivityNameDedupKey(m.activityName) === currentNameKey)
          ))

          if (alreadyMatched) continue

          matched.push({
            activityId: match.activity._id,
            activityName: match.activity.name,
            matchedText: activityText,
            dayNumber: day.dayNumber,
            price: match.activity.adultPrice,
            rebate: match.activity.rebate,
            splitRebate: match.activity.splitRebate,
            exclusiveGroup: match.activity.exclusiveGroup,
            isDefaultInGroup: match.activity.isDefaultInGroup,
            confidence: getConfidence(match.score, match.keywordCount),
          })

          if (match.activity.exclusiveGroup) {
            addedExclusiveGroups.add(match.activity.exclusiveGroup)
          }
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
  const { parseItineraryText } = require('./parse-itinerary-with-fallback')
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
