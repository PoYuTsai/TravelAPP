#!/usr/bin/env node

/**
 * 從餐廳資料庫刪除咖啡廳條目（已移至獨立咖啡廳資料庫）
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

// 要從餐廳資料庫刪除的咖啡廳（已移至咖啡廳資料庫）
const cafesToRemove = [
  'HAAN Studio',
  'Versailles de Flore',
  'No.39 Cafe',
  'Ginger Farm Kitchen',
  'Monsoon Tea',
  'Ristr8to Lab',
  'Doi Chaang Coffee',
  'Akha Ama Coffee',
]

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
  console.log('☕ 從餐廳資料庫移除咖啡廳條目...\n')

  // 查詢餐廳資料庫
  const result = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', {
    page_size: 100,
  })

  let removedCount = 0

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const category = page.properties['分類']?.select?.name || ''

    // 檢查是否為咖啡廳
    if (cafesToRemove.includes(name) || category === '咖啡廳') {
      console.log(`  刪除: ${name} (${category})`)

      // Archive the page (Notion 的刪除方式)
      await notionRequest(`/pages/${page.id}`, 'PATCH', {
        archived: true,
      })

      removedCount++
    }
  }

  console.log('')
  console.log('=' .repeat(50))
  console.log(`🎉 完成！已從餐廳資料庫移除 ${removedCount} 筆咖啡廳條目`)
  console.log('   這些咖啡廳已存在於獨立的咖啡廳資料庫中')
}

main().catch(console.error)
