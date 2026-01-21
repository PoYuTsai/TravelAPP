// scripts/add-daphnee-sample.mjs
// 執行方式: node scripts/add-daphnee-sample.mjs

import { createClient } from '@sanity/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 手動讀取 .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  } catch (e) {
    // .env.local 不存在，略過
  }
}

loadEnv()

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN, // 需要寫入權限的 token
  useCdn: false,
})

const daphneeItinerary = {
  _type: 'itinerary',
  clientName: 'Daphnee',
  startDate: '2025-02-20',
  endDate: '2025-02-26',
  adults: 4,
  children: 0,
  days: [
    {
      _type: 'dayItem',
      _key: 'day1',
      date: '2025-02-20',
      title: '出發日',
      morning: '台灣',
      afternoon: '15:00到機場',
      evening: '亞航18:55-22:15',
    },
    {
      _type: 'dayItem',
      _key: 'day2',
      date: '2025-02-21',
      title: '換錢・市集日',
      morning: '換錢\n巫宗雄 mr.pierre\nNakhonping Exchange\n(帶兩萬泰銖/人)',
      afternoon: '市集: 真心市集\n(古城區)',
      evening: '市集: 白色市集\n(尼曼區)',
    },
    {
      _type: 'dayItem',
      _key: 'day3',
      date: '2025-02-22',
      title: '雨樹市集・夜間動物園',
      morning: '',
      afternoon: '市集: 雨樹市集',
      evening: '夜間動物園',
    },
    {
      _type: 'dayItem',
      _key: 'day4',
      date: '2025-02-23',
      title: '自由活動',
      morning: '',
      afternoon: '',
      evening: '',
    },
    {
      _type: 'dayItem',
      _key: 'day5',
      date: '2025-02-24',
      title: '老虎園・塔佩門',
      morning: '老虎園',
      afternoon: '',
      evening: '日落古城塔佩門拍照',
    },
    {
      _type: 'dayItem',
      _key: 'day6',
      date: '2025-02-25',
      title: '籐器街・瓦洛洛市集',
      morning: '籐器街',
      afternoon: '瓦洛洛市集\n(買伴手禮)',
      evening: '',
    },
    {
      _type: 'dayItem',
      _key: 'day7',
      date: '2025-02-26',
      title: '返程',
      morning: '9:00出發',
      afternoon: '長榮11:50-16:30\n華航11:25-15:50',
      evening: '',
    },
  ],
  hotels: [
    // 第一組 2 人的住宿路線
    {
      _type: 'hotelBooking',
      _key: 'hotel1',
      hotelName: 'BED Phrasingh',
      startDate: '2025-02-21',
      endDate: '2025-02-23',
      guests: '2人（A組）',
      color: 'green',
    },
    {
      _type: 'hotelBooking',
      _key: 'hotel2',
      hotelName: 'Riion Chiang Mai',
      startDate: '2025-02-23',
      endDate: '2025-02-25',
      guests: '2人（A組）',
      note: '不同房型',
      color: 'blue',
    },
    {
      _type: 'hotelBooking',
      _key: 'hotel3',
      hotelName: 'Ever Green Hotel',
      startDate: '2025-02-25',
      endDate: '2025-02-26',
      guests: '2人（A組）',
      color: 'orange',
    },
    // 第二組 2 人的住宿路線
    {
      _type: 'hotelBooking',
      _key: 'hotel4',
      hotelName: 'Duangtawan Hotel',
      startDate: '2025-02-21',
      endDate: '2025-02-26',
      guests: '2人（B組）',
      note: '全程同一飯店',
      color: 'yellow',
    },
  ],
  priceIncludes: '- 機場接送\n- 包車服務\n- 中文導遊',
  priceExcludes: '- 機票\n- 門票\n- 餐費\n- 個人消費',
}

async function main() {
  console.log('正在新增 Daphnee 範例資料...')

  try {
    const result = await client.create(daphneeItinerary)
    console.log('✓ 成功新增！文件 ID:', result._id)
    console.log('請到 Sanity Studio 查看並 Publish 此文件')
  } catch (error) {
    console.error('✗ 新增失敗:', error.message)

    if (error.message.includes('token')) {
      console.log('\n需要在 .env.local 設定 SANITY_API_TOKEN')
      console.log('取得方式: https://www.sanity.io/manage → 選擇專案 → API → Tokens → Add API token')
      console.log('權限選擇: Editor 或 Deploy')
    }
  }
}

main()
