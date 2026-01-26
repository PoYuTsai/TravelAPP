#!/usr/bin/env node

/**
 * 全面審查所有知識庫資料庫
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
  '🍜 餐廳推薦': process.env.NOTION_RESTAURANT_DB,
  '☕ 咖啡廳推薦': process.env.NOTION_CAFE_DB,
  '🏨 飯店推薦': process.env.NOTION_HOTEL_DB,
  '🏔️ 景點推薦': process.env.NOTION_ATTRACTION_DB,
  '🎫 門票資訊': process.env.NOTION_TICKET_DB,
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
    console.error('API 錯誤:', data)
    throw new Error(data.message || 'Notion API 錯誤')
  }

  return data
}

async function auditDatabase(name, dbId) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${name}`)
  console.log('='.repeat(60))

  if (!dbId) {
    console.log('❌ 資料庫 ID 未設定')
    return { name, total: 0, issues: ['資料庫 ID 未設定'] }
  }

  // 取得資料庫結構
  const db = await notionRequest(`/databases/${dbId}`)
  console.log(`\n📋 欄位: ${Object.keys(db.properties).join(', ')}`)

  // 查詢所有資料
  const result = await notionRequest(`/databases/${dbId}/query`, 'POST', {
    page_size: 100,
  })

  console.log(`📊 總筆數: ${result.results.length}`)

  const issues = []
  let missingUrl = 0
  let missingName = 0

  console.log('\n📝 資料列表:')
  for (const page of result.results) {
    const props = page.properties
    const nameField = props['名稱']?.title?.[0]?.plain_text || ''

    // 檢查地圖連結
    const mapUrl = props['地圖連結']?.url || ''

    // 檢查其他可能的 URL 欄位
    const otherUrl = props['連結']?.url || props['官網']?.url || ''

    let status = '✓'
    let warning = ''

    if (!nameField) {
      status = '❌'
      warning = ' [無名稱]'
      missingName++
    }

    if (!mapUrl && !otherUrl) {
      if (status === '✓') status = '⚠️'
      warning += ' [無連結]'
      missingUrl++
    }

    // 檢查是否為短連結
    if (mapUrl && mapUrl.includes('maps.app.goo.gl')) {
      if (status === '✓') status = '⚠️'
      warning += ' [短連結]'
    }

    const displayUrl = mapUrl || otherUrl || '(無)'
    console.log(`  ${status} ${nameField || '(無名稱)'}${warning}`)
    console.log(`     ${displayUrl.substring(0, 70)}${displayUrl.length > 70 ? '...' : ''}`)
  }

  if (missingUrl > 0) {
    issues.push(`${missingUrl} 筆缺少連結`)
  }
  if (missingName > 0) {
    issues.push(`${missingName} 筆缺少名稱`)
  }

  console.log(`\n📈 統計: ${result.results.length} 筆資料`)
  if (issues.length > 0) {
    console.log(`⚠️  問題: ${issues.join(', ')}`)
  } else {
    console.log('✅ 無問題')
  }

  return {
    name,
    total: result.results.length,
    issues
  }
}

async function main() {
  console.log('🔍 全面審查知識庫資料庫')
  console.log('=' .repeat(60))

  const results = []

  for (const [name, dbId] of Object.entries(databases)) {
    try {
      const result = await auditDatabase(name, dbId)
      results.push(result)
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`)
      results.push({ name, total: 0, issues: [error.message] })
    }
  }

  // 總結
  console.log('\n')
  console.log('=' .repeat(60))
  console.log('📊 總結報告')
  console.log('=' .repeat(60))

  let totalRecords = 0
  let totalIssues = 0

  for (const r of results) {
    const issueText = r.issues.length > 0 ? ` ⚠️ ${r.issues.join(', ')}` : ' ✅'
    console.log(`${r.name}: ${r.total} 筆${issueText}`)
    totalRecords += r.total
    totalIssues += r.issues.length
  }

  console.log('')
  console.log(`總計: ${totalRecords} 筆資料`)
  if (totalIssues > 0) {
    console.log(`⚠️  共 ${totalIssues} 個問題需要處理`)
  } else {
    console.log('✅ 所有資料庫正常')
  }
}

main().catch(console.error)
