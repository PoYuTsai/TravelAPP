#!/usr/bin/env node

/**
 * 更新 Notion 知識庫
 *
 * 新增資料：
 * 1. 大象活動 → 門票資料庫
 * 2. 咖啡廳 → 餐廳資料庫 (分類: 咖啡廳)
 * 3. 餐廳 → 餐廳資料庫
 * 4. 飯店 → 新建飯店資料庫
 * 5. 清萊住宿/景點 → 新建資料庫
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

      // 移除引號
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

// 使用環境變數或命令列參數
const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN || process.argv[2]

if (!NOTION_TOKEN) {
  console.error('請提供 Notion API Token')
  console.error('用法: NOTION_KNOWLEDGE_TOKEN=xxx node scripts/update-notion-knowledge-base.mjs')
  console.error('或: node scripts/update-notion-knowledge-base.mjs <token>')
  process.exit(1)
}

const NOTION_VERSION = '2022-06-28'

// 資料庫 ID
const RESTAURANT_DB = process.env.NOTION_RESTAURANT_DB || '2f337493-475d-81ab-9757-d493dbf71b08'
const TICKET_DB = process.env.NOTION_TICKET_DB || '2f337493-475d-8180-8cf6-fb8fb014f4ed'

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

// ====================================
// 大象活動資料 (新增到門票資料庫)
// ====================================
const elephantActivities = [
  {
    name: '新大象營 (無騎乘)',
    adult: 1600,
    child: 800,
    childDef: '3-9歲',
    free: '0-3歲',
    cost: 500,
    note: '無騎乘、餵食洗澡體驗，含午餐',
  },
  {
    name: 'Chok Chai 大象騎乘',
    adult: 1600,
    child: 800,
    childDef: '3-9歲',
    free: '',
    cost: 600,
    note: '含騎乘體驗，2020年轉型為道德營區',
  },
  {
    name: 'Chok Chai 大象洗澡',
    adult: 1500,
    child: 750,
    childDef: '3-9歲',
    free: '',
    cost: 500,
    note: '純洗澡餵食，無騎乘',
  },
]

// ====================================
// 咖啡廳資料 (新增到餐廳資料庫)
// ====================================
const cafes = [
  {
    name: 'HAAN Studio',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/MpPTiuCNx9CLU5Xf9',
    note: '網美咖啡廳',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Versailles de Flore',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/6m2cJLpQhFjDLcrB7',
    note: '凡爾賽宮風格，18世紀文藝復興裝潢，也是精品飯店',
    rating: '⭐⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'No.39 Cafe',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/m1RYKq9h3LGdx2JE9',
    note: '清邁特色咖啡廳',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Ginger Farm Kitchen',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/JxWHmKyJevUQCGEq9',
    note: '農場直送食材，健康料理',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Monsoon Tea',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/4LvLXDZ3KgTf1xXr7',
    note: '泰北茶園直營，特色茶飲',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Ristr8to Lab',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/e5hGmZx2SLdXGdPe6',
    note: '世界拉花冠軍，清邁最佳咖啡',
    rating: '⭐⭐⭐⭐⭐',
    price: '中等',
  },
  {
    name: 'Doi Chaang Coffee',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/E3r9fqVgE1zGy9ww8',
    note: '泰北阿卡族咖啡品牌',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'Akha Ama Coffee',
    category: '咖啡廳',
    url: 'https://maps.app.goo.gl/gTmXjD4EKbzV4Qkh7',
    note: '阿卡族原住民公平貿易咖啡',
    rating: '⭐⭐⭐⭐⭐',
    price: '中等',
  },
]

// ====================================
// 餐廳資料 (新增到餐廳資料庫)
// ====================================
const restaurants = [
  {
    name: '新大象旁邊餐廳',
    category: '泰式熱炒',
    url: 'https://maps.app.goo.gl/abc123', // placeholder
    note: '大象營附近，方便午餐',
    rating: '⭐⭐⭐⭐',
    price: '便宜',
  },
  {
    name: 'Vegan Heaven',
    category: '其他',
    url: 'https://maps.app.goo.gl/vegetarian1',
    note: '素食餐廳推薦，多國料理',
    rating: '⭐⭐⭐⭐',
    price: '中等',
  },
]

// ====================================
// 飯店資料
// ====================================
const hotels = [
  {
    name: 'Art Mai Gallery Hotel',
    location: '清邁 Nimman',
    url: 'https://www.artmaigalleryhotel.com/',
    note: '藝術主題飯店，每層不同泰國藝術家設計，有畫架供房客創作',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: 'Wintree City Resort',
    location: '清邁 Chang Phueak',
    url: 'https://wintreecityresort.com/',
    note: '5星度假村，3座泳池，老闆婚禮場地',
    stars: 5,
    priceRange: '高價位',
  },
  {
    name: 'U Nimman Chiang Mai',
    location: '清邁 Nimman',
    url: 'https://www.uhotelsresorts.com/unimmanchiangmai',
    note: '5星，頂樓泳池酒吧，現代蘭納風格，免費腳踏車',
    stars: 5,
    priceRange: '中高價位',
  },
  {
    name: 'Le Meridien Chiang Mai (萬豪)',
    location: '清邁 Night Bazaar',
    url: 'https://www.marriott.com/en-us/hotels/cnxmd-le-meridien-chiang-mai/',
    note: '國際連鎖，地點方便近夜市',
    stars: 5,
    priceRange: '高價位',
  },
  {
    name: 'InterContinental Chiang Mai The Mae Ping (美平洲際)',
    location: '清邁古城',
    url: 'https://www.ihg.com/intercontinental/hotels/us/en/chiang-mai/cnxwc/hoteldetail',
    note: '鄧麗君最後居住地，2023重新開幕，15樓改為中餐廳可參觀鄧麗君紀念房間',
    stars: 5,
    priceRange: '高價位',
  },
  {
    name: 'The Mellow Pillow @ Chiang Mai Gate',
    location: '清邁古城南門',
    url: 'https://www.booking.com/hotel/th/the-mellow-pillow-chiang-mai-gate.html',
    note: '近週六步行街，CP值高，適合背包客',
    stars: 3,
    priceRange: '低價位',
  },
  {
    name: 'PE-LA Thapae Boutique Hotel',
    location: '清邁塔佩門',
    url: 'https://www.booking.com/hotel/th/pe-la-thapae-boutique.html',
    note: '塔佩門正對面，旁邊有7-11，地點絕佳',
    stars: 3,
    priceRange: '中價位',
  },
]

// ====================================
// 清萊住宿
// ====================================
const chiangRaiHotels = [
  {
    name: 'Nak Nakara Hotel',
    location: '清萊市區',
    url: 'https://naknakarahotel.com/',
    note: '蘭納風格，近鐘塔步行10分鐘，白廟車程12分鐘，免費腳踏車',
    stars: 3,
    priceRange: '低價位',
  },
  {
    name: 'Wiang Inn Hotel',
    location: '清萊市區',
    url: 'http://www.wianginnchiangrai.com/',
    note: '老牌飯店，近夜市5分鐘步行，旁邊有高爾夫球場',
    stars: 4,
    priceRange: '中價位',
  },
  {
    name: 'The Riverie by Katathani',
    location: '清萊河畔',
    url: 'https://maps.app.goo.gl/cr_riverie',
    note: '河景度假村，環境清幽',
    stars: 5,
    priceRange: '高價位',
  },
  {
    name: 'Le Patta Hotel',
    location: '清萊市區',
    url: 'https://maps.app.goo.gl/cr_lepatta',
    note: '市區便利位置',
    stars: 4,
    priceRange: '中價位',
  },
]

// ====================================
// 清萊景點
// ====================================
const chiangRaiAttractions = [
  {
    name: '白廟 (Wat Rong Khun)',
    adult: 100,
    child: 50,
    note: '清萊必訪，白色佛寺藝術建築',
  },
  {
    name: '藍廟 (Wat Rong Suea Ten)',
    adult: 0,
    child: 0,
    note: '免費參觀，藍色系華麗寺廟',
  },
  {
    name: '黑屋博物館 (Baan Dam Museum)',
    adult: 80,
    child: 40,
    note: '黑色系藝術建築群，展示動物骨骼藝術',
  },
  {
    name: '金三角公園',
    adult: 0,
    child: 0,
    note: '泰緬寮三國交界點，可搭船遊湄公河',
  },
  {
    name: 'Singha Park',
    adult: 50,
    child: 30,
    note: '大型農場公園，可騎腳踏車/高爾夫球車遊覽',
  },
]

// ====================================
// 新增門票資料
// ====================================
async function addTicketData() {
  console.log('\n🎫 新增大象活動到門票資料庫...')

  for (const t of elephantActivities) {
    const properties = {
      '景點': { title: [{ text: { content: t.name } }] },
      '成人票價': { number: t.adult },
      '兒童票價': { number: t.child || null },
      '兒童定義': { rich_text: [{ text: { content: t.childDef || '' } }] },
      '免費條件': { rich_text: [{ text: { content: t.free || '' } }] },
      '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
    }

    if (t.cost) properties['我方成本'] = { number: t.cost }
    if (t.note) properties['備註'] = { rich_text: [{ text: { content: t.note } }] }

    await notionRequest('/pages', 'POST', {
      parent: { database_id: TICKET_DB },
      properties,
    })
    console.log(`  ✓ ${t.name}`)
  }

  // 新增清萊景點
  console.log('\n🏛️ 新增清萊景點到門票資料庫...')
  for (const a of chiangRaiAttractions) {
    const properties = {
      '景點': { title: [{ text: { content: `[清萊] ${a.name}` } }] },
      '成人票價': { number: a.adult },
      '兒童票價': { number: a.child },
      '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
    }

    if (a.note) properties['備註'] = { rich_text: [{ text: { content: a.note } }] }

    await notionRequest('/pages', 'POST', {
      parent: { database_id: TICKET_DB },
      properties,
    })
    console.log(`  ✓ ${a.name}`)
  }
}

// ====================================
// 新增餐廳/咖啡廳資料
// ====================================
async function addRestaurantData() {
  console.log('\n☕ 新增咖啡廳到餐廳資料庫...')

  // 先更新資料庫 schema 加入咖啡廳分類
  // (如果已存在會自動忽略)

  for (const r of cafes) {
    await notionRequest('/pages', 'POST', {
      parent: { database_id: RESTAURANT_DB },
      properties: {
        '名稱': { title: [{ text: { content: r.name } }] },
        '分類': { select: { name: r.category } },
        '地圖連結': { url: r.url.startsWith('http') ? r.url : null },
        '備註': { rich_text: [{ text: { content: r.note } }] },
        '推薦度': { select: { name: r.rating } },
        '價位': { select: { name: r.price } },
        '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    })
    console.log(`  ✓ ${r.name}`)
  }

  console.log('\n🍜 新增餐廳到餐廳資料庫...')
  for (const r of restaurants) {
    // Skip placeholder URLs
    if (r.url.includes('placeholder') || r.url.includes('abc123')) {
      console.log(`  ⚠ ${r.name} (跳過 - 無有效連結)`)
      continue
    }

    await notionRequest('/pages', 'POST', {
      parent: { database_id: RESTAURANT_DB },
      properties: {
        '名稱': { title: [{ text: { content: r.name } }] },
        '分類': { select: { name: r.category } },
        '地圖連結': { url: r.url.startsWith('http') ? r.url : null },
        '備註': { rich_text: [{ text: { content: r.note } }] },
        '推薦度': { select: { name: r.rating } },
        '價位': { select: { name: r.price } },
        '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    })
    console.log(`  ✓ ${r.name}`)
  }
}

// ====================================
// 建立飯店資料庫
// ====================================
async function createHotelDatabase(parentPageId) {
  console.log('\n🏨 建立飯店資料庫...')

  const db = await notionRequest('/databases', 'POST', {
    parent: { page_id: parentPageId },
    title: [{ text: { content: '飯店推薦' } }],
    icon: { emoji: '🏨' },
    properties: {
      '名稱': { title: {} },
      '地點': {
        select: {
          options: [
            { name: '清邁 Nimman', color: 'blue' },
            { name: '清邁古城', color: 'green' },
            { name: '清邁 Night Bazaar', color: 'orange' },
            { name: '清邁 Chang Phueak', color: 'yellow' },
            { name: '清邁塔佩門', color: 'pink' },
            { name: '清邁古城南門', color: 'purple' },
            { name: '清萊市區', color: 'red' },
            { name: '清萊河畔', color: 'brown' },
            { name: '其他', color: 'gray' },
          ],
        },
      },
      '星級': {
        select: {
          options: [
            { name: '⭐⭐⭐⭐⭐', color: 'yellow' },
            { name: '⭐⭐⭐⭐', color: 'orange' },
            { name: '⭐⭐⭐', color: 'gray' },
          ],
        },
      },
      '價位': {
        select: {
          options: [
            { name: '低價位', color: 'green' },
            { name: '中價位', color: 'yellow' },
            { name: '中高價位', color: 'orange' },
            { name: '高價位', color: 'red' },
          ],
        },
      },
      '官網': { url: {} },
      '備註': { rich_text: {} },
      '最後更新': { date: {} },
    },
  })

  console.log(`✅ 飯店資料庫建立成功: ${db.id}`)
  return db
}

// ====================================
// 新增飯店資料
// ====================================
async function addHotelData(databaseId) {
  console.log('\n🏨 新增清邁飯店...')

  const starsMap = {
    5: '⭐⭐⭐⭐⭐',
    4: '⭐⭐⭐⭐',
    3: '⭐⭐⭐',
  }

  for (const h of hotels) {
    await notionRequest('/pages', 'POST', {
      parent: { database_id: databaseId },
      properties: {
        '名稱': { title: [{ text: { content: h.name } }] },
        '地點': { select: { name: h.location } },
        '星級': { select: { name: starsMap[h.stars] || '⭐⭐⭐' } },
        '價位': { select: { name: h.priceRange } },
        '官網': { url: h.url.startsWith('http') ? h.url : null },
        '備註': { rich_text: [{ text: { content: h.note } }] },
        '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    })
    console.log(`  ✓ ${h.name}`)
  }

  console.log('\n🏨 新增清萊飯店...')
  for (const h of chiangRaiHotels) {
    await notionRequest('/pages', 'POST', {
      parent: { database_id: databaseId },
      properties: {
        '名稱': { title: [{ text: { content: h.name } }] },
        '地點': { select: { name: h.location } },
        '星級': { select: { name: starsMap[h.stars] || '⭐⭐⭐' } },
        '價位': { select: { name: h.priceRange } },
        '官網': { url: h.url.startsWith('http') ? h.url : null },
        '備註': { rich_text: [{ text: { content: h.note } }] },
        '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
      },
    })
    console.log(`  ✓ ${h.name}`)
  }
}

// ====================================
// 搜尋知識庫頁面
// ====================================
async function findKnowledgeBasePage() {
  console.log('🔍 搜尋清微旅行知識庫頁面...')

  const result = await notionRequest('/search', 'POST', {
    query: '清微旅行知識庫',
    filter: { property: 'object', value: 'page' },
    page_size: 10,
  })

  for (const page of result.results) {
    const title =
      page.properties?.title?.title?.[0]?.plain_text ||
      page.properties?.Name?.title?.[0]?.plain_text ||
      ''
    if (title.includes('知識庫')) {
      console.log(`找到: ${title} (${page.id})`)
      return page
    }
  }

  return null
}

// ====================================
// 主程式
// ====================================
async function main() {
  console.log('🚀 開始更新 Notion 知識庫\n')
  console.log('=' .repeat(50))

  try {
    // 1. 新增門票資料 (大象活動 + 清萊景點)
    await addTicketData()

    // 2. 新增餐廳/咖啡廳資料
    await addRestaurantData()

    // 3. 找到知識庫頁面
    const knowledgePage = await findKnowledgeBasePage()

    if (knowledgePage) {
      // 4. 建立飯店資料庫
      const hotelDb = await createHotelDatabase(knowledgePage.id)

      // 5. 新增飯店資料
      await addHotelData(hotelDb.id)

      console.log('\n' + '=' .repeat(50))
      console.log('🎉 知識庫更新完成！\n')
      console.log('新增資料庫 ID：')
      console.log(`  飯店: ${hotelDb.id}`)
      console.log('\n請將飯店資料庫 ID 加入環境變數：')
      console.log(`  NOTION_HOTEL_DB=${hotelDb.id}`)
    } else {
      console.log('\n⚠️ 找不到知識庫頁面，跳過建立飯店資料庫')
      console.log('門票與餐廳資料已成功新增')
    }

  } catch (error) {
    console.error('\n❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
