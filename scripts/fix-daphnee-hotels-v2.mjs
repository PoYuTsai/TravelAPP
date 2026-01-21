// scripts/fix-daphnee-hotels-v2.mjs
// 根據客人原始截圖修正飯店資料（正確版本）
import { createClient } from '@sanity/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

// 正確的飯店資料（根據客人原始截圖仔細對照）
// 原圖是 2025 年，我們改成 2026 年
// guests 欄位用來分組：同一組放同一行
const correctHotels = [
  // A組：BED → Riion → Ever Green（換飯店）
  {
    _key: 'bed',
    _type: 'hotelBooking',
    hotelName: 'BED Phrasingh',
    startDate: '2026-02-21',  // 入住 2/21
    endDate: '2026-02-23',    // 退房 2/23（住 2 晚）
    color: 'green',
    guests: 'A組'
  },
  {
    _key: 'riion',
    _type: 'hotelBooking',
    hotelName: 'Riion Chiang Mai',
    startDate: '2026-02-23',  // 入住 2/23
    endDate: '2026-02-25',    // 退房 2/25（住 2 晚）
    color: 'blue',
    note: '不同房型',
    guests: 'A組'
  },
  {
    _key: 'evergreen',
    _type: 'hotelBooking',
    hotelName: 'Ever Green Hotel',
    startDate: '2026-02-25',  // 入住 2/25
    endDate: '2026-02-26',    // 退房 2/26（住 1 晚）
    color: 'orange',
    guests: 'A組'
  },
  // B組：Duangtawan 全程
  {
    _key: 'duangtawan',
    _type: 'hotelBooking',
    hotelName: 'Duangtawan Hotel',
    startDate: '2026-02-20',  // 入住 2/20
    endDate: '2026-02-26',    // 退房 2/26（住 6 晚）
    color: 'yellow',
    guests: 'B組'
  }
]

async function main() {
  const doc = await client.fetch(`*[_type == 'itinerary' && clientName == 'Daphnee'][0]`)

  if (!doc) {
    console.log('找不到 Daphnee 的行程')
    return
  }

  console.log('更新前飯店資料:')
  doc.hotels.forEach(h => console.log(`  ${h.hotelName}: ${h.startDate} ~ ${h.endDate} (${h.color}) [${h.guests || '無'}]`))

  await client.patch(doc._id).set({ hotels: correctHotels }).commit()

  console.log('\n✓ 已更新為正確的飯店資料:')
  correctHotels.forEach(h => console.log(`  ${h.hotelName}: ${h.startDate} ~ ${h.endDate} (${h.color}) [${h.guests}]`))
  console.log('\n飯店會按照 guests 分組顯示在同一行')
}

main()
