// scripts/update-daphnee-year.mjs
// 執行方式: node scripts/update-daphnee-year.mjs

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
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

async function main() {
  console.log('正在更新 Daphnee 的日期為 2026 年...')

  try {
    // 查詢 Daphnee 的文件
    const doc = await client.fetch(`*[_type == "itinerary" && clientName == "Daphnee"][0]`)

    if (!doc) {
      console.log('找不到 Daphnee 的行程')
      return
    }

    console.log('找到文件 ID:', doc._id)

    // 更新 days 的日期 (2025 -> 2026)
    const updatedDays = doc.days.map(day => ({
      ...day,
      date: day.date.replace('2025-', '2026-')
    }))

    // 更新 hotels 的日期
    const updatedHotels = doc.hotels?.map(hotel => ({
      ...hotel,
      startDate: hotel.startDate.replace('2025-', '2026-'),
      endDate: hotel.endDate.replace('2025-', '2026-')
    })) || []

    // 更新文件
    await client
      .patch(doc._id)
      .set({
        startDate: doc.startDate.replace('2025-', '2026-'),
        endDate: doc.endDate.replace('2025-', '2026-'),
        days: updatedDays,
        hotels: updatedHotels,
      })
      .commit()

    console.log('✓ 成功更新！')
    console.log('  出發日期:', doc.startDate, '->', doc.startDate.replace('2025-', '2026-'))
    console.log('  結束日期:', doc.endDate, '->', doc.endDate.replace('2025-', '2026-'))
    console.log('  已更新', updatedDays.length, '天行程')
    console.log('  已更新', updatedHotels.length, '個飯店')
    console.log('\n請到 Sanity Studio 確認並 Publish')
  } catch (error) {
    console.error('✗ 更新失敗:', error.message)
  }
}

main()
