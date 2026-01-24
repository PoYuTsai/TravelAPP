// scripts/seed-north-thailand-tour.mjs
// 執行方式: SANITY_TOKEN=your-token node scripts/seed-north-thailand-tour.mjs

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

const tourPackage = {
  _type: 'tourPackage',
  title: '泰北親子深度遊 7天6夜',
  slug: {
    _type: 'slug',
    current: 'north-thailand-deep-tour-7d6n',
  },
  subtitle: '住進我們芳縣的家，一路玩到金三角',
  duration: '7天6夜',
  highlights: [
    '金三角',
    '一遊兩國',
    '芳縣民宿',
    '大象互動',
    'ATV越野',
    '茵他儂',
  ],
  order: 2,
  suitableFor: [
    '來過清邁，想跑遠一點 — 金三角、清萊、芳縣，一次收集泰北精華（或是第一次就想深度探索泰北）',
    '孩子 5 歲以上，喜歡冒險 — ATV 越野車、大象互動、長頸村探訪',
    '想住進真正的「在地人家」— 我們芳縣的民宿，老闆與老闆娘親自招待',
    '不想每天換飯店 — 清萊連住兩晚、古城連住兩晚，行李不用一直拖',
  ],
  dailySchedule: [
    {
      _key: 'day1',
      day: 1,
      emoji: '✈️',
      title: '接機・古城輕旅行',
      activities: '機場接機 → 素帖山雙龍寺 → 夜間動物園 或 夜市晚餐',
    },
    {
      _key: 'day2',
      day: 2,
      emoji: '🐘',
      title: '大象・ATV・芳縣',
      activities: '新大象之家 → ATV 越野車 → 入住芳縣民宿・雲南火鍋晚餐',
    },
    {
      _key: 'day3',
      day: 3,
      emoji: '🚢',
      title: '金三角・一遊兩國',
      activities: '美塞關口 → 天空步道 → 金三角大佛 → 湄公河遊船 → 清萊夜市',
    },
    {
      _key: 'day4',
      day: 4,
      emoji: '🏛️',
      title: '清萊經典廟宇巡禮',
      activities: '黑屋 → 藍廟 → 河畔咖啡廳 → 觀音寺 → 白廟',
    },
    {
      _key: 'day5',
      day: 5,
      emoji: '🌳',
      title: '清萊返回清邁',
      activities: '長頸村 → 溫泉休息站 → 湄康蓬村 → 巨樹咖啡廳 → 瓦洛洛市場',
    },
    {
      _key: 'day6',
      day: 6,
      emoji: '⛰️',
      title: '茵他儂國家公園',
      activities: '泰國最高峰・雙龍塔 → 卡倫族生態村 → 苗族市場午餐 → 寧曼路晚餐',
    },
    {
      _key: 'day7',
      day: 7,
      emoji: '✈️',
      title: '送機・平安返家',
      activities: '飯店 Check-out → 機場送機',
    },
  ],
  includes: [
    '機場接送機',
    '導遊費用（全程中文導遊）',
    '芳縣民宿一晚（含早餐）',
    '外地城市住宿補貼',
    '油費、停車費、過路費',
    '泰國旅遊保險',
  ],
  excludes: [
    '機票',
    '清萊、古城住宿（客人自行預訂）',
    '景點門票、湄公河遊船費',
    '巨樹咖啡廳當地接駁車費用',
    '午餐、晚餐（早餐由飯店提供）',
    '按摩費用',
    '司機與導遊小費',
    '個人消費與紀念品',
  ],
  priceRange: '฿41,300 起',
  priceNote: '1-9人同價（一台車），含全程導遊、芳縣民宿一晚',
}

async function seed() {
  console.log('正在上架套餐...')

  try {
    const result = await client.create(tourPackage)
    console.log('✅ 上架成功!')
    console.log('ID:', result._id)
    console.log('標題:', result.title)
    console.log('')
    console.log('👉 請到 Sanity Studio 上傳封面圖')
  } catch (error) {
    console.error('❌ 上架失敗:', error.message)
  }
}

seed()
