// src/lib/itinerary/formatter.ts
// 行程格式化輸出

import type { ParsedDay } from './types'
import { WEEKDAYS } from './types'

/**
 * 將結構化資料轉回 LINE 純文字格式
 */
export function formatToLineText(days: ParsedDay[]): string {
  return days.map((day) => {
    const date = new Date(day.date + 'T00:00:00')
    const month = date.getMonth() + 1
    const dayNum = date.getDate()
    const weekday = WEEKDAYS[date.getDay()]

    let text = `${month}/${dayNum} (${weekday})\n`
    text += `Day ${day.dayNumber}｜${day.title}\n`

    if (day.morning) {
      day.morning.split('\n').forEach((line) => {
        if (line.trim()) text += `・${line.trim()}\n`
      })
    }

    if (day.lunch) {
      text += `午餐：${day.lunch}\n`
    }

    if (day.afternoon) {
      day.afternoon.split('\n').forEach((line) => {
        if (line.trim()) text += `・${line.trim()}\n`
      })
    }

    if (day.dinner) {
      text += `晚餐：${day.dinner}\n`
    }

    if (day.evening) {
      day.evening.split('\n').forEach((line) => {
        const trimmed = line.trim()
        // 過濾掉晚餐（已在上面獨立輸出）
        if (!trimmed) return
        if (/^[・\-•·]?\s*(晚餐|dinner)[：:]/i.test(trimmed)) return
        text += `・${trimmed}\n`
      })
    }

    return text
  }).join('\n')
}

/**
 * 從 Sanity 資料格式轉成 LINE 純文字
 */
export function sanityToLineText(itinerary: {
  clientName?: string
  days?: Array<{
    date: string
    title: string
    morning?: string
    afternoon?: string
    evening?: string
    lunch?: string
    dinner?: string
    accommodation?: string
  }>
}): string {
  if (!itinerary.days || itinerary.days.length === 0) {
    return '（無行程資料）'
  }

  const lines: string[] = []

  itinerary.days.forEach((day, index) => {
    const date = new Date(day.date + 'T00:00:00')
    const month = date.getMonth() + 1
    const dayNum = date.getDate()
    const weekday = WEEKDAYS[date.getDay()]

    lines.push(`${month}/${dayNum} (${weekday})`)
    lines.push(`Day ${index + 1}｜${day.title || ''}`)

    if (day.morning) {
      day.morning.split('\n').forEach((line) => {
        if (line.trim()) lines.push(`・${line.trim()}`)
      })
    }

    if (day.lunch) {
      lines.push(`午餐：${day.lunch}`)
    }

    if (day.afternoon) {
      day.afternoon.split('\n').forEach((line) => {
        if (line.trim()) lines.push(`・${line.trim()}`)
      })
    }

    if (day.dinner) {
      lines.push(`晚餐：${day.dinner}`)
    }

    if (day.evening) {
      day.evening.split('\n').forEach((line) => {
        const trimmed = line.trim()
        // 過濾掉住宿和晚餐（這些已在上面獨立輸出）
        if (!trimmed) return
        if (/^[・\-•·]?\s*(住宿|accommodation|hotel)[：:]/i.test(trimmed)) return
        if (/^[・\-•·]?\s*(晚餐|dinner)[：:]/i.test(trimmed)) return
        const cleaned = trimmed.replace(/^[・\-•·]\s*/, '')
        if (cleaned) lines.push(`・${cleaned}`)
      })
    }

    if (day.accommodation) {
      lines.push(`・住宿: ${day.accommodation}`)
    }

    lines.push('')
  })

  return lines.join('\n')
}

/**
 * 從 Sanity 資料格式轉成基本資訊文字
 */
export function sanityToBasicInfoText(data: {
  clientName?: string
  startDate?: string
  endDate?: string
  adults?: number
  children?: number
  childrenAges?: string
  totalPeople?: number
  luggageNote?: string
  vehicleNote?: string
  guideNote?: string
}): string {
  const lines: string[] = []

  if (data.clientName) {
    lines.push(`客戶姓名: ${data.clientName}`)
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate + 'T00:00:00')
    const end = new Date(data.endDate + 'T00:00:00')
    const startStr = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()}`
    const endStr = `${end.getMonth() + 1}/${end.getDate()}`
    lines.push(`日期: ${startStr}~${endStr}`)
  }

  if (data.adults || data.children) {
    let peopleStr = ''
    if (data.adults) peopleStr += `成人${data.adults}`
    if (data.children) {
      peopleStr += ` 小朋友${data.children}`
      if (data.childrenAges) peopleStr += ` (${data.childrenAges})`
    }
    lines.push(`人數: ${data.totalPeople || (data.adults || 0) + (data.children || 0)}人`)
    lines.push(peopleStr)
  }

  if (data.luggageNote) {
    lines.push(`行李: ${data.luggageNote}`)
  }

  if (data.vehicleNote) {
    lines.push(`包車: ${data.vehicleNote}`)
  }

  if (data.guideNote) {
    lines.push(`導遊: ${data.guideNote}`)
  }

  return lines.join('\n')
}

/**
 * 從 Sanity 資料格式轉成報價文字
 */
export function sanityToQuotationText(items: Array<{
  date?: string
  description: string
  unitPrice: number
  quantity: number
  unit?: string
}>, total?: number): string {
  const lines: string[] = []

  items.forEach((item) => {
    let line = ''

    if (item.date) {
      const date = new Date(item.date + 'T00:00:00')
      const month = date.getMonth() + 1
      const day = date.getDate()
      line += `${month}/${day} `
    }

    line += item.description

    if (item.quantity > 1) {
      line += ` ${item.unitPrice}*${item.quantity}${item.unit || '天'}`
    } else {
      line += ` ${item.unitPrice}`
    }

    lines.push(line)
  })

  if (total) {
    lines.push(`小計: ${total}`)
  }

  return lines.join('\n')
}
