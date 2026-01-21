// scripts/fix-evergreen.mjs
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
console.log('目前 Ever Green endDate:', doc.hotels.find(h => h.hotelName === 'Ever Green Hotel')?.endDate)

// 更新 Ever Green 退房日為 2/27
const updatedHotels = doc.hotels.map(h =>
  h.hotelName === 'Ever Green Hotel'
    ? { ...h, endDate: '2026-02-27' }
    : h
)

await client.patch(doc._id).set({ hotels: updatedHotels }).commit()
console.log('✓ Ever Green 退房日已更新為 2026-02-27')
