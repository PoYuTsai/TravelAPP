#!/usr/bin/env node

/**
 * 為飯店資料庫新增 Google Maps 地圖連結
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
const HOTEL_DB = process.env.NOTION_HOTEL_DB

// 飯店 Google Maps 連結對照表
const hotelMapUrls = {
  // 清邁飯店
  'InterContinental Chiang Mai The Mae Ping (美平洲際)': 'https://www.google.com/maps/search/InterContinental+Chiang+Mai+Mae+Ping',
  'Le Meridien Chiang Mai (萬豪)': 'https://www.google.com/maps/search/Le+Meridien+Chiang+Mai',
  'U Nimman Chiang Mai': 'https://www.google.com/maps/search/U+Nimman+Chiang+Mai',
  'Art Mai Gallery Hotel': 'https://www.google.com/maps/search/Art+Mai+Gallery+Hotel+Chiang+Mai',
  'Wintree City Resort': 'https://www.google.com/maps/search/Wintree+City+Resort+Chiang+Mai',
  'PE-LA Thapae Boutique Hotel': 'https://www.google.com/maps/search/PE-LA+Thapae+Boutique+Hotel+Chiang+Mai',
  'The Mellow Pillow @ Chiang Mai Gate': 'https://www.google.com/maps/search/The+Mellow+Pillow+Chiang+Mai+Gate',
  // 清萊飯店
  'Nak Nakara Hotel': 'https://www.google.com/maps/search/Nak+Nakara+Hotel+Chiang+Rai',
  'Wiang Inn Hotel': 'https://www.google.com/maps/search/Wiang+Inn+Hotel+Chiang+Rai',
  'The Riverie by Katathani': 'https://www.google.com/maps/search/The+Riverie+by+Katathani+Chiang+Rai',
  'Le Patta Hotel': 'https://www.google.com/maps/search/Le+Patta+Hotel+Chiang+Rai',
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

async function ensureMapProperty() {
  console.log('📋 檢查資料庫欄位...')

  // 先取得資料庫結構
  const db = await notionRequest(`/databases/${HOTEL_DB}`)

  if (!db.properties['地圖連結']) {
    console.log('   新增「地圖連結」欄位...')
    await notionRequest(`/databases/${HOTEL_DB}`, 'PATCH', {
      properties: {
        '地圖連結': { url: {} }
      }
    })
    console.log('   ✓ 欄位已新增\n')
  } else {
    console.log('   ✓ 欄位已存在\n')
  }
}

async function addHotelMapUrls() {
  // 先確保欄位存在
  await ensureMapProperty()

  console.log('🗺️  開始為飯店新增 Google Maps 連結...\n')

  const result = await notionRequest(`/databases/${HOTEL_DB}/query`, 'POST', {
    page_size: 100,
  })

  let addedCount = 0
  let skippedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const currentMapUrl = page.properties['地圖連結']?.url || ''

    // 如果已有地圖連結，跳過
    if (currentMapUrl) {
      console.log(`⏭️  ${name} 已有地圖連結，跳過`)
      skippedCount++
      continue
    }

    const newUrl = hotelMapUrls[name]

    if (newUrl) {
      console.log(`新增: ${name}`)
      console.log(`  🗺️  ${newUrl}`)

      await notionRequest(`/pages/${page.id}`, 'PATCH', {
        properties: {
          '地圖連結': { url: newUrl },
        },
      })

      addedCount++
      console.log('  ✓ 已新增\n')
    } else {
      console.log(`⚠️ ${name} 無對照 URL，跳過`)
      skippedCount++
    }
  }

  console.log('=' .repeat(50))
  console.log(`🎉 完成！`)
  console.log(`   新增: ${addedCount} 筆`)
  console.log(`   跳過: ${skippedCount} 筆`)
}

async function main() {
  try {
    await addHotelMapUrls()
  } catch (error) {
    console.error('❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
