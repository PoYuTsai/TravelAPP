#!/usr/bin/env node

/**
 * 修復餐廳資料庫中的 share.google 短連結
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

// 需要修復的短連結對照表
const urlFixes = {
  'ถูก อิ่ม อร่อย ข้าวต้ม 1 บาท': 'https://www.google.com/maps/search/Took+Im+Aroi+Khao+Tom+1+Baht+Chiang+Mai',
  'หมูกระทะช้างเผือก': 'https://www.google.com/maps/search/Moo+Kratha+Chang+Phueak+Chiang+Mai',
  'หมูจุ่มเจ้โส': 'https://www.google.com/maps/search/Moo+Jum+Jae+So+Chiang+Mai',
  'Neng\'s Clay Oven Roasted Pork – Muang Mai Market': 'https://www.google.com/maps/search/Neng+Clay+Oven+Roasted+Pork+Muang+Mai+Market+Chiang+Mai',
  'Vegan Heaven': 'https://www.google.com/maps/search/Vegan+Heaven+Chiang+Mai',
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
  console.log('🍜 修復餐廳 share.google 短連結...\n')

  const result = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', {
    page_size: 100,
  })

  let fixedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const currentUrl = page.properties['地圖連結']?.url || ''

    // 檢查是否為短連結
    if (currentUrl.includes('share.google')) {
      const newUrl = urlFixes[name]

      if (newUrl) {
        console.log(`✏️  ${name}`)
        console.log(`   舊: ${currentUrl}`)
        console.log(`   新: ${newUrl}`)

        await notionRequest(`/pages/${page.id}`, 'PATCH', {
          properties: {
            '地圖連結': { url: newUrl }
          }
        })

        fixedCount++
        console.log(`   ✓ 已修復\n`)
      } else {
        console.log(`⚠️  ${name} - 無對應修復 URL`)
        console.log(`   ${currentUrl}\n`)
      }
    }
  }

  console.log('=' .repeat(50))
  console.log(`🎉 完成！修復 ${fixedCount} 筆短連結`)
}

main().catch(console.error)
