#!/usr/bin/env node

/**
 * 新增剩餘的飯店和景點資料
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
const ATTRACTION_DB = process.env.NOTION_ATTRACTION_DB

// ====================================
// 清邁飯店 (4筆)
// ====================================
const chiangMaiHotels = [
  {
    name: 'K Maison Lanna Boutique Hotel',
    location: '清邁古城',
    url: 'https://www.google.com/maps/search/K+Maison+Lanna+Boutique+Hotel+Chiang+Mai',
    note: '蘭納風格精品酒店',
    stars: '⭐⭐⭐⭐',
    priceRange: '中價位',
  },
  {
    name: 'Hotel Sensai Nimman',
    location: '清邁 Nimman',
    url: 'https://www.google.com/maps/search/Hotel+Sensai+Nimman+Chiang+Mai',
    note: '尼曼路新開幕飯店',
    stars: '⭐⭐⭐⭐',
    priceRange: '中價位',
  },
  {
    name: '115 Burirattana Hotel',
    location: '清邁古城',
    url: 'https://www.google.com/maps/search/Burirattana+Hotel+Chiang+Mai',
    note: '古城內平價飯店',
    stars: '⭐⭐⭐',
    priceRange: '低價位',
  },
  {
    name: 'ANA Park Hotel',
    location: '其他',
    url: 'https://www.google.com/maps/search/ANA+Park+Hotel+Chiang+Mai',
    note: '河濱區新飯店',
    stars: '⭐⭐⭐⭐',
    priceRange: '中價位',
  },
]

// ====================================
// 清萊飯店 (4筆)
// ====================================
const chiangRaiHotels = [
  {
    name: 'Riva Vista Riverfront Chiang Rai',
    location: '清萊河畔',
    url: 'https://www.google.com/maps/search/Riva+Vista+Riverfront+Chiang+Rai',
    note: '河景度假村',
    stars: '⭐⭐⭐⭐',
    priceRange: '中價位',
  },
  {
    name: 'Lavanda Hotel Chiang Rai',
    location: '清萊市區',
    url: 'https://www.google.com/maps/search/Lavanda+Hotel+Chiang+Rai',
    note: '市區精品飯店',
    stars: '⭐⭐⭐⭐',
    priceRange: '中價位',
  },
  {
    name: 'Sann Hotel Chiang Rai',
    location: '清萊市區',
    url: 'https://www.google.com/maps/search/Sann+Hotel+Chiang+Rai',
    note: '市區設計旅店',
    stars: '⭐⭐⭐⭐',
    priceRange: '中價位',
  },
  {
    name: 'Clay Bed Chiangrai',
    location: '清萊市區',
    url: 'https://www.google.com/maps/search/Clay+Bed+Chiangrai',
    note: '平價設計旅店',
    stars: '⭐⭐⭐',
    priceRange: '低價位',
  },
]

// ====================================
// 清萊景點 (8筆)
// ====================================
const chiangRaiAttractions = [
  {
    name: 'Wat Sang Kaew Phothiyan (玻璃寺)',
    category: '寺廟',
    url: 'https://www.google.com/maps/search/Wat+Sang+Kaew+Phothiyan+Chiang+Rai',
    note: '玻璃裝飾的華麗寺廟，Mae Suai 區',
    region: '清萊',
  },
  {
    name: 'Choui Fong Tea (翠峰茶園)',
    category: '茶園',
    url: 'https://www.google.com/maps/search/Choui+Fong+Tea+Chiang+Rai',
    note: '清萊最大茶園，山景優美',
    region: '清萊',
  },
  {
    name: 'Singha Park Chiang Rai',
    category: '農場',
    url: 'https://www.google.com/maps/search/Singha+Park+Chiang+Rai',
    note: '勝獅啤酒農場，花海與動物園',
    region: '清萊',
  },
  {
    name: 'Rai Chern Tawan (白龍王禪修中心)',
    category: '寺廟',
    url: 'https://www.google.com/maps/search/Rai+Chern+Tawan+Chiang+Rai',
    note: '高僧 W. Wachiramethi 禪修中心',
    region: '清萊',
  },
  {
    name: 'Doi Tung Royal Villa (皇太后行宮)',
    category: '皇室景點',
    url: 'https://www.google.com/maps/search/Doi+Tung+Royal+Villa',
    note: '皇太后故居，花園優美',
    region: '清萊',
  },
  {
    name: 'Wat Ming Muang (清萊市廟)',
    category: '寺廟',
    url: 'https://www.google.com/maps/search/Wat+Ming+Muang+Chiang+Rai',
    note: '清萊市中心重要寺廟',
    region: '清萊',
  },
  {
    name: 'Thamluang Khunnam Nangnon (睡美人洞)',
    category: '自然景點',
    url: 'https://www.google.com/maps/search/Thamluang+Khunnam+Nangnon+National+Park',
    note: '2018年野豬足球隊救援事件地點',
    region: '清萊',
  },
  {
    name: 'Wat Tham Pla (魚洞寺)',
    category: '寺廟',
    url: 'https://www.google.com/maps/search/Wat+Tham+Pla+Fish+Cave+Temple',
    note: '洞穴寺廟，有大量鯉魚',
    region: '清萊',
  },
]

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

async function addHotel(hotel) {
  const properties = {
    '名稱': { title: [{ text: { content: hotel.name } }] },
    '地點': { select: { name: hotel.location } },
    '地圖連結': { url: hotel.url },
    '備註': { rich_text: [{ text: { content: hotel.note } }] },
    '星級': { select: { name: hotel.stars } },
    '價位': { select: { name: hotel.priceRange } },
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: HOTEL_DB },
    properties,
  })
}

async function addAttraction(attraction) {
  const properties = {
    '名稱': { title: [{ text: { content: attraction.name } }] },
    '分類': { select: { name: attraction.category } },
    '地圖連結': { url: attraction.url },
    '備註': { rich_text: [{ text: { content: attraction.note } }] },
    '地區': { select: { name: attraction.region } },
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: ATTRACTION_DB },
    properties,
  })
}

async function main() {
  try {
    console.log('🚀 新增剩餘資料...\n')

    // 新增清邁飯店
    console.log('🏨 新增清邁飯店...')
    for (const h of chiangMaiHotels) {
      console.log(`  + ${h.name}`)
      await addHotel(h)
    }
    console.log(`  ✓ 完成 (${chiangMaiHotels.length} 筆)\n`)

    // 新增清萊飯店
    console.log('🏨 新增清萊飯店...')
    for (const h of chiangRaiHotels) {
      console.log(`  + ${h.name}`)
      await addHotel(h)
    }
    console.log(`  ✓ 完成 (${chiangRaiHotels.length} 筆)\n`)

    // 新增清萊景點
    console.log('🏔️ 新增清萊景點...')
    for (const a of chiangRaiAttractions) {
      console.log(`  + ${a.name}`)
      await addAttraction(a)
    }
    console.log(`  ✓ 完成 (${chiangRaiAttractions.length} 筆)\n`)

    const total = chiangMaiHotels.length + chiangRaiHotels.length + chiangRaiAttractions.length
    console.log('=' .repeat(50))
    console.log(`🎉 全部完成！共新增 ${total} 筆資料`)
    console.log(`   清邁飯店: ${chiangMaiHotels.length} 筆`)
    console.log(`   清萊飯店: ${chiangRaiHotels.length} 筆`)
    console.log(`   清萊景點: ${chiangRaiAttractions.length} 筆`)

  } catch (error) {
    console.error('❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
