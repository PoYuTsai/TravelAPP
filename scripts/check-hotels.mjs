// scripts/check-hotels.mjs
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

const doc = await client.fetch(`*[_type == 'itinerary' && clientName == 'Daphnee'][0]`)

console.log('=== Daphnee 行程資料 ===')
console.log('日期範圍:', doc.startDate, '~', doc.endDate)
console.log('\n每日行程日期:')
doc.days.forEach((d, i) => console.log(`  Day ${i+1}: ${d.date}`))

console.log('\n飯店資料:')
doc.hotels.forEach((h, i) => {
  console.log(`  ${i+1}. ${h.hotelName}`)
  console.log(`     入住: ${h.startDate}, 退房: ${h.endDate}`)
  console.log(`     顏色: ${h.color || 'yellow'}`)
})
