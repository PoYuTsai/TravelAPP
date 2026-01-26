#!/usr/bin/env node

/**
 * 使用精確的英文名稱修正所有 URL
 * 並顯示備註供檢查
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

// 精確的 Google Maps 搜尋名稱對照表
// 使用在 Google Maps 上實際能找到的名稱
const correctSearchNames = {
  // 餐廳
  'ถูก อิ่ม อร่อย ข้าวต้ม 1 บาท': 'ถูก อิ่ม อร่อย Chiang Mai',
  'หมูกระทะช้างเผือก': 'หมูกระทะช้างเผือก Chang Phueak',
  'หมูจุ่มเจ้โส': 'หมูจุ่มเจ้โส Chiang Mai',
  'ครัวคุณแม่หมูกระทะ สาขาเชียงใหม่(แยกหลุยส์)': 'ครัวคุณแม่หมูกระทะ Louis Chiang Mai',
  "Neng's Clay Oven Roasted Pork – Muang Mai Market": 'Neng Clay Oven Roasted Pork Muang Mai Market',
  'กองคำ (Gong Kham)': 'Gong Kham Mae Rim',
  'Air Diamond Cafe': 'Air Diamond Cafe Mae Taeng',
  'Payod Shan food(vegan/vegetarian)': 'Payod Shan Food Chiang Mai',
  'Sukjai by Pata Obasan': 'Sukjai Vegetarian Chiang Mai',
  'Krua Lawng Khao': 'Krua Lawng Khao Mae Rim',
  'Vegan Heaven': 'Vegan Heaven Chiang Mai',
  'The Kad Farang Mae Rim': 'Kad Farang Village Mae Rim',
  '183 Begin Vegan': 'Begin Again Vegan Cafe Chiang Mai',
  'ร้านข้าวซอยแม่นาย (Khao Soy Mae Nai)': 'ข้าวซอยแม่นาย Mae Taeng',
  'Saiyut & Doctor Sai Kitchen': 'Saiyut Doctor Sai Kitchen Mae Taeng',
  'ก๋วยเตี๋ยวหมูสวนดอก (Guay Tiew Moo Suan Dok)': 'ก๋วยเตี๋ยวหมูสวนดอก Mae Taeng',
  'Pang Pao Beach': 'Pang Pao Beach Mae Taeng',
  'Mai Heun 60': 'Mai Heun 60 Mae Rim',
  'Chada Vegetarian Restaurant': 'Chada Vegetarian Restaurant Chiang Mai',
  '1 Reform Kafé': 'Reform Kafe Chiang Mai',
  'Khong Khao Mueang': 'Khong Khao Mueang Mae Rim',

  // 咖啡廳
  'Ginger Farm Kitchen': 'Ginger Farm Kitchen Chiang Mai',
  'HAAN Studio': 'HAAN Coffee Studio Chiang Mai',
  'No.39 Cafe': 'No.39 Cafe Chiang Mai',
  'Roast8ry Lab': 'Roast8ry Lab Chiang Mai',
  'Monsoon Tea': 'Monsoon Tea Chiang Mai',
  'Versailles de Flore': 'Versailles de Flore Chiang Mai',
  'The Baristro Coffee Roaster': 'The Baristro Chiang Mai',
  'Akha Ama Coffee': 'Akha Ama Coffee Chiang Mai',
  'Doi Chaang Coffee': 'Doi Chaang Coffee Chiang Mai',
  'Ristr8to Lab': 'Ristr8to Lab Chiang Mai',

  // 飯店
  'Nak Nakara Hotel': 'Nak Nakara Hotel Chiang Rai',
  'ANA Park Hotel': 'ANA Park Hotel Chiang Mai',
  'Le Meridien Chiang Mai (萬豪)': 'Le Meridien Chiang Mai',
  'The Mellow Pillow @ Chiang Mai Gate': 'The Mellow Pillow Chiang Mai Gate',
  '115 Burirattana Hotel': '115 The Residence Chiang Mai',
  'InterContinental Chiang Mai The Mae Ping (美平洲際)': 'InterContinental Chiang Mai Mae Ping',
  'K Maison Lanna Boutique Hotel': 'K Maison Lanna Boutique Hotel Chiang Mai',
  'Wiang Inn Hotel': 'Wiang Inn Hotel Chiang Rai',
  'Wintree City Resort': 'Wintree City Resort Chiang Mai',
  'Sann Hotel Chiang Rai': 'Sann Hotel Chiang Rai',
  'Hotel Sensai Nimman': 'Hotel Sensai Nimman Chiang Mai',
  'The Riverie by Katathani': 'The Riverie by Katathani Chiang Rai',
  'Art Mai Gallery Hotel': 'Art Mai Gallery Nimman Hotel Chiang Mai',
  'Clay Bed Chiangrai': 'Clay Bed Chiang Rai',
  'U Nimman Chiang Mai': 'U Nimman Chiang Mai',
  'Riva Vista Riverfront Chiang Rai': 'Riva Vista Riverfront Chiang Rai',
  'PE-LA Thapae Boutique Hotel': 'PE-LA Thapae Boutique Hotel Chiang Mai',
  'Lavanda Hotel Chiang Rai': 'Lavanda Hotel Chiang Rai',
  'Le Patta Hotel': 'Le Patta Hotel Chiang Rai',

  // 景點
  'Thamluang Khunnam Nangnon (睡美人洞)': 'Tham Luang Cave Chiang Rai',
  'Choui Fong Tea (翠峰茶園)': 'Choui Fong Tea Plantation Chiang Rai',
  'Wat Sang Kaew Phothiyan (玻璃寺)': 'Wat Sang Kaew Phothiyan Chiang Rai',
  'Wat Tham Pla (魚洞寺)': 'Wat Tham Pla Fish Cave Chiang Rai',
  'Rai Chern Tawan (白龍王禪修中心)': 'Rai Cherntawan Chiang Rai',
  'Doi Tung Royal Villa (皇太后行宮)': 'Doi Tung Royal Villa Chiang Rai',
  'Singha Park Chiang Rai': 'Singha Park Chiang Rai',
  'Wat Ming Muang (清萊市廟)': 'Wat Ming Muang Chiang Rai',
}

const databases = {
  '餐廳': process.env.NOTION_RESTAURANT_DB,
  '咖啡廳': process.env.NOTION_CAFE_DB,
  '飯店': process.env.NOTION_HOTEL_DB,
  '景點': process.env.NOTION_ATTRACTION_DB,
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

function generateUrl(searchName) {
  const encoded = encodeURIComponent(searchName).replace(/%20/g, '+')
  return `https://www.google.com/maps/search/${encoded}`
}

async function fixDatabase(dbName, dbId) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔧 ${dbName}推薦`)
  console.log('='.repeat(60))

  const result = await notionRequest(`/databases/${dbId}/query`, 'POST', {
    page_size: 100,
  })

  let fixedCount = 0

  for (const page of result.results) {
    const props = page.properties
    const name = props['名稱']?.title?.[0]?.plain_text || ''
    const note = props['備註']?.rich_text?.[0]?.plain_text || ''
    const currentUrl = props['地圖連結']?.url || ''

    if (!name) continue

    const searchName = correctSearchNames[name]
    if (!searchName) {
      console.log(`⚠️  ${name} - 無對照表`)
      continue
    }

    const newUrl = generateUrl(searchName)

    if (currentUrl !== newUrl) {
      console.log(`✏️  ${name}`)
      console.log(`   搜尋: ${searchName}`)
      if (note) console.log(`   備註: ${note}`)

      await notionRequest(`/pages/${page.id}`, 'PATCH', {
        properties: {
          '地圖連結': { url: newUrl }
        }
      })

      fixedCount++
    }
  }

  console.log(`\n✅ 修正 ${fixedCount} 筆`)
  return fixedCount
}

async function main() {
  console.log('🔄 使用精確英文名稱修正所有 URL\n')

  let total = 0

  for (const [name, dbId] of Object.entries(databases)) {
    if (dbId) {
      total += await fixDatabase(name, dbId)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`🎉 完成！共修正 ${total} 筆`)
}

main().catch(console.error)
