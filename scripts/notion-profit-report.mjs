import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { Client } = require('@notionhq/client')
const ExcelJS = require('exceljs')

// ===== 設定 =====
const NOTION_TOKEN = process.env.NOTION_TOKEN
const DATABASE_ID = '26037493-475d-8115-bb53-000ba2f98287'

if (!NOTION_TOKEN) {
  console.error('請設定 NOTION_TOKEN 環境變數')
  process.exit(1)
}

const notion = new Client({ auth: NOTION_TOKEN })

// ===== 利潤解析函數 =====
function extractProfit(text) {
  if (!text || text.trim() === '') return { value: 0, confident: false }

  // 移除換行，統一處理
  const cleanText = text.replace(/\n/g, ' ').trim()

  // 策略1: 如果開頭就是數字（可能有逗號），後面接空格或中文或括號
  const startWithNumber = cleanText.match(/^([\d,]+(?:\.\d+)?)\s*[（(\u4e00-\u9fff]/)
  if (startWithNumber) {
    const num = parseFloat(startWithNumber[1].replace(/,/g, ''))
    if (!isNaN(num)) return { value: num, confident: true }
  }

  // 策略2: 找最後一個 "= 數字" 的模式
  const equalPatterns = cleanText.match(/=\s*([\d,]+(?:\.\d+)?)/g)
  if (equalPatterns && equalPatterns.length > 0) {
    const lastEqual = equalPatterns[equalPatterns.length - 1]
    const num = parseFloat(lastEqual.replace(/[=\s,]/g, ''))
    if (!isNaN(num)) return { value: num, confident: true }
  }

  // 策略3: 簡單算式 (例如 7200+1000)
  const simpleCalc = cleanText.match(/^([\d,]+)\s*([+\-])\s*([\d,]+)$/)
  if (simpleCalc) {
    const a = parseFloat(simpleCalc[1].replace(/,/g, ''))
    const b = parseFloat(simpleCalc[3].replace(/,/g, ''))
    const op = simpleCalc[2]
    const result = op === '+' ? a + b : a - b
    return { value: result, confident: true }
  }

  // 策略4: 找第一個獨立的數字
  const firstNumber = cleanText.match(/([\d,]+(?:\.\d+)?)/)
  if (firstNumber) {
    const num = parseFloat(firstNumber[1].replace(/,/g, ''))
    if (!isNaN(num) && num > 0) return { value: num, confident: false }
  }

  return { value: 0, confident: false }
}

// ===== 日期解析函數 =====
function extractMonth(dateValue) {
  if (!dateValue) return null

  // Notion date 可能是 { start: "2026-01-02", end: "2026-01-05" } 或字串
  let dateStr = typeof dateValue === 'string' ? dateValue : dateValue.start

  if (!dateStr) return null

  // 解析 YYYY-MM-DD 或 YYYY/MM/DD
  const match = dateStr.match(/(\d{4})[-\/](\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}` // 例如 "2026-01"
  }

  return null
}

// ===== 主程式 =====
async function main() {
  console.log('正在讀取 Notion 資料庫...')

  // 讀取所有資料 (使用新版 API: dataSources.query)
  const pages = []
  let cursor = undefined

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    })

    pages.push(...response.results)
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  console.log(`共讀取 ${pages.length} 筆資料`)

  // 解析資料
  const records = []

  for (const page of pages) {
    const props = page.properties

    // 取得客戶名稱
    let customerName = ''
    if (props['客戶名稱']?.title?.[0]?.plain_text) {
      customerName = props['客戶名稱'].title[0].plain_text
    }

    // 取得日期
    let dateValue = null
    let month = null
    if (props['旅遊日期']?.date) {
      dateValue = props['旅遊日期'].date
      month = extractMonth(dateValue)
    }

    // 取得利潤原始文字
    let profitRaw = ''
    if (props['利潤']?.rich_text?.[0]?.plain_text) {
      profitRaw = props['利潤'].rich_text[0].plain_text
    }

    // 解析利潤
    const profitResult = extractProfit(profitRaw)

    records.push({
      customerName,
      date: dateValue?.start || '',
      month,
      profitRaw,
      profitValue: profitResult.value,
      confident: profitResult.confident,
    })
  }

  // 按月份統計
  const monthlyStats = {}

  for (const record of records) {
    if (record.month) {
      if (!monthlyStats[record.month]) {
        monthlyStats[record.month] = { total: 0, count: 0 }
      }
      monthlyStats[record.month].total += record.profitValue
      monthlyStats[record.month].count += 1
    }
  }

  // 建立 Excel
  const workbook = new ExcelJS.Workbook()

  // Sheet 1: 月份統計
  const summarySheet = workbook.addWorksheet('月份統計')
  summarySheet.columns = [
    { header: '月份', key: 'month', width: 15 },
    { header: '總利潤', key: 'total', width: 15 },
    { header: '訂單數', key: 'count', width: 10 },
  ]

  const sortedMonths = Object.keys(monthlyStats).sort()
  for (const month of sortedMonths) {
    summarySheet.addRow({
      month,
      total: monthlyStats[month].total,
      count: monthlyStats[month].count,
    })
  }

  // 加總行
  const grandTotal = Object.values(monthlyStats).reduce((sum, m) => sum + m.total, 0)
  const grandCount = Object.values(monthlyStats).reduce((sum, m) => sum + m.count, 0)
  summarySheet.addRow({})
  summarySheet.addRow({ month: '總計', total: grandTotal, count: grandCount })

  // 格式化
  summarySheet.getColumn('total').numFmt = '#,##0'
  summarySheet.getRow(1).font = { bold: true }

  // Sheet 2: 明細（供核對）
  const detailSheet = workbook.addWorksheet('明細')
  detailSheet.columns = [
    { header: '客戶名稱', key: 'customerName', width: 20 },
    { header: '日期', key: 'date', width: 15 },
    { header: '月份', key: 'month', width: 10 },
    { header: '利潤原始文字', key: 'profitRaw', width: 50 },
    { header: '自動判斷利潤', key: 'profitValue', width: 15 },
    { header: '需核對', key: 'needCheck', width: 10 },
  ]

  for (const record of records) {
    detailSheet.addRow({
      customerName: record.customerName,
      date: record.date,
      month: record.month,
      profitRaw: record.profitRaw,
      profitValue: record.profitValue,
      needCheck: record.confident ? '' : '⚠️',
    })
  }

  detailSheet.getColumn('profitValue').numFmt = '#,##0'
  detailSheet.getRow(1).font = { bold: true }

  // 儲存
  const fileName = `profit-report-${new Date().toISOString().slice(0, 10)}.xlsx`
  const filePath = `/mnt/c/Users/eric1/OneDrive/Desktop/${fileName}`
  await workbook.xlsx.writeFile(filePath)

  console.log('')
  console.log('===== 月份統計 =====')
  for (const month of sortedMonths) {
    console.log(`${month}: ${monthlyStats[month].total.toLocaleString()} (${monthlyStats[month].count} 筆)`)
  }
  console.log(`總計: ${grandTotal.toLocaleString()}`)
  console.log('')
  console.log(`Excel 已儲存: ${filePath}`)
}

main().catch(console.error)
