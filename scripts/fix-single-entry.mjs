#!/usr/bin/env node

/**
 * 修正單筆資料
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
  console.log('🔧 修正餐廳 #4...\n')

  const result = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', {
    page_size: 100,
  })

  // 找到需要修正的項目
  const targetName = 'ครัวคุณแม่หมูกระทะ สาขาเชียงใหม่(แยกหลุยส์)'
  const newUrl = 'https://www.google.com/maps/search/ครัวคุณแม่หมูกระทะ+สาขาเชียงใหม่'

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''

    if (name === targetName) {
      const currentUrl = page.properties['地圖連結']?.url || ''

      console.log(`找到: ${name}`)
      console.log(`舊連結: ${currentUrl}`)
      console.log(`新連結: ${newUrl}`)

      await notionRequest(`/pages/${page.id}`, 'PATCH', {
        properties: {
          '地圖連結': { url: newUrl }
        }
      })

      console.log('✓ 已修正')
      return
    }
  }

  console.log('❌ 找不到該項目')
}

main().catch(console.error)
