#!/usr/bin/env node

/**
 * 檢查門票資料庫詳細內容
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
const TICKET_DB = process.env.NOTION_TICKET_DB

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
  console.log('🎫 檢查門票資料庫...\n')

  // 取得資料庫結構
  const db = await notionRequest(`/databases/${TICKET_DB}`)

  console.log('欄位結構：')
  for (const [name, prop] of Object.entries(db.properties)) {
    console.log(`  - ${name}: ${prop.type}`)
  }
  console.log('')

  // 查詢所有資料
  const result = await notionRequest(`/databases/${TICKET_DB}/query`, 'POST', {
    page_size: 100,
  })

  console.log(`共 ${result.results.length} 筆資料：\n`)

  for (const page of result.results) {
    const props = page.properties

    // 找出 title 欄位
    let titleField = ''
    for (const [name, prop] of Object.entries(props)) {
      if (prop.type === 'title') {
        titleField = prop.title?.[0]?.plain_text || '(空)'
        console.log(`【${titleField}】(欄位: ${name})`)
        break
      }
    }

    // 顯示其他欄位
    const adultPrice = props['成人票價']?.number || '-'
    const childPrice = props['兒童票價']?.number || '-'
    const note = props['備註']?.rich_text?.[0]?.plain_text || ''

    console.log(`   成人: ${adultPrice} | 兒童: ${childPrice}`)
    if (note) console.log(`   備註: ${note}`)
    console.log('')
  }
}

main().catch(console.error)
