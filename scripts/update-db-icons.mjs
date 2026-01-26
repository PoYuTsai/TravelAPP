#!/usr/bin/env node

/**
 * 更新 Notion 資料庫圖標
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
const CAFE_DB = process.env.NOTION_CAFE_DB
const ATTRACTION_DB = process.env.NOTION_ATTRACTION_DB

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

async function updateDatabaseIcon(dbId, emoji, dbName) {
  console.log(`🔄 更新 ${dbName} 圖標為 ${emoji}...`)

  await notionRequest(`/databases/${dbId}`, 'PATCH', {
    icon: {
      type: 'emoji',
      emoji: emoji
    }
  })

  console.log(`   ✓ 完成`)
}

async function main() {
  console.log('🎨 更新資料庫圖標...\n')

  // 更新咖啡廳資料庫圖標
  await updateDatabaseIcon(CAFE_DB, '☕', '咖啡廳推薦')

  // 更新景點資料庫圖標
  await updateDatabaseIcon(ATTRACTION_DB, '🏔️', '景點推薦')

  console.log('\n🎉 完成！')
}

main().catch(console.error)
