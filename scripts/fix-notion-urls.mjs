#!/usr/bin/env node

/**
 * 修復 Notion 知識庫中的無效 URL
 *
 * 問題：部分飯店使用了 placeholder URL (如 cr_riverie)
 * 解決：更新為正確的官方網站連結
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// 手動載入 .env.local
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
    // .env.local 不存在則跳過
  }
}

loadEnv()

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const NOTION_VERSION = '2022-06-28'
const HOTEL_DB = process.env.NOTION_HOTEL_DB

if (!NOTION_TOKEN || !HOTEL_DB) {
  console.error('缺少環境變數 NOTION_KNOWLEDGE_TOKEN 或 NOTION_HOTEL_DB')
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
    console.error('API 錯誤:', data)
    throw new Error(data.message || 'Notion API 錯誤')
  }

  return data
}

// 需要修復的 URL 對照表 (飯店)
const hotelUrlFixes = {
  'The Riverie by Katathani': 'https://www.theriverie.com/',
  'Le Patta Hotel': 'https://www.lepattachiangrai.com/',
}

// 需要修復的 URL 對照表 (餐廳)
const restaurantUrlFixes = {
  'Vegan Heaven': 'https://veganheavencnx.com/',
}

const RESTAURANT_DB = process.env.NOTION_RESTAURANT_DB

async function fixHotelUrls() {
  console.log('🔧 開始修復飯店資料庫 URL...\n')

  const result = await notionRequest(`/databases/${HOTEL_DB}/query`, 'POST', {
    page_size: 100,
  })

  let fixedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const currentUrl = page.properties['官網']?.url || ''

    if (currentUrl.includes('cr_') || currentUrl.includes('placeholder') || currentUrl.includes('abc123')) {
      const newUrl = hotelUrlFixes[name]

      if (newUrl) {
        console.log(`修復: ${name}`)
        console.log(`  舊: ${currentUrl}`)
        console.log(`  新: ${newUrl}`)

        await notionRequest(`/pages/${page.id}`, 'PATCH', {
          properties: {
            '官網': { url: newUrl },
          },
        })

        fixedCount++
        console.log('  ✓ 已更新\n')
      }
    }
  }

  return fixedCount
}

async function fixRestaurantUrls() {
  console.log('🔧 開始修復餐廳資料庫 URL...\n')

  const result = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', {
    page_size: 100,
  })

  let fixedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const currentUrl = page.properties['地圖連結']?.url || ''

    if (currentUrl.includes('vegetarian') || currentUrl.includes('placeholder') || currentUrl.includes('abc123')) {
      const newUrl = restaurantUrlFixes[name]

      if (newUrl) {
        console.log(`修復: ${name}`)
        console.log(`  舊: ${currentUrl}`)
        console.log(`  新: ${newUrl}`)

        await notionRequest(`/pages/${page.id}`, 'PATCH', {
          properties: {
            '地圖連結': { url: newUrl },
          },
        })

        fixedCount++
        console.log('  ✓ 已更新\n')
      }
    }
  }

  return fixedCount
}

async function main() {
  try {
    const hotelFixed = await fixHotelUrls()
    const restaurantFixed = await fixRestaurantUrls()

    console.log('=' .repeat(50))
    console.log(`🎉 修復完成！`)
    console.log(`   飯店: ${hotelFixed} 筆`)
    console.log(`   餐廳: ${restaurantFixed} 筆`)
  } catch (error) {
    console.error('❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
