#!/usr/bin/env node

/**
 * 設定 Notion 知識庫
 *
 * 建立以下資料庫：
 * 1. 餐廳資料庫
 * 2. 門票資料庫
 * 3. 話術資料庫
 */

// 使用命令列傳入的 token，避免寫入程式碼
const NOTION_TOKEN = process.argv[2]

if (!NOTION_TOKEN) {
  console.error('請提供 Notion API Token')
  console.error('用法: node scripts/setup-notion-knowledge-base.mjs <token>')
  process.exit(1)
}

const NOTION_VERSION = '2022-06-28'

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

// 搜尋使用者有權限的頁面
async function searchPages() {
  console.log('🔍 搜尋可用的頁面...')

  const result = await notionRequest('/search', 'POST', {
    filter: { property: 'object', value: 'page' },
    page_size: 10,
  })

  console.log(`找到 ${result.results.length} 個頁面`)

  for (const page of result.results) {
    const title = page.properties?.title?.title?.[0]?.plain_text ||
                  page.properties?.Name?.title?.[0]?.plain_text ||
                  '(無標題)'
    console.log(`  - ${title} (${page.id})`)
  }

  return result.results
}

// 建立知識庫父頁面
async function createKnowledgeBasePage(parentPageId) {
  console.log('\n📁 建立「清微旅行知識庫」頁面...')

  const page = await notionRequest('/pages', 'POST', {
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [{ text: { content: '清微旅行知識庫' } }]
      }
    },
    icon: { emoji: '📚' },
    children: [
      {
        object: 'block',
        type: 'callout',
        callout: {
          icon: { emoji: '💡' },
          rich_text: [{ text: { content: '此知識庫包含餐廳推薦、門票價格、常用話術等營運資料。' } }]
        }
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: '資料庫' } }]
        }
      }
    ]
  })

  console.log(`✅ 頁面建立成功: ${page.id}`)
  return page
}

// 建立餐廳資料庫
async function createRestaurantDatabase(parentPageId) {
  console.log('\n🍜 建立餐廳資料庫...')

  const db = await notionRequest('/databases', 'POST', {
    parent: { page_id: parentPageId },
    title: [{ text: { content: '餐廳推薦' } }],
    icon: { emoji: '🍜' },
    properties: {
      '名稱': { title: {} },
      '分類': {
        select: {
          options: [
            { name: '泰式熱炒', color: 'red' },
            { name: '泰式燒烤', color: 'orange' },
            { name: '小陶鍋', color: 'yellow' },
            { name: '脆皮豬', color: 'brown' },
            { name: '海鮮', color: 'blue' },
            { name: '咖啡廳', color: 'pink' },
            { name: '甜點', color: 'purple' },
            { name: '其他', color: 'gray' },
          ]
        }
      },
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
            { name: '中等', color: 'yellow' },
            { name: '偏貴', color: 'red' },
          ]
        }
      },
      '最後更新': { date: {} },
    }
  })

  console.log(`✅ 餐廳資料庫建立成功: ${db.id}`)
  return db
}

// 建立門票資料庫
async function createTicketDatabase(parentPageId) {
  console.log('\n🎫 建立門票資料庫...')

  const db = await notionRequest('/databases', 'POST', {
    parent: { page_id: parentPageId },
    title: [{ text: { content: '門票價格' } }],
    icon: { emoji: '🎫' },
    properties: {
      '景點': { title: {} },
      '成人票價': { number: { format: 'number' } },
      '兒童票價': { number: { format: 'number' } },
      '兒童定義': { rich_text: {} },
      '免費條件': { rich_text: {} },
      '我方成本': { number: { format: 'number' } },
      '售價含餐': { number: { format: 'number' } },
      '備註': { rich_text: {} },
      '最後更新': { date: {} },
    }
  })

  console.log(`✅ 門票資料庫建立成功: ${db.id}`)
  return db
}

// 建立話術資料庫
async function createRepliesDatabase(parentPageId) {
  console.log('\n💬 建立話術資料庫...')

  const db = await notionRequest('/databases', 'POST', {
    parent: { page_id: parentPageId },
    title: [{ text: { content: '常用話術' } }],
    icon: { emoji: '💬' },
    properties: {
      '標題': { title: {} },
      '情境': {
        select: {
          options: [
            { name: '詢價', color: 'blue' },
            { name: '天氣', color: 'yellow' },
            { name: '行程確認', color: 'green' },
            { name: '售後', color: 'purple' },
            { name: '景點介紹', color: 'orange' },
            { name: '其他', color: 'gray' },
          ]
        }
      },
      '回覆內容': { rich_text: {} },
      '備註': { rich_text: {} },
    }
  })

  console.log(`✅ 話術資料庫建立成功: ${db.id}`)
  return db
}

// 新增餐廳資料
async function addRestaurantData(databaseId) {
  console.log('\n📝 新增餐廳資料...')

  const restaurants = [
    {
      name: 'ถูก อิ่ม อร่อย ข้าวต้ม 1 บาท',
      category: '泰式熱炒',
      url: 'https://share.google/pZKCSvpdiRHa1ujRx',
      note: '1฿粥，超便宜',
      rating: '⭐⭐⭐⭐⭐',
      price: '便宜',
    },
    {
      name: 'หมูกระทะช้างเผือก',
      category: '泰式燒烤',
      url: 'https://share.google/kQ9nYyvg0QSEojaMF',
      note: '',
      rating: '⭐⭐⭐⭐',
      price: '中等',
    },
    {
      name: 'หมูจุ่มเจ้โส',
      category: '小陶鍋',
      url: 'https://share.google/wbGFRY05ZoPVfKnQx',
      note: '',
      rating: '⭐⭐⭐⭐',
      price: '中等',
    },
    {
      name: "Neng's Clay Oven Roasted Pork – Muang Mai Market",
      category: '脆皮豬',
      url: 'https://share.google/zki4Nm7NWLQU4D9dn',
      note: '',
      rating: '⭐⭐⭐⭐⭐',
      price: '中等',
    },
    {
      name: '海鮮燒烤369吃到飽',
      category: '海鮮',
      url: 'https://maps.app.goo.gl/qRRwG4nmiZU1MEMG6',
      note: '新鮮海鮮+燒烤吃到飽',
      rating: '⭐⭐⭐⭐',
      price: '中等',
    },
  ]

  for (const r of restaurants) {
    await notionRequest('/pages', 'POST', {
      parent: { database_id: databaseId },
      properties: {
        '名稱': { title: [{ text: { content: r.name } }] },
        '分類': { select: { name: r.category } },
        '地圖連結': { url: r.url },
        '備註': { rich_text: [{ text: { content: r.note } }] },
        '推薦度': { select: { name: r.rating } },
        '價位': { select: { name: r.price } },
        '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
      }
    })
    console.log(`  ✓ ${r.name}`)
  }
}

// 新增門票資料
async function addTicketData(databaseId) {
  console.log('\n📝 新增門票資料...')

  const tickets = [
    { name: '夜間動物園', adult: 1200, child: 600, childDef: '101-140cm', free: '100cm以下' },
    { name: '大象保護營', adult: 1600, child: 800, childDef: '3-9歲', free: '0-3歲', cost: 600, sellPrice: 1600 },
    { name: 'ATV越野車 10km (1小時)', adult: 2000, child: 800, childDef: '後座乘客', free: '' },
    { name: 'ATV越野車 20km (2小時)', adult: 3000, child: 1300, childDef: '後座乘客', free: '' },
    { name: '白河漂流 7km (1小時)', adult: 1200, child: 1200, childDef: '', free: '' },
    { name: '白河漂流 10km (2小時)', adult: 1800, child: 1800, childDef: '', free: '' },
    { name: '大象便便造紙公園', adult: 150, child: 150, childDef: '', free: '0-3歲' },
    { name: '清邁大峽谷水上樂園', adult: 950, child: 750, childDef: '90-120cm', free: '90cm以下' },
    { name: '3D博物館', adult: 400, child: 240, childDef: '100-140cm', free: '100cm以下' },
    { name: '茵他儂國家公園', adult: 300, child: 150, childDef: '3-14歲', free: '0-3歲' },
    { name: '豬豬農場 (Uncle Pong Mini Zoo)', adult: 200, child: 200, childDef: '', free: '' },
    { name: 'Phoenix Adventure Park 小火車', adult: 90, child: 90, childDef: '', free: '2歲以下' },
    { name: '長頸村', adult: 300, child: 300, childDef: '', free: '' },
    { name: '清道竹伐', adult: 500, child: 500, childDef: '', free: '', note: '每艘2-3人' },
  ]

  for (const t of tickets) {
    const properties = {
      '景點': { title: [{ text: { content: t.name } }] },
      '成人票價': { number: t.adult },
      '兒童票價': { number: t.child || null },
      '兒童定義': { rich_text: [{ text: { content: t.childDef || '' } }] },
      '免費條件': { rich_text: [{ text: { content: t.free || '' } }] },
      '最後更新': { date: { start: new Date().toISOString().split('T')[0] } },
    }

    if (t.cost) properties['我方成本'] = { number: t.cost }
    if (t.sellPrice) properties['售價含餐'] = { number: t.sellPrice }
    if (t.note) properties['備註'] = { rich_text: [{ text: { content: t.note } }] }

    await notionRequest('/pages', 'POST', {
      parent: { database_id: databaseId },
      properties,
    })
    console.log(`  ✓ ${t.name}`)
  }
}

// 主程式
async function main() {
  console.log('🚀 開始設定 Notion 知識庫\n')
  console.log('=' .repeat(50))

  try {
    // 1. 搜尋可用頁面
    const pages = await searchPages()

    if (pages.length === 0) {
      console.log('\n⚠️ 找不到任何頁面。請確保：')
      console.log('1. 在 Notion 中建立一個頁面')
      console.log('2. 在該頁面的「...」選單中選擇「Connections」')
      console.log('3. 將你的 Integration 加入到該頁面')
      return
    }

    // 使用第一個頁面作為父頁面
    const parentPage = pages[0]
    const parentTitle = parentPage.properties?.title?.title?.[0]?.plain_text ||
                        parentPage.properties?.Name?.title?.[0]?.plain_text ||
                        '(無標題)'

    console.log(`\n📌 將在「${parentTitle}」下建立知識庫`)
    console.log('=' .repeat(50))

    // 2. 建立知識庫父頁面
    const knowledgePage = await createKnowledgeBasePage(parentPage.id)

    // 3. 建立資料庫
    const restaurantDb = await createRestaurantDatabase(knowledgePage.id)
    const ticketDb = await createTicketDatabase(knowledgePage.id)
    const repliesDb = await createRepliesDatabase(knowledgePage.id)

    // 4. 新增初始資料
    await addRestaurantData(restaurantDb.id)
    await addTicketData(ticketDb.id)

    console.log('\n' + '=' .repeat(50))
    console.log('🎉 知識庫設定完成！\n')
    console.log('資料庫 ID：')
    console.log(`  餐廳: ${restaurantDb.id}`)
    console.log(`  門票: ${ticketDb.id}`)
    console.log(`  話術: ${repliesDb.id}`)
    console.log('\n請將這些 ID 加入環境變數或設定檔中。')

  } catch (error) {
    console.error('\n❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
