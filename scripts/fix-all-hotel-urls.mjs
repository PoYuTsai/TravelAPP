#!/usr/bin/env node

/**
 * 全面修正飯店資料庫的 Google Maps URL
 * 使用更精確的搜尋詞確保連結正確
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

// 正確的飯店 Google Maps URL 對照表
// 使用精確的英文名稱搜尋
const correctUrls = {
  // 清邁飯店
  'InterContinental Chiang Mai The Mae Ping (美平洲際)': 'https://www.google.com/maps/search/InterContinental+Chiang+Mai+The+Mae+Ping',
  'Le Meridien Chiang Mai (萬豪)': 'https://www.google.com/maps/search/Le+Meridien+Chiang+Mai+Hotel',
  'U Nimman Chiang Mai': 'https://www.google.com/maps/search/U+Nimman+Chiang+Mai+Hotel',
  'Wintree City Resort': 'https://www.google.com/maps/search/Wintree+City+Resort+Chiang+Mai',
  'Art Mai Gallery Hotel': 'https://www.google.com/maps/search/Art+Mai+Gallery+Nimman+Hotel+Chiang+Mai',
  'K Maison Lanna Boutique Hotel': 'https://www.google.com/maps/search/K+Maison+Lanna+Boutique+Hotel+Chiang+Mai',
  'Hotel Sensai Nimman': 'https://www.google.com/maps/search/Hotel+Sensai+Nimman+Chiang+Mai',
  '115 Burirattana Hotel': 'https://www.google.com/maps/search/115+The+Residence+Chiang+Mai',
  'ANA Park Hotel': 'https://www.google.com/maps/search/ANA+Park+Hotel+Chiang+Mai',
  'PE-LA Thapae Boutique Hotel': 'https://www.google.com/maps/search/PE-LA+Thapae+Boutique+Hotel+Chiang+Mai',
  'The Mellow Pillow @ Chiang Mai Gate': 'https://www.google.com/maps/search/The+Mellow+Pillow+Chiang+Mai+Gate',

  // 清萊飯店
  'The Riverie by Katathani': 'https://www.google.com/maps/search/The+Riverie+by+Katathani+Chiang+Rai',
  'Wiang Inn Hotel': 'https://www.google.com/maps/search/Wiang+Inn+Hotel+Chiang+Rai',
  'Le Patta Hotel': 'https://www.google.com/maps/search/Le+Patta+Hotel+Chiang+Rai',
  'Nak Nakara Hotel': 'https://www.google.com/maps/search/Nak+Nakara+Hotel+Chiang+Rai',
  'Riva Vista Riverfront Chiang Rai': 'https://www.google.com/maps/search/Riva+Vista+Riverfront+Chiang+Rai',
  'Lavanda Hotel Chiang Rai': 'https://www.google.com/maps/search/Lavanda+Hotel+Chiang+Rai',
  'Sann Hotel Chiang Rai': 'https://www.google.com/maps/search/Sann+Hotel+Chiang+Rai',
  'Clay Bed Chiangrai': 'https://www.google.com/maps/search/Clay+Bed+Chiang+Rai',
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

async function main() {
  console.log('🏨 全面修正飯店 Google Maps 連結...\n')

  const result = await notionRequest(`/databases/${HOTEL_DB}/query`, 'POST', {
    page_size: 100,
  })

  let updatedCount = 0
  let skippedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const currentUrl = page.properties['地圖連結']?.url || ''

    if (correctUrls[name]) {
      const newUrl = correctUrls[name]

      if (currentUrl !== newUrl) {
        console.log(`✏️  ${name}`)
        console.log(`   舊: ${currentUrl || '(無)'}`)
        console.log(`   新: ${newUrl}`)

        await notionRequest(`/pages/${page.id}`, 'PATCH', {
          properties: {
            '地圖連結': { url: newUrl }
          }
        })

        updatedCount++
        console.log(`   ✓ 已更新\n`)
      } else {
        console.log(`⏭️  ${name} - 連結已正確`)
        skippedCount++
      }
    } else {
      console.log(`⚠️  ${name} - 無對應 URL，請手動檢查`)
      skippedCount++
    }
  }

  console.log('')
  console.log('=' .repeat(50))
  console.log(`🎉 完成！更新 ${updatedCount} 筆，跳過 ${skippedCount} 筆`)
}

main().catch(console.error)
