// scripts/fix-daphnee-hotels-v3.mjs
// 修正：2/20 到達當天就要入住
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

// 正確的飯店資料
// 2/20 到達，當天就入住！
const correctHotels = [
  // A組：BED → Riion → Ever Green
  {
    _key: 'bed',
    _type: 'hotelBooking',
    hotelName: 'BED Phrasingh',
    startDate: '2026-02-20',  // 入住 2/20（到達當天）
    endDate: '2026-02-23',    // 退房 2/23（住 3 晚）
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
  doc.hotels.forEach(h => console.log(`  ${h.hotelName}: ${h.startDate} ~ ${h.endDate}`))

  await client.patch(doc._id).set({ hotels: correctHotels }).commit()

  console.log('\n✓ 已更新飯店資料:')
  correctHotels.forEach(h => {
    const nights = Math.round((new Date(h.endDate) - new Date(h.startDate)) / (1000*60*60*24))
    console.log(`  ${h.hotelName}: ${h.startDate} ~ ${h.endDate} (${nights}晚) [${h.guests}]`)
  })
}

main()
