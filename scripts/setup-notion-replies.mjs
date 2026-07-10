#!/usr/bin/env node

/**
 * LEGACY / MANUAL-ONLY：建立全新的空白話術資料庫並填入初始資料。
 *
 * 這不是同步或 migration 腳本，不得用來修正或覆寫既有 live Notion；
 * live 話術需先人工審核，再以一次性 migration 或 Notion UI 更新。
 *
 * 使用方式（僅限已確認的全新空白資料庫）：
 * node scripts/setup-notion-replies.mjs --confirm-empty-database
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const CONFIRM_EMPTY_DATABASE_FLAG = '--confirm-empty-database'

if (!process.argv.includes(CONFIRM_EMPTY_DATABASE_FLAG)) {
  console.error(
    `❌ 這是 LEGACY / MANUAL-ONLY seed，只能建立全新空白資料庫。` +
      `若已人工確認目標為空白資料庫，請加上 ${CONFIRM_EMPTY_DATABASE_FLAG}；` +
      '不得用來修正或覆寫既有 live Notion。'
  )
  process.exit(1)
}

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

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const NOTION_VERSION = '2022-06-28'
const REPLIES_DB = process.env.NOTION_REPLIES_DB

if (!NOTION_TOKEN) {
  console.error('❌ 請設定 NOTION_KNOWLEDGE_TOKEN 環境變數')
  process.exit(1)
}

if (!REPLIES_DB) {
  console.error('❌ 請設定 NOTION_REPLIES_DB 環境變數')
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

// ====================================
// 話術資料
// ====================================

const replies = [
  // === 完整範本 ===
  {
    category: '完整範本',
    title: '報價確認範本',
    content: `<這是我們品牌官網，再麻煩請詳閱一些常見QA>
1.包車常見問題 (含用車包含費用，時間，方式等等須知)
https://chiangway-travel.com/services/car-charter
2.退款政策
https://chiangway-travel.com/cancellation

---

**包含:** 油費、停車費、過路費、外地住宿補貼
**服務角色:** 公開標準服務是泰國司機，中文導遊為選配；司機與導遊是不同專業角色。
**旅遊保險:** 旅遊保險為自由選配，THB 100／人／趟；未加購不影響包車服務。
**用車時間:** 清邁 10 小時；清萊／金三角 12 小時。基本用車時間用完後，另有 30 分鐘彈性；超過則 THB 300／小時／車，導遊不另收超時費。
**小費:** 看服務跟心意，不強制~ (有給的話司機跟導遊會很開心)

**不包含:** 門票、餐費、機票跟飯店、小費、個人花費

---

若有選配中文導遊，導遊會全程照顧大家，包含景點文化導覽、餐廳推薦點菜
我們也會全程在群組線上中文協助，幫忙預訂餐廳，協助一些意外狀況
門票費用跟餐費可以根據預算讓導遊處理
例如: 第一天換錢後先給導遊20000泰銖，交代用餐口味偏好
(如:不吃海鮮，牛肉，菜色不要太辣等等)
每一筆都會請她記錄，多退少補，這樣後續大家算錢會比較簡單跟清楚

---

確認的話要麻煩您先轉訂金 {{訂金金額}}
(尾款 {{總價}}-{{訂金金額}}={{尾款金額}}，於包車結束當天匯款)

戶名: 蔡柏裕
銀行名稱：彰化銀行
銀行代碼：009
帳號：51619501772100

**感謝您選擇我們清微旅行的包車，希望能帶給您與家人朋友們一趟難忘的清邁包車體驗!**`,
    note: '客戶確認要訂時發送，需替換 {{訂金金額}}、{{總價}}、{{尾款金額}}',
    order: 1,
  },
  {
    category: '完整範本',
    title: '收到訂金後範本',
    content: `收到款項確認沒問題！

再麻煩加一下我的個人line:
1003904

安排好車之後，我會開一個群組邀請負責的泰國司機；若有選配中文導遊，也會邀請導遊加入。Eric 與團隊會在群組協助中文聯絡。

行程會貼在群組記事本，全程有任何突發狀況我們都會隨時連絡保持聯繫與處理。`,
    note: '確認收到訂金後發送',
    order: 2,
  },
  {
    category: '完整範本',
    title: '行前提醒範本',
    content: `**溫馨提醒**

1. 泰國入境的規定是每人至少攜帶20000塊(每組家庭40000塊)的等值泰銖(也可以是台幣或美金)，雖然不一定會被抽查，建議還是遵守相關規定!

2. 清邁最好的巫宗雄匯率: {{匯率資訊}}

3. 入境要填TDAC (出國3天前先填好)
https://tdac.immigration.go.th/arrival-card/#/home

4. 清邁12~2月早晚溫差大，建議攜帶一件薄外套`,
    note: '出發前 3 天發送，需替換 {{匯率資訊}}',
    order: 3,
  },

  // === 服務說明 ===
  {
    category: '服務說明',
    title: '包含費用與保險選配',
    content: `**包車費用包含:** 油費、停車費、過路費、外地住宿補貼
**選配:** 旅遊保險為自由選配，THB 100／人／趟；未加購不影響包車服務。`,
    note: '說明包車費用包含項目與旅遊保險選配',
    order: 10,
  },
  {
    category: '服務說明',
    title: '不包含費用',
    content: `**不包含:** 門票、餐費、機票跟飯店、小費、個人花費`,
    note: '說明包車費用不包含項目',
    order: 11,
  },
  {
    category: '服務說明',
    title: '用車時間說明',
    content: `**用車時間:** 清邁 10 小時；清萊／金三角 12 小時。基本用車時間用完後，另有 30 分鐘彈性；超過則 THB 300／小時／車，導遊不另收超時費。`,
    note: '說明用車時間與超時費用',
    order: 12,
  },
  {
    category: '服務說明',
    title: '導遊服務說明',
    content: `公開標準服務是泰國司機，中文導遊為選配；司機與導遊是不同專業角色。
若有選配中文導遊，導遊會全程照顧大家，包含景點文化導覽、餐廳推薦點菜
我們也會全程在群組線上中文協助，幫忙預訂餐廳，協助一些意外狀況
門票費用跟餐費可以根據預算讓導遊處理
例如: 第一天換錢後先給導遊20000泰銖，交代用餐口味偏好
(如:不吃海鮮，牛肉，菜色不要太辣等等)
每一筆都會請她記錄，多退少補，這樣後續大家算錢會比較簡單跟清楚`,
    note: '說明導遊職責與費用處理方式',
    order: 13,
  },
  {
    category: '服務說明',
    title: '小費說明',
    content: `**小費:** 看服務跟心意，不強制~ (有給的話司機跟導遊會很開心)`,
    note: '說明小費相關',
    order: 14,
  },

  // === 行前提醒 ===
  {
    category: '行前提醒',
    title: '入境須知',
    content: `泰國入境的規定是每人至少攜帶20000塊(每組家庭40000塊)的等值泰銖(也可以是台幣或美金)，雖然不一定會被抽查，建議還是遵守相關規定!`,
    note: '說明泰國入境現金規定',
    order: 20,
  },
  {
    category: '行前提醒',
    title: '匯率資訊',
    content: `清邁最好的巫宗雄匯率: 截至 {{日期}} 最新 (泰銖:台幣=1:{{匯率}})`,
    note: '需定期更新匯率，替換 {{日期}} 和 {{匯率}}',
    order: 21,
  },
  {
    category: '行前提醒',
    title: 'TDAC 填寫提醒',
    content: `入境要填TDAC (出國3天前先填好)
https://tdac.immigration.go.th/arrival-card/#/home`,
    note: '提醒客戶填寫泰國入境卡',
    order: 22,
  },
  {
    category: '行前提醒',
    title: '天氣提醒',
    content: `清邁12~2月早晚溫差大，建議攜帶一件薄外套`,
    note: '12-2月涼季提醒',
    order: 23,
  },

  // === 付款相關 ===
  {
    category: '付款相關',
    title: '訂金付款資訊',
    content: `確認的話要麻煩您先轉訂金 {{訂金金額}}
(尾款 {{總價}}-{{訂金金額}}={{尾款金額}}，於包車結束當天匯款)

戶名: 蔡柏裕
銀行名稱：彰化銀行
銀行代碼：009
帳號：51619501772100`,
    note: '訂金付款說明，需替換金額佔位符',
    order: 30,
  },
  {
    category: '付款相關',
    title: '後續流程說明',
    content: `收到款項待確認沒問題後，再麻煩加一下我的個人line:
1003904

安排好車之後，我會開一個群組邀請負責的泰國司機；若有選配中文導遊，也會邀請導遊加入。Eric 與團隊會在群組協助中文聯絡。

行程會貼在群組記事本，全程有任何突發狀況我們都會隨時連絡保持聯繫與處理。`,
    note: '說明收到訂金後的流程',
    order: 31,
  },

  // === 連結 ===
  {
    category: '連結',
    title: '官網連結',
    content: `<這是我們品牌官網，再麻煩請詳閱一些常見QA>
1.包車常見問題 (含用車包含費用，時間，方式等等須知)
https://chiangway-travel.com/services/car-charter
2.退款政策
https://chiangway-travel.com/cancellation`,
    note: '引導客戶閱讀官網 FAQ',
    order: 40,
  },

  // === 其他 ===
  {
    category: '其他',
    title: '感謝語',
    content: `**感謝您選擇我們清微旅行的包車，希望能帶給您與家人朋友們一趟難忘的清邁包車體驗!**`,
    note: '結尾感謝語',
    order: 50,
  },
]

// ====================================
// 檢查資料庫結構
// ====================================
async function checkDatabaseSchema() {
  console.log('🔍 檢查話術資料庫結構...')

  const db = await notionRequest(`/databases/${REPLIES_DB}`)

  console.log(`📋 資料庫名稱: ${db.title?.[0]?.plain_text || '(無標題)'}`)
  console.log('📊 現有欄位:')

  for (const [name, prop] of Object.entries(db.properties)) {
    console.log(`  - ${name}: ${prop.type}`)
  }

  return db.properties
}

async function assertTargetDatabaseIsEmpty() {
  console.log('🔒 確認目標話術資料庫為空白...')
  const result = await notionRequest(`/databases/${REPLIES_DB}/query`, 'POST', {
    page_size: 1,
  })

  if (Array.isArray(result.results) && result.results.length > 0) {
    throw new Error(
      '目標話術資料庫不是空白；已中止且不會修改 schema 或新增頁面。' +
        'live 話術請改用經審核的一次性 migration 或 Notion UI 更新。'
    )
  }

  console.log('✅ 目標資料庫為空白')
}

// ====================================
// 更新資料庫結構
// ====================================
async function updateDatabaseSchema() {
  console.log('\n🔧 更新資料庫結構...')

  await notionRequest(`/databases/${REPLIES_DB}`, 'PATCH', {
    properties: {
      '標題': { title: {} },
      '分類': {
        select: {
          options: [
            { name: '完整範本', color: 'blue' },
            { name: '服務說明', color: 'green' },
            { name: '行前提醒', color: 'orange' },
            { name: '付款相關', color: 'red' },
            { name: '連結', color: 'purple' },
            { name: '其他', color: 'gray' },
          ],
        },
      },
      '內容': { rich_text: {} },
      '備註': { rich_text: {} },
      '排序': { number: {} },
    },
  })

  console.log('✅ 資料庫結構更新完成')
}

// ====================================
// 新增話術資料
// ====================================
async function addReplies() {
  console.log('\n💬 新增話術資料...\n')

  for (const r of replies) {
    try {
      await notionRequest('/pages', 'POST', {
        parent: { database_id: REPLIES_DB },
        properties: {
          '標題': { title: [{ text: { content: r.title } }] },
          '分類': { select: { name: r.category } },
          '內容': { rich_text: [{ text: { content: r.content } }] },
          '備註': { rich_text: [{ text: { content: r.note } }] },
          '排序': { number: r.order },
        },
      })
      console.log(`  ✅ [${r.category}] ${r.title}`)
    } catch (error) {
      console.error(`  ❌ [${r.category}] ${r.title}: ${error.message}`)
    }
  }
}

// ====================================
// 主程式
// ====================================
async function main() {
  console.log('🚀 開始設定話術資料庫\n')
  console.log('='.repeat(50))

  try {
    // 1. 檢查現有結構
    await checkDatabaseSchema()

    // 2. 實際確認資料庫沒有既有頁面；確認旗標本身不構成證明。
    await assertTargetDatabaseIsEmpty()

    // 3. 更新結構
    await updateDatabaseSchema()

    // 4. 新增資料
    await addReplies()

    console.log('\n' + '='.repeat(50))
    console.log('🎉 話術資料庫設定完成！')
    console.log(`\n共新增 ${replies.length} 筆話術`)
    console.log('\n分類統計:')

    const stats = {}
    for (const r of replies) {
      stats[r.category] = (stats[r.category] || 0) + 1
    }
    for (const [cat, count] of Object.entries(stats)) {
      console.log(`  - ${cat}: ${count} 筆`)
    }

  } catch (error) {
    console.error('\n❌ 發生錯誤:', error.message)
    process.exit(1)
  }
}

main()
