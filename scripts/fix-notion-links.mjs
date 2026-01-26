#!/usr/bin/env node

/**
 * 修正 Notion 知識庫連結
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
  } catch (e) {
    // ignore
  }
}

loadEnv()

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const NOTION_VERSION = '2022-06-28'

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

// 要修正的連結
// 使用 Google Maps 搜尋格式，確保連結穩定
const fixes = [
  {
    database: process.env.NOTION_HOTEL_DB,
    searchName: '115 Burirattana Hotel',
    // 正確的泰文名稱: บุรีรัตนา 115 โฮเทล
    newUrl: 'https://www.google.com/maps/search/Burirattana+115+Hotel+Chiang+Mai',
    urlField: '地圖連結',
  },
  {
    database: process.env.NOTION_RESTAURANT_DB,
    searchName: 'Sukjai by Pata Obasan',
    // 正確完整名稱
    newUrl: 'https://www.google.com/maps/search/Sukjai+by+Pata+Obasan+Chiang+Mai',
    urlField: '地圖連結',
  },
]

async function findAndUpdatePage(dbId, searchName, newUrl, urlField) {
  console.log(`\n🔍 搜尋: ${searchName}`)

  // 搜尋頁面
  const response = await notionRequest(`/databases/${dbId}/query`, 'POST', {
    filter: {
      property: '名稱',
      title: {
        contains: searchName.split(' ')[0], // 用第一個字搜尋
      },
    },
  })

  // 找到匹配的頁面
  let targetPage = null
  for (const page of response.results) {
    const props = page.properties
    let name = ''
    for (const key of ['名稱', '景點', '標題']) {
      if (props[key]?.title?.[0]?.plain_text) {
        name = props[key].title[0].plain_text
        break
      }
    }

    if (name.includes(searchName) || searchName.includes(name)) {
      targetPage = page
      console.log(`   找到: ${name} (${page.id})`)
      break
    }
  }

  if (!targetPage) {
    console.log(`   ❌ 找不到匹配的頁面`)
    return false
  }

  // 取得現有 URL
  const currentUrl = targetPage.properties[urlField]?.url || '(無)'
  console.log(`   現有連結: ${currentUrl}`)
  console.log(`   新連結: ${newUrl}`)

  // 更新頁面
  await notionRequest(`/pages/${targetPage.id}`, 'PATCH', {
    properties: {
      [urlField]: { url: newUrl },
    },
  })

  console.log(`   ✅ 已更新`)
  return true
}

async function main() {
  console.log('🔧 修正 Notion 知識庫連結\n')
  console.log('='.repeat(50))

  for (const fix of fixes) {
    try {
      await findAndUpdatePage(fix.database, fix.searchName, fix.newUrl, fix.urlField)
    } catch (e) {
      console.log(`   ❌ 錯誤: ${e.message}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ 完成')
}

main().catch(console.error)
