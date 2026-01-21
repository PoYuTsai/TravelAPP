// scripts/check-all-versions.mjs
// 檢查 Sanity 中 Daphnee 文件的所有版本
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

// 查詢所有 Daphnee 相關文件（包括 drafts）
const docs = await client.fetch(`*[_type == 'itinerary' && clientName == 'Daphnee']{
  _id,
  _updatedAt,
  startDate,
  endDate,
  "hotelCount": count(hotels),
  "firstHotel": hotels[0].hotelName,
  "firstHotelStart": hotels[0].startDate
}`)

console.log('=== 所有 Daphnee 文件 ===')
docs.forEach(d => {
  console.log(`\nID: ${d._id}`)
  console.log(`  更新時間: ${d._updatedAt}`)
  console.log(`  日期: ${d.startDate} ~ ${d.endDate}`)
  console.log(`  飯店數: ${d.hotelCount}`)
  console.log(`  第一個飯店: ${d.firstHotel} (${d.firstHotelStart})`)
})
