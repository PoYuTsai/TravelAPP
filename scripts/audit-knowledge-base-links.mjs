#!/usr/bin/env node

/**
 * 知識庫連結審計腳本
 *
 * 功能：
 * 1. 從 Notion 撈取所有有 Google Maps 連結的資料
 * 2. 訪問每個連結，解析實際的商家名稱
 * 3. 比對 Notion 名稱與 Google Maps 商家名稱
 * 4. 輸出不匹配的項目
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue

      const key = trimmed.slice(0, eqIndex)
      let value = trimmed.slice(eqIndex + 1)

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  } catch (e) {
    // ignore
  }
}

loadEnv()

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const NOTION_VERSION = '2022-06-28'

// 資料庫 ID
const DATABASES = {
  餐廳: process.env.NOTION_RESTAURANT_DB,
  咖啡廳: process.env.NOTION_CAFE_DB,
  飯店: process.env.NOTION_HOTEL_DB,
  景點: process.env.NOTION_ATTRACTION_DB,
}

if (!NOTION_TOKEN) {
  console.error('❌ 請設定 NOTION_KNOWLEDGE_TOKEN')
  process.exit(1)
}

async function notionRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`https://api.notion.com/v1${endpoint}`, options)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Notion API 錯誤')
  }

  return data
}

// 從 Google Maps URL 解析商家名稱
async function getGoogleMapsInfo(url) {
  if (!url) return null

  try {
    // 處理不同格式的 Google Maps URL
    let searchName = null

    // 格式 1: https://www.google.com/maps/search/Name+Here
    const searchMatch = url.match(/\/maps\/search\/([^/?]+)/)
    if (searchMatch) {
      searchName = decodeURIComponent(searchMatch[1].replace(/\+/g, ' '))
      return { type: 'search', name: searchName, url }
    }

    // 格式 2: https://www.google.com/maps/place/Name+Here
    const placeMatch = url.match(/\/maps\/place\/([^/?@]+)/)
    if (placeMatch) {
      searchName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
      return { type: 'place', name: searchName, url }
    }

    // 格式 3: 短連結 maps.app.goo.gl (需要 fetch 取得重定向)
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      return { type: 'shortlink', name: '(短連結-需手動檢查)', url }
    }

    // 格式 4: 含有 place_id
    if (url.includes('place_id=') || url.includes('!1s')) {
      return { type: 'place_id', name: '(Place ID-需手動檢查)', url }
    }

    return { type: 'unknown', name: '(無法解析)', url }
  } catch (e) {
    return { type: 'error', name: e.message, url }
  }
}

// 比較名稱相似度
function compareNames(notionName, googleName) {
  if (!googleName || googleName.startsWith('(')) return { match: 'unknown', reason: '無法解析 Google 名稱' }

  const normalize = (str) => str
    .toLowerCase()
    .replace(/[^\w\u0E00-\u0E7F\u4E00-\u9FFF]/g, '') // 保留英文、泰文、中文
    .trim()

  const n1 = normalize(notionName)
  const n2 = normalize(googleName)

  // 完全匹配
  if (n1 === n2) return { match: 'exact', reason: '完全匹配' }

  // 包含關係
  if (n1.includes(n2) || n2.includes(n1)) return { match: 'partial', reason: '部分匹配' }

  // 檢查關鍵字
  const n1Words = notionName.toLowerCase().split(/\s+/)
  const n2Words = googleName.toLowerCase().split(/\s+/)
  const commonWords = n1Words.filter(w => w.length > 2 && n2Words.some(w2 => w2.includes(w) || w.includes(w2)))

  if (commonWords.length > 0) {
    return { match: 'keyword', reason: `關鍵字匹配: ${commonWords.join(', ')}` }
  }

  return { match: 'mismatch', reason: '名稱不匹配' }
}

// 撈取資料庫所有項目
async function fetchDatabaseItems(dbId, dbName) {
  const items = []
  let hasMore = true
  let startCursor = undefined

  while (hasMore) {
    const response = await notionRequest(`/databases/${dbId}/query`, 'POST', {
      start_cursor: startCursor,
      page_size: 100,
    })

    for (const page of response.results) {
      const props = page.properties

      // 取得名稱 (嘗試不同欄位名)
      let name = ''
      for (const key of ['名稱', '景點', '標題', 'Name']) {
        if (props[key]?.title?.[0]?.plain_text) {
          name = props[key].title[0].plain_text
          break
        }
      }

      // 取得 URL (嘗試不同欄位名)
      let url = null
      for (const key of ['地圖連結', '官網', 'URL', 'url']) {
        if (props[key]?.url) {
          url = props[key].url
          break
        }
      }

      // 只收集有 Google Maps 連結的項目
      if (url && (url.includes('google.com/maps') || url.includes('goo.gl') || url.includes('maps.app'))) {
        items.push({
          id: page.id,
          database: dbName,
          notionName: name,
          url,
        })
      }
    }

    hasMore = response.has_more
    startCursor = response.next_cursor
  }

  return items
}

// 主程式
async function main() {
  console.log('🔍 知識庫連結審計\n')
  console.log('='.repeat(60))

  const allItems = []

  // 1. 撈取所有資料庫
  for (const [dbName, dbId] of Object.entries(DATABASES)) {
    if (!dbId) {
      console.log(`⚠️ ${dbName}: 未設定資料庫 ID，跳過`)
      continue
    }

    console.log(`\n📂 撈取 ${dbName} 資料庫...`)
    try {
      const items = await fetchDatabaseItems(dbId, dbName)
      console.log(`   找到 ${items.length} 筆有 Google Maps 連結的資料`)
      allItems.push(...items)
    } catch (e) {
      console.log(`   ❌ 錯誤: ${e.message}`)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 共 ${allItems.length} 筆需要檢查\n`)

  // 2. 檢查每個連結
  const results = {
    exact: [],
    partial: [],
    keyword: [],
    mismatch: [],
    unknown: [],
  }

  for (const item of allItems) {
    const googleInfo = await getGoogleMapsInfo(item.url)
    const comparison = compareNames(item.notionName, googleInfo?.name || '')

    const result = {
      ...item,
      googleName: googleInfo?.name || '(無法取得)',
      urlType: googleInfo?.type || 'unknown',
      ...comparison,
    }

    results[comparison.match].push(result)

    // 顯示進度
    const icon = {
      exact: '✅',
      partial: '🟡',
      keyword: '🟠',
      mismatch: '❌',
      unknown: '❓',
    }[comparison.match]

    if (comparison.match === 'mismatch' || comparison.match === 'unknown') {
      console.log(`${icon} [${item.database}] ${item.notionName}`)
      console.log(`   Google: ${googleInfo?.name || '(無法取得)'}`)
      console.log(`   URL: ${item.url}`)
      console.log('')
    }
  }

  // 3. 輸出報告
  console.log('\n' + '='.repeat(60))
  console.log('📋 審計報告\n')

  console.log(`✅ 完全匹配: ${results.exact.length} 筆`)
  console.log(`🟡 部分匹配: ${results.partial.length} 筆`)
  console.log(`🟠 關鍵字匹配: ${results.keyword.length} 筆`)
  console.log(`❌ 不匹配: ${results.mismatch.length} 筆`)
  console.log(`❓ 無法判斷: ${results.unknown.length} 筆`)

  // 4. 列出需要檢查的項目
  const needsReview = [...results.mismatch, ...results.unknown]

  if (needsReview.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️ 需要人工檢查的項目:\n')

    for (const item of needsReview) {
      console.log(`[${item.database}] ${item.notionName}`)
      console.log(`  Notion 名稱: ${item.notionName}`)
      console.log(`  Google 名稱: ${item.googleName}`)
      console.log(`  連結類型: ${item.urlType}`)
      console.log(`  URL: ${item.url}`)
      console.log(`  原因: ${item.reason}`)
      console.log('')
    }
  }

  // 5. 輸出 JSON 供後續處理
  const outputPath = resolve(__dirname, '../.notion-audit-results.json')
  const fs = await import('fs')
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: allItems.length,
      exact: results.exact.length,
      partial: results.partial.length,
      keyword: results.keyword.length,
      mismatch: results.mismatch.length,
      unknown: results.unknown.length,
    },
    needsReview,
    allResults: results,
  }, null, 2))

  console.log(`\n📄 詳細結果已存至: .notion-audit-results.json`)
}

main().catch(console.error)
