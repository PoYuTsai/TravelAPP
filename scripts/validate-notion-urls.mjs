#!/usr/bin/env node

/**
 * 驗證 Notion 知識庫中所有 URL 的有效性
 * 列出所有 URL 供人工檢查
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
const RESTAURANT_DB = process.env.NOTION_RESTAURANT_DB
const TICKET_DB = process.env.NOTION_TICKET_DB
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
  return await response.json()
}

async function listAllUrls() {
  console.log('📋 列出所有 Notion 知識庫 URL\n')
  console.log('=' .repeat(60))

  // 餐廳資料庫
  console.log('\n🍜 餐廳資料庫')
  console.log('-' .repeat(60))
  const restaurants = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', { page_size: 100 })

  for (const page of restaurants.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || '(無名稱)'
    const url = page.properties['地圖連結']?.url || '(無連結)'
    const isPlaceholder = url.includes('abc123') || url.includes('placeholder') || url.includes('vegetarian')

    console.log(`${isPlaceholder ? '⚠️' : '✓'} ${name}`)
    console.log(`   ${url}`)
  }

  // 飯店資料庫
  console.log('\n🏨 飯店資料庫')
  console.log('-' .repeat(60))
  const hotels = await notionRequest(`/databases/${HOTEL_DB}/query`, 'POST', { page_size: 100 })

  for (const page of hotels.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || '(無名稱)'
    const url = page.properties['官網']?.url || '(無連結)'
    const isPlaceholder = url.includes('cr_') || url.includes('placeholder')

    console.log(`${isPlaceholder ? '⚠️' : '✓'} ${name}`)
    console.log(`   ${url}`)
  }

  // 門票資料庫 (通常沒有 URL)
  console.log('\n🎫 門票資料庫')
  console.log('-' .repeat(60))
  const tickets = await notionRequest(`/databases/${TICKET_DB}/query`, 'POST', { page_size: 100 })

  for (const page of tickets.results) {
    const name = page.properties['景點']?.title?.[0]?.plain_text || '(無名稱)'
    console.log(`✓ ${name}`)
  }

  console.log('\n' + '=' .repeat(60))
  console.log('檢查完成！⚠️ 標記的項目需要修復')
}

listAllUrls().catch(console.error)
