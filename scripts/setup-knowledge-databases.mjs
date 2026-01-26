#!/usr/bin/env node

/**
 * 建立 Notion 知識庫資料庫並新增所有資料
 *
 * 功能：
 * 1. 建立咖啡廳資料庫（獨立於餐廳）
 * 2. 建立景點推薦資料庫
 * 3. 新增所有餐廳、咖啡廳、飯店、景點資料
 */

import { readFileSync, writeFileSync } from 'fs'
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
const HOTEL_DB = process.env.NOTION_HOTEL_DB

// 將從現有資料庫推斷 parent page
let CAFE_DB = process.env.NOTION_CAFE_DB
let ATTRACTION_DB = process.env.NOTION_ATTRACTION_DB

// ====================================
// 素食餐廳 (5筆)
// ====================================
const vegetarianRestaurants = [
  {
    name: 'Sukjai by Pata Obasan',
    category: '素食',
    url: 'https://www.google.com/maps/search/Sukjai+by+Pata+Obasan+Chiang+Mai',
    note: '清邁素食餐廳，泰式料理',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'Chada Vegetarian Restaurant',
    category: '素食',
    url: 'https://www.google.com/maps/search/Chada+Vegetarian+Restaurant+Chiang+Mai',
    note: '清邁古城素食餐廳',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: '183 Begin Vegan',
    category: '素食',
    url: 'https://www.google.com/maps/search/183+Begin+Vegan+Chiang+Mai',
    note: '純素早午餐，西式與泰式',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: '1 Reform Kafé',
    category: '素食',
    url: 'https://www.google.com/maps/search/1+Reform+Kafe+Vegan+Garden+Chiang+Mai',
    note: '素食花園餐廳，環境優美',
    rating: '⭐⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: '9 Payod Shan Food',
    category: '素食',
    url: 'https://www.google.com/maps/search/9+Payod+Shan+Food+Chiang+Mai',
    note: '撣族素食料理',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
]

// ====================================
// Mae Rim 地區餐廳 (5筆)
// ====================================
const maeRimRestaurants = [
  {
    name: 'Mai Heun 60',
    category: '泰式熱炒',
    url: 'https://www.google.com/maps/search/Mai+Heun+60+Mae+Rim+Chiang+Mai',
    note: 'Mae Rim 在地餐廳',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'The Kad Farang Mae Rim',
    category: '其他',
    url: 'https://www.google.com/maps/search/Kad+Farang+Mae+Rim+Chiang+Mai',
    note: 'Mae Rim 美食廣場，多元選擇',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Krua Lawng Khao',
    category: '泰式熱炒',
    url: 'https://www.google.com/maps/search/Krua+Lawng+Khao+Mae+Rim',
    note: 'Mae Rim 泰式餐廳',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'กองคำ (Gong Kham)',
    category: '泰北料理',
    url: 'https://www.google.com/maps/search/Gong+Kham+Mae+Rim+Chiang+Mai',
    note: 'Mae Rim 在地泰北料理',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'Khong Khao Mueang',
    category: '泰北料理',
    url: 'https://www.google.com/maps/search/Khong+Khao+Mueang+Mae+Rim',
    note: 'Mae Rim 泰北傳統料理',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
]

// ====================================
// 湄登地區餐廳 (5筆)
// ====================================
const maeTaengRestaurants = [
  {
    name: 'ร้านข้าวซอยแม่นาย (Khao Soy Mae Nai)',
    category: '泰北料理',
    url: 'https://www.google.com/maps/search/Khao+Soy+Mae+Nai+Mae+Taeng',
    note: '湄登著名咖哩麵店',
    rating: '⭐⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'ก๋วยเตี๋ยวหมูสวนดอก (Guay Tiew Moo Suan Dok)',
    category: '小吃',
    url: 'https://www.google.com/maps/search/Guay+Tiew+Moo+Suan+Dok+Mae+Taeng',
    note: '湄登豬肉米粉店',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'Pang Pao Beach',
    category: '景觀餐廳',
    url: 'https://www.google.com/maps/search/Pang+Pao+Beach+Mae+Taeng',
    note: '湄登河畔景觀餐廳',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Air Diamond Cafe',
    category: '景觀餐廳',
    url: 'https://www.google.com/maps/search/Air+Diamond+Cafe+Mae+Taeng',
    note: '湄登景觀咖啡廳餐廳',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Saiyut & Doctor Sai Kitchen',
    category: '泰式熱炒',
    url: 'https://www.google.com/maps/search/Saiyut+Doctor+Sai+Kitchen+Chiang+Mai',
    note: '泰式家常料理',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
]

// ====================================
// 咖啡廳 (現有 + 新增)
// ====================================
const allCafes = [
  // 之前已在餐廳資料庫的咖啡廳 (需要移動)
  { name: 'HAAN Studio', url: 'https://www.google.com/maps/search/HAAN+Studio+Chiang+Mai', note: '韓系咖啡廳，古城區', rating: '⭐⭐⭐⭐⭐', price: '中等' },
  { name: 'Versailles de Flore', url: 'https://www.google.com/maps/search/Versailles+de+Flore+Chiang+Mai', note: '法式花園咖啡廳', rating: '⭐⭐⭐⭐⭐', price: '偏貴' },
  { name: 'No.39 Cafe', url: 'https://www.google.com/maps/search/No.39+Cafe+Chiang+Mai', note: '日系簡約咖啡廳', rating: '⭐⭐⭐⭐', price: '中等' },
  { name: 'Ginger Farm Kitchen', url: 'https://www.google.com/maps/search/Ginger+Farm+Kitchen+Chiang+Mai', note: '農場餐廳咖啡廳', rating: '⭐⭐⭐⭐⭐', price: '中等' },
  { name: 'Monsoon Tea', url: 'https://www.google.com/maps/search/Monsoon+Tea+Chiang+Mai', note: '茶葉專門店', rating: '⭐⭐⭐⭐⭐', price: '中等' },
  { name: 'Ristr8to Lab', url: 'https://www.google.com/maps/search/Ristr8to+Lab+Nimmanhaemin+Chiang+Mai', note: '世界冠軍咖啡師，拉花藝術', rating: '⭐⭐⭐⭐⭐', price: '中等' },
  { name: 'Doi Chaang Coffee', url: 'https://www.google.com/maps/search/Doi+Chaang+Coffee+Chiang+Mai', note: '泰北高山咖啡品牌', rating: '⭐⭐⭐⭐', price: '便宜' },
  { name: 'Akha Ama Coffee', url: 'https://www.google.com/maps/search/Akha+Ama+Coffee+Chiang+Mai', note: '阿卡族公平貿易咖啡', rating: '⭐⭐⭐⭐⭐', price: '中等' },
  // 新增的咖啡廳
  { name: 'Roast8ry Lab', url: 'https://www.google.com/maps/search/Roast8ry+Lab+Nimman+Chiang+Mai', note: '尼曼路精品咖啡，自家烘焙', rating: '⭐⭐⭐⭐⭐', price: '中等' },
  { name: 'The Baristro Coffee Roaster', url: 'https://www.google.com/maps/search/The+Baristro+Coffee+Roaster+Chiang+Mai', note: '清邁知名咖啡烘焙店', rating: '⭐⭐⭐⭐⭐', price: '中等' },
]

// ====================================
// 清邁飯店 (新增 4筆)
// ====================================
const chiangMaiHotels = [
  {
    name: 'K Maison Lanna Boutique Hotel',
    location: '清邁古城',
    url: 'https://www.google.com/maps/search/K+Maison+Lanna+Boutique+Hotel+Chiang+Mai',
    note: '蘭納風格精品酒店',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: 'Hotel Sensai Nimman',
    location: '尼曼路',
    url: 'https://www.google.com/maps/search/Hotel+Sensai+Nimman+Chiang+Mai',
    note: '尼曼路新開幕飯店',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: '115 Burirattana Hotel',
    location: '清邁古城',
    url: 'https://www.google.com/maps/search/Burirattana+Hotel+Chiang+Mai',
    note: '古城內平價飯店',
    stars: 3,
    priceRange: '平價',
  },
  {
    name: 'ANA Park Hotel',
    location: '河濱區',
    url: 'https://www.google.com/maps/search/ANA+Park+Hotel+Chiang+Mai',
    note: '河濱區新飯店',
    stars: 4,
    priceRange: '中價位',
  },
]

// ====================================
// 清萊飯店 (新增 4筆)
// ====================================
const chiangRaiHotels = [
  {
    name: 'Riva Vista Riverfront Chiang Rai',
    location: '清萊河畔',
    url: 'https://www.google.com/maps/search/Riva+Vista+Riverfront+Chiang+Rai',
    note: '河景度假村',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: 'Lavanda Hotel Chiang Rai',
    location: '清萊市區',
    url: 'https://www.google.com/maps/search/Lavanda+Hotel+Chiang+Rai',
    note: '市區精品飯店',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: 'Sann Hotel Chiang Rai',
    location: '清萊市區',
    url: 'https://www.google.com/maps/search/Sann+Hotel+Chiang+Rai',
    note: '市區設計旅店',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: 'Clay Bed Chiangrai',
    location: '清萊市區',
    url: 'https://www.google.com/maps/search/Clay+Bed+Chiangrai',
    note: '平價設計旅店',
    stars: 3,
    priceRange: '平價',
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

async function getParentPage() {
  // 從現有餐廳資料庫取得 parent page
  const db = await notionRequest(`/databases/${RESTAURANT_DB}`)
  return db.parent
}

async function createCafeDatabase(parent) {
  console.log('☕ 建立咖啡廳資料庫...')

  const result = await notionRequest('/databases', 'POST', {
    parent,
    title: [{ text: { content: '咖啡廳推薦' } }],
    properties: {
      '名稱': { title: {} },
      '地圖連結': { url: {} },
      '備註': { rich_text: {} },
      '推薦度': {
        select: {
          options: [
            { name: '⭐⭐⭐⭐⭐', color: 'yellow' },
            { name: '⭐⭐⭐⭐', color: 'orange' },
            { name: '⭐⭐⭐', color: 'gray' },
          ]
        }
      },
      '價位': {
        select: {
          options: [
            { name: '便宜', color: 'green' },
            { name: '中等', color: 'blue' },
            { name: '偏貴', color: 'red' },
          ]
        }
      },
      '最後更新': { date: {} },
    },
  })

  console.log(`  ✓ 已建立: ${result.id}\n`)
  return result.id
}

async function createAttractionDatabase(parent) {
  console.log('🏔️ 建立景點推薦資料庫...')

  const result = await notionRequest('/databases', 'POST', {
    parent,
    title: [{ text: { content: '景點推薦' } }],
    properties: {
      '名稱': { title: {} },
      '分類': {
        select: {
          options: [
            { name: '寺廟', color: 'yellow' },
            { name: '茶園', color: 'green' },
            { name: '農場', color: 'brown' },
            { name: '皇室景點', color: 'purple' },
            { name: '自然景點', color: 'blue' },
            { name: '博物館', color: 'gray' },
            { name: '其他', color: 'default' },
          ]
        }
      },
      '地圖連結': { url: {} },
      '備註': { rich_text: {} },
      '地區': {
        select: {
          options: [
            { name: '清邁', color: 'blue' },
            { name: '清萊', color: 'green' },
            { name: 'Mae Rim', color: 'orange' },
            { name: '湄登', color: 'yellow' },
          ]
        }
      },
      '最後更新': { date: {} },
    },
  })

  console.log(`  ✓ 已建立: ${result.id}\n`)
  return result.id
}

async function addRestaurant(restaurant) {
  const properties = {
    '名稱': { title: [{ text: { content: restaurant.name } }] },
    '分類': { select: { name: restaurant.category } },
    '地圖連結': { url: restaurant.url },
    '備註': { rich_text: [{ text: { content: restaurant.note } }] },
    '推薦度': { select: { name: restaurant.rating } },
    '價位': { select: { name: restaurant.price } },
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: RESTAURANT_DB },
    properties,
  })
}

async function addCafe(cafe, cafeDbId) {
  const properties = {
    '名稱': { title: [{ text: { content: cafe.name } }] },
    '地圖連結': { url: cafe.url },
    '備註': { rich_text: [{ text: { content: cafe.note } }] },
    '推薦度': { select: { name: cafe.rating } },
    '價位': { select: { name: cafe.price } },
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: cafeDbId },
    properties,
  })
}

async function addHotel(hotel) {
  const properties = {
    '名稱': { title: [{ text: { content: hotel.name } }] },
    '地點': { rich_text: [{ text: { content: hotel.location } }] },
    '地圖連結': { url: hotel.url },
    '備註': { rich_text: [{ text: { content: hotel.note } }] },
    '星級': { number: hotel.stars },
    '價位': { select: { name: hotel.priceRange } },
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: HOTEL_DB },
    properties,
  })
}

async function addAttraction(attraction, attractionDbId) {
  const properties = {
    '名稱': { title: [{ text: { content: attraction.name } }] },
    '分類': { select: { name: attraction.category } },
    '地圖連結': { url: attraction.url },
    '備註': { rich_text: [{ text: { content: attraction.note } }] },
    '地區': { select: { name: attraction.region } },
  }

  await notionRequest('/pages', 'POST', {
    parent: { database_id: attractionDbId },
    properties,
  })
}

function updateEnvFile(cafeDbId, attractionDbId) {
  const envPath = resolve(__dirname, '../.env.local')
  let content = readFileSync(envPath, 'utf-8')

  // 添加新的資料庫 ID
  if (!content.includes('NOTION_CAFE_DB')) {
    content += `\nNOTION_CAFE_DB="${cafeDbId}"`
  }
  if (!content.includes('NOTION_ATTRACTION_DB')) {
    content += `\nNOTION_ATTRACTION_DB="${attractionDbId}"`
  }

  writeFileSync(envPath, content)
  console.log('📝 已更新 .env.local\n')
}

async function main() {
  try {
    console.log('🚀 開始設定知識庫...\n')

    // 取得 parent page
    const parent = await getParentPage()
    console.log(`📂 Parent: ${parent.page_id || parent.workspace}\n`)

    // 建立新資料庫
    const cafeDbId = await createCafeDatabase(parent)
    const attractionDbId = await createAttractionDatabase(parent)

    // 更新 .env.local
    updateEnvFile(cafeDbId, attractionDbId)

    // 新增餐廳
    console.log('🍜 新增素食餐廳...')
    for (const r of vegetarianRestaurants) {
      console.log(`  + ${r.name}`)
      await addRestaurant(r)
    }
    console.log(`  ✓ 完成 (${vegetarianRestaurants.length} 筆)\n`)

    console.log('🍜 新增 Mae Rim 餐廳...')
    for (const r of maeRimRestaurants) {
      console.log(`  + ${r.name}`)
      await addRestaurant(r)
    }
    console.log(`  ✓ 完成 (${maeRimRestaurants.length} 筆)\n`)

    console.log('🍜 新增湄登餐廳...')
    for (const r of maeTaengRestaurants) {
      console.log(`  + ${r.name}`)
      await addRestaurant(r)
    }
    console.log(`  ✓ 完成 (${maeTaengRestaurants.length} 筆)\n`)

    // 新增咖啡廳
    console.log('☕ 新增咖啡廳...')
    for (const c of allCafes) {
      console.log(`  + ${c.name}`)
      await addCafe(c, cafeDbId)
    }
    console.log(`  ✓ 完成 (${allCafes.length} 筆)\n`)

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
      await addAttraction(a, attractionDbId)
    }
    console.log(`  ✓ 完成 (${chiangRaiAttractions.length} 筆)\n`)

    // 總結
    const total = vegetarianRestaurants.length + maeRimRestaurants.length +
                  maeTaengRestaurants.length + allCafes.length +
                  chiangMaiHotels.length + chiangRaiHotels.length +
                  chiangRaiAttractions.length
    console.log('=' .repeat(50))
    console.log(`🎉 全部完成！共新增 ${total} 筆資料`)
    console.log(`   素食餐廳: ${vegetarianRestaurants.length} 筆`)
    console.log(`   Mae Rim: ${maeRimRestaurants.length} 筆`)
    console.log(`   湄登: ${maeTaengRestaurants.length} 筆`)
    console.log(`   咖啡廳: ${allCafes.length} 筆`)
    console.log(`   清邁飯店: ${chiangMaiHotels.length} 筆`)
    console.log(`   清萊飯店: ${chiangRaiHotels.length} 筆`)
    console.log(`   清萊景點: ${chiangRaiAttractions.length} 筆`)
    console.log('')
    console.log(`新資料庫 ID:`)
    console.log(`   NOTION_CAFE_DB=${cafeDbId}`)
    console.log(`   NOTION_ATTRACTION_DB=${attractionDbId}`)

  } catch (error) {
    console.error('❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
