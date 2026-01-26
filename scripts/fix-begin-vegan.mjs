#!/usr/bin/env node

/**
 * 修正 183 Begin Vegan 資料
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
  console.log('🔧 檢查 183 Begin Vegan...\n')

  const result = await notionRequest(`/databases/${RESTAURANT_DB}/query`, 'POST', {
    page_size: 100,
  })

  for (const page of result.results) {
    const name = page.properties['名稱']?.title?.[0]?.plain_text || ''
    const url = page.properties['地圖連結']?.url || ''
    const note = page.properties['備註']?.rich_text?.[0]?.plain_text || ''

    if (name.includes('Begin') || name.includes('Vegan Cafe')) {
      console.log('找到資料:')
      console.log(`  名稱: ${name}`)
      console.log(`  連結: ${url}`)
      console.log(`  備註: ${note}`)
      console.log(`  Page ID: ${page.id}`)
      console.log('')

      // 修正為正確的名稱和連結
      const newName = 'Begin Vegan'
      const newUrl = 'https://www.google.com/maps/place/Begin+Vegan+vegetarian+food+and+breakfast/@18.7920895,98.9933325,17z'
      const newNote = '純素早午餐，西式與泰式'

      console.log('修正為:')
      console.log(`  名稱: ${newName}`)
      console.log(`  連結: ${newUrl}`)

      await notionRequest(`/pages/${page.id}`, 'PATCH', {
        properties: {
          '名稱': { title: [{ text: { content: newName } }] },
          '地圖連結': { url: newUrl },
          '備註': { rich_text: [{ text: { content: newNote } }] },
        }
      })

      console.log('\n✓ 已修正')
      return
    }
  }

  console.log('❌ 找不到該項目')
}

main().catch(console.error)
