#!/usr/bin/env node

/**
 * 審查飯店資料庫 URL 狀態
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

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
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch (e) {}
}
loadEnv()

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const NOTION_VERSION = '2022-06-28'
const HOTEL_DB = process.env.NOTION_HOTEL_DB

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

async function main() {
  console.log('🏨 審查飯店資料庫...\n')

  const result = await notionRequest(`/databases/${HOTEL_DB}/query`, 'POST', {
    page_size: 100,
  })

  console.log(`共 ${result.results.length} 筆飯店資料:\n`)

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || '(無名稱)'
    const location = page.properties['地點']?.select?.name || '(無地點)'
    const mapUrl = page.properties['地圖連結']?.url || '❌ 無連結'
    const stars = page.properties['星級']?.select?.name || ''
    const price = page.properties['價位']?.select?.name || ''

    console.log(`【${name}】`)
    console.log(`   地點: ${location}`)
    console.log(`   星級: ${stars} | 價位: ${price}`)
    console.log(`   連結: ${mapUrl}`)
    console.log('')
  }
}

main().catch(console.error)
