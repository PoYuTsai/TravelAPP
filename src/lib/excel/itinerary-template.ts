// src/lib/excel/itinerary-template.ts
import ExcelJS from 'exceljs'

interface DayItem {
  date: string
  title: string
  morning?: string
  afternoon?: string
  evening?: string
}

interface HotelBooking {
  hotelName: string
  startDate: string
  endDate: string
  guests?: string
  note?: string
  color?: string
}

interface ItineraryData {
  clientName: string
  startDate: string
  endDate: string
  adults: number
  children: number
  days: DayItem[]
  hotels?: HotelBooking[]
}

// 顏色對應表
const colorMap: Record<string, string> = {
  yellow: 'FFFFFF00',
  green: 'FF90EE90',
  blue: 'FFB0C4DE',
  orange: 'FFFFDAB9',
  pink: 'FFFFB6C1',
  purple: 'FFE6E6FA',
  gray: 'FFD3D3D3',
}

// 星期對應
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

function formatDateHeader(dateStr: string): string {
  // 使用 UTC 解析避免時區偏移問題
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = weekdays[date.getUTCDay()]
  return `${year}/${month}/${day}(${weekday})`
}

function getDateIndex(dates: string[], targetDate: string): number {
  return dates.findIndex((d) => d === targetDate)
}

function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export async function generateItineraryExcel(data: ItineraryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '清微旅行'
  workbook.created = new Date()

  // 加入時間戳記到 sheet 名稱，方便確認是否為最新檔案
  const now = new Date()
  const timestamp = `${now.getHours()}h${now.getMinutes()}m${now.getSeconds()}s`
  const worksheet = workbook.addWorksheet(`${data.clientName} ${timestamp}`, {
    views: [{ showGridLines: true }],
  })

  console.log(`=== Excel Generated at ${timestamp} ===`)

  // 取得所有日期
  const dates = data.days.map((d) => d.date).sort()
  const numDays = dates.length

  // 設定欄寬
  worksheet.getColumn(1).width = 8 // 時段欄
  for (let i = 2; i <= numDays + 1; i++) {
    worksheet.getColumn(i).width = 18
  }

  // === Row 1: 日期標題 ===
  const headerRow = worksheet.getRow(1)
  headerRow.getCell(1).value = ''
  dates.forEach((date, index) => {
    const cell = headerRow.getCell(index + 2)
    cell.value = formatDateHeader(date)
    cell.font = { bold: true, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' },
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 25

  // === Row 2-4: 早/午/晚 ===
  const timeSlots = [
    { label: '早', field: 'morning' as const },
    { label: '午', field: 'afternoon' as const },
    { label: '晚', field: 'evening' as const },
  ]

  timeSlots.forEach((slot, slotIndex) => {
    const row = worksheet.getRow(slotIndex + 2)

    // 時段標籤
    const labelCell = row.getCell(1)
    labelCell.value = slot.label
    labelCell.font = { bold: true, size: 11 }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' }
    labelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFAEBD7' }, // 淺橘色背景
    }
    labelCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }

    // 每天的活動
    dates.forEach((date, dateIndex) => {
      const dayData = data.days.find((d) => d.date === date)
      const cell = row.getCell(dateIndex + 2)
      cell.value = dayData?.[slot.field] || ''
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })

    row.height = 50
  })

  // === Row 5: Hotel 標籤行 ===
  const hotelLabelRow = worksheet.getRow(5)
  const hotelLabelCell = hotelLabelRow.getCell(1)
  hotelLabelCell.value = 'Hotel'
  hotelLabelCell.font = { bold: true, size: 11 }
  hotelLabelCell.alignment = { horizontal: 'center', vertical: 'middle' }
  hotelLabelCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }

  // === Row 5+: Hotels（按客人分組，同組放同一行）===
  if (data.hotels && data.hotels.length > 0) {
    // Debug: 印出日期陣列
    console.log('=== Hotel Debug ===')
    console.log('Dates array:', dates)

    // 按 guests 分組
    const hotelGroups: Map<string, HotelBooking[]> = new Map()
    data.hotels.forEach((hotel) => {
      const groupKey = hotel.guests || '未分組'
      if (!hotelGroups.has(groupKey)) {
        hotelGroups.set(groupKey, [])
      }
      hotelGroups.get(groupKey)!.push(hotel)
    })

    // 將分組轉換為陣列並按開始日期排序每組內的飯店
    const groupsArray = Array.from(hotelGroups.entries()).map(([groupName, hotels]) => ({
      groupName,
      hotels: hotels.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    }))

    console.log(`Found ${groupsArray.length} hotel groups:`, groupsArray.map((g) => g.groupName))

    // 每個分組一行
    groupsArray.forEach((group, groupIndex) => {
      const rowNum = 5 + groupIndex
      const row = worksheet.getRow(rowNum)

      // 第一欄：Hotel 標籤或空白
      if (groupIndex > 0) {
        const labelCell = row.getCell(1)
        labelCell.value = ''
        labelCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      }

      // 先設定整行的邊框
      for (let col = 2; col <= numDays + 1; col++) {
        const cell = row.getCell(col)
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      }

      // 處理該組的每個飯店
      group.hotels.forEach((hotel) => {
        // 找出飯店入住的起始和結束欄位
        let startIdx = getDateIndex(dates, hotel.startDate)
        let endIdx = getDateIndex(dates, hotel.endDate)

        console.log(`Hotel: ${hotel.hotelName} [${group.groupName}]`)
        console.log(`  startDate: ${hotel.startDate}, endDate: ${hotel.endDate}`)
        console.log(`  startIdx: ${startIdx}, endIdx: ${endIdx}`)

        // 處理入住日在行程範圍外的情況
        if (startIdx === -1) {
          if (hotel.startDate < dates[0]) {
            startIdx = 0
            console.log(`  startDate before first day, using index 0`)
          } else {
            console.log(`  SKIPPED: startDate not found in days array`)
            return
          }
        }

        // 處理退房日在行程範圍外的情況
        if (endIdx === -1) {
          if (hotel.endDate > dates[dates.length - 1]) {
            // 退房日超出範圍，色塊延伸到最後一天
            endIdx = dates.length
            console.log(`  endDate after last day, extending to last column (index ${endIdx})`)
          } else {
            console.log(`  SKIPPED: endDate not found in days array`)
            return
          }
        }

        // 色塊範圍：入住日到退房前一天
        const startCol = startIdx + 2
        const endCol = endIdx + 1
        console.log(`  startCol: ${startCol}, endCol: ${endCol}`)

        // 顯示文字
        let displayText = hotel.hotelName
        if (hotel.note) {
          displayText += `\n(${hotel.note})`
        }

        // 設定顏色
        const bgColor = colorMap[hotel.color || 'yellow'] || colorMap.yellow

        if (endCol >= startCol) {
          console.log(`  Filling row ${rowNum}, cols ${startCol}-${endCol} for ${hotel.hotelName}`)

          // 1. 先對所有儲存格填色
          for (let col = startCol; col <= endCol; col++) {
            const cell = row.getCell(col)
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: bgColor },
            }
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            }
          }

          // 2. 再 merge（如果需要跨多格）
          if (endCol > startCol) {
            const startLetter = String.fromCharCode(64 + startCol)
            const endLetter = String.fromCharCode(64 + endCol)
            const mergeRange = `${startLetter}${rowNum}:${endLetter}${rowNum}`
            console.log(`  Merging: ${mergeRange}`)
            worksheet.mergeCells(mergeRange)
          }

          // 3. 設定 master cell 的文字和樣式
          const cell = row.getCell(startCol)
          cell.value = displayText
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          cell.font = { size: 11 }
        }
      })

      row.height = 30
    })

    // 合併 Hotel 標籤儲存格（如果有多組）
    if (groupsArray.length > 1) {
      worksheet.mergeCells(5, 1, 5 + groupsArray.length - 1, 1)
    }
  } else {
    // 沒有飯店資料，只顯示空白行
    hotelLabelRow.height = 30
    for (let col = 2; col <= numDays + 1; col++) {
      const cell = hotelLabelRow.getCell(col)
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    }
  }

  // 產生 Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
