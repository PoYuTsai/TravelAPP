#!/usr/bin/env node

/**
 * 從飯店資料庫移除「官網」欄位
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
  console.log('🗑️  移除飯店資料庫「官網」欄位...\n')

  // 先查看資料庫結構
  const db = await notionRequest(`/databases/${HOTEL_DB}`)

  console.log('目前欄位：')
  for (const [name, prop] of Object.entries(db.properties)) {
    console.log(`  - ${name} (${prop.type})`)
  }
  console.log('')

  if (db.properties['官網']) {
    console.log('🗑️  刪除「官網」欄位...')

    // Notion API 可以透過將欄位設為 null 來移除
    await notionRequest(`/databases/${HOTEL_DB}`, 'PATCH', {
      properties: {
        '官網': null
      }
    })

    console.log('✓ 已成功刪除「官網」欄位')
  } else {
    console.log('✓ 「官網」欄位不存在，無需刪除')
  }
}

main().catch(console.error)
