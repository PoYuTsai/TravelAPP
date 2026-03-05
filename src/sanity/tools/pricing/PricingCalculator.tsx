// src/sanity/tools/pricing/PricingCalculator.tsx
// 報價計算器 - 複製 HTML prototype 的 UI

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import html2pdf from 'html2pdf.js'
import { useClient } from 'sanity'
import {
  parseItineraryText,
  matchActivitiesToDatabase,
  generateConsecutiveDates,
  type ActivityRecord,
  type ActivityMatchResult,
} from '@/lib/itinerary'

// 互斥群組定義 - 同群組只能選一個
const EXCLUSIVE_GROUPS: Record<string, string[]> = {
  elephant: ['elephant-meal', 'elephant'],
  shooting: ['shooting', 'shooting-pro'],
  cabaret: ['cabaret-vip', 'cabaret'],
  zipline: ['zipline-a', 'zipline-b', 'zipline-c'],
}

// 預設資料（跟 HTML prototype v3 一樣）
const DEFAULT_CONFIG = {
  exchangeRate: 0.93,
  nights: 5,
  mealDays: 5,
  guideDays: 5,
  insurancePerPerson: 100,
  roomPrices: { double: 2500, triple: 3500, family: 4500 },
  dailyCarFees: [
    { day: 'D1', name: '市區(接機+行程)', cost: 2700, price: 3200, type: 'city' },
    { day: 'D2', name: '郊區(大象/射擊)', cost: 3300, price: 3800, type: 'suburban' },
    { day: 'D3', name: '清萊一日遊', cost: 4000, price: 4500, type: 'chiangrai' },
    { day: 'D4', name: '郊區(水上/動物園)', cost: 3300, price: 3800, type: 'suburban' },
    { day: 'D5', name: '郊區(叢林/蛇園)', cost: 3300, price: 3800, type: 'suburban' },
    { day: 'D6', name: '送機', cost: 500, price: 600, type: 'airport' },
  ],
  guidePerDay: { cost: 1500, price: 2500 },
  luggagePerTrip: 600,
  childSeatPerDay: 500,  // 兒童座椅 500/張/天
  thaiDress: {
    cloth: { price: 500, rebate: 200 },
    makeup: { price: 1000, rebate: 500 },  // HTML v3: 1000/500
    photo: { price: 2500, rebate: 500 },
  },
}

// 門票類型（含日期）
interface DynamicTicket {
  id: string
  name: string
  price: number
  rebate: number
  split: boolean
  checked: boolean
  dayNumber?: number  // 來自哪一天（動態解析時設定）
  source: 'parsed' | 'manual' | 'default'  // 來源
  exclusiveGroup?: string  // 互斥群組
}

// 門票關鍵字對照表 - 用於智能匹配
const TICKET_KEYWORDS: Record<string, string[]> = {
  // 大象
  'elephant-meal': ['大象', 'elephant', '保護營', '湄登', '含餐', 'maetang'],
  'elephant': ['大象', 'elephant', '保護營', '湄登', '不含餐', 'maetang'],
  // 射擊
  'shooting': ['射擊', 'shooting', '靶場', 'mae rim', '基本'],
  'shooting-pro': ['射擊', 'shooting', '靶場', '進階', 'pro'],
  // 人妖秀
  'cabaret-vip': ['人妖秀', '人妖', 'cabaret', 'miracle', 'vip'],
  'cabaret': ['人妖秀', '人妖', 'cabaret', 'miracle', '普通'],
  // 清萊
  'whiteTemple': ['白廟', 'white temple', '龍昆'],
  'blueTemple': ['藍廟', 'blue temple'],
  'blackTemple': ['黑廟', 'black temple', '黑屋'],
  'longNeck': ['長頸', 'long neck', '長頸族', '長頸村'],
  // 其他活動
  'waterPark': ['水上樂園', '大峽谷', 'grand canyon', 'waterpark'],
  'nightSafari': ['夜間動物園', 'night safari', '動物園'],
  'zipline-a': ['叢林飛索', '叢林飛越', 'zipline', 'coaster', 'pong yang', '飛索'],
  'zipline-b': ['叢林飛索', '叢林飛越', 'zipline', 'eagle track'],
  'zipline-c': ['叢林飛索', '叢林飛越', 'zipline', 'flight of gibbon'],
  'snakeFarm': ['蛇園', 'snake', '蛇園表演'],
  'pigSlide': ['豬豬', '溜滑梯', '豬豬溜滑梯'],
  'muaythai': ['泰拳', 'muay thai', '泰拳體驗'],
  'massage': ['按摩', 'massage', 'spa', '泰式按摩'],
  // 泰服
  'thaiDress': ['泰服', 'thai dress', '泰服體驗', '攝影師'],
}

// 預設門票範本（當沒有解析行程時使用）
const DEFAULT_TICKETS: DynamicTicket[] = [
  // 大象保護營（二擇一）
  { id: 'elephant-meal', name: '大象保護營（含餐）', price: 1600, rebate: 1000, split: true, checked: false, source: 'default', exclusiveGroup: 'elephant' },
  { id: 'elephant', name: '大象保護營（不含餐）', price: 1600, rebate: 1100, split: true, checked: false, source: 'default', exclusiveGroup: 'elephant' },
  // 射擊（二擇一）
  { id: 'shooting', name: '射擊（基本）', price: 1700, rebate: 500, split: true, checked: false, source: 'default', exclusiveGroup: 'shooting' },
  { id: 'shooting-pro', name: '射擊（進階）', price: 5000, rebate: 1000, split: true, checked: false, source: 'default', exclusiveGroup: 'shooting' },
  // 人妖秀（二擇一）
  { id: 'cabaret-vip', name: '人妖秀（VIP）', price: 1000, rebate: 500, split: true, checked: false, source: 'default', exclusiveGroup: 'cabaret' },
  { id: 'cabaret', name: '人妖秀（普通）', price: 800, rebate: 350, split: true, checked: false, source: 'default', exclusiveGroup: 'cabaret' },
  // 清萊一日遊
  { id: 'whiteTemple', name: '白廟', price: 200, rebate: 0, split: false, checked: false, source: 'default' },
  { id: 'blueTemple', name: '藍廟', price: 0, rebate: 0, split: false, checked: false, source: 'default' },
  { id: 'blackTemple', name: '黑廟', price: 80, rebate: 0, split: false, checked: false, source: 'default' },
  { id: 'longNeck', name: '長頸村', price: 300, rebate: 200, split: true, checked: false, source: 'default' },
  // 其他活動
  { id: 'waterPark', name: '水上樂園', price: 950, rebate: 250, split: true, checked: false, source: 'default' },
  { id: 'nightSafari', name: '夜間動物園', price: 1200, rebate: 550, split: true, checked: false, source: 'default' },
  // 叢林飛索（三擇一）
  { id: 'zipline-a', name: '叢林飛索 A', price: 2400, rebate: 500, split: true, checked: false, source: 'default', exclusiveGroup: 'zipline' },
  { id: 'zipline-b', name: '叢林飛索 B', price: 2200, rebate: 450, split: true, checked: false, source: 'default', exclusiveGroup: 'zipline' },
  { id: 'zipline-c', name: '叢林飛索 C', price: 2000, rebate: 400, split: true, checked: false, source: 'default', exclusiveGroup: 'zipline' },
  // 其他
  { id: 'snakeFarm', name: '蛇園', price: 200, rebate: 100, split: true, checked: false, source: 'default' },
  { id: 'pigSlide', name: '豬豬溜滑梯', price: 200, rebate: 30, split: true, checked: false, source: 'default' },
  // 泰拳
  { id: 'muaythai', name: '泰拳體驗', price: 1500, rebate: 300, split: true, checked: false, source: 'default' },
  // 按摩
  { id: 'massage', name: '泰式按摩', price: 500, rebate: 100, split: true, checked: false, source: 'default' },
]

// 將 DEFAULT_TICKETS 轉換為 ActivityRecord 格式（供匹配器使用）
function getDefaultActivitiesForMatching(): ActivityRecord[] {
  return DEFAULT_TICKETS.map(ticket => ({
    _id: ticket.id,
    name: ticket.name,
    keywords: TICKET_KEYWORDS[ticket.id] || [],
    activityType: 'ticket' as const,
    adultPrice: ticket.price,
    rebate: ticket.rebate,
    splitRebate: ticket.split,
    exclusiveGroup: ticket.exclusiveGroup,
    isActive: true,
  }))
}

// 下載對外報價單
function downloadExternalQuote(
  c: any,
  people: number,
  exchangeRate: number,
  hotels: Hotel[],
  mealLevel: number,
  thaiDressCloth: boolean,
  thaiDressPhoto: boolean,
  makeupCount: number,
  config: any,
  includeAccommodation: boolean,
  includeMeals: boolean,
  includeGuide: boolean,
  totalNights: number,
  babySeatCount: number,
  childSeatCount: number,
  collectDeposit: boolean,
  tripDays: number,
  customItinerary?: { day: string; title: string; items: string[]; hotel: string | null }[]
) {
  const tripNights = tripDays - 1
  const fmt = (n: number) => n.toLocaleString()
  const mealLabels: Record<number, string> = { 600: '簡餐', 900: '平價', 1200: '精選', 1500: '高級' }

  const hotelInfo = hotels.map(h => `${h.name}(${h.nights}晚)`).join(' + ')
  // 只有勾選住宿時才考慮飯店押金
  const hotelsWithDeposit = includeAccommodation ? hotels.filter(h => h.hasDeposit) : []
  const getHotelRoomCount = (h: Hotel) => ROOM_CATEGORIES.reduce((sum, cat) => {
    return sum + h.rooms[cat.key].reduce((catSum: number, subRoom: SubRoomConfig) => catSum + subRoom.quantity, 0)
  }, 0)
  const getHotelDeposit = (h: Hotel) => {
    if (!h.hasDeposit) return 0
    return h.depositPerRoom * getHotelRoomCount(h)
  }
  const totalDeposit = hotelsWithDeposit.reduce((sum, h) => sum + getHotelDeposit(h), 0)

  // 計算各項金額
  const mealsAmount = c.mealCost  // 餐費
  const actualTicketsAmount = c.ticketPrice + c.thaiDressPrice  // 真正的門票/泰服（不含保險）
  const insuranceAmount = c.insuranceCost  // 保險
  const mealsTicketsAmount = mealsAmount + actualTicketsAmount + insuranceAmount  // 總和
  const carAmount = c.transportPrice  // 車導費用

  // 判斷勾選狀態（標籤用）
  const hasMeals = includeMeals && mealsAmount > 0
  const hasActualTickets = actualTicketsAmount > 0  // 有門票或泰服
  const hasInsurance = insuranceAmount > 0
  const hasMealsOrTicketsOrInsurance = hasMeals || hasActualTickets || hasInsurance
  const isCarOnly = !includeAccommodation && !hasMealsOrTicketsOrInsurance

  // 動態標籤（只看餐費和門票，保險不影響標籤）
  const getMealsTicketsLabel = () => {
    if (hasMeals && hasActualTickets) return '餐費＋門票'
    if (hasMeals && hasInsurance && !hasActualTickets) return '餐費'
    if (hasMeals) return '餐費'
    if (hasActualTickets) return '門票'
    if (hasInsurance) return '保險'
    return ''
  }

  // 動態項目列表
  const getMealsTicketsItems = () => {
    const items = []
    if (hasMeals) items.push('餐費')
    if (hasActualTickets) items.push('門票活動、泰服')
    if (hasInsurance) items.push('保險')
    return items.join('、')
  }

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>清微旅行報價單</title>
  <style>
    /* 清微旅行 - PDF 專業報價單樣式 */
    :root {
      --brand-primary: #2d5a3d;
      --brand-dark: #1e3d2a;
      --gold-accent: #b89b4d;
      --cream-bg: #fefcf8;
      --cream-light: #fffdf9;
      --text-primary: #2c2c2c;
      --text-secondary: #4a4a4a;
      --text-muted: #777777;
      --border-light: #e5e0d8;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      background: white;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
      padding: 0;
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.5;
    }
    .pdf-container {
      width: 100%;
      max-width: 560px;
      margin: 0 auto;
      padding: 24px 20px;
      background: white;
    }
    .header {
      background: linear-gradient(135deg, #2d5a3d 0%, #1e3d2a 100%);
      color: white;
      padding: 24px 20px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 20px;
    }
    .header .brand-en { font-size: 11px; letter-spacing: 3px; opacity: 0.85; margin-bottom: 6px; text-transform: uppercase; }
    .header .brand-zh { font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 2px; }
    .header .tagline { font-size: 12px; opacity: 0.9; margin-top: 6px; }
    .header .trip-info {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.2);
    }
    .header .trip-label { font-size: 10px; opacity: 0.75; margin-bottom: 4px; }
    .header .trip-title { font-size: 18px; font-weight: 600; }
    .section { margin-bottom: 18px; }
    .section-title {
      color: var(--brand-primary);
      font-size: 14px;
      font-weight: 600;
      border-bottom: 2px solid var(--gold-accent);
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .itinerary-day {
      background: var(--cream-light);
      border-left: 3px solid var(--gold-accent);
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 6px;
    }
    .itinerary-day .title { font-weight: 600; color: var(--brand-dark); font-size: 12px; margin-bottom: 3px; }
    .itinerary-day .items { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }
    .itinerary-day .hotel { font-size: 10px; color: var(--brand-primary); margin-top: 4px; font-weight: 500; }
    .price-summary {
      background: var(--cream-bg);
      border: 1px solid var(--border-light);
      border-radius: 6px;
      padding: 14px;
    }
    .price-meta { font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
    .price-meta strong { color: var(--text-primary); }
    .price-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed var(--border-light);
      font-size: 12px;
    }
    .price-row:last-child { border-bottom: none; }
    .price-row.category {
      border-bottom: 2px solid #d4c4a8;
      padding: 8px 0 6px 0;
      margin-top: 10px;
    }
    .price-row.category:first-child { margin-top: 0; }
    .price-row.category span:first-child { font-weight: 600; color: #5c4a2a; }
    .price-row.category span:last-child { font-weight: 600; }
    .price-detail { padding-left: 14px; font-size: 11px; color: var(--text-secondary); margin: 2px 0; }
    .price-total {
      display: flex;
      justify-content: space-between;
      padding: 10px 0 4px 0;
      margin-top: 10px;
      border-top: 2px solid var(--gold-accent);
      font-weight: 700;
      font-size: 14px;
    }
    .price-box {
      background: linear-gradient(135deg, #2d5a3d 0%, #1e3d2a 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 16px 0;
    }
    .price-box .label { font-size: 12px; opacity: 0.9; }
    .price-box .amount { font-size: 32px; font-weight: 700; margin: 6px 0; letter-spacing: 1px; }
    .price-box .sub { font-size: 11px; opacity: 0.85; }
    .includes { display: flex; gap: 10px; margin: 16px 0; }
    .includes .box { flex: 1; padding: 10px; border-radius: 6px; }
    .includes .yes { background: #f4f9f5; border: 1px solid #c8e6c9; }
    .includes .no { background: #faf8f5; border: 1px solid #d4c4a8; }
    .includes .box h4 { font-size: 11px; margin-bottom: 6px; font-weight: 600; }
    .includes .yes h4 { color: var(--brand-primary); }
    .includes .no h4 { color: #8b7355; }
    .includes .box ul { font-size: 10px; line-height: 1.7; color: var(--text-secondary); list-style: none; }
    .payment-phases {
      background: var(--cream-light);
      border: 1px solid var(--border-light);
      border-radius: 6px;
      padding: 12px;
    }
    .payment-phases h4 { font-size: 12px; margin-bottom: 10px; font-weight: 600; color: var(--text-primary); }
    .payment-phase {
      background: white;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 6px;
      border-left: 3px solid var(--gold-accent);
    }
    .payment-phase:last-child { margin-bottom: 0; }
    .payment-phase .label { font-weight: 600; color: var(--text-primary); font-size: 11px; margin-bottom: 2px; }
    .payment-phase .timing { font-size: 10px; color: var(--text-muted); margin-bottom: 3px; }
    .payment-phase .items { font-size: 10px; color: var(--text-secondary); line-height: 1.5; }
    .payment-phase .amount { font-weight: 600; color: var(--brand-primary); margin-top: 4px; font-size: 11px; }
    .policy-box {
      background: #fafafa;
      border-radius: 6px;
      padding: 10px;
      font-size: 10px;
      margin-bottom: 10px;
    }
    .policy-box .title { font-weight: 600; color: var(--text-primary); margin-bottom: 6px; font-size: 11px; }
    .policy-box .content { color: var(--text-secondary); line-height: 1.6; }
    .footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border-light);
      text-align: center;
    }
    .footer .brand { font-weight: 600; color: var(--brand-primary); font-size: 13px; margin-bottom: 6px; }
    .footer .contact { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
    .footer .date { font-size: 10px; color: var(--text-muted); margin-top: 8px; }

    /* 列印/PDF 專用樣式 */
    @media print {
      @page {
        size: A4;
        margin: 15mm 12mm;
      }
      html, body {
        width: 100%;
        height: auto;
        background: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .pdf-container {
        width: 100%;
        max-width: none;
        padding: 0;
        margin: 0;
      }
      .header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .section, .itinerary-day, .payment-phase {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .price-box {
        break-inside: avoid;
        page-break-inside: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="pdf-container">
    <div class="header">
      <div class="brand-en">Chiangway Travel</div>
      <h1 class="brand-zh">清微旅行</h1>
      <p class="tagline">台灣爸爸 × 泰國媽媽｜清邁在地親子包車</p>
      <div class="trip-info">
        <div class="trip-label">行程報價單</div>
        <div class="trip-title">清邁 ${tripDays}天${tripNights}夜 親子包車</div>
      </div>
    </div>

    <!-- 行程概覽 -->
    <div class="section">
      <h3 class="section-title">📅 行程概覽</h3>
      ${(customItinerary && customItinerary.length > 0 ? customItinerary : ITINERARY).map(day => `
        <div class="itinerary-day">
          <div class="title">${day.day}｜${day.title}</div>
          <div class="items">${day.items.join('　')}</div>
          ${day.hotel ? `<div class="hotel">🏨 ${day.hotel}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- 費用明細 -->
    <div class="section">
      <h3 class="section-title">💰 費用明細</h3>
      <div class="price-meta">
        👥 <strong>${people} 人</strong>　｜　🗓️ <strong>${tripDays}天${tripNights}夜</strong>
      </div>
      <div class="price-summary">

        ${includeAccommodation ? `
        <div class="price-row category">
          <span>🏨 住宿（${totalNights}晚）</span>
          <span>${fmt(c.accommodationCost)} 泰銖</span>
        </div>
        ${hotels.map(h => `<div class="price-detail">• ${h.name}（${h.nights}晚）</div>`).join('')}
        ` : ''}

        ${includeMeals ? `
        <div class="price-row category">
          <span>🍜 餐費（${c.mealDays}天午晚餐）</span>
          <span>${fmt(c.mealCost)} 泰銖</span>
        </div>
        <div class="price-detail">• ${mealLabels[mealLevel]}餐廳 ${fmt(mealLevel)}/人/天 × ${people}人</div>
        ` : ''}

        <div class="price-row category">
          <span>🚗 包車 + 導遊</span>
          <span>${fmt(c.transportPrice)} 泰銖</span>
        </div>
        <div class="price-detail">• 包車 6 天（${c.carCount}台）+ 中文導遊 ${c.guideDays} 天</div>
        ${c.needLuggageCar ? `<div class="price-detail">• 行李車（接機＋送機）</div>` : ''}
        ${c.childSeatCost > 0 ? `<div class="price-detail">• 兒童座椅 ${babySeatCount + childSeatCount}張 × ${c.guideDays}天</div>` : ''}

        ${c.includeTickets && c.selectedTickets.length > 0 ? `
        <div class="price-row category">
          <span>🎫 門票活動（${c.selectedTickets.length}項）</span>
          <span>${fmt(c.ticketPrice)} 泰銖</span>
        </div>
        ${c.selectedTickets.slice(0, 6).map((t: any) => `<div class="price-detail">• ${t.name.replace(/^D\\d /, '')}${t.price > 0 ? ` ${fmt(t.price)}/人` : ''}</div>`).join('')}
        ${c.selectedTickets.length > 6 ? `<div class="price-detail">• ...及其他 ${c.selectedTickets.length - 6} 項</div>` : ''}
        ` : ''}

        ${c.thaiDressPrice > 0 ? `
        <div class="price-row category">
          <span>👘 泰服體驗</span>
          <span>${fmt(c.thaiDressPrice)} 泰銖</span>
        </div>
        ${thaiDressCloth ? `<div class="price-detail">• 泰服衣服 ${people}人</div>` : ''}
        ${makeupCount > 0 ? `<div class="price-detail">• 專業化妝 ${makeupCount}人</div>` : ''}
        ${thaiDressPhoto ? `<div class="price-detail">• 攝影師 ${people <= 10 ? 1 : 2}位</div>` : ''}
        ` : ''}

        ${c.insuranceCost > 0 ? `
        <div class="price-row category">
          <span>🛡️ 旅遊保險</span>
          <span>${fmt(c.insuranceCost)} 泰銖</span>
        </div>
        <div class="price-detail">• ${fmt(config.insurancePerPerson)}/人 × ${people}人</div>
        ` : ''}

        <div class="price-total"><span>總計</span><span>${fmt(c.totalPrice)} 泰銖</span></div>
      </div>
    </div>

    <!-- 每人費用 -->
    <div class="price-box">
      <div class="label">每人費用</div>
      <div class="amount">NT$ ${fmt(c.perPersonTWD)}</div>
      <div class="sub">約 ${fmt(Math.round(c.perPersonTHB))} 泰銖</div>
    </div>

    <!-- 費用包含/不含 -->
    <div class="includes">
      <div class="box yes">
        <h4>✅ 費用包含</h4>
        <ul>
          ${includeAccommodation ? `<li>• ${totalNights}晚住宿</li>` : ''}
          ${includeMeals ? `<li>• ${c.mealDays}天午晚餐</li>` : ''}
          <li>• 全程包車（${c.carCount}台）</li>
          ${includeGuide ? `<li>• 專業中文導遊</li>` : ''}
          ${c.includeTickets && c.selectedTickets.length > 0 ? `<li>• ${c.selectedTickets.length}項門票活動</li>` : ''}
          ${c.includeTickets && c.thaiDressPrice > 0 ? `<li>• 泰服體驗</li>` : ''}
          ${c.insuranceCost > 0 ? `<li>• 旅遊保險</li>` : ''}
        </ul>
      </div>
      <div class="box no">
        <h4>❌ 費用不含</h4>
        <ul>
          <li>• 來回機票</li>
          ${!includeAccommodation ? `<li>• 住宿</li>` : ''}
          ${!includeMeals ? `<li>• 餐費</li>` : ''}
          ${c.selectedTickets.length === 0 ? `<li>• 門票（現場）</li>` : ''}
          ${!includeGuide ? `<li>• 導遊</li>` : ''}
          <li>• 個人消費、小費</li>
        </ul>
      </div>
    </div>

    <!-- Payment Phases -->
    <div class="payment-phases">
      <h4>💳 付款方式與時程</h4>
      ${isCarOnly ? `
      <!-- 純包車：訂金制 (2階段) -->
      <div class="payment-phase">
        <div class="label">📍 第一階段｜預約訂金 30%</div>
        <div class="timing">⏰ 確認行程後</div>
        <div class="items">• 確認行程細節後支付訂金，即完成預約</div>
        <div class="amount">💰 ${fmt(Math.round(carAmount * 0.3))} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(carAmount * 0.3 / exchangeRate))}</span></div>
      </div>
      <div class="payment-phase">
        <div class="label">📍 第二階段｜尾款 70%（含超時結算）</div>
        <div class="timing">⏰ 送機前一天</div>
        <div class="items">
          • 包車費用${includeGuide ? '、導遊費用' : ''}${c.needLuggageCar ? '、行李車' : ''}${c.childSeatCost > 0 ? '、兒童座椅' : ''}<br />
          • 統一結算超時費（若有）
        </div>
        <div class="amount">💰 ${fmt(Math.round(carAmount * 0.7))} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(carAmount * 0.7 / exchangeRate))}</span></div>
      </div>
      ` : includeAccommodation ? `
      <!-- 有住宿：住宿 → 餐費/門票 → 車導全額 -->
      <div class="payment-phase">
        <div class="label">📍 第一階段｜住宿全額</div>
        <div class="timing">⏰ 出發前 1.5～2 個月</div>
        <div class="items">
          • 討論好飯店細節（星級、房型、預算）後統一報價<br />
          • 收到款項後下訂，會請飯店提供每晚/每房的正式 PDF 單據<br />
          <span style="color:#888;font-size:11px;">（入境或 TDAC 如被詢問，可出示飯店訂房資料）</span>
        </div>
        <div class="amount">💰 ${fmt(c.accommodationCost)} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(c.accommodationCost / exchangeRate))}</span></div>
      </div>
      ${hasMealsOrTicketsOrInsurance ? `
      <div class="payment-phase">
        <div class="label">📍 第二階段｜${getMealsTicketsLabel()}</div>
        <div class="timing">⏰ 出發前 1 個月</div>
        <div class="items">• ${getMealsTicketsItems()}</div>
        <div class="amount">💰 ${fmt(mealsTicketsAmount)} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(mealsTicketsAmount / exchangeRate))}</span></div>
      </div>
      ` : ''}
      <div class="payment-phase">
        <div class="label">📍 ${hasMealsOrTicketsOrInsurance ? '第三' : '第二'}階段｜車${includeGuide ? '導' : '輛'}費（含超時結算）</div>
        <div class="timing">⏰ 送機前一天</div>
        <div class="items">
          • 包車費用${includeGuide ? '、導遊費用' : ''}${c.needLuggageCar ? '、行李車' : ''}${c.childSeatCost > 0 ? '、兒童座椅' : ''}<br />
          • 統一結算超時費（若有）
        </div>
        <div class="amount">💰 ${fmt(carAmount)} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(carAmount / exchangeRate))}</span></div>
      </div>
      ` : `
      <!-- 無住宿但有餐費/門票：餐費/門票全額 → 車30%訂金 → 車70%尾款 -->
      <div class="payment-phase">
        <div class="label">📍 第一階段｜${getMealsTicketsLabel()}全額</div>
        <div class="timing">⏰ 出發前 1 個月</div>
        <div class="items">• ${getMealsTicketsItems()}</div>
        <div class="amount">💰 ${fmt(mealsTicketsAmount)} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(mealsTicketsAmount / exchangeRate))}</span></div>
      </div>
      <div class="payment-phase">
        <div class="label">📍 第二階段｜車${includeGuide ? '導' : '輛'}訂金 30%</div>
        <div class="timing">⏰ 同時支付</div>
        <div class="items">• 確認行程細節後支付訂金，即完成預約</div>
        <div class="amount">💰 ${fmt(Math.round(carAmount * 0.3))} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(carAmount * 0.3 / exchangeRate))}</span></div>
      </div>
      <div class="payment-phase">
        <div class="label">📍 第三階段｜車${includeGuide ? '導' : '輛'}尾款 70%（含超時結算）</div>
        <div class="timing">⏰ 送機前一天</div>
        <div class="items">
          • 包車費用${includeGuide ? '、導遊費用' : ''}${c.needLuggageCar ? '、行李車' : ''}${c.childSeatCost > 0 ? '、兒童座椅' : ''}<br />
          • 統一結算超時費（若有）
        </div>
        <div class="amount">💰 ${fmt(Math.round(carAmount * 0.7))} 泰銖 <span style="font-weight:normal;color:#666;">≈ NT$ ${fmt(Math.round(carAmount * 0.7 / exchangeRate))}</span></div>
      </div>
      `}
      <div style="margin-top: 12px; padding: 10px; background: #fff3e0; border: 1px solid #ffcc02; border-radius: 6px; font-size: 12px;">
        <div style="font-weight:bold;color:#9a6b2a;margin-bottom:4px;">⏱️ 超時費說明</div>
        <div style="color:#555;">
          • 清邁行程：每日 10 小時｜清萊：每日 12 小時<br />
          • 超時費：<strong>200 泰銖/小時 × ${c.carCount}台車</strong>${includeGuide ? '（導遊不另收）' : ''}
        </div>
      </div>
      <!-- 台幣匯款資訊 -->
      <div style="margin-top: 12px; padding: 12px; background: #f9f8f6; border: 1px solid #b89b4d; border-radius: 6px; font-size: 12px;">
        <div style="font-weight:bold;color:#5c4a2a;margin-bottom:8px;">🏦 台幣匯款資訊</div>
        <div style="color:#333; line-height: 1.8;">
          戶名：<strong>蔡柏裕</strong><br />
          銀行：彰化銀行（代碼 009）<br />
          帳號：<strong>51619501772100</strong>
        </div>
      </div>
    </div>

    ${hotelsWithDeposit.length > 0 && collectDeposit ? `
    <!-- Deposit Notice - 代收 -->
    <div class="deposit-box">
      <h4>💳 飯店押金（另收，退房退還）</h4>
      <div class="info">
        ${hotelsWithDeposit.map(h => `• ${h.name}：${fmt(getHotelDeposit(h))} 泰銖（${getHotelRoomCount(h)} 間 × ${fmt(h.depositPerRoom)}）`).join('<br />')}
        <div style="margin-top: 8px; padding: 10px; background: #b89b4d; color: white; border-radius: 4px; font-weight: bold;">
          📋 實收押金：${fmt(totalDeposit)} 泰銖 ≈ NT$ ${fmt(Math.round(totalDeposit / exchangeRate))}
        </div>
        <div style="margin-top: 8px; padding: 8px; background: #f9f8f6; border-radius: 4px;">
          ✅ 押金統一由導遊收取，退房後全額退還<br />
          💡 建議以現金支付（信用卡退款需 7~14 天）
        </div>
      </div>
    </div>
    ` : hotelsWithDeposit.length > 0 ? `
    <!-- Deposit Notice - 自付提醒 -->
    <div class="deposit-box" style="background: #fff8e1; border-color: #ffc107;">
      <h4>💡 飯店押金提醒</h4>
      <div class="info">
        <div style="color: #555; line-height: 1.8;">
          部分飯店入住時需支付押金，退房時全額退還：<br />
          ${hotelsWithDeposit.map(h => `• ${h.name}：約 ${fmt(h.depositPerRoom)} 泰銖/間`).join('<br />')}
        </div>
        <div style="margin-top: 8px; padding: 8px; background: #f8f6f2; border-radius: 4px; color: #5c4a2a;">
          💵 押金請於入住時直接支付給飯店，退房時退還<br />
          💡 建議準備現金（信用卡退款需 7~14 天）
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Policies -->
    <!-- 政策說明 -->
    <div class="section">
      <div class="policy-box">
        <div class="title">📋 退款政策</div>
        <div class="content">
          <strong>車導服務</strong>：14天前全額｜7-13天50%｜4-6天30%｜3天內不退<br />
          <strong>住宿</strong>：依各飯店政策　<strong>門票餐費</strong>：訂購後不退
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="brand">清微旅行 Chiangway Travel</div>
      <div class="contact">🌐 chiangway-travel.com　｜　💬 LINE: @037nyuwk</div>
      <div class="date">報價日期：${new Date().toLocaleDateString('zh-TW')}　｜　有效期 14 天</div>
    </div>

  </div>
</body>
</html>`

  // 使用 html2pdf.js 直接產生 PDF（不需要列印對話框，沒有瀏覽器頁首頁尾）
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const element = container.querySelector('.pdf-container') as HTMLElement
  if (!element) {
    document.body.removeChild(container)
    alert('產生 PDF 失敗')
    return
  }

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: `清微旅行報價單_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'png' as const, quality: 1 },
    html2canvas: {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      letterRendering: true
    },
    jsPDF: {
      unit: 'mm' as const,
      format: 'a4' as const,
      orientation: 'portrait' as const
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  }

  html2pdf().set(opt).from(element).save().then(() => {
    document.body.removeChild(container)
  }).catch((err: Error) => {
    document.body.removeChild(container)
    console.error('PDF 產生錯誤:', err)
    alert('PDF 下載失敗，請再試一次')
  })
}

// 行程資料（跟 HTML v3 一樣）
const PACKAGE_IMAGE_PATH = '/images/packages/6d5n-classic'
const ITINERARY = [
  { day: 'DAY 1', title: '抵達清邁・放鬆展開旅程', items: ['🛬 機場接機', '💱 巫宗雄換匯', '🍽️ 午餐：脆皮豬', '👘 泰服體驗＋攝影', '🥭 阿嬤芒果糯米飯', '🍽️ 晚餐：EKACHAN'], hotel: '香格里拉酒店', image: 'd1.png' },
  { day: 'DAY 2', title: '大象互動 + 射擊體驗', items: ['🐘 大象保護營', '☕ AIR DIAMOND CAFE', '🍽️ 午餐：MAI HEUN 60', '🔫 射擊體驗', '🍽️ 晚餐：SAMSEN VILLA 米其林', '💃 人妖秀'], hotel: '香格里拉酒店', image: 'd2.png' },
  { day: 'DAY 3', title: '清萊一日遊（經典三廟）', items: ['⛪ 白廟', '🍽️ 午餐：LALITTA CAFÉ', '💙 藍廟', '🖤 黑廟', '👩 長頸村', '🍽️ 晚餐：泰式烤肉'], hotel: '香格里拉酒店', image: 'd3.png' },
  { day: 'DAY 4', title: '水上樂園 + 夜間動物園', items: ['🏊 清邁大峽谷水上樂園', '🍽️ 午餐：園區內', '🎨 藝術村 BAAN KANGWAT', '🦁 夜間動物園', '🍽️ 晚餐：黑森林餐廳'], hotel: '清邁美平洲際酒店', image: 'd4.png' },
  { day: 'DAY 5', title: '湄林探險一日', items: ['🌲 叢林飛索 ZIPLINE', '🍽️ 午餐：FLEUR CAFE', '🐍 蛇園表演', '🐷 豬豬溜滑梯', '🛒 BIG C 採買', '🍽️ 晚餐：康托克帝王餐'], hotel: '清邁美平洲際酒店', image: 'd5.png' },
  { day: 'DAY 6', title: '收心慢遊・送機回國', items: ['🍳 早餐後退房', '🛫 專車送機'], hotel: null, image: 'd6.png' },
]

// 房型基本分類（固定 4 種）
type RoomCategory = 'double' | 'twin' | 'triple' | 'family'

const ROOM_CATEGORIES: { key: RoomCategory; label: string; icon: string; capacity: number; defaultPrice: number }[] = [
  { key: 'double', label: '雙床房（1大床）', icon: '🛏️', capacity: 2, defaultPrice: 2500 },
  { key: 'twin', label: '兩張單人床房', icon: '🛏️🛏️', capacity: 2, defaultPrice: 2500 },
  { key: 'triple', label: '三人房', icon: '🛏️🛏️🛏️', capacity: 3, defaultPrice: 3500 },
  { key: 'family', label: '家庭4人房', icon: '👨‍👩‍👧‍👦', capacity: 4, defaultPrice: 4500 },
]

// 子房型索引
type SubRoomIndex = 0 | 1 | 2

// 子房型設定
interface SubRoomConfig {
  name: string        // 飯店具體房型名稱 (e.g., "Horizon俱樂部豪華雙人間")
  quantity: number    // 房間數量
  price: number       // 每晚價格
  hasExtraBed: boolean // 是否加床（免費）
}

// 每個分類有 3 個子房型
type CategoryRooms = [SubRoomConfig, SubRoomConfig, SubRoomConfig]

// 飯店類型
interface Hotel {
  id: number
  name: string
  nights: number
  startNight: number  // 從第幾晚開始入住（1-indexed），預設 1。用於處理分批住宿
  // 4 種房型分類，每種有 3 個子房型
  rooms: {
    double: CategoryRooms
    twin: CategoryRooms
    triple: CategoryRooms
    family: CategoryRooms
  }
  // 押金政策
  hasDeposit: boolean
  depositPerRoom: number  // 每間房押金（check-in 時收取）
}

// 動態車費類型
interface CarFeeDay {
  day: string      // D1, D2, ...
  date: string     // 2/12, 2/13, ...
  name: string     // 行程標題
  cost: number     // 成本
  price: number    // 報價
  type: string     // city, suburban, chiangrai, airport
}

// 儲存的報價設定類型
interface SavedQuote {
  id: string
  name: string
  createdAt: string
  data: {
    itineraryText: string
    people: number
    carFees: CarFeeDay[]
    tickets: DynamicTicket[]
    useDefaultTickets?: boolean  // 是否使用預設門票
    // 新增欄位
    hotels?: Hotel[]
    exchangeRate?: number
    includeAccommodation?: boolean
    includeMeals?: boolean
    includeGuide?: boolean
    luggageCar?: boolean
    childSeatCount?: number
    babySeatCount?: number  // 嬰兒座椅
    thaiDressCloth?: boolean
    thaiDressPhoto?: boolean
    makeupCount?: number
    mealLevel?: number  // 餐費等級
    collectDeposit?: boolean
  }
}

export function PricingCalculator() {
  // Sanity client for fetching activities
  const client = useClient({ apiVersion: '2024-01-01' })

  // 智能解析器狀態
  const [showParser, setShowParser] = useState(false)
  const [itineraryText, setItineraryText] = useState('')
  const [dbActivities, setDbActivities] = useState<ActivityRecord[]>([])
  const [parseResult, setParseResult] = useState<ActivityMatchResult | null>(null)
  const [parseWarnings, setParseWarnings] = useState<{ type: string; message: string }[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [isParseConfirmed, setIsParseConfirmed] = useState(false)

  // 解析後的行程（用於 PDF 輸出）
  const [parsedItinerary, setParsedItinerary] = useState<{
    day: string
    title: string
    items: string[]
    hotel: string | null
  }[]>([])

  // 動態車費（解析行程後自動產生）
  const [carFees, setCarFees] = useState<CarFeeDay[]>(DEFAULT_CONFIG.dailyCarFees.map(d => ({
    ...d,
    date: '',
  })))

  // 儲存的報價設定
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([])
  const [currentQuoteName, setCurrentQuoteName] = useState('')

  // Form states
  const [people, setPeople] = useState(10)
  const [exchangeRate, setExchangeRate] = useState(0.93)

  // 多飯店住宿（每飯店 4 種固定房型分類，每種 3 個子房型）
  const createEmptySubRooms = (defaultPrice: number): CategoryRooms => [
    { name: '', quantity: 0, price: defaultPrice, hasExtraBed: false },
    { name: '', quantity: 0, price: defaultPrice, hasExtraBed: false },
    { name: '', quantity: 0, price: defaultPrice, hasExtraBed: false },
  ]

  const createEmptyRooms = () => ({
    double: createEmptySubRooms(2500),
    twin: createEmptySubRooms(2500),
    triple: createEmptySubRooms(3500),
    family: createEmptySubRooms(4500),
  })

  // 根據人數計算預設房間數量（人數 ÷ 2，無條件進位）
  const calculateDefaultRoomCount = (peopleCount: number) => Math.ceil(peopleCount / 2)

  // 建立有預設房間的飯店房型（用於解析行程時）
  const createDefaultRooms = (hotelName: string, roomCount?: number) => {
    // 根據飯店名稱給不同的預設房型名稱
    const isShangri = hotelName.includes('香格里拉')
    const roomName = isShangri ? '豪華客房（大床）' : '經典客房（大床）'
    const defaultQuantity = roomCount ?? 2  // 預設 2 間，或指定數量
    return {
      double: [
        { name: roomName, quantity: defaultQuantity, price: 2500, hasExtraBed: false },
        { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        { name: '', quantity: 0, price: 2500, hasExtraBed: false },
      ] as CategoryRooms,
      twin: createEmptySubRooms(2500),
      triple: createEmptySubRooms(3500),
      family: createEmptySubRooms(4500),
    }
  }

  const [hotels, setHotels] = useState<Hotel[]>([
    {
      id: 1,
      name: '香格里拉酒店',
      nights: 3,
      startNight: 1,  // 從第 1 晚開始
      rooms: {
        double: [
          { name: '豪華客房（大床）', quantity: 5, price: 2500, hasExtraBed: false },  // 10人=5間
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        ],
        twin: [
          { name: '高級客房（雙床）', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        ],
        triple: [
          { name: '豪華三人房', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
        ],
        family: [
          { name: '家庭房', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
        ],
      },
      hasDeposit: false,
      depositPerRoom: 3000
    },
    {
      id: 2,
      name: '清邁美平洲際酒店',
      nights: 2,
      startNight: 4,  // 從第 4 晚開始（香格里拉 3 晚之後）
      rooms: {
        double: [
          { name: '經典客房（大床）', quantity: 5, price: 2500, hasExtraBed: false },  // 10人=5間
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        ],
        twin: [
          { name: '經典客房（雙床）', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        ],
        triple: [
          { name: '高級三人房', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
        ],
        family: [
          { name: '家庭套房', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
        ],
      },
      hasDeposit: false,
      depositPerRoom: 3000
    },
  ])
  const [nextHotelId, setNextHotelId] = useState(3)

  const [mealLevel, setMealLevel] = useState(900)
  const [tickets, setTickets] = useState<DynamicTicket[]>(DEFAULT_TICKETS)
  const [useDefaultTickets, setUseDefaultTickets] = useState(true)  // 是否使用預設門票（vs 解析後動態門票）
  const [savedParsedTickets, setSavedParsedTickets] = useState<DynamicTicket[]>([])  // 保存解析後的門票，用於切換回去
  const [thaiDressCloth, setThaiDressCloth] = useState(true)
  const [thaiDressPhoto, setThaiDressPhoto] = useState(true)  // 攝影師預設勾選
  const [makeupCount, setMakeupCount] = useState(0)
  const [thaiDressDay, setThaiDressDay] = useState<number | null>(null)  // 泰服在哪一天（從解析結果取得）
  const [luggageCar, setLuggageCar] = useState(true)
  // 兒童座椅
  const [babySeatCount, setBabySeatCount] = useState(0)  // 0-2歲嬰兒座椅
  const [childSeatCount, setChildSeatCount] = useState(0)  // 3-5歲兒童座椅
  const [includeAccommodation, setIncludeAccommodation] = useState(true)
  const [includeMeals, setIncludeMeals] = useState(true)
  const [includeTickets, setIncludeTickets] = useState(true)
  const [includeGuide, setIncludeGuide] = useState(true)  // 導遊選項
  const [collectDeposit, setCollectDeposit] = useState(false)  // 代收押金（預設不收）
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})  // 房型分類展開狀態
  const [activeTab, setActiveTab] = useState<'input' | 'internal' | 'external'>('input')

  // 切換房型分類展開狀態
  const toggleCategory = (hotelId: number, catKey: string) => {
    const key = `${hotelId}-${catKey}`
    setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // 檢查分類是否展開（預設：有房間才展開）
  const isCategoryExpanded = (hotelId: number, catKey: string, hasRooms: boolean) => {
    const key = `${hotelId}-${catKey}`
    if (key in expandedCategories) return expandedCategories[key]
    return hasRooms  // 預設：有房間才展開
  }
  const config = DEFAULT_CONFIG

  // 載入活動資料庫
  const loadActivities = useCallback(async () => {
    setIsLoadingActivities(true)
    try {
      const activities = await client.fetch<ActivityRecord[]>(`
        *[_type == "activity" && isActive == true] | order(sortOrder asc) {
          _id,
          name,
          keywords,
          activityType,
          location,
          "adultPrice": adultPrice,
          "childPrice": childPrice,
          "rebate": rebate,
          "splitRebate": splitRebate,
          exclusiveGroup,
          isDefaultInGroup,
          isActive,
          sortOrder
        }
      `)
      setDbActivities(activities)
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setIsLoadingActivities(false)
    }
  }, [client])

  // 打開解析器時載入活動
  useEffect(() => {
    if (showParser && dbActivities.length === 0) {
      loadActivities()
    }
  }, [showParser, dbActivities.length, loadActivities])

  // 智能解析行程
  const handleParseItinerary = useCallback(() => {
    if (!itineraryText.trim()) return

    const parsed = parseItineraryText(itineraryText)
    // 如果 Sanity 資料庫是空的，用 DEFAULT_TICKETS 來匹配
    const activitiesToMatch = dbActivities.length > 0 ? dbActivities : getDefaultActivitiesForMatching()
    const result = matchActivitiesToDatabase(parsed, activitiesToMatch)

    // 泰服關鍵字（特殊處理：不在 DEFAULT_TICKETS，但有獨立 UI）
    const thaiDressKeywords = ['泰服', 'thai dress', '泰服體驗', '攝影師拍攝']

    // 找出泰服在哪一天（從 unmatched 活動中取得 dayNumber）
    const thaiDressActivity = result.unmatched.find(u =>
      thaiDressKeywords.some(kw => u.text.toLowerCase().includes(kw.toLowerCase()))
    )
    const detectedThaiDressDay = thaiDressActivity?.dayNumber || null

    // 檢查是否有泰服相關活動
    const hasThaiDress = detectedThaiDressDay !== null || itineraryText.toLowerCase().includes('泰服')

    // 過濾掉泰服相關的未匹配項目（因為有獨立 UI 處理）
    const filteredUnmatched = result.unmatched.filter(u =>
      !thaiDressKeywords.some(kw => u.text.toLowerCase().includes(kw.toLowerCase()))
    )

    // 建立新的結果物件（避免修改原物件）
    const filteredResult = {
      ...result,
      unmatched: filteredUnmatched
    }
    setParseResult(filteredResult)

    // 自動勾選泰服並設定天數（如果偵測到）
    if (hasThaiDress) {
      setThaiDressCloth(true)
      setThaiDressDay(detectedThaiDressDay)
      console.log(`[Thai Dress] 偵測到泰服 (Day ${detectedThaiDressDay})，自動勾選`)
    } else {
      setThaiDressDay(null)
    }

    // DEBUG: 顯示匹配結果
    console.log('=== 解析結果 ===')
    console.log('匹配到的活動:', result.matched.map(m => `${m.activityName} (D${m.dayNumber})`))
    console.log('未匹配的活動:', filteredUnmatched.map(u => u.text))
    if (hasThaiDress) console.log(`泰服: ✓ 偵測到 (Day ${detectedThaiDressDay})`)

    // 儲存解析警告
    setParseWarnings(parsed.warnings || [])

    // 1. 根據解析的天數產生車費欄位
    if (parsed.days.length > 0) {
      // 找到第一個有日期的天，產生連續日期
      let generatedDates: { dateStr: string }[] = []
      const firstDayWithDate = parsed.days.find(d => d.date)
      if (firstDayWithDate) {
        const [year, month, day] = firstDayWithDate.date.split('-').map(Number)
        const firstDayIndex = parsed.days.indexOf(firstDayWithDate)
        // 從第一天往前推算起始日期
        let startYear = year
        let startMonth = month
        let startDay = day - firstDayIndex
        // 處理日期往前推算時的月份邊界
        while (startDay < 1) {
          startMonth--
          if (startMonth < 1) {
            startMonth = 12
            startYear--
          }
          const daysInPrevMonth = [31, startYear % 4 === 0 && (startYear % 100 !== 0 || startYear % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][startMonth - 1]
          startDay += daysInPrevMonth
        }
        generatedDates = generateConsecutiveDates(startYear, startMonth, startDay, parsed.days.length)
      }

      const newCarFees = parsed.days.map((day, index) => {
        const dayNum = index + 1
        const isFirstDay = dayNum === 1
        const isLastDay = dayNum === parsed.days.length

        // 優先使用生成的連續日期，否則用解析到的日期
        const dateStr = generatedDates[index]?.dateStr ||
          (day.date ? `${parseInt(day.date.split('-')[1])}/${parseInt(day.date.split('-')[2])}` : '')

        // 智能判斷路線類型
        let type = 'suburban'
        let defaultPrice = 3800
        let defaultCost = 3300

        if (isFirstDay && day.title?.includes('抵達')) {
          type = 'city'
          defaultPrice = 3200
          defaultCost = 2700
        } else if (isLastDay && (day.title?.includes('送機') || day.rawText?.includes('送機'))) {
          type = 'airport'
          defaultPrice = 600
          defaultCost = 500
        } else if (day.title?.includes('清萊') || day.rawText?.includes('清萊')) {
          type = 'chiangrai'
          defaultPrice = 4500
          defaultCost = 4000
        } else if (day.title?.includes('市區') || day.title?.includes('市集')) {
          type = 'city'
          defaultPrice = 3500
          defaultCost = 3000
        }

        return {
          day: `D${dayNum}`,
          date: dateStr,
          name: day.title || `第 ${dayNum} 天`,
          cost: defaultCost,
          price: defaultPrice,
          type,
        }
      })
      setCarFees(newCarFees)
    }

    // 2. 根據匹配結果生成動態門票
    if (result.matched.length > 0) {
      // 從匹配結果生成動態門票列表
      const dynamicTickets: DynamicTicket[] = []
      const addedGroups = new Set<string>()  // 追蹤已加入的互斥群組

      for (const matched of result.matched) {
        // 找對應的 DEFAULT_TICKET 範本
        const template = DEFAULT_TICKETS.find(t =>
          matched.activityName.includes(t.name) ||
          t.name.includes(matched.activityName) ||
          // 也嘗試用 id 匹配
          matched.activityId.includes(t.id) ||
          t.id.includes(matched.activityId.replace(/-/g, ''))
        )

        if (template) {
          // 檢查互斥群組
          if (template.exclusiveGroup) {
            if (addedGroups.has(template.exclusiveGroup)) {
              // 同群組已有項目，跳過
              continue
            }
            addedGroups.add(template.exclusiveGroup)

            // 加入整個互斥群組的所有選項
            const groupTickets = DEFAULT_TICKETS.filter(t => t.exclusiveGroup === template.exclusiveGroup)
            groupTickets.forEach(gt => {
              dynamicTickets.push({
                ...gt,
                dayNumber: matched.dayNumber,
                source: 'parsed',
                checked: gt.id === template.id,  // 只勾選匹配到的那個
              })
            })
          } else {
            // 非互斥群組，直接加入
            dynamicTickets.push({
              ...template,
              dayNumber: matched.dayNumber,
              source: 'parsed',
              checked: true,
            })
          }
        } else {
          // 沒有範本，從資料庫資料建立新門票
          dynamicTickets.push({
            id: matched.activityId,
            name: matched.activityName,
            price: matched.price,
            rebate: matched.rebate,
            split: matched.splitRebate,
            checked: true,
            dayNumber: matched.dayNumber,
            source: 'parsed',
            exclusiveGroup: matched.exclusiveGroup,
          })
        }
      }

      // 按 dayNumber 排序
      dynamicTickets.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))

      // DEBUG: 顯示動態門票（勾選狀態）
      console.log('生成的動態門票:', dynamicTickets.map(t => `${t.name} (checked: ${t.checked})`))

      setTickets(dynamicTickets)
      setSavedParsedTickets(dynamicTickets)  // 保存解析結果，用於切換回去
      setUseDefaultTickets(false)
    } else {
      // 沒有匹配到任何活動，保持現有門票但全部取消勾選
      console.log('無匹配活動，重置所有門票為未勾選')
      setTickets(prev => prev.map(t => ({ ...t, checked: false })))
      setSavedParsedTickets([])
    }

    // 3. 根據解析的住宿更新飯店（如果有的話）
    if (result.hotels.length > 0) {
      // 統計每間飯店的住宿天數和起始晚數
      // hotelInfo: { name: string, nights: number, startNight: number }
      const hotelStats: Record<string, { nights: number; startNight: number }> = {}
      result.hotels.forEach(h => {
        if (!hotelStats[h.name]) {
          hotelStats[h.name] = { nights: 1, startNight: h.dayNumber }
        } else {
          hotelStats[h.name].nights += 1
          // 更新最早的起始晚數
          hotelStats[h.name].startNight = Math.min(hotelStats[h.name].startNight, h.dayNumber)
        }
      })

      // 建立飯店列表（帶有預設房間，根據人數計算）
      const uniqueHotels = Object.entries(hotelStats)
      if (uniqueHotels.length > 0) {
        const defaultRoomCount = calculateDefaultRoomCount(people)
        const newHotels = uniqueHotels.map(([name, stats], index) => ({
          id: index + 1,
          name,
          nights: stats.nights,
          startNight: stats.startNight,  // 使用解析到的起始晚數
          rooms: createDefaultRooms(name, defaultRoomCount),  // 根據人數計算房間數
          hasDeposit: false,
          depositPerRoom: 3000,
        }))
        setHotels(newHotels)
        setNextHotelId(uniqueHotels.length + 1)
      }
    }

    // 4. 產生行程概覽格式（用於 PDF）
    const newItinerary = parsed.days.map((day, index) => {
      const dayNum = index + 1
      const dateStr = day.date ? `${parseInt(day.date.split('-')[1])}/${parseInt(day.date.split('-')[2])}` : ''

      // 從活動中提取項目
      const items: string[] = []
      day.activities.forEach(act => {
        if (act.content && !act.content.match(/^(早餐|午餐|晚餐|住宿)[：:]/)) {
          items.push(act.content.replace(/^[・\-•·]\s*/, ''))
        }
      })
      if (day.morning) items.push(day.morning)
      if (day.afternoon) items.push(day.afternoon)
      if (day.evening) items.push(day.evening)

      // 找該天的住宿
      const hotelForDay = result.hotels.find(h => h.dayNumber === dayNum)

      return {
        day: `DAY ${dayNum}${dateStr ? ` (${dateStr})` : ''}`,
        title: day.title || `第 ${dayNum} 天`,
        items: items.slice(0, 8), // 最多顯示 8 個項目
        hotel: hotelForDay?.name || day.accommodation || null,
      }
    })
    setParsedItinerary(newItinerary)

    // 解析完成直接生效（不需要確認按鈕）
    setIsParseConfirmed(true)
  }, [itineraryText, dbActivities])

  // 車費管理函數
  const updateCarFee = (index: number, field: keyof CarFeeDay, value: any) => {
    setCarFees(prev => prev.map((cf, i) => i === index ? { ...cf, [field]: value } : cf))
  }

  const addCarFeeDay = () => {
    const newDay = carFees.length + 1
    setCarFees(prev => [...prev, {
      day: `D${newDay}`,
      date: '',
      name: `第 ${newDay} 天`,
      cost: 3300,
      price: 3800,
      type: 'suburban',
    }])
  }

  const removeCarFeeDay = (index: number) => {
    if (carFees.length <= 1) return
    setCarFees(prev => prev.filter((_, i) => i !== index).map((cf, i) => ({
      ...cf,
      day: `D${i + 1}`,
    })))
  }

  // 確認解析結果 - 綁定到內部明細和對外報價
  const confirmParsedItinerary = useCallback(() => {
    if (parsedItinerary.length === 0) return
    setIsParseConfirmed(true)
    // 關閉解析器面板（可選）
    // setShowParser(false)
  }, [parsedItinerary])

  // 重置解析（清空所有解析結果）
  const resetParsedItinerary = useCallback(() => {
    setParsedItinerary([])
    setParseResult(null)
    setParseWarnings([])
    setIsParseConfirmed(false)
    setItineraryText('')
    // 重置為預設車費
    setCarFees(DEFAULT_CONFIG.dailyCarFees.map(d => ({
      ...d,
      date: '',
    })))
    // 重置為預設門票
    setTickets(DEFAULT_TICKETS.map(t => ({ ...t, checked: false })))
    setUseDefaultTickets(true)
  }, [])

  // 報價儲存/載入/複製功能
  const STORAGE_KEY = 'chiangway-pricing-quotes'

  // 從 localStorage 載入已儲存的報價
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setSavedQuotes(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load saved quotes:', e)
    }
  }, [])

  // 儲存當前報價
  const saveCurrentQuote = () => {
    const name = currentQuoteName.trim() || `報價 ${new Date().toLocaleDateString('zh-TW')}`
    const newQuote: SavedQuote = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      data: {
        itineraryText,
        people,
        carFees,
        tickets: tickets.map(t => ({ ...t })),
        useDefaultTickets,
        // 新增欄位
        hotels: hotels.map(h => ({ ...h })),
        exchangeRate,
        includeAccommodation,
        includeMeals,
        includeGuide,
        luggageCar,
        childSeatCount,
        babySeatCount,
        thaiDressCloth,
        thaiDressPhoto,
        makeupCount,
        mealLevel,
        collectDeposit,
      },
    }
    const updated = [...savedQuotes, newQuote]
    setSavedQuotes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setCurrentQuoteName('')
    alert(`✅ 已儲存「${name}」`)
  }

  // 載入報價
  const loadQuote = (quote: SavedQuote) => {
    setItineraryText(quote.data.itineraryText || '')
    setPeople(quote.data.people || 10)
    if (quote.data.carFees) setCarFees(quote.data.carFees)
    if (quote.data.tickets) setTickets(quote.data.tickets)
    if (quote.data.useDefaultTickets !== undefined) setUseDefaultTickets(quote.data.useDefaultTickets)
    // 載入新增欄位
    if (quote.data.hotels) setHotels(quote.data.hotels)
    if (quote.data.exchangeRate !== undefined) setExchangeRate(quote.data.exchangeRate)
    if (quote.data.includeAccommodation !== undefined) setIncludeAccommodation(quote.data.includeAccommodation)
    if (quote.data.includeMeals !== undefined) setIncludeMeals(quote.data.includeMeals)
    if (quote.data.includeGuide !== undefined) setIncludeGuide(quote.data.includeGuide)
    if (quote.data.luggageCar !== undefined) setLuggageCar(quote.data.luggageCar)
    if (quote.data.childSeatCount !== undefined) setChildSeatCount(quote.data.childSeatCount)
    if (quote.data.babySeatCount !== undefined) setBabySeatCount(quote.data.babySeatCount)
    if (quote.data.thaiDressCloth !== undefined) setThaiDressCloth(quote.data.thaiDressCloth)
    if (quote.data.thaiDressPhoto !== undefined) setThaiDressPhoto(quote.data.thaiDressPhoto)
    if (quote.data.makeupCount !== undefined) setMakeupCount(quote.data.makeupCount)
    if (quote.data.mealLevel !== undefined) setMealLevel(quote.data.mealLevel)
    if (quote.data.collectDeposit !== undefined) setCollectDeposit(quote.data.collectDeposit)
    setCurrentQuoteName(quote.name)
    // 如果有行程文字，自動打開解析器
    if (quote.data.itineraryText) {
      setShowParser(true)
    }
    alert(`✅ 已載入「${quote.name}」\n${quote.data.itineraryText ? '💡 請點「解析行程」重新解析' : ''}`)
  }

  // 複製報價（Fork）
  const forkQuote = (quote: SavedQuote) => {
    loadQuote(quote)
    setCurrentQuoteName(`${quote.name} (複製)`)
  }

  // 全部清空（新增全新報價）
  const resetAllFields = () => {
    if (!confirm('確定要清空所有欄位，開始新報價嗎？')) return
    // 清空解析器
    setItineraryText('')
    setParsedItinerary([])
    setParseResult(null)
    setParseWarnings([])
    setIsParseConfirmed(false)
    // 重置基本設定
    setPeople(10)
    setExchangeRate(0.93)
    setIncludeAccommodation(true)
    setIncludeMeals(true)
    setIncludeGuide(true)
    setCollectDeposit(true)
    // 重置車費
    setCarFees(DEFAULT_CONFIG.dailyCarFees.map(d => ({ ...d, date: '' })))
    setLuggageCar(true)
    setChildSeatCount(0)
    // 重置飯店（預設香格里拉3晚 + 美平2晚，10人=5間大床房）
    setHotels([
      {
        id: 1,
        name: '香格里拉酒店',
        nights: 3,
        startNight: 1,  // 從第 1 晚開始
        rooms: {
          double: [
            { name: '豪華客房（大床）', quantity: 5, price: 2500, hasExtraBed: false },  // 10人=5間
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          ],
          twin: [
            { name: '高級客房（雙床）', quantity: 0, price: 2500, hasExtraBed: false },
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          ],
          triple: [
            { name: '豪華三人房', quantity: 0, price: 3500, hasExtraBed: false },
            { name: '', quantity: 0, price: 3500, hasExtraBed: false },
            { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          ],
          family: [
            { name: '家庭房', quantity: 0, price: 4500, hasExtraBed: false },
            { name: '', quantity: 0, price: 4500, hasExtraBed: false },
            { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          ],
        },
        hasDeposit: false,
        depositPerRoom: 3000
      },
      {
        id: 2,
        name: '清邁美平洲際酒店',
        nights: 2,
        startNight: 4,  // 從第 4 晚開始
        rooms: {
          double: [
            { name: '經典客房（大床）', quantity: 5, price: 2500, hasExtraBed: false },  // 10人=5間
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          ],
          twin: [
            { name: '經典客房（雙床）', quantity: 0, price: 2500, hasExtraBed: false },
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
            { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          ],
          triple: [
            { name: '高級三人房', quantity: 0, price: 3500, hasExtraBed: false },
            { name: '', quantity: 0, price: 3500, hasExtraBed: false },
            { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          ],
          family: [
            { name: '家庭套房', quantity: 0, price: 4500, hasExtraBed: false },
            { name: '', quantity: 0, price: 4500, hasExtraBed: false },
            { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          ],
        },
        hasDeposit: false,
        depositPerRoom: 3000
      },
    ])
    setNextHotelId(3)
    // 重置門票
    setTickets(DEFAULT_TICKETS.map(t => ({ ...t, checked: false })))
    setUseDefaultTickets(true)
    setSavedParsedTickets([])  // 清除保存的解析門票
    // 重置泰服
    setThaiDressCloth(false)
    setThaiDressPhoto(false)
    setMakeupCount(0)
    setThaiDressDay(null)
    // 清空報價名稱
    setCurrentQuoteName('')
    alert('✅ 已清空所有欄位，可以開始新報價')
  }

  // 刪除報價
  const deleteQuote = (id: string) => {
    if (!confirm('確定要刪除這個報價嗎？')) return
    const updated = savedQuotes.filter(q => q.id !== id)
    setSavedQuotes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  // 清空所有報價
  const clearAllQuotes = () => {
    if (!confirm('確定要清空所有儲存的報價嗎？此操作無法復原。')) return
    setSavedQuotes([])
    localStorage.removeItem(STORAGE_KEY)
  }

  // 飯店管理函數
  const addHotel = () => {
    // 計算新飯店應該從第幾晚開始（預設接在最後一間飯店之後）
    const lastEndNight = hotels.length > 0
      ? Math.max(...hotels.map(h => (h.startNight || 1) + h.nights - 1))
      : 0
    const newStartNight = lastEndNight + 1

    setHotels(prev => [...prev, {
      id: nextHotelId,
      name: '新飯店',
      nights: 1,
      startNight: newStartNight,  // 接在最後一間之後
      rooms: createEmptyRooms(),
      hasDeposit: false,
      depositPerRoom: 3000
    }])
    setNextHotelId(prev => prev + 1)
  }

  const removeHotel = (id: number) => {
    if (hotels.length <= 1) return // 至少保留一間
    setHotels(prev => prev.filter(h => h.id !== id))
  }

  const updateHotel = (id: number, field: keyof Hotel, value: any) => {
    setHotels(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  const updateRoom = (hotelId: number, category: RoomCategory, subIndex: SubRoomIndex, field: keyof SubRoomConfig, value: any) => {
    setHotels(prev => prev.map(h => {
      if (h.id !== hotelId) return h
      const newSubRooms = [...h.rooms[category]] as CategoryRooms
      newSubRooms[subIndex] = { ...newSubRooms[subIndex], [field]: value }
      return {
        ...h,
        rooms: {
          ...h.rooms,
          [category]: newSubRooms
        }
      }
    }))
  }

  // 計算總住宿晚數（使用最大結束晚數，正確處理平行住宿）
  // 例：香格里拉 D1-3 (startNight=1, nights=3, endNight=3)
  //     美平洲際 D4-5 (startNight=4, nights=2, endNight=5)
  //     總晚數 = max(3, 5) = 5
  // 分批住宿例：飯店A D1-2 (startNight=1, nights=2)，飯店B D1-2 (startNight=1, nights=2)
  //     總晚數 = max(2, 2) = 2（而非 4）
  const totalNights = hotels.length > 0
    ? Math.max(...hotels.map(h => (h.startNight || 1) + h.nights - 1))
    : 0

  // 行程天數（優先使用解析後的車費天數）
  const tripDays = carFees.length
  const tripNights = tripDays - 1 // 天數 - 1 = 晚數

  // Auto-adjust luggage car based on max passengers per car
  // maxPerCar >= 8 自動勾選（8人以上很緊，需要行李車）
  useEffect(() => {
    const cars = people <= 9 ? 1 : 1 + Math.ceil((people - 9) / 10)
    const basePerCar = Math.floor(people / cars)
    const remainder = people % cars
    const maxPerCar = basePerCar + (remainder > 0 ? 1 : 0)
    setLuggageCar(maxPerCar >= 8)
  }, [people])

  // Calculations
  const calculation = useMemo(() => {
    const { mealDays, guideDays, guidePerDay, luggagePerTrip, insurancePerPerson, thaiDress } = config
    // 使用動態車費（carFees state）而非 config.dailyCarFees
    const dailyCarFees = carFees
    // 使用多飯店的總晚數
    const nights = totalNights

    // 車輛計算：第一台 9 人（導遊坐副駕）、之後每台 10 人
    // 1-9人=1台, 10-19人=2台, 20-29人=3台...
    const carCount = people <= 9 ? 1 : 1 + Math.ceil((people - 9) / 10)

    // 舒適配車人數計算（平均分配）
    // 例：22人/3台 = 8+7+7
    const basePerCar = Math.floor(people / carCount)
    const remainder = people % carCount
    // 產生配車字串，例："8+7+7"
    const carDistributionArr: number[] = []
    for (let i = 0; i < carCount; i++) {
      // 多的人分配到前面幾台車
      carDistributionArr.push(basePerCar + (i < remainder ? 1 : 0))
    }
    const carDistribution = carDistributionArr.join('+')
    // 最大單車人數（用於判斷行李空間）
    const maxPerCar = Math.max(...carDistributionArr)

    // 行李車邏輯：
    // ≤7: OK（行李剛好）
    // 8-10: 很緊，建議加行李車，提醒確認行李件數/尺寸
    const luggageStatus: 'ok' | 'tight' = maxPerCar <= 7 ? 'ok' : 'tight'
    const suggestLuggageCar = maxPerCar >= 8
    const needLuggageCar = luggageCar

    // 住宿 - 使用多飯店系統（可選擇不含住宿）
    // 每間飯店的住宿費 = 各房型分類內所有子房型 (數量 × 單價) 加總 × 晚數
    const getHotelCost = (h: Hotel) => {
      const roomTotal = ROOM_CATEGORIES.reduce((sum, cat) => {
        // 遍歷該分類的 3 個子房型
        const categoryTotal = h.rooms[cat.key].reduce((catSum, subRoom) => {
          return catSum + (subRoom.quantity * subRoom.price)
        }, 0)
        return sum + categoryTotal
      }, 0)
      return roomTotal * h.nights
    }
    const accommodationCost = includeAccommodation
      ? hotels.reduce((sum, h) => sum + getHotelCost(h), 0)
      : 0

    // 計算飯店總房間數（所有子房型數量加總）
    const getHotelRoomCount = (h: Hotel) => ROOM_CATEGORIES.reduce((sum, cat) => {
      return sum + h.rooms[cat.key].reduce((catSum, subRoom) => catSum + subRoom.quantity, 0)
    }, 0)

    // 計算飯店總容量（含加床）
    const getHotelCapacity = (h: Hotel) => ROOM_CATEGORIES.reduce((sum, cat) => {
      // 遍歷該分類的 3 個子房型
      const categoryCapacity = h.rooms[cat.key].reduce((catSum, subRoom) => {
        const baseCapacity = subRoom.quantity * cat.capacity
        const extraBeds = subRoom.hasExtraBed ? subRoom.quantity : 0  // 每間加床房多 1 人
        return catSum + baseCapacity + extraBeds
      }, 0)
      return sum + categoryCapacity
    }, 0)

    // 總房間容量（平均）
    const totalRoomCapacity = hotels.length > 0
      ? hotels.reduce((sum, h) => sum + getHotelCapacity(h), 0) / hotels.length
      : 0

    // 有押金的飯店（只有勾選住宿時才考慮）
    const hotelsWithDeposit = includeAccommodation ? hotels.filter(h => h.hasDeposit) : []

    // 計算押金：每間房押金 × 房間數（check-in 時收取，退房退還）
    const getHotelDeposit = (h: Hotel) => {
      if (!h.hasDeposit) return 0
      const totalRooms = getHotelRoomCount(h)
      return h.depositPerRoom * totalRooms
    }
    const totalDeposit = hotelsWithDeposit.reduce((sum, h) => sum + getHotelDeposit(h), 0)

    // Meal（可選擇不含餐費）
    const mealCost = includeMeals ? people * mealLevel * mealDays : 0

    // Car
    let carCostTotal = 0, carPriceTotal = 0
    dailyCarFees.forEach((d: any) => {
      carCostTotal += (d.cost || 0) * carCount
      carPriceTotal += (d.price || 0) * carCount
    })

    // Guide (respect includeGuide toggle)
    const guideCost = includeGuide ? guidePerDay.cost * guideDays : 0
    const guidePrice = includeGuide ? guidePerDay.price * guideDays : 0

    // Luggage
    const luggageCost = needLuggageCar ? luggagePerTrip * 2 : 0

    // Child Seats (0-2歲嬰兒座椅, 3-5歲兒童座椅)
    const childSeatCost = (babySeatCount + childSeatCount) * config.childSeatPerDay * guideDays

    const transportCost = carCostTotal + guideCost
    const transportPrice = carPriceTotal + guidePrice + luggageCost + childSeatCost
    const transportProfit = transportPrice - transportCost - luggageCost - childSeatCost

    // Tickets
    let ticketCost = 0, ticketPrice = 0, ticketYourProfit = 0, ticketPartnerProfit = 0
    const selectedTickets = tickets.filter(t => t.checked)
    selectedTickets.forEach(t => {
      const cost = (t.price - t.rebate) * people
      const price = t.price * people
      ticketCost += cost
      ticketPrice += price
      const profit = t.rebate * people
      if (t.split && t.rebate > 0) {
        ticketYourProfit += profit / 2
        ticketPartnerProfit += profit / 2
      }
    })

    // Thai dress
    let thaiDressCost = 0, thaiDressPrice = 0, thaiDressYourProfit = 0, thaiDressPartnerProfit = 0
    if (thaiDressCloth) {
      const clothCost = (thaiDress.cloth.price - thaiDress.cloth.rebate) * people
      const clothPrice = thaiDress.cloth.price * people
      thaiDressCost += clothCost
      thaiDressPrice += clothPrice
      const profit = thaiDress.cloth.rebate * people
      thaiDressYourProfit += profit / 2
      thaiDressPartnerProfit += profit / 2
    }
    if (makeupCount > 0) {
      const makeupCostTotal = (thaiDress.makeup.price - thaiDress.makeup.rebate) * makeupCount
      const makeupPriceTotal = thaiDress.makeup.price * makeupCount
      thaiDressCost += makeupCostTotal
      thaiDressPrice += makeupPriceTotal
      const profit = thaiDress.makeup.rebate * makeupCount
      thaiDressYourProfit += profit / 2
      thaiDressPartnerProfit += profit / 2
    }
    if (thaiDressPhoto) {
      const photographerCount = people <= 10 ? 1 : 2
      const photoCost = (thaiDress.photo.price - thaiDress.photo.rebate) * photographerCount
      const photoPrice = thaiDress.photo.price * photographerCount
      thaiDressCost += photoCost
      thaiDressPrice += photoPrice
      const profit = thaiDress.photo.rebate * photographerCount
      thaiDressYourProfit += profit / 2
      thaiDressPartnerProfit += profit / 2
    }

    // Insurance（只有包套行程才含保險，純包車不含）
    const hasPackageServices = includeAccommodation || includeMeals || (includeTickets && selectedTickets.length > 0)
    const insuranceCost = hasPackageServices ? insurancePerPerson * people : 0

    // 門票費用（只有勾選「含門票」才計入）
    const effectiveTicketCost = includeTickets ? ticketCost : 0
    const effectiveTicketPrice = includeTickets ? ticketPrice : 0
    const effectiveThaiDressCost = includeTickets ? thaiDressCost : 0
    const effectiveThaiDressPrice = includeTickets ? thaiDressPrice : 0

    // Totals
    const totalCost = accommodationCost + mealCost + transportCost + effectiveTicketCost + effectiveThaiDressCost + insuranceCost + luggageCost
    const totalPrice = accommodationCost + mealCost + transportPrice + effectiveTicketPrice + effectiveThaiDressPrice + insuranceCost

    const yourTotalProfit = transportProfit + (includeTickets ? ticketYourProfit : 0) + (includeTickets ? thaiDressYourProfit : 0)
    const partnerTotalProfit = (includeTickets ? ticketPartnerProfit : 0) + (includeTickets ? thaiDressPartnerProfit : 0)

    const perPersonTHB = totalPrice / people
    const perPersonTWD = Math.round(perPersonTHB / exchangeRate)

    return {
      people, carCount, carDistribution, maxPerCar, luggageStatus, suggestLuggageCar, needLuggageCar, nights, mealDays, guideDays, mealLevel,
      includeAccommodation, includeMeals, includeTickets, hotels, hotelsWithDeposit, totalRoomCapacity,
      getHotelCost, getHotelDeposit, getHotelRoomCount, getHotelCapacity, totalDeposit,
      accommodationCost, mealCost, transportCost, transportPrice, transportProfit,
      carCostTotal, carPriceTotal, guideCost, guidePrice, luggageCost, childSeatCost,
      selectedTickets, ticketCost, ticketPrice, ticketYourProfit, ticketPartnerProfit,
      thaiDressCost, thaiDressPrice, thaiDressYourProfit, thaiDressPartnerProfit,
      insuranceCost, totalCost, totalPrice, yourTotalProfit, partnerTotalProfit,
      perPersonTHB, perPersonTWD, exchangeRate,
      dailyCarFees,
    }
  }, [config, people, exchangeRate, hotels, totalNights, mealLevel, tickets, thaiDressCloth, thaiDressPhoto, makeupCount, luggageCar, babySeatCount, childSeatCount, includeAccommodation, includeMeals, includeTickets, includeGuide, carFees])

  const fmt = (n: number) => n.toLocaleString()

  const toggleTicket = (id: string) => {
    setTickets(prev => {
      const ticket = prev.find(t => t.id === id)
      if (!ticket) return prev

      // 如果要勾選這個票，檢查互斥群組
      if (!ticket.checked) {
        // 使用 ticket 自身的 exclusiveGroup 或從 EXCLUSIVE_GROUPS 查找
        const group = ticket.exclusiveGroup || Object.entries(EXCLUSIVE_GROUPS).find(([_, ids]) => ids.includes(id))?.[0]

        if (group) {
          // 找出同一天、同群組的票（動態門票）或同群組的票（預設門票）
          return prev.map(t => {
            if (t.id === id) return { ...t, checked: true }
            // 同群組且同一天（或都沒有 dayNumber）的票要取消
            const sameGroup = t.exclusiveGroup === group || EXCLUSIVE_GROUPS[group]?.includes(t.id)
            const sameDay = ticket.dayNumber === undefined || t.dayNumber === undefined || t.dayNumber === ticket.dayNumber
            if (sameGroup && sameDay && t.id !== id) return { ...t, checked: false }
            return t
          })
        }
      }

      // 沒有互斥群組，直接切換
      return prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t)
    })
  }

  // 門票 + 泰服 統一控制
  const selectAllActivities = () => {
    setTickets(prev => prev.map(t => ({ ...t, checked: true })))
    setThaiDressCloth(true)
  }

  const deselectAllActivities = () => {
    setTickets(prev => prev.map(t => ({ ...t, checked: false })))
    setThaiDressCloth(false)
    setThaiDressPhoto(false)
    setMakeupCount(0)
  }

  const allTicketsSelected = tickets.every(t => t.checked)
  const noTicketsSelected = tickets.every(t => !t.checked)
  const allActivitiesSelected = allTicketsSelected && thaiDressCloth
  const noActivitiesSelected = noTicketsSelected && !thaiDressCloth && !thaiDressPhoto && makeupCount === 0

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 1100, margin: '0 auto', padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ color: '#5c4a2a', marginBottom: 5 }}>🚐 清邁 {tripDays}天{tripNights}夜 報價計算器</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>內部工具 v4 — 智能解析 + 車導明細</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('input')} style={{ padding: '10px 20px', background: activeTab === 'input' ? '#5c4a2a' : '#ddd', color: activeTab === 'input' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📝 輸入</button>
        <button onClick={() => setActiveTab('internal')} style={{ padding: '10px 20px', background: activeTab === 'internal' ? '#5c4a2a' : '#ddd', color: activeTab === 'internal' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📊 內部明細</button>
        <button onClick={() => setActiveTab('external')} style={{ padding: '10px 20px', background: activeTab === 'external' ? '#5c4a2a' : '#ddd', color: activeTab === 'external' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📄 對外報價單</button>
        <button onClick={() => downloadExternalQuote(calculation, people, exchangeRate, hotels, mealLevel, thaiDressCloth, thaiDressPhoto, makeupCount, config, includeAccommodation, includeMeals, includeGuide, totalNights, babySeatCount, childSeatCount, collectDeposit, tripDays, isParseConfirmed ? parsedItinerary : undefined)} style={{ padding: '10px 20px', background: '#b89b4d', color: 'white', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📥 下載報價</button>
      </div>

      {/* Input Tab */}
      {activeTab === 'input' && (
        <>
          {/* 📦 套餐行程管理 - 放在最上方 */}
          <Section title="📦 套餐行程管理" style={{ background: '#f3e5f5', border: '1px solid #ce93d8' }}>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px 0' }}>
              儲存完整報價設定，下次可快速載入或複製修改
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <input
                type="text"
                value={currentQuoteName}
                onChange={e => setCurrentQuoteName(e.target.value)}
                placeholder="輸入名稱（例：王先生 6天5夜 2/12-17）"
                style={{ flex: 1, minWidth: 200, padding: 8, border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
              />
              <button
                onClick={saveCurrentQuote}
                style={{ padding: '8px 16px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
              >
                💾 儲存
              </button>
              <button
                onClick={resetAllFields}
                style={{ padding: '8px 16px', background: '#607d8b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
              >
                ✨ 新建
              </button>
            </div>

            {savedQuotes.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>📂 已儲存（{savedQuotes.length}）</strong>
                  <button
                    onClick={clearAllQuotes}
                    style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >
                    🗑️ 清空全部
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {savedQuotes.map(q => (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 8,
                        background: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13 }}>
                        📄 {q.name}
                        <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
                          {new Date(q.createdAt).toLocaleDateString('zh-TW')}
                        </span>
                      </span>
                      <button
                        onClick={() => loadQuote(q)}
                        style={{ padding: '4px 8px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                      >
                        📥 載入
                      </button>
                      <button
                        onClick={() => forkQuote(q)}
                        style={{ padding: '4px 8px', background: '#ff9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                      >
                        📋 複製
                      </button>
                      <button
                        onClick={() => deleteQuote(q.id)}
                        style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* 1️⃣ 快速開始（可收合） */}
          <Section title="📋 快速開始" style={{ background: '#e3f2fd', border: '1px solid #90caf9' }}>
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => setShowParser(!showParser)}
                style={{
                  padding: '8px 16px',
                  background: showParser ? '#1565c0' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {showParser ? '收起' : '📋 貼入行程文字'}
              </button>
              <span style={{ marginLeft: 12, fontSize: 13, color: '#666' }}>
                {parsedItinerary.length > 0
                  ? `✅ 已解析 ${carFees.length} 天行程`
                  : '可選 — 貼入行程快速帶入天數、日期、活動'}
              </span>
            </div>

            {showParser && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                  💡 貼入完整行程文字，系統會自動解析天數、日期、活動、飯店
                </div>
                <textarea
                  value={itineraryText}
                  onChange={e => setItineraryText(e.target.value)}
                  placeholder={`貼入行程文字，例如：

2/12 (四)
Day 1｜抵達清邁
・機場接機
・泰服拍攝體驗
住宿: 香格里拉酒店

2/13 (五)
Day 2｜大象保護營
・大象保護營（含餐）
・射擊體驗
住宿: 香格里拉酒店

2/14 (六)
Day 3｜茵他儂國家公園
・茵他儂一日遊
・雙龍塔
住宿: 香格里拉酒店

2/15 (日)
Day 4｜清萊一日遊
・白廟
・藍廟
・黑廟
住宿: 香格里拉酒店

2/16 (一)
Day 5｜送機
・自由活動
・機場送機`}
                  style={{
                    width: '100%',
                    minHeight: 350,
                    maxHeight: 600,
                    padding: 16,
                    border: '1px solid #90caf9',
                    borderRadius: 8,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    background: '#fafafa',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                  }}
                />
                <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleParseItinerary}
                    disabled={!itineraryText.trim()}
                    style={{
                      padding: '10px 24px',
                      background: !itineraryText.trim() ? '#ccc' : '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: !itineraryText.trim() ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontWeight: 'bold',
                    }}
                  >
                    🚀 解析並帶入
                  </button>
                  {parsedItinerary.length > 0 && (
                    <button
                      onClick={resetParsedItinerary}
                      style={{
                        padding: '10px 16px',
                        background: '#fff',
                        color: '#f44336',
                        border: '1px solid #f44336',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      🔄 清除重來
                    </button>
                  )}
                  {parseResult && (
                    <span style={{ fontSize: 12, color: '#666' }}>
                      ✅ {parseResult.matched.length} 項活動匹配
                      {parseResult.unmatched.length > 0 && ` | ⚠️ ${parseResult.unmatched.length} 項未匹配`}
                    </span>
                  )}
                </div>
                {/* 解析警告 */}
                {parseWarnings.length > 0 && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#fff3e0',
                    border: '1px solid #ffb74d',
                    borderRadius: 6,
                    fontSize: 13,
                  }}>
                    <strong style={{ color: '#e65100' }}>⚠️ 發現問題：</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      {parseWarnings.map((w, i) => (
                        <li key={i} style={{ color: '#bf360c', marginBottom: 4 }}>
                          {w.message}
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                      請修正上方行程文字後重新解析
                    </div>
                  </div>
                )}

                {/* 未匹配活動（可展開） */}
                {parseResult && parseResult.unmatched.length > 0 && (
                  <details style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#fce4ec',
                    border: '1px solid #f48fb1',
                    borderRadius: 6,
                    fontSize: 13,
                  }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#c2185b' }}>
                      ⚠️ {parseResult.unmatched.length} 項活動未匹配資料庫（點擊展開）
                    </summary>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      {parseResult.unmatched.map((u, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          <span style={{ color: '#880e4f' }}>Day {u.dayNumber}:</span> {u.text}
                          {u.suggestedKeywords.length > 0 && (
                            <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
                              (建議關鍵字: {u.suggestedKeywords.join(', ')})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                      💡 這些活動不在資料庫，可能是：免費景點、自由活動、或需要新增到資料庫
                    </div>
                  </details>
                )}

                {/* 解析結果摘要 */}
                {parsedItinerary.length > 0 && (
                  <div style={{ marginTop: 12, padding: 10, background: '#e8f5e9', borderRadius: 6, fontSize: 13 }}>
                    <strong>已帶入：</strong>
                    {carFees.length} 天行程
                    {carFees[0]?.date && ` (${carFees[0].date} ~ ${carFees[carFees.length-1]?.date})`}
                    {parseResult?.hotels && parseResult.hotels.length > 0 && (
                      <> | 🏨 {parseResult.hotels.map(h => h.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</>
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* 2️⃣ 基本設定 */}
          <Section title="👥 基本設定">
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontWeight: 'bold' }}>人數</label>
                <input type="number" value={people} onChange={e => setPeople(Number(e.target.value) || 4)} style={{ ...inputStyle, width: 80 }} />
                <span style={noteStyle}>人</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontWeight: 'bold' }}>匯率</label>
                <input type="number" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} min={0.85} max={1.05} step={0.01} style={{ ...inputStyle, width: 80 }} />
              </div>
              {people < 4 && <span style={{ color: '#f44336', fontSize: 13 }}>⚠️ 最低 4 人</span>}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeAccommodation} onChange={e => setIncludeAccommodation(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span>🏨 含住宿</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeMeals} onChange={e => setIncludeMeals(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span>🍜 含餐費</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeTickets} onChange={e => setIncludeTickets(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span>🎫 含門票</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeGuide} onChange={e => setIncludeGuide(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span>🧑‍💼 含導遊</span>
              </label>
              {calculation.totalDeposit > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={collectDeposit} onChange={e => setCollectDeposit(e.target.checked)} style={{ width: 16, height: 16 }} />
                  <span style={{ color: collectDeposit ? '#9a6b2a' : '#666' }}>💳 代收押金</span>
                </label>
              )}
            </div>
            {(!includeAccommodation || !includeMeals || noActivitiesSelected || !includeGuide) && (
              <div style={{ marginTop: 10, padding: 8, background: '#fff3e0', borderRadius: 6, fontSize: 13 }}>
                💡 {[
                  !includeAccommodation && '住宿',
                  !includeMeals && '餐費',
                  noActivitiesSelected && '門票/活動',
                  !includeGuide && '導遊'
                ].filter(Boolean).join('、')}由客人自理
              </div>
            )}
          </Section>

          {/* 住宿 */}
          <Section title={`🏨 住宿（共 ${totalNights} 晚）`} style={!includeAccommodation ? { opacity: 0.5 } : {}}>
            {!includeAccommodation ? (
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, textAlign: 'center', color: '#666' }}>
                客人自理住宿
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {hotels.map((hotel, index) => {
                    const hotelTotal = calculation.getHotelCost(hotel)
                    const hotelCapacity = calculation.getHotelCapacity(hotel)
                    const hotelRoomCount = calculation.getHotelRoomCount(hotel)
                    // 找出有任何子房型數量 > 0 的分類
                    const activeRooms = ROOM_CATEGORIES.filter(cat =>
                      hotel.rooms[cat.key].some(subRoom => subRoom.quantity > 0)
                    )
                    return (
                      <div key={hotel.id} style={{ background: '#fafafa', borderRadius: 8, padding: 16, border: hotel.hasDeposit ? '2px solid #b89b4d' : '1px solid #e0e0e0' }}>
                        {/* 第一行：飯店名稱、晚數、刪除 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold', color: '#5c4a2a', minWidth: 70 }}>飯店 {index + 1}</span>
                          <input
                            type="text"
                            value={hotel.name}
                            onChange={e => updateHotel(hotel.id, 'name', e.target.value)}
                            placeholder="飯店名稱"
                            style={{ flex: 1, minWidth: 150, padding: 8, border: '1px solid #ddd', borderRadius: 6, fontWeight: 'bold' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <label style={{ fontSize: 13, color: '#666' }}>起始</label>
                            <input
                              type="number"
                              value={hotel.startNight || 1}
                              onChange={e => updateHotel(hotel.id, 'startNight', Math.max(1, Number(e.target.value)))}
                              min={1}
                              max={30}
                              style={{ width: 50, padding: 6, border: '1px solid #ddd', borderRadius: 6, textAlign: 'center' }}
                              title="從第幾晚開始入住"
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <label style={{ fontSize: 13, color: '#666' }}>晚數</label>
                            <input
                              type="number"
                              value={hotel.nights}
                              onChange={e => updateHotel(hotel.id, 'nights', Math.max(1, Number(e.target.value)))}
                              min={1}
                              max={30}
                              style={{ width: 50, padding: 6, border: '1px solid #ddd', borderRadius: 6, textAlign: 'center' }}
                            />
                          </div>
                          <span style={{ fontSize: 12, color: '#888' }}>
                            D{hotel.startNight || 1}-D{(hotel.startNight || 1) + hotel.nights - 1}
                          </span>
                          {hotels.length > 1 && (
                            <button
                              onClick={() => removeHotel(hotel.id)}
                              style={{ padding: '6px 10px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                            >
                              ✕ 刪除
                            </button>
                          )}
                        </div>

                        {/* 第二行：4 種固定房型分類，每種有 3 個子房型 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                          {ROOM_CATEGORIES.map(cat => {
                            const subRooms = hotel.rooms[cat.key]
                            const categoryHasRooms = subRooms.some(sr => sr.quantity > 0)
                            const categoryTotal = subRooms.reduce((sum, sr) => sum + (sr.quantity * sr.price), 0)
                            const isExpanded = isCategoryExpanded(hotel.id, cat.key, categoryHasRooms)

                            return (
                              <div
                                key={cat.key}
                                style={{
                                  background: categoryHasRooms ? '#faf8f5' : 'white',
                                  padding: isExpanded ? 12 : 8,
                                  borderRadius: 8,
                                  border: categoryHasRooms ? '1px solid #d4c5a9' : '1px solid #e8e8e8',
                                }}
                              >
                                {/* 房型分類標題 - 可點擊展開/收合 */}
                                <div
                                  onClick={() => toggleCategory(hotel.id, cat.key)}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    marginBottom: isExpanded ? 8 : 0,
                                    padding: '4px 0',
                                  }}
                                >
                                  <span style={{ fontSize: 13, color: categoryHasRooms ? '#5c4a2a' : '#999', fontWeight: categoryHasRooms ? 'bold' : 'normal' }}>
                                    <span style={{ display: 'inline-block', width: 16, fontSize: 10, color: '#999' }}>
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                    {cat.icon} {cat.label}
                                  </span>
                                  {categoryHasRooms && (
                                    <span style={{ fontSize: 12, color: '#8b7355' }}>
                                      小計：{fmt(categoryTotal)}/晚
                                    </span>
                                  )}
                                </div>

                                {/* 3 個子房型輸入欄位 - 可收合 */}
                                {isExpanded && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {subRooms.map((subRoom, subIdx) => (
                                    <div
                                      key={subIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: 8,
                                        background: subRoom.quantity > 0 ? '#fff' : '#fafafa',
                                        borderRadius: 4,
                                        border: subRoom.quantity > 0 ? '1px solid #b89b4d' : '1px solid #eee',
                                        opacity: subRoom.quantity > 0 ? 1 : 0.7,
                                        flexWrap: 'wrap'
                                      }}
                                    >
                                      {/* 子房型序號 */}
                                      <span style={{ fontSize: 11, color: '#999', minWidth: 20 }}>
                                        {subIdx + 1}.
                                      </span>

                                      {/* 飯店具體房型名稱 */}
                                      <input
                                        type="text"
                                        value={subRoom.name}
                                        onChange={e => updateRoom(hotel.id, cat.key, subIdx as SubRoomIndex, 'name', e.target.value)}
                                        placeholder="房型名稱"
                                        style={{ flex: 1, minWidth: 140, padding: 5, border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }}
                                      />

                                      {/* 數量 */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <input
                                          type="number"
                                          value={subRoom.quantity}
                                          onChange={e => updateRoom(hotel.id, cat.key, subIdx as SubRoomIndex, 'quantity', Math.max(0, Number(e.target.value)))}
                                          min={0}
                                          max={20}
                                          style={{ width: 40, padding: 5, border: '1px solid #ddd', borderRadius: 4, textAlign: 'center', fontSize: 12 }}
                                        />
                                        <span style={{ fontSize: 10, color: '#666' }}>間</span>
                                      </div>

                                      {/* 價格 */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <span style={{ fontSize: 10, color: '#666' }}>@</span>
                                        <input
                                          type="number"
                                          value={subRoom.price}
                                          onChange={e => updateRoom(hotel.id, cat.key, subIdx as SubRoomIndex, 'price', Math.max(0, Number(e.target.value)))}
                                          min={0}
                                          step={100}
                                          style={{ width: 60, padding: 5, border: '1px solid #ddd', borderRadius: 4, textAlign: 'center', fontSize: 12 }}
                                        />
                                        <span style={{ fontSize: 10, color: '#666' }}>/晚</span>
                                      </div>

                                      {/* 加床選項 */}
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 11 }}>
                                        <input
                                          type="checkbox"
                                          checked={subRoom.hasExtraBed}
                                          onChange={e => updateRoom(hotel.id, cat.key, subIdx as SubRoomIndex, 'hasExtraBed', e.target.checked)}
                                          style={{ width: 12, height: 12 }}
                                        />
                                        <span style={{ color: subRoom.hasExtraBed ? '#b89b4d' : '#999' }}>加床</span>
                                      </label>

                                      {/* 子房型小計（當有數量時顯示）*/}
                                      {subRoom.quantity > 0 && (
                                        <span style={{ fontSize: 11, color: '#5c4a2a', fontWeight: 'bold' }}>
                                          = {fmt(subRoom.quantity * subRoom.price)}
                                          {subRoom.hasExtraBed && <span style={{ color: '#b89b4d', marginLeft: 4 }}>+{subRoom.quantity}床</span>}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>}
                              </div>
                            )
                          })}
                        </div>

                        {/* 第三行：押金勾選 + 小計 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={hotel.hasDeposit}
                                onChange={e => updateHotel(hotel.id, 'hasDeposit', e.target.checked)}
                                style={{ width: 16, height: 16 }}
                              />
                              <span style={{ fontSize: 13, color: hotel.hasDeposit ? '#9a6b2a' : '#666' }}>
                                💳 押金
                              </span>
                            </label>
                            {hotel.hasDeposit && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  type="number"
                                  value={hotel.depositPerRoom}
                                  onChange={e => updateHotel(hotel.id, 'depositPerRoom', Math.max(0, Number(e.target.value)))}
                                  min={0}
                                  step={500}
                                  style={{ width: 70, padding: 4, border: '1px solid #b89b4d', borderRadius: 4, textAlign: 'center', fontSize: 12 }}
                                />
                                <span style={{ fontSize: 11, color: '#9a6b2a' }}>/間房</span>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: '#555' }}>
                            {hotelRoomCount} 間房 容納 {hotelCapacity} 人 ｜ <strong>{fmt(hotelTotal)} 泰銖</strong>（{hotel.nights}晚）
                          </div>
                        </div>

                        {/* 已選房型摘要 */}
                        {activeRooms.length > 0 && (
                          <div style={{ marginTop: 8, padding: 10, background: '#f9f8f6', borderRadius: 6, fontSize: 12 }}>
                            <div style={{ color: '#5c4a2a', fontWeight: 'bold', marginBottom: 4 }}>📋 房型摘要：</div>
                            {activeRooms.map(cat => {
                              const subRooms = hotel.rooms[cat.key].filter(sr => sr.quantity > 0)
                              return (
                                <div key={cat.key}>
                                  <div style={{ color: '#5c4a2a', fontWeight: 'bold', fontSize: 11, marginTop: 4 }}>
                                    {cat.icon} {cat.label}
                                  </div>
                                  {subRooms.map((sr, idx) => (
                                    <div key={idx} style={{ color: '#555', paddingLeft: 12 }}>
                                      • {sr.name || `子房型 ${idx + 1}`} × {sr.quantity}間 @{fmt(sr.price)}
                                      {sr.hasExtraBed && <span style={{ color: '#b89b4d' }}>（含加床）</span>}
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* 押金明細 */}
                        {hotel.hasDeposit && (
                          <div style={{ marginTop: 8, padding: 10, background: '#fff3e0', borderRadius: 6, fontSize: 12 }}>
                            <div style={{ color: '#9a6b2a', fontWeight: 'bold', marginBottom: 4 }}>
                              💳 {hotel.name} 押金：{fmt(hotel.depositPerRoom)} × {hotelRoomCount} 間 = <strong>{fmt(calculation.getHotelDeposit(hotel))} 泰銖</strong>
                            </div>
                            <div style={{ color: '#666', fontSize: 11 }}>
                              Check-in 時統一收取，退房由導遊退還客人
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 押金總提示 */}
                {calculation.hotelsWithDeposit.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fff8e1', border: '2px solid #b89b4d', borderRadius: 8 }}>
                    <div style={{ fontWeight: 'bold', color: '#9a6b2a', marginBottom: 8, fontSize: 15 }}>
                      💳 押金總計：{fmt(calculation.totalDeposit)} 泰銖
                    </div>
                    <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                      {calculation.hotelsWithDeposit.map(h => (
                        <div key={h.id} style={{ marginBottom: 2 }}>
                          • {h.name}：{fmt(h.depositPerRoom)} × {calculation.getHotelRoomCount(h)} 間 = {fmt(calculation.getHotelDeposit(h))} 泰銖
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', padding: 8, borderRadius: 6, fontSize: 12 }}>
                      <div style={{ color: '#5c4a2a', fontWeight: 'bold', marginBottom: 4 }}>📋 跟客人說明：</div>
                      <div style={{ color: '#555' }}>
                        1. 押金統一收取 <strong>{fmt(calculation.totalDeposit)} 泰銖</strong>，退房後由導遊退還<br />
                        2. <span style={{ color: '#d32f2f' }}>建議付現金</span>（信用卡退款需 7~14 天處理時間）
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    onClick={addHotel}
                    style={{ padding: '8px 16px', background: '#b89b4d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                  >
                    + 新增飯店
                  </button>
                  <p style={{ ...noteStyle, margin: 0 }}>
                    住宿總計：<strong>{fmt(calculation.accommodationCost)} 泰銖</strong>（{totalNights} 晚）
                  </p>
                </div>

                {tripNights !== totalNights && (
                  <div style={{ ...warningStyle, marginTop: 12 }}>
                    ⚠️ 行程 {tripDays} 天（{tripNights} 晚），但住宿只有 {totalNights} 晚。請調整飯店晚數！
                  </div>
                )}
              </>
            )}
          </Section>

          {/* 餐費 */}
          <Section title={`🍜 餐費（${calculation.mealDays}天午晚餐）`} style={!includeMeals ? { opacity: 0.5 } : {}}>
            {!includeMeals ? (
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, textAlign: 'center', color: '#666' }}>
                客人自理餐費
              </div>
            ) : (
              <>
                <Row>
                  <label style={{ minWidth: 100 }}>餐費等級</label>
                  <select value={mealLevel} onChange={e => setMealLevel(Number(e.target.value))} style={{ ...inputStyle, minWidth: 150 }}>
                    <option value={600}>簡餐 - 600/人/天</option>
                    <option value={900}>平價 - 900/人/天</option>
                    <option value={1200}>精選 - 1,200/人/天</option>
                    <option value={1500}>高級 - 1,500/人/天</option>
                  </select>
                </Row>
                <p style={noteStyle}>餐費小計：{fmt(calculation.mealCost)} 泰銖</p>
              </>
            )}
          </Section>

          {/* 車導 */}
          <Section title="🚗 車導費">
            <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
              <strong>🚐 車輛規則</strong><br />
              • 第一台：導遊坐副駕，後座最多 9 人<br />
              • 後續車輛：無導遊，每台可坐 10 人<br />
              • 1~9人→1台｜10~19人→2台｜20~29人→3台...
            </div>
            <div style={{ background: '#f8f6f2', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#5c4a2a', fontSize: 15 }}>
                🚗 {calculation.carCount} 台車：<span style={{ fontFamily: 'monospace' }}>{calculation.carDistribution}</span>
                {calculation.needLuggageCar ? ' + 🧳行李車' : ''}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#555' }}>
                舒適配車（單車最多 {calculation.maxPerCar} 人）
              </p>
            </div>
            {calculation.luggageStatus === 'ok' ? (
              <div style={{ background: '#f9f8f6', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                ✅ 每車 ≤7 人，行李空間 OK，不需額外行李車
              </div>
            ) : (
              <div style={{ background: '#ffebee', padding: 10, borderRadius: 6, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={luggageCar} onChange={e => setLuggageCar(e.target.checked)} />
                  <label>🧳 行李車（接+送 = 1,200 泰銖）</label>
                </div>
                <div style={{ fontSize: 13, color: '#c62828', background: '#fff', padding: 8, borderRadius: 4 }}>
                  ⚠️ 單車 {calculation.maxPerCar} 人，<strong>行李空間很緊</strong><br />
                  📋 請跟客人確認：行李件數 & 尺寸
                </div>
              </div>
            )}
            <div style={{ background: '#f8f6f2', border: '1px solid #e8e4dc', borderRadius: 8, padding: 12, fontSize: 13 }}>
              <strong>⏱️ 超時費規則</strong><br />
              • 清邁行程：10 小時/天<br />
              • 清萊行程：12 小時/天<br />
              • 超時費：200 泰銖/小時
            </div>

            {/* 兒童座椅 */}
            <div style={{ marginTop: 12, background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 8, padding: 12 }}>
              <strong style={{ color: '#9a6b2a' }}>🪑 兒童安全座椅</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
                <div style={{ background: 'white', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>👶 0-2 歲嬰兒座椅</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      value={babySeatCount}
                      onChange={e => setBabySeatCount(Math.max(0, Number(e.target.value)))}
                      min={0}
                      max={10}
                      style={{ width: 50, padding: 6, border: '1px solid #ddd', borderRadius: 4, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 13, color: '#666' }}>張</span>
                    <span style={{ fontSize: 12, color: '#999' }}>@500/天</span>
                  </div>
                </div>
                <div style={{ background: 'white', padding: 10, borderRadius: 6, border: '1px solid #ddd' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>🧒 3-5 歲兒童座椅</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      value={childSeatCount}
                      onChange={e => setChildSeatCount(Math.max(0, Number(e.target.value)))}
                      min={0}
                      max={10}
                      style={{ width: 50, padding: 6, border: '1px solid #ddd', borderRadius: 4, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 13, color: '#666' }}>張</span>
                    <span style={{ fontSize: 12, color: '#999' }}>@500/天</span>
                  </div>
                </div>
              </div>
              {(babySeatCount > 0 || childSeatCount > 0) && (
                <div style={{ marginTop: 10, padding: 8, background: '#f9f8f6', borderRadius: 4, fontSize: 12 }}>
                  🪑 座椅費用：({babySeatCount} + {childSeatCount}) × 500 × {calculation.guideDays}天 = <strong>{fmt(calculation.childSeatCost)} 泰銖</strong>
                </div>
              )}
            </div>

            {/* 每日車費明細 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>📅 每日車費（{carFees.length} 天）</strong>
                <button
                  onClick={addCarFeeDay}
                  style={{ padding: '4px 12px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                >
                  ➕ 新增天數
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {carFees.map((cf, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 60px 1fr 80px 80px 30px',
                      gap: 8,
                      alignItems: 'center',
                      padding: 8,
                      background: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>{cf.day}</span>
                    <input
                      type="text"
                      value={cf.date}
                      onChange={e => updateCarFee(index, 'date', e.target.value)}
                      placeholder="2/12"
                      style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={cf.name}
                      onChange={e => updateCarFee(index, 'name', e.target.value)}
                      placeholder="行程名稱"
                      style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }}
                    />
                    <input
                      type="number"
                      value={cf.price}
                      onChange={e => updateCarFee(index, 'price', Number(e.target.value))}
                      placeholder="報價"
                      style={{ padding: 4, border: '1px solid #ddd', borderRadius: 4, fontSize: 12, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 11, color: '#666' }}>
                      ×{calculation.carCount}台
                    </span>
                    <button
                      onClick={() => removeCarFeeDay(index)}
                      disabled={carFees.length <= 1}
                      style={{
                        padding: 4,
                        background: carFees.length <= 1 ? '#eee' : '#ffebee',
                        color: carFees.length <= 1 ? '#999' : '#c62828',
                        border: 'none',
                        borderRadius: 4,
                        cursor: carFees.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
                💡 解析行程後會自動產生每日車費，你可以手動調整報價
              </p>
            </div>

            {/* 車導總計 */}
            <div style={{ marginTop: 12, padding: 12, background: '#f9f8f6', borderRadius: 8 }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#5c4a2a', fontSize: 14 }}>
                🚗 車導總計：{fmt(calculation.transportPrice)} 泰銖
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#555' }}>
                車費 {fmt(calculation.carPriceTotal)} + 導遊 {fmt(calculation.guidePrice)}
                {calculation.luggageCost > 0 ? ` + 行李車 ${fmt(calculation.luggageCost)}` : ''}
                {calculation.childSeatCost > 0 ? ` + 座椅 ${fmt(calculation.childSeatCost)}` : ''}
              </p>
            </div>
          </Section>


          {/* 門票 */}
          <Section title={`🎫 門票活動${!useDefaultTickets ? '（解析自行程）' : ''}${!includeTickets ? '（客人自理）' : ''}`} style={!includeTickets ? { opacity: 0.5 } : {}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <p style={{ ...noteStyle, margin: 0 }}>★ = 退款對分</p>
                {/* 切換按鈕：解析門票 ↔ 預設門票 */}
                {!useDefaultTickets && (
                  <button
                    onClick={() => {
                      setTickets(DEFAULT_TICKETS.map(t => ({ ...t, checked: false })))
                      setUseDefaultTickets(true)
                    }}
                    style={{ padding: '4px 8px', background: '#607d8b', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >
                    🔄 回預設門票
                  </button>
                )}
                {useDefaultTickets && savedParsedTickets.length > 0 && (
                  <button
                    onClick={() => {
                      setTickets(savedParsedTickets)
                      setUseDefaultTickets(false)
                    }}
                    style={{ padding: '4px 8px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >
                    📋 回解析門票
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={selectAllActivities}
                  disabled={allActivitiesSelected}
                  style={{ padding: '6px 12px', background: allActivitiesSelected ? '#ccc' : '#b89b4d', color: 'white', border: 'none', borderRadius: 4, cursor: allActivitiesSelected ? 'not-allowed' : 'pointer', fontSize: 13 }}
                >
                  ✅ 全選
                </button>
                <button
                  onClick={deselectAllActivities}
                  disabled={noActivitiesSelected}
                  style={{ padding: '6px 12px', background: noActivitiesSelected ? '#ccc' : '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: noActivitiesSelected ? 'not-allowed' : 'pointer', fontSize: 13 }}
                >
                  ❌ 全不選
                </button>
              </div>
            </div>
            {noActivitiesSelected && (
              <div style={{ background: '#fff3e0', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                💡 門票/活動由客人現場付給導遊
              </div>
            )}
            {/* 按日期分組顯示（當有解析結果時） */}
            {!useDefaultTickets && tickets.some(t => t.dayNumber) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 按 dayNumber 分組 */}
                {/* 取得所有天數（包含泰服天數） */}
                {Array.from(new Set([...tickets.map(t => t.dayNumber), thaiDressDay].filter(Boolean))).sort((a, b) => (a || 0) - (b || 0)).map(dayNum => {
                  const dayTickets = tickets.filter(t => t.dayNumber === dayNum)
                  const isThaiDressDay = thaiDressDay === dayNum
                  // 如果這天沒有門票也沒有泰服，跳過
                  if (dayTickets.length === 0 && !isThaiDressDay) return null
                  return (
                    <div key={dayNum || 'other'} style={{ background: '#f9f8f6', padding: 12, borderRadius: 8, border: '1px solid #e0e0e0' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#5c4a2a', fontSize: 13 }}>
                        📅 Day {dayNum}
                        {carFees[dayNum ? dayNum - 1 : 0]?.date && <span style={{ fontWeight: 'normal', marginLeft: 8, color: '#666' }}>({carFees[dayNum ? dayNum - 1 : 0]?.date})</span>}
                        {carFees[dayNum ? dayNum - 1 : 0]?.name && <span style={{ fontWeight: 'normal', marginLeft: 8, color: '#999' }}>- {carFees[dayNum ? dayNum - 1 : 0]?.name}</span>}
                      </div>
                      {dayTickets.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
                          {dayTickets.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: t.checked ? '#fff' : '#f0f0f0', borderRadius: 4, opacity: t.checked ? 1 : 0.6 }}>
                              <input type="checkbox" checked={t.checked} onChange={() => toggleTicket(t.id)} />
                              <label style={{ flex: 1, fontSize: 13 }}>{t.name}{t.split && t.rebate > 0 ? ' ★' : ''}</label>
                              <span style={{ color: '#666', fontSize: 12 }}>
                                {t.price > 0 ? `${fmt(t.price - t.rebate)}` : '免費'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 泰服體驗（在偵測到的天數內顯示） */}
                      {isThaiDressDay && (
                        <div style={{ marginTop: 10, padding: 10, background: '#fff9e6', borderRadius: 6, border: '1px solid #f0d000' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13 }}>👘</span>
                            <input type="checkbox" checked={thaiDressCloth} onChange={e => setThaiDressCloth(e.target.checked)} />
                            <label style={{ fontSize: 13 }}>泰服衣服</label>
                            <span style={{ ...noteStyle, fontSize: 11 }}>500/人</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, opacity: 0 }}>👘</span>
                            <input type="checkbox" checked={thaiDressPhoto} onChange={e => setThaiDressPhoto(e.target.checked)} />
                            <label style={{ fontSize: 13 }}>攝影師</label>
                            <span style={{ ...noteStyle, fontSize: 11 }}>2,500/位</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, opacity: 0 }}>👘</span>
                            <label style={{ fontSize: 13 }}>化妝</label>
                            <input type="number" value={makeupCount} onChange={e => setMakeupCount(Number(e.target.value))} min={0} max={50} style={{ ...inputStyle, width: 50, padding: '2px 4px' }} />
                            <span style={{ ...noteStyle, fontSize: 11 }}>人 × 1,000</span>
                          </div>
                          {calculation.thaiDressPrice > 0 && (
                            <div style={{ marginTop: 6, fontSize: 12, color: '#666', textAlign: 'right' }}>
                              泰服小計：{fmt(calculation.thaiDressPrice)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* 預設門票列表 */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
                {tickets.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: t.checked ? '#f9f8f6' : '#f5f5f5', borderRadius: 6, opacity: t.checked ? 1 : 0.7 }}>
                    <input type="checkbox" checked={t.checked} onChange={() => toggleTicket(t.id)} />
                    <label style={{ flex: 1 }}>{t.name}{t.split && t.rebate > 0 ? ' ★' : ''}</label>
                    <span style={{ color: '#666', fontSize: 13 }}>
                      {t.price > 0 ? `成本 ${fmt(t.price - t.rebate)}` : '免費'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ ...noteStyle, marginTop: 12 }}>
              已選 {calculation.selectedTickets.length}/{tickets.length} 項｜門票成本/人：{fmt(calculation.selectedTickets.reduce((sum, t) => sum + (t.price - t.rebate), 0))} 泰銖
            </p>

            {/* 泰服體驗（僅在預設門票模式時顯示，有日期分組時在 Day 1 內顯示） */}
            {(useDefaultTickets || !tickets.some(t => t.dayNumber)) && (
              <div style={{ marginTop: 16, padding: 12, background: '#fff9e6', borderRadius: 8, border: '1px solid #f0d000' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#5c4a2a', fontSize: 13 }}>
                  👘 泰服體驗
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={thaiDressCloth} onChange={e => setThaiDressCloth(e.target.checked)} />
                  <label>泰服衣服</label>
                  <span style={noteStyle}>售價 500 / 成本 200 /人（全員）</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={thaiDressPhoto} onChange={e => setThaiDressPhoto(e.target.checked)} />
                  <label>攝影師</label>
                  <span style={noteStyle}>售價 2,500 / 成本 500 /位（1位可拍10人）</span>
                </div>
                <Row style={{ marginTop: 8 }}>
                  <label>化妝人數</label>
                  <input type="number" value={makeupCount} onChange={e => setMakeupCount(Number(e.target.value))} min={0} max={50} style={inputStyle} />
                  <span style={noteStyle}>售價 1,000 / 成本 500 /人</span>
                </Row>
                <p style={{ ...noteStyle, marginTop: 8 }}>泰服小計：{fmt(calculation.thaiDressPrice)} 泰銖</p>
              </div>
            )}
          </Section>

          {/* Result - 移除 sticky，改為一般區塊 */}
          <div style={{ background: '#5c4a2a', color: 'white', textAlign: 'center', padding: 24, borderRadius: 12, marginTop: 16 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>每人報價（台幣）</div>
            <div style={{ fontSize: 36, fontWeight: 'bold' }}>NT$ {fmt(calculation.perPersonTWD)}</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 12 }}>
              總計 {fmt(calculation.totalPrice)} 泰銖 ÷ {people}人 ÷ {exchangeRate}
            </p>
            {calculation.totalDeposit > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: 13, color: '#ffcc00' }}>
                  💳 另收押金：{fmt(calculation.totalDeposit)} 泰銖（退房退還，建議現金）
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Internal Tab */}
      {activeTab === 'internal' && (
        <Section title="📊 成本/售價/利潤明細（內部用）">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>項目</th>
                <th style={thStyle}>成本</th>
                <th style={thStyle}>售價</th>
                <th style={thStyle}>利潤</th>
              </tr>
            </thead>
            <tbody>
              <SectionRow title={`🏨 住宿 (${totalNights}晚)`} />
              {hotels.map(h => {
                const hotelCost = calculation.getHotelCost(h)
                // 遍歷每個房型分類，計算該分類下所有子房型的總數量
                const roomInfo = ROOM_CATEGORIES
                  .filter(cat => h.rooms[cat.key].some(sr => sr.quantity > 0))
                  .map(cat => {
                    const totalQty = h.rooms[cat.key].reduce((sum, sr) => sum + sr.quantity, 0)
                    return `${cat.label.replace(/（.*）/, '')}x${totalQty}`
                  })
                  .join('+')
                return (
                  <DataRow key={h.id} name={`${h.name} (${h.nights}晚) ${roomInfo}${h.hasDeposit ? ' 💳' : ''}`} cost={hotelCost} price={hotelCost} profit={0} className="day-row" />
                )
              })}
              <SubtotalRow name="住宿小計" cost={calculation.accommodationCost} price={calculation.accommodationCost} profit={0} />
              {calculation.hotelsWithDeposit.length > 0 && (
                <InfoRow text={`💳 需押金飯店：${calculation.hotelsWithDeposit.map(h => h.name).join('、')}`} />
              )}

              <SectionRow title={`🍜 餐費 (${calculation.mealDays}天午晚餐)`} />
              <DataRow name={`餐費 (${mealLevel}/人/天)`} cost={calculation.mealCost} price={calculation.mealCost} profit={0} />

              <SectionRow title={`🚗 車費明細 (${calculation.carCount}台)`} />
              {calculation.dailyCarFees.map((d: any, i: number) => (
                <DataRow key={i} name={`${d.day} ${d.name}`} cost={d.cost * calculation.carCount} price={d.price * calculation.carCount} profit={(d.price - d.cost) * calculation.carCount} className="day-row" />
              ))}
              <SubtotalRow name="車費小計" cost={calculation.carCostTotal} price={calculation.carPriceTotal} profit={calculation.carPriceTotal - calculation.carCostTotal} />

              <SectionRow title="👤 導遊" />
              <DataRow name={`導遊 (${calculation.guideDays}天)`} cost={calculation.guideCost} price={calculation.guidePrice} profit={calculation.guidePrice - calculation.guideCost} />
              {calculation.needLuggageCar && <DataRow name="行李車 (2趟)" cost={0} price={calculation.luggageCost} profit={calculation.luggageCost} />}
              {calculation.childSeatCost > 0 && <DataRow name={`兒童座椅 (${babySeatCount + childSeatCount}張 × ${calculation.guideDays}天)`} cost={0} price={calculation.childSeatCost} profit={calculation.childSeatCost} />}
              <SubtotalRow name="車導總計" cost={calculation.transportCost} price={calculation.transportPrice} profit={calculation.transportProfit} />
              <InfoRow text="※ 接送機已含在 D1/D6 車費" />

              {/* 超時費規則 */}
              <SectionRow title="⏱️ 超時費規則（未計入報價）" />
              <InfoRow text="清邁行程：10小時/天，超時 200 泰銖/小時" />
              <InfoRow text="清萊行程：12小時/天，超時 200 泰銖/小時" />
            </tbody>
          </table>

          {/* 門票活動 - 統一格式 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>項目</th>
                <th style={thStyle}>成本</th>
                <th style={thStyle}>售價</th>
                <th style={thStyle}>利潤</th>
              </tr>
            </thead>
            <tbody>
              <SectionRow title={`🎫 門票活動（${people}人）`} />
              {calculation.selectedTickets.map((t: any, i: number) => (
                <DataRow key={i} name={`${t.name}${t.split && t.rebate > 0 ? ' ★' : ''}`} cost={(t.price - t.rebate) * people} price={t.price * people} profit={t.rebate * people} className="day-row" />
              ))}
              <SubtotalRow name="門票總計" cost={calculation.ticketCost} price={calculation.ticketPrice} profit={calculation.ticketYourProfit + calculation.ticketPartnerProfit} />
              <tr style={{ background: '#c8e6c9' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>　→ 你的利潤（退款½）</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, color: '#5c4a2a', fontWeight: 'bold' }}>{fmt(calculation.ticketYourProfit)}</td>
              </tr>
              <tr style={{ background: '#fff3cd' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>　→ 郭姐利潤（退款½）</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, color: '#5c4a2a', fontWeight: 'bold' }}>{fmt(calculation.ticketPartnerProfit)}</td>
              </tr>
              <InfoRow text="★ 標記項目有退款（佣金）需對分｜無標記為原價或免費" />
            </tbody>
          </table>

          {/* D1 泰服體驗 */}
          {calculation.thaiDressPrice > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
              <tbody>
                <SectionRow title="👘 D1 泰服體驗（利潤對分）" />
                {thaiDressCloth && (
                  <DataRow name={`泰服衣服 (${people}人)`} cost={(config.thaiDress.cloth.price - config.thaiDress.cloth.rebate) * people} price={config.thaiDress.cloth.price * people} profit={config.thaiDress.cloth.rebate * people} className="day-row" />
                )}
                {makeupCount > 0 && (
                  <DataRow name={`化妝 (${makeupCount}人)`} cost={(config.thaiDress.makeup.price - config.thaiDress.makeup.rebate) * makeupCount} price={config.thaiDress.makeup.price * makeupCount} profit={config.thaiDress.makeup.rebate * makeupCount} className="day-row" />
                )}
                {thaiDressPhoto && (() => {
                  const photographerCount = people <= 10 ? 1 : 2
                  return <DataRow name={`攝影師 (${photographerCount}位)`} cost={(config.thaiDress.photo.price - config.thaiDress.photo.rebate) * photographerCount} price={config.thaiDress.photo.price * photographerCount} profit={config.thaiDress.photo.rebate * photographerCount} className="day-row" />
                })()}
                <SubtotalRow name="泰服小計" cost={calculation.thaiDressCost} price={calculation.thaiDressPrice} profit={calculation.thaiDressYourProfit + calculation.thaiDressPartnerProfit} />
              </tbody>
            </table>
          )}

          {/* 保險 + 總計 + 利潤分配 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 16 }}>
            <tbody>
              <SectionRow title="🛡️ 保險" />
              <DataRow name={`旅遊保險 (${people}人)`} cost={calculation.insuranceCost} price={calculation.insuranceCost} profit={0} />

              <SectionRow title="💰 總計" />
              <SubtotalRow name="總計" cost={calculation.totalCost} price={calculation.totalPrice} profit={calculation.yourTotalProfit + calculation.partnerTotalProfit} />

              <SectionRow title="📈 利潤分配" />
              <tr style={{ background: '#c8e6c9' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>✅ 你的利潤（車導差價 + 門票½）</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, color: '#5c4a2a', fontWeight: 'bold' }}>{fmt(calculation.yourTotalProfit)}</td>
              </tr>
              <tr style={{ background: '#fff3cd' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>🤝 郭姐利潤（門票½）</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, color: '#5c4a2a', fontWeight: 'bold' }}>{fmt(calculation.partnerTotalProfit)}</td>
              </tr>
              <tr style={{ background: '#fff3cd' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>💵 付給郭姐（成本）</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(calculation.transportCost + calculation.ticketCost + calculation.mealCost + calculation.thaiDressCost)}</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
              </tr>

              <SectionRow title="🏷️ 每人報價" />
              <tr style={{ background: '#f9f8f6', fontWeight: 'bold' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>每人報價</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}>{fmt(Math.round(calculation.perPersonTHB))} 泰銖</td>
                <td style={{ ...tdStyle, color: '#5c4a2a', fontWeight: 'bold' }}>NT$ {fmt(calculation.perPersonTWD)}</td>
              </tr>

              {calculation.totalDeposit > 0 && (
                <>
                  <SectionRow title="💳 飯店押金（另收，退房退還）" />
                  {calculation.hotelsWithDeposit.map(h => (
                    <tr key={h.id} style={{ background: '#fff8e1' }}>
                      <td style={{ ...tdStyle, textAlign: 'left' }}>{h.name}</td>
                      <td style={tdStyle}>{calculation.getHotelRoomCount(h)} 間 × {fmt(h.depositPerRoom)}</td>
                      <td style={tdStyle}></td>
                      <td style={{ ...tdStyle, color: '#9a6b2a', fontWeight: 'bold' }}>{fmt(calculation.getHotelDeposit(h))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#b89b4d', color: 'white', fontWeight: 'bold' }}>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>押金總計（建議現金）</td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}></td>
                    <td style={tdStyle}>{fmt(calculation.totalDeposit)} 泰銖</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </Section>
      )}

      {/* External Tab */}
      {activeTab === 'external' && (
        <div style={{ background: 'white', border: '2px solid #5c4a2a', borderRadius: 12, padding: 24, maxWidth: 600, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #a08060 0%, #8b7355 100%)', color: 'white', borderRadius: '12px 12px 0 0', margin: '-24px -24px 20px -24px', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚐</div>
            <h2 style={{ margin: 0, fontSize: 24 }}>清微旅行 Chiangway Travel</h2>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>台灣爸爸 × 泰國媽媽｜清邁在地親子包車</p>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 'bold' }}>清邁 {tripDays}天{tripNights}夜 親子包車行程</div>
          </div>

          {/* Itinerary */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#5c4a2a', fontSize: 16, borderBottom: '2px solid #5c4a2a', paddingBottom: 8 }}>📅 行程概覽</h3>
            {(isParseConfirmed && parsedItinerary.length > 0 ? parsedItinerary : ITINERARY).map((day, i) => (
              <div key={i} style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 6 }}>{day.day}｜{day.title}</div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{day.items.join('　')}</div>
                {day.hotel && <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>🏨 {day.hotel}</div>}
              </div>
            ))}
          </div>

          {/* Price Summary */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#5c4a2a', fontSize: 16, borderBottom: '2px solid #5c4a2a', paddingBottom: 8 }}>💰 費用明細</h3>

            <div style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
              👥 <strong>{people} 人</strong>｜🗓️ {tripDays}天{tripNights}夜
            </div>

            {/* Detailed Breakdown */}
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 16 }}>

              {/* 住宿明細 */}
              {includeAccommodation && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #5c4a2a', marginBottom: 8 }}>
                    <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>🏨 住宿（{totalNights}晚）</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(calculation.accommodationCost)} 泰銖</span>
                  </div>
                  {hotels.map(h => (
                    <div key={h.id} style={{ paddingLeft: 16, fontSize: 12, color: '#555', marginBottom: 4 }}>
                      • {h.name}（{h.nights}晚）
                    </div>
                  ))}
                </>
              )}

              {/* 餐費明細 */}
              {includeMeals && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #5c4a2a', marginBottom: 8, marginTop: includeAccommodation ? 12 : 0 }}>
                    <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>🍜 餐費（{calculation.mealDays}天午晚餐）</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(calculation.mealCost)} 泰銖</span>
                  </div>
                  <div style={{ paddingLeft: 16, fontSize: 12, color: '#555' }}>
                    • {mealLevel === 600 ? '簡餐' : mealLevel === 900 ? '平價' : mealLevel === 1200 ? '精選' : '高級'}餐廳 {fmt(mealLevel)}/人/天 × {people}人 × {calculation.mealDays}天
                  </div>
                </>
              )}

              {/* 車導明細 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #5c4a2a', marginBottom: 8, marginTop: 12 }}>
                <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>🚗 包車 + 導遊（{calculation.carCount}台車）</span>
                <span style={{ fontWeight: 'bold' }}>{fmt(calculation.transportPrice)} 泰銖</span>
              </div>
              <div style={{ paddingLeft: 16, fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                • 包車 6 天 × {calculation.carCount}台<br />
                • 中文導遊 {calculation.guideDays} 天
                {calculation.needLuggageCar && <><br />• 行李車（接機＋送機）</>}
                {calculation.childSeatCost > 0 && <><br />• 兒童座椅 {babySeatCount + childSeatCount}張 × {calculation.guideDays}天</>}
              </div>

              {/* 門票明細 */}
              {includeTickets && calculation.selectedTickets.length > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #5c4a2a', marginBottom: 8, marginTop: 12 }}>
                    <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>🎫 門票活動（{calculation.selectedTickets.length}項）</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(calculation.ticketPrice)} 泰銖</span>
                  </div>
                  <div style={{ paddingLeft: 16, fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                    {calculation.selectedTickets.map((t: any, idx: number) => (
                      <div key={idx}>• {t.name.replace(/^D\d /, '')}{t.price > 0 ? ` ${fmt(t.price)}/人` : '（免費）'}</div>
                    ))}
                  </div>
                </>
              )}

              {/* 泰服明細 */}
              {calculation.thaiDressPrice > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #5c4a2a', marginBottom: 8, marginTop: 12 }}>
                    <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>👘 泰服體驗</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(calculation.thaiDressPrice)} 泰銖</span>
                  </div>
                  <div style={{ paddingLeft: 16, fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                    {thaiDressCloth && <>• 泰服衣服 500/人 × {people}人<br /></>}
                    {makeupCount > 0 && <>• 專業化妝 1,000/人 × {makeupCount}人<br /></>}
                    {thaiDressPhoto && <>• 攝影師 2,500/位 × {people <= 10 ? 1 : 2}位</>}
                  </div>
                </>
              )}

              {/* 保險（只有包套行程才顯示） */}
              {calculation.insuranceCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 12, borderBottom: '1px dashed #ddd' }}>
                  <span>🛡️ 旅遊保險（{fmt(config.insurancePerPerson)}/人 × {people}人）</span>
                  <span style={{ fontWeight: 'bold' }}>{fmt(calculation.insuranceCost)} 泰銖</span>
                </div>
              )}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px 0', marginTop: 8, borderTop: '2px solid #5c4a2a' }}>
                <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>總計</span>
                <span style={{ fontWeight: 'bold', color: '#5c4a2a' }}>{fmt(calculation.totalPrice)} 泰銖</span>
              </div>
            </div>
          </div>

          {/* Per Person Price */}
          <div style={{ background: 'linear-gradient(135deg, #a08060 0%, #8b7355 100%)', color: 'white', padding: 20, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>每人費用</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', margin: '8px 0' }}>NT$ {fmt(calculation.perPersonTWD)}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>約 {fmt(Math.round(calculation.perPersonTHB))} 泰銖 ÷ {people}人</div>
          </div>

          {/* Includes/Excludes */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f9f8f6', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 8 }}>✅ 費用包含</div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                {includeAccommodation && <>• {totalNights}晚住宿<br /></>}
                {includeMeals && <>• {calculation.mealDays}天午晚餐<br /></>}
                • 全程包車（{calculation.carCount}台）<br />
                {includeGuide && <>• 專業中文導遊<br /></>}
                {includeTickets && calculation.selectedTickets.length > 0 && <>• {calculation.selectedTickets.length}項門票活動<br /></>}
                {includeTickets && calculation.thaiDressPrice > 0 && <>• 泰服體驗<br /></>}
                {calculation.insuranceCost > 0 && <>• 旅遊保險</>}
              </div>
            </div>
            <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', color: '#9a6b2a', marginBottom: 8 }}>❌ 費用不含</div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                • 來回機票<br />
                {!includeAccommodation && <>• 住宿<br /></>}
                {!includeMeals && <>• 餐費<br /></>}
                {calculation.selectedTickets.length === 0 && <>• 門票（現場付費）<br /></>}
                {!includeGuide && <>• 導遊<br /></>}
                • 個人消費<br />
                                • 小費
              </div>
            </div>
          </div>

          {/* Payment Phases */}
          {(() => {
            // 計算各項金額
            const mealsAmount = calculation.mealCost
            const actualTicketsAmount = calculation.ticketPrice + calculation.thaiDressPrice  // 真正的門票/泰服（不含保險）
            const insuranceAmount = calculation.insuranceCost
            const mealsTicketsAmount = mealsAmount + actualTicketsAmount + insuranceAmount  // 總額
            const carAmount = calculation.transportPrice

            // 判斷勾選狀態（標籤用）
            const hasMeals = includeMeals && mealsAmount > 0
            const hasActualTickets = actualTicketsAmount > 0  // 有門票或泰服
            const hasInsurance = insuranceAmount > 0
            const hasMealsOrTicketsOrInsurance = hasMeals || hasActualTickets || hasInsurance
            const isCarOnly = !includeAccommodation && !hasMealsOrTicketsOrInsurance

            // 動態標籤（只看餐費和門票，保險不影響標籤）
            const getMealsTicketsLabel = () => {
              if (hasMeals && hasActualTickets) return '餐費＋門票'
              if (hasMeals && hasInsurance && !hasActualTickets) return '餐費'  // 有餐費+保險但沒門票
              if (hasMeals) return '餐費'
              if (hasActualTickets) return '門票'
              if (hasInsurance) return '保險'  // 只有保險（邊緣情況）
              return ''
            }

            const getMealsTicketsItems = () => {
              const items = []
              if (hasMeals) items.push('餐費')
              if (hasActualTickets) items.push('門票活動、泰服')
              if (hasInsurance) items.push('保險')
              return items.join('、')
            }

            return (
              <div style={{ marginTop: 20, background: '#f8f6f2', border: '1px solid #e8e4dc', borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 12, fontSize: 14 }}>💳 付款方式與時程</div>

                {isCarOnly ? (
                  <>
                    {/* 純包車：訂金制 (2階段) */}
                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第一階段｜預約訂金 30%</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 確認行程後</div>
                      <div style={{ fontSize: 12, color: '#555' }}>• 確認行程細節後支付訂金，即完成預約</div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(Math.round(carAmount * 0.3))} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(carAmount * 0.3 / exchangeRate))}</span>
                      </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第二階段｜尾款 70%（含超時結算）</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 送機前一天</div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        • 包車費用{includeGuide ? '、導遊費用' : ''}{calculation.needLuggageCar ? '、行李車' : ''}{calculation.childSeatCost > 0 ? '、兒童座椅' : ''}<br />
                        • 統一結算超時費（若有）
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(Math.round(carAmount * 0.7))} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(carAmount * 0.7 / exchangeRate))}</span>
                      </div>
                    </div>
                  </>
                ) : includeAccommodation ? (
                  <>
                    {/* 有住宿：住宿 → 餐費/門票 → 車導全額 */}
                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第一階段｜住宿全額</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 出發前 1.5～2 個月</div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        • 討論好飯店細節（星級、房型、預算）後統一報價<br />
                        • 收到款項後下訂，會請飯店提供每晚/每房的正式 PDF 單據<br />
                        <span style={{ color: '#888', fontSize: 11 }}>（入境或 TDAC 如被詢問，可出示飯店訂房資料）</span>
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(calculation.accommodationCost)} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(calculation.accommodationCost / exchangeRate))}</span>
                      </div>
                    </div>

                    {hasMealsOrTicketsOrInsurance && (
                      <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                        <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第二階段｜{getMealsTicketsLabel()}</div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 出發前 1 個月</div>
                        <div style={{ fontSize: 12, color: '#555' }}>• {getMealsTicketsItems()}</div>
                        <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                          💰 {fmt(mealsTicketsAmount)} 泰銖
                          <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(mealsTicketsAmount / exchangeRate))}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 {hasMealsOrTicketsOrInsurance ? '第三' : '第二'}階段｜車{includeGuide ? '導' : '輛'}費（含超時結算）</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 送機前一天</div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        • 包車費用{includeGuide ? '、導遊費用' : ''}{calculation.needLuggageCar ? '、行李車' : ''}{calculation.childSeatCost > 0 ? '、兒童座椅' : ''}<br />
                        • 統一結算超時費（若有）
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(carAmount)} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(carAmount / exchangeRate))}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 無住宿但有餐費/門票：餐費/門票全額 → 車30%訂金 → 車70%尾款 */}
                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第一階段｜{getMealsTicketsLabel()}全額</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 出發前 1 個月</div>
                      <div style={{ fontSize: 12, color: '#555' }}>• {getMealsTicketsItems()}</div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(mealsTicketsAmount)} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(mealsTicketsAmount / exchangeRate))}</span>
                      </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第二階段｜車{includeGuide ? '導' : '輛'}訂金 30%</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 同時支付</div>
                      <div style={{ fontSize: 12, color: '#555' }}>• 確認行程細節後支付訂金，即完成預約</div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(Math.round(carAmount * 0.3))} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(carAmount * 0.3 / exchangeRate))}</span>
                      </div>
                    </div>
                    <div style={{ background: 'white', borderRadius: 6, padding: 12, marginBottom: 8, borderLeft: '4px solid #5c4a2a' }}>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 4 }}>📍 第三階段｜車{includeGuide ? '導' : '輛'}尾款 70%（含超時結算）</div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ 送機前一天</div>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                        • 包車費用{includeGuide ? '、導遊費用' : ''}{calculation.needLuggageCar ? '、行李車' : ''}{calculation.childSeatCost > 0 ? '、兒童座椅' : ''}<br />
                        • 統一結算超時費（若有）
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginTop: 6 }}>
                        💰 {fmt(Math.round(carAmount * 0.7))} 泰銖
                        <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8 }}>≈ NT$ {fmt(Math.round(carAmount * 0.7 / exchangeRate))}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* 超時費說明 */}
                <div style={{ marginTop: 8, padding: 10, background: '#fff3e0', borderRadius: 6, fontSize: 12, border: '1px solid #ffcc02' }}>
                  <div style={{ fontWeight: 'bold', color: '#9a6b2a', marginBottom: 4 }}>⏱️ 超時費說明</div>
                  <div style={{ color: '#555' }}>
                    • 清邁行程：每日 10 小時｜清萊：每日 12 小時<br />
                    • 超時費：<strong>200 泰銖/小時 × {calculation.carCount}台車</strong>{includeGuide ? '（導遊不另收）' : ''}
                  </div>
                </div>

                {/* 台幣匯款資訊 */}
                <div style={{ marginTop: 12, padding: 12, background: '#f9f8f6', border: '1px solid #b89b4d', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 8 }}>🏦 台幣匯款資訊</div>
                  <div style={{ color: '#333', lineHeight: 1.8 }}>
                    戶名：<strong>蔡柏裕</strong><br />
                    銀行：彰化銀行（代碼 009）<br />
                    帳號：<strong>51619501772100</strong>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Deposit Notice */}
          {calculation.hotelsWithDeposit.length > 0 && collectDeposit && (
            <div style={{ marginTop: 16, padding: 12, background: '#fff8e1', border: '1px solid #ffcc02', borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', color: '#9a6b2a', marginBottom: 8, fontSize: 14 }}>
                💳 飯店押金（另收，退房退還）
              </div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                {calculation.hotelsWithDeposit.map(h => (
                  <div key={h.id}>• {h.name}：{fmt(calculation.getHotelDeposit(h))} 泰銖（{calculation.getHotelRoomCount(h)} 間 × {fmt(h.depositPerRoom)}）</div>
                ))}
                <div style={{ marginTop: 8, padding: 10, background: '#b89b4d', color: 'white', borderRadius: 4, fontWeight: 'bold' }}>
                  📋 實收押金：{fmt(calculation.totalDeposit)} 泰銖 ≈ NT$ {fmt(Math.round(calculation.totalDeposit / exchangeRate))}
                </div>
                <div style={{ marginTop: 8, padding: 8, background: '#f9f8f6', borderRadius: 4 }}>
                  ✅ 押金統一由導遊收取，退房後全額退還<br />
                  💡 建議以現金支付（信用卡退款需 7~14 天）
                </div>
              </div>
            </div>
          )}
          {/* Deposit Reminder - 不代收時提醒客人 */}
          {includeAccommodation && !collectDeposit && (
            <div style={{ marginTop: 16, padding: 12, background: '#f8f6f2', border: '1px solid #e8e4dc', borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', color: '#5c4a2a', marginBottom: 8, fontSize: 14 }}>
                💡 飯店押金提醒
              </div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                部分飯店入住時可能需支付押金（依各飯店政策不同），退房時全額退還。<br />
                💵 押金請於入住時直接支付給飯店<br />
                💡 建議準備現金（信用卡退款需 7~14 天）
              </div>
            </div>
          )}

          {/* 實際收取金額摘要 */}
          {(() => {
            const mealsAmount = calculation.mealCost
            const actualTicketsAmount = calculation.ticketPrice + calculation.thaiDressPrice  // 真正的門票/泰服
            const insuranceAmount = calculation.insuranceCost
            const mealsTicketsAmount = mealsAmount + actualTicketsAmount + insuranceAmount
            const carAmount = calculation.transportPrice
            const hasMeals = includeMeals && mealsAmount > 0
            const hasActualTickets = actualTicketsAmount > 0
            const hasInsurance = insuranceAmount > 0
            const hasMealsOrTicketsOrInsurance = hasMeals || hasActualTickets || hasInsurance
            const isCarOnly = !includeAccommodation && !hasMealsOrTicketsOrInsurance

            const getMealsTicketsLabel = () => {
              if (hasMeals && hasActualTickets) return '餐費+門票'
              if (hasMeals && hasInsurance && !hasActualTickets) return '餐費'
              if (hasMeals) return '餐費'
              if (hasActualTickets) return '門票'
              if (hasInsurance) return '保險'
              return ''
            }

            return (
              <div style={{ marginTop: 20, background: '#5c4a2a', color: 'white', padding: 16, borderRadius: 8 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 14 }}>💵 實際收取金額摘要</div>
                <div style={{ fontSize: 13, lineHeight: 2 }}>
                  {isCarOnly ? (
                    <>
                      {/* 純包車：30% + 70% */}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>第一階段（訂金 30%）</span>
                        <span>NT$ {fmt(Math.round(carAmount * 0.3 / exchangeRate))}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>第二階段（尾款 70%）</span>
                        <span>NT$ {fmt(Math.round(carAmount * 0.7 / exchangeRate))}</span>
                      </div>
                    </>
                  ) : includeAccommodation ? (
                    <>
                      {/* 有住宿：住宿 → 餐費/門票 → 車導 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>住宿</span>
                        <span>NT$ {fmt(Math.round(calculation.accommodationCost / exchangeRate))}</span>
                      </div>
                      {hasMealsOrTicketsOrInsurance && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{getMealsTicketsLabel()}</span>
                          <span>NT$ {fmt(Math.round(mealsTicketsAmount / exchangeRate))}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>車{includeGuide ? '導' : '輛'}費</span>
                        <span>NT$ {fmt(Math.round(carAmount / exchangeRate))}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 無住宿但有餐費/門票：餐費/門票 → 車30% → 車70% */}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{getMealsTicketsLabel()}</span>
                        <span>NT$ {fmt(Math.round(mealsTicketsAmount / exchangeRate))}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>車{includeGuide ? '導' : '輛'}訂金 30%</span>
                        <span>NT$ {fmt(Math.round(carAmount * 0.3 / exchangeRate))}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>車{includeGuide ? '導' : '輛'}尾款 70%</span>
                        <span>NT$ {fmt(Math.round(carAmount * 0.7 / exchangeRate))}</span>
                      </div>
                    </>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.3)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 15 }}>
                    <span>團費總計</span>
                    <span>NT$ {fmt(calculation.perPersonTWD * people)}</span>
                  </div>
                  {calculation.totalDeposit > 0 && collectDeposit && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffcc00', marginTop: 4 }}>
                      <span>+ 飯店押金（退房退還）</span>
                      <span>NT$ {fmt(Math.round(calculation.totalDeposit / exchangeRate))}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Policies */}
          <div style={{ marginTop: 20 }}>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 11, marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', color: '#333', marginBottom: 8 }}>📋 退款政策</div>
              <div style={{ color: '#555', lineHeight: 1.8 }}>
                <strong>【車導服務】</strong><br />
                • 14 天前取消：全額退款<br />
                • 7-13 天前取消：退款 50%<br />
                • 4-6 天前取消：退款 30%<br />
                • 3 天內取消：不予退款<br /><br />
                <strong>【住宿】</strong>依各飯店取消政策為準<br />
                <strong>【門票/餐費】</strong>訂購後恕不退款<br />
                <strong>【不可抗力】</strong>天災、疫情、班機取消另案協商
              </div>
            </div>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 11 }}>
              <div style={{ fontWeight: 'bold', color: '#333', marginBottom: 8 }}>🔒 隱私政策</div>
              <div style={{ color: '#555', lineHeight: 1.6 }}>
                • 您的護照資料僅提供給飯店辦理入住登記與泰國當地 TM30 移民局申報（法規必備）<br />
                • 我們遵守各飯店之隱私權政策<br />
                • 行程結束後不保留您的個人資料
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '2px solid #eee', textAlign: 'center', fontSize: 13, color: '#666' }}>
            <div style={{ marginBottom: 8 }}>💬 LINE 諮詢：<strong>@037nyuwk</strong></div>
            <div>🌐 chiangway-travel.com</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Styles
const inputStyle: React.CSSProperties = { padding: 8, border: '1px solid #ddd', borderRadius: 6, fontSize: 16, width: 80 }
const noteStyle: React.CSSProperties = { fontSize: 12, color: '#999' }
const warningStyle: React.CSSProperties = { background: '#fff3cd', color: '#856404', padding: 12, borderRadius: 6, marginTop: 8 }
const thStyle: React.CSSProperties = { border: '1px solid #ddd', padding: 8, textAlign: 'center', background: '#f5f5f5' }
const tdStyle: React.CSSProperties = { border: '1px solid #ddd', padding: 8, textAlign: 'right' }

// Components
function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', ...style }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#333', borderBottom: '2px solid #5c4a2a', paddingBottom: 8 }}>{title}</h2>
      {children}
    </div>
  )
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap', ...style }}>{children}</div>
}

function SectionRow({ title }: { title: string }) {
  return <tr><td colSpan={4} style={{ background: '#5c4a2a', color: 'white', padding: 8, fontWeight: 'bold', textAlign: 'left' }}>{title}</td></tr>
}

function DataRow({ name, cost, price, profit, className }: { name: string; cost: number; price: number; profit: number; className?: string }) {
  return (
    <tr style={className === 'day-row' ? { background: '#fafafa' } : {}}>
      <td style={{ ...tdStyle, textAlign: 'left' }}>{name}</td>
      <td style={tdStyle}>{cost.toLocaleString()}</td>
      <td style={tdStyle}>{price.toLocaleString()}</td>
      <td style={tdStyle}>{profit > 0 ? profit.toLocaleString() : '-'}</td>
    </tr>
  )
}

function SubtotalRow({ name, cost, price, profit }: { name: string; cost: number; price: number; profit: number }) {
  return (
    <tr style={{ background: '#f9f8f6', fontWeight: 'bold' }}>
      <td style={{ ...tdStyle, textAlign: 'left' }}>{name}</td>
      <td style={tdStyle}>{cost.toLocaleString()}</td>
      <td style={tdStyle}>{price.toLocaleString()}</td>
      <td style={tdStyle}>{profit.toLocaleString()}</td>
    </tr>
  )
}

function InfoRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={4} style={{ textAlign: 'left', color: '#666', fontSize: 12, background: '#fafafa', padding: 8, border: '1px solid #ddd' }}>{text}</td>
    </tr>
  )
}

function QuoteItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #ddd' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
