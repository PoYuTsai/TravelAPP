#!/usr/bin/env node

/**
 * 詳細審查所有資料庫 - 列出完整資訊供人工檢查
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

const databases = {
  '餐廳': process.env.NOTION_RESTAURANT_DB,
  '咖啡廳': process.env.NOTION_CAFE_DB,
  '飯店': process.env.NOTION_HOTEL_DB,
  '景點': process.env.NOTION_ATTRACTION_DB,
}

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
    throw new Error(data.message || 'Notion API 錯誤')
  }

  return data
}

// 從 URL 提取搜尋詞
function extractSearchTerm(url) {
  if (!url) return '(無連結)'

  const match = url.match(/\/search\/([^?]+)/)
  if (match) {
    return decodeURIComponent(match[1].replace(/\+/g, ' '))
  }

  const placeMatch = url.match(/\/place\/([^/@]+)/)
  if (placeMatch) {
    return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
  }

  return url.substring(0, 60) + '...'
}

async function auditDatabase(name, dbId) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🔍 ${name}推薦`)
  console.log('='.repeat(70))

  const result = await notionRequest(`/databases/${dbId}/query`, 'POST', {
    page_size: 100,
  })

  console.log(`共 ${result.results.length} 筆\n`)
  console.log('編號 | 名稱 | 連結搜尋詞')
  console.log('-'.repeat(70))

  let index = 1
  for (const page of result.results) {
    const props = page.properties
    const dbName = props['名稱']?.title?.[0]?.plain_text || '(無名稱)'
    const mapUrl = props['地圖連結']?.url || ''
    const searchTerm = extractSearchTerm(mapUrl)

    // 標記可能有問題的項目
    let flag = ''
    if (!mapUrl) {
      flag = '❌ 無連結'
    } else if (mapUrl.includes('share.google') || mapUrl.includes('maps.app.goo.gl')) {
      flag = '⚠️ 短連結'
    }

    console.log(`${String(index).padStart(2)}. ${dbName}`)
    console.log(`    → ${searchTerm} ${flag}`)
    index++
  }

  return result.results.length
}

async function main() {
  console.log('📋 詳細審查所有知識庫資料')
  console.log('請檢查每筆資料的「名稱」和「連結搜尋詞」是否對應正確\n')

  for (const [name, dbId] of Object.entries(databases)) {
    if (dbId) {
      await auditDatabase(name, dbId)
    }
  }

  console.log('\n\n' + '='.repeat(70))
  console.log('📝 請回報需要修正的項目編號和正確資訊')
  console.log('='.repeat(70))
}

main().catch(console.error)
