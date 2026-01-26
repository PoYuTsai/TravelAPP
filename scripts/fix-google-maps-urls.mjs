#!/usr/bin/env node

/**
 * 修復 Notion 餐廳資料庫中的 Google Maps 短連結
 *
 * 問題：maps.app.goo.gl 短連結可能會過期或無法正確導向
 * 解決：更新為完整的 Google Maps URL 格式
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
const RESTAURANT_DB = process.env.NOTION_RESTAURANT_DB

// Google Maps 完整 URL 對照表
// 格式：店名 -> 完整 Google Maps 搜尋 URL
const googleMapsUrls = {
  // 咖啡廳 - 使用 Google Maps search URL 格式
  'HAAN Studio': 'https://www.google.com/maps/search/HAAN+Studio+Chiang+Mai',
  'Versailles de Flore': 'https://www.google.com/maps/search/Versailles+de+Flore+Chiang+Mai',
  'No.39 Cafe': 'https://www.google.com/maps/search/No.39+Cafe+Chiang+Mai',
  'Ginger Farm Kitchen': 'https://www.google.com/maps/search/Ginger+Farm+Kitchen+Chiang+Mai',
  'Monsoon Tea': 'https://www.google.com/maps/search/?api=1&query=Monsoon+Tea&query_place_id=ChIJ11WNHrc62jARohQCNB5OQw8',
  'Ristr8to Lab': 'https://www.google.com/maps/search/Ristr8to+Lab+Nimmanhaemin+Chiang+Mai',
  'Doi Chaang Coffee': 'https://www.google.com/maps/search/Doi+Chaang+Coffee+Chiang+Mai',
  'Akha Ama Coffee': 'https://www.google.com/maps/search/?api=1&query=Akha+Ama+Coffee&query_place_id=ChIJ-4cjn5I62jAR3xGbI-RDLPI',
  // 餐廳
  '海鮮燒烤369吃到飽': 'https://www.google.com/maps/search/369+Seafood+BBQ+Buffet+Chiang+Mai',
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

async function fixGoogleMapsUrls() {
  console.log('🗺️  開始修復 Google Maps 連結...\n')

  const result = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', {
    page_size: 100,
  })

  let fixedCount = 0
  let skippedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const currentUrl = page.properties['地圖連結']?.url || ''

    // 只處理 maps.app.goo.gl 連結
    if (currentUrl.includes('maps.app.goo.gl')) {
      const newUrl = googleMapsUrls[name]

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
      } else {
        console.log(`⚠️ ${name} 使用 maps.app.goo.gl 但無對照 URL`)
        console.log(`   目前: ${currentUrl}`)
        skippedCount++
      }
    }
  }

  console.log('=' .repeat(50))
  console.log(`🎉 修復完成！`)
  console.log(`   已更新: ${fixedCount} 筆`)
  console.log(`   跳過: ${skippedCount} 筆`)
}

async function main() {
  try {
    await fixGoogleMapsUrls()
  } catch (error) {
    console.error('❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
