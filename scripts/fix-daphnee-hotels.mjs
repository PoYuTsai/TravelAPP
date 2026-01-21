// scripts/fix-daphnee-hotels.mjs
// 根據客人原始截圖修正飯店資料
import { createClient } from '@sanity/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 讀取 env
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=')
  if (key && val.length) process.env[key.trim()] = val.join('=').trim()
})

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

// 正確的飯店資料（根據客人原始截圖）
const correctHotels = [
  {
    _key: 'bed',
    _type: 'hotelBooking',
    hotelName: 'BED Phrasingh',
    startDate: '2026-02-20',
    endDate: '2026-02-22',  // 住 2 晚
    color: 'yellow',
    guests: '2人'
  },
  {
    _key: 'duangtawan',
    _type: 'hotelBooking',
    hotelName: 'Duangtawan Hotel',
    startDate: '2026-02-20',
    endDate: '2026-02-25',  // 住 5 晚
    color: 'green',
    guests: '2人'
  },
  {
    _key: 'riion',
    _type: 'hotelBooking',
    hotelName: 'Riion Chiang Mai',
    startDate: '2026-02-22',
    endDate: '2026-02-24',  // 住 2 晚
    color: 'blue',
    guests: '2人'
  },
  {
    _key: 'evergreen',
    _type: 'hotelBooking',
    hotelName: 'Ever Green Hotel',
    startDate: '2026-02-25',
    endDate: '2026-02-27',  // 住 2 晚（退房超出行程範圍）
    color: 'gray',
    guests: '2人'
  }
]

async function main() {
  const doc = await client.fetch(`*[_type == 'itinerary' && clientName == 'Daphnee'][0]`)

  if (!doc) {
    console.log('找不到 Daphnee 的行程')
    return
  }

  console.log('更新前飯店資料:')
  doc.hotels.forEach(h => console.log(`  ${h.hotelName}: ${h.startDate} ~ ${h.endDate} (${h.color})`))

  await client.patch(doc._id).set({ hotels: correctHotels }).commit()

  console.log('\n✓ 已更新為正確的飯店資料:')
  correctHotels.forEach(h => console.log(`  ${h.hotelName}: ${h.startDate} ~ ${h.endDate} (${h.color})`))
  console.log('\n請到 Sanity Studio 確認並 Publish')
}

main()
