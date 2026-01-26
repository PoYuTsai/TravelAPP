#!/usr/bin/env node

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
      if ((value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1)
      process.env[key] = value
    }
  } catch (e) {}
}

loadEnv()

const NOTION_TOKEN = process.env.NOTION_KNOWLEDGE_TOKEN
const HOTEL_DB = process.env.NOTION_HOTEL_DB

const response = await fetch(`https://api.notion.com/v1/databases/${HOTEL_DB}`, {
  headers: {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
  }
})

const data = await response.json()
console.log('飯店資料庫欄位:')
Object.entries(data.properties).forEach(([k, v]) => console.log(`  - ${k} (${v.type})`))
