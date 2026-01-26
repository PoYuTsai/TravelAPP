#!/usr/bin/env node

/**
 * 自動修正所有資料庫的 Google Maps URL
 * 根據名稱自動生成正確的搜尋連結
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
  } catch (e) {}
}
loadEnv()

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const NOTION_VERSION = '2022-06-28'

const databases = {
  '餐廳': { id: process.env.NOTION_RESTAURANT_DB, location: 'Chiang Mai' },
  '咖啡廳': { id: process.env.NOTION_CAFE_DB, location: 'Chiang Mai' },
  '飯店': { id: process.env.NOTION_HOTEL_DB, location: null }, // 從名稱判斷
  '景點': { id: process.env.NOTION_ATTRACTION_DB, location: null }, // 從名稱判斷
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
    console.error('API 錯誤:', data)
    throw new Error(data.message || 'Notion API 錯誤')
  }

  return data
}

// 根據名稱生成 Google Maps 搜尋 URL
function generateMapUrl(name, defaultLocation) {
  // 清理名稱，移除括號內的中文註解但保留英文
  let searchName = name

  // 如果名稱包含 Chiang Rai，使用清萊
  let location = defaultLocation
  if (name.toLowerCase().includes('chiang rai') || name.includes('清萊')) {
    location = 'Chiang Rai'
  } else if (name.toLowerCase().includes('mae rim')) {
    location = 'Mae Rim Chiang Mai'
  } else if (name.toLowerCase().includes('mae taeng')) {
    location = 'Mae Taeng Chiang Mai'
  }

  // 如果名稱已經包含地點，不重複加
  const hasLocation =
    name.toLowerCase().includes('chiang mai') ||
    name.toLowerCase().includes('chiang rai') ||
    name.toLowerCase().includes('mae rim') ||
    name.toLowerCase().includes('mae taeng')

  // 構建搜尋詞
  let searchTerm = searchName
  if (location && !hasLocation) {
    searchTerm = `${searchName} ${location}`
  }

  // URL 編碼（保留泰文等 Unicode 字符）
  const encoded = encodeURIComponent(searchTerm).replace(/%20/g, '+')

  return `https://www.google.com/maps/search/${encoded}`
}

async function fixDatabase(dbName, dbConfig) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔧 修正 ${dbName}推薦`)
  console.log('='.repeat(60))

  const result = await notionRequest(`/databases/${dbConfig.id}/query`, 'POST', {
    page_size: 100,
  })

  let fixedCount = 0
  let skippedCount = 0

  for (const page of result.results) {
    const props = page.properties
    const name = props['名稱']?.title?.[0]?.plain_text || ''
    const currentUrl = props['地圖連結']?.url || ''

    if (!name) {
      console.log(`⏭️  (無名稱) - 跳過`)
      skippedCount++
      continue
    }

    // 根據資料庫類型決定預設地點
    let defaultLocation = dbConfig.location

    // 飯店：檢查地點欄位
    if (dbName === '飯店') {
      const locationField = props['地點']?.select?.name || ''
      if (locationField.includes('清萊')) {
        defaultLocation = 'Chiang Rai'
      } else {
        defaultLocation = 'Chiang Mai'
      }
    }

    // 景點：檢查地區欄位
    if (dbName === '景點') {
      const regionField = props['地區']?.select?.name || ''
      if (regionField.includes('清萊')) {
        defaultLocation = 'Chiang Rai'
      } else {
        defaultLocation = 'Chiang Mai'
      }
    }

    const newUrl = generateMapUrl(name, defaultLocation)

    // 檢查是否需要更新
    if (currentUrl !== newUrl) {
      console.log(`✏️  ${name}`)
      console.log(`   舊: ${currentUrl || '(無)'}`)
      console.log(`   新: ${newUrl}`)

      await notionRequest(`/pages/${page.id}`, 'PATCH', {
        properties: {
          '地圖連結': { url: newUrl }
        }
      })

      fixedCount++
    } else {
      skippedCount++
    }
  }

  console.log(`\n✅ ${dbName}: 修正 ${fixedCount} 筆, 跳過 ${skippedCount} 筆`)
  return { fixed: fixedCount, skipped: skippedCount }
}

async function main() {
  console.log('🔄 自動修正所有資料庫的 Google Maps URL')
  console.log('根據名稱自動生成正確的搜尋連結\n')

  let totalFixed = 0
  let totalSkipped = 0

  for (const [name, config] of Object.entries(databases)) {
    if (config.id) {
      const result = await fixDatabase(name, config)
      totalFixed += result.fixed
      totalSkipped += result.skipped
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 總計')
  console.log('='.repeat(60))
  console.log(`修正: ${totalFixed} 筆`)
  console.log(`跳過: ${totalSkipped} 筆`)
  console.log('\n🎉 完成！所有連結已根據名稱自動更新')
}

main().catch(console.error)
