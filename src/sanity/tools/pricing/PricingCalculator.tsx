// src/sanity/tools/pricing/PricingCalculator.tsx
// 報價計算器 - 複製 HTML prototype 的 UI

import React, { useState, useEffect, useMemo } from 'react'
import html2pdf from 'html2pdf.js'

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

// 門票資料
const DEFAULT_TICKETS = [
  // D2 大象保護營（二擇一）
  { id: 'elephant-meal', name: 'D2 大象保護營（含餐）', price: 1600, rebate: 1000, split: true, checked: false },
  { id: 'elephant', name: 'D2 大象保護營（不含餐）', price: 1600, rebate: 1100, split: true, checked: true },
  // D2 射擊（二擇一）
  { id: 'shooting', name: 'D2 射擊（基本）', price: 1700, rebate: 500, split: true, checked: true },
  { id: 'shooting-pro', name: 'D2 射擊（進階）', price: 5000, rebate: 1000, split: true, checked: false },
  // D2 人妖秀（二擇一）
  { id: 'cabaret-vip', name: 'D2 人妖秀（VIP）', price: 1000, rebate: 500, split: true, checked: true },
  { id: 'cabaret', name: 'D2 人妖秀（普通）', price: 800, rebate: 350, split: true, checked: false },
  // D3
  { id: 'whiteTemple', name: 'D3 白廟', price: 200, rebate: 0, split: false, checked: true },
  { id: 'blueTemple', name: 'D3 藍廟', price: 0, rebate: 0, split: false, checked: true },
  { id: 'blackTemple', name: 'D3 黑廟', price: 80, rebate: 0, split: false, checked: true },
  { id: 'longNeck', name: 'D3 長頸村', price: 300, rebate: 200, split: true, checked: true },
  // D4
  { id: 'waterPark', name: 'D4 水上樂園', price: 950, rebate: 250, split: true, checked: true },
  { id: 'nightSafari', name: 'D4 夜間動物園', price: 1200, rebate: 550, split: true, checked: true },
  // D5 叢林飛索（三擇一）
  { id: 'zipline-a', name: 'D5 叢林飛索 A', price: 2400, rebate: 500, split: true, checked: true },
  { id: 'zipline-b', name: 'D5 叢林飛索 B', price: 2200, rebate: 450, split: true, checked: false },
  { id: 'zipline-c', name: 'D5 叢林飛索 C', price: 2000, rebate: 400, split: true, checked: false },
  // D5
  { id: 'snakeFarm', name: 'D5 蛇園', price: 200, rebate: 100, split: true, checked: true },
  { id: 'pigSlide', name: 'D5 豬豬溜滑梯', price: 200, rebate: 30, split: true, checked: true },
]

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
  collectDeposit: boolean
) {
  const fmt = (n: number) => n.toLocaleString()
  const mealLabels: Record<number, string> = { 900: '平價', 1200: '精選', 1500: '高級' }

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
    /* 清微旅行 - 溫暖品牌配色（紅標題 + 綠強調 + 米色背景） */
    :root {
      --red-primary: #c94a4a;
      --red-dark: #a63d3d;
      --green-accent: #4a8c54;
      --cream-bg: #fef8f0;
      --cream-light: #fffbf5;
      --text-primary: #333333;
      --text-secondary: #555555;
      --text-muted: #888888;
      --border-light: #e8e0d5;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
      max-width: 600px; margin: 0 auto; padding: 20px;
      background: #f5f0e8; color: var(--text-primary);
    }
    .header {
      background: linear-gradient(135deg, #c94a4a 0%, #a63d3d 100%);
      color: white; padding: 28px 24px; border-radius: 12px 12px 0 0; text-align: center;
      box-shadow: 0 4px 12px rgba(166, 61, 61, 0.2);
    }
    .header h1 { text-shadow: 0 1px 2px rgba(0,0,0,0.15); }
    .content {
      background: var(--cream-bg);
      border: 1px solid var(--border-light); border-top: none;
      border-radius: 0 0 12px 12px; padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    h3 {
      color: var(--red-primary);
      border-bottom: 2px solid var(--green-accent);
      padding-bottom: 8px; margin: 0 0 16px 0; font-size: 16px;
    }
    .itinerary-day {
      background: var(--cream-light);
      border-left: 4px solid var(--green-accent);
      border-radius: 8px; padding: 12px; margin-bottom: 8px;
    }
    .itinerary-day .title { font-weight: bold; color: var(--red-dark); margin-bottom: 4px; font-size: 14px; }
    .itinerary-day .items { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
    .itinerary-day .hotel { font-size: 11px; color: var(--green-accent); margin-top: 6px; font-weight: 500; }
    .price-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed var(--border-light); }
    .price-row:last-child { border-bottom: none; }
    .price-total {
      display: flex; justify-content: space-between;
      padding: 12px 0 4px 0; margin-top: 8px;
      border-top: 2px solid var(--green-accent);
      font-weight: bold; color: var(--text-primary);
    }
    .price-box {
      background: linear-gradient(135deg, #c94a4a 0%, #a63d3d 100%);
      color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 20px 0;
      box-shadow: 0 4px 16px rgba(166, 61, 61, 0.25);
    }
    .price-box .label { font-size: 14px; opacity: 0.95; margin-bottom: 4px; }
    .price-box .amount { font-size: 38px; font-weight: bold; margin: 8px 0; }
    .price-box .sub { font-size: 13px; opacity: 0.9; }
    .includes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .includes .box { padding: 12px; border-radius: 8px; }
    .includes .yes { background: #f0f7f1; border: 1px solid #c8e6c9; }
    .includes .no { background: #fef5f5; border: 1px solid #ffcdd2; }
    .includes .box h4 { font-size: 13px; margin-bottom: 8px; font-weight: 600; }
    .includes .yes h4 { color: var(--green-accent); }
    .includes .no h4 { color: #c94a4a; }
    .includes .box ul { font-size: 12px; line-height: 1.8; color: var(--text-secondary); list-style: none; }
    .deposit-box { background: #fff8e8; border: 1px solid #ffe082; border-radius: 8px; padding: 12px; margin: 16px 0; }
    .deposit-box h4 { color: #e67e00; font-size: 14px; margin-bottom: 8px; font-weight: 600; }
    .deposit-box .info { font-size: 12px; color: var(--text-secondary); line-height: 1.8; }
    .payment-phases { background: var(--cream-light); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px; margin: 20px 0; }
    .payment-phases h4 { color: var(--text-primary); font-size: 14px; margin-bottom: 12px; font-weight: 600; }
    .payment-phase { background: white; border-radius: 6px; padding: 12px; margin-bottom: 8px; border-left: 4px solid var(--green-accent); }
    .payment-phase:last-child { margin-bottom: 0; }
    .payment-phase .label { font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 13px; }
    .payment-phase .timing { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
    .payment-phase .items { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
    .payment-phase .amount { font-weight: 600; color: var(--green-accent); margin-top: 6px; font-size: 13px; }
    .footer {
      margin-top: 24px; padding-top: 20px;
      border-top: 1px solid var(--border-light);
      text-align: center; font-size: 13px; color: var(--text-secondary);
    }
    .footer a { color: var(--red-primary); text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .footer .brand { font-weight: 600; color: var(--red-primary); margin-bottom: 8px; font-size: 15px; }
    .note-box { background: var(--cream-light); border-radius: 8px; padding: 12px; font-size: 11px; margin-bottom: 12px; }
    .note-box .title { font-weight: 600; color: var(--text-primary); margin-bottom: 6px; font-size: 12px; }
    .note-box .content { color: var(--text-secondary); line-height: 1.7; }
    @media print { body { background: white; padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 14px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px;">CHIANGWAY TRAVEL</div>
    <h1 style="font-size: 26px; margin: 0; font-weight: 600;">清微旅行</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.95; font-size: 13px;">台灣爸爸 × 泰國媽媽｜清邁在地親子包車</p>
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.25);">
      <div style="font-size: 11px; opacity: 0.8; margin-bottom: 4px;">行程報價單</div>
      <div style="font-size: 20px; font-weight: 600;">清邁 ${totalNights + 1}天${totalNights}夜 親子包車</div>
    </div>
  </div>

  <div class="content">
    <!-- Itinerary -->
    <h3>📅 行程概覽</h3>
    ${ITINERARY.map(day => `
      <div class="itinerary-day">
        <div class="title">${day.day}｜${day.title}</div>
        <div class="items">${day.items.join('　')}</div>
        ${day.hotel ? `<div class="hotel">🏨 ${day.hotel}</div>` : ''}
      </div>
    `).join('')}

    <!-- Price Summary -->
    <h3 style="margin-top: 20px;">💰 費用明細</h3>
    <div style="font-size: 14px; color: #555; margin-bottom: 12px;">
      👥 <strong>${people} 人</strong>｜🗓️ ${totalNights + 1}天${totalNights}夜
    </div>
    <div style="background: #fafafa; border-radius: 8px; padding: 16px;">

      ${includeAccommodation ? `
      <!-- 住宿明細 -->
      <div class="price-row" style="border-bottom: 2px solid #b89b4d; padding-bottom: 8px; margin-bottom: 8px;">
        <span style="font-weight:bold; color:#5c4a2a;">🏨 住宿（${totalNights}晚）</span>
        <span style="font-weight:bold;">${fmt(c.accommodationCost)} 泰銖</span>
      </div>
      ${hotels.map(h => `
        <div style="padding-left: 16px; font-size: 12px; color: #555; margin-bottom: 4px;">
          • ${h.name}（${h.nights}晚）
        </div>
      `).join('')}
      ` : ''}

      ${includeMeals ? `
      <!-- 餐費明細 -->
      <div class="price-row" style="border-bottom: 2px solid #b89b4d; padding-bottom: 8px; margin-bottom: 8px; margin-top: 12px;">
        <span style="font-weight:bold; color:#5c4a2a;">🍜 餐費（${c.mealDays}天午晚餐）</span>
        <span style="font-weight:bold;">${fmt(c.mealCost)} 泰銖</span>
      </div>
      <div style="padding-left: 16px; font-size: 12px; color: #555;">
        • ${mealLabels[mealLevel]}餐廳 ${fmt(mealLevel)}/人/天 × ${people}人 × ${c.mealDays}天
      </div>
      ` : ''}

      <!-- 車導明細 -->
      <div class="price-row" style="border-bottom: 2px solid #b89b4d; padding-bottom: 8px; margin-bottom: 8px; margin-top: 12px;">
        <span style="font-weight:bold; color:#5c4a2a;">🚗 包車 + 導遊（${c.carCount}台車）</span>
        <span style="font-weight:bold;">${fmt(c.transportPrice)} 泰銖</span>
      </div>
      <div style="padding-left: 16px; font-size: 12px; color: #555; line-height: 1.8;">
        • 包車 6 天 × ${c.carCount}台<br />
        • 中文導遊 ${c.guideDays} 天
        ${c.needLuggageCar ? `<br />• 行李車（接機＋送機）` : ''}
        ${c.childSeatCost > 0 ? `<br />• 兒童座椅 ${babySeatCount + childSeatCount}張 × ${c.guideDays}天` : ''}
      </div>

      ${c.selectedTickets.length > 0 ? `
      <!-- 門票明細 -->
      <div class="price-row" style="border-bottom: 2px solid #b89b4d; padding-bottom: 8px; margin-bottom: 8px; margin-top: 12px;">
        <span style="font-weight:bold; color:#5c4a2a;">🎫 門票活動（${c.selectedTickets.length}項）</span>
        <span style="font-weight:bold;">${fmt(c.ticketPrice)} 泰銖</span>
      </div>
      <div style="padding-left: 16px; font-size: 12px; color: #555; line-height: 1.8;">
        ${c.selectedTickets.map((t: any) => `• ${t.name.replace(/^D\\d /, '')}${t.price > 0 ? ` ${fmt(t.price)}/人` : '（免費）'}`).join('<br />')}
      </div>
      ` : ''}

      ${c.thaiDressPrice > 0 ? `
      <!-- 泰服明細 -->
      <div class="price-row" style="border-bottom: 2px solid #b89b4d; padding-bottom: 8px; margin-bottom: 8px; margin-top: 12px;">
        <span style="font-weight:bold; color:#5c4a2a;">👘 泰服體驗</span>
        <span style="font-weight:bold;">${fmt(c.thaiDressPrice)} 泰銖</span>
      </div>
      <div style="padding-left: 16px; font-size: 12px; color: #555; line-height: 1.8;">
        ${thaiDressCloth ? `• 泰服衣服 500/人 × ${people}人<br />` : ''}
        ${makeupCount > 0 ? `• 專業化妝 1,000/人 × ${makeupCount}人<br />` : ''}
        ${thaiDressPhoto ? `• 攝影師 2,500/位 × ${people <= 10 ? 1 : 2}位` : ''}
      </div>
      ` : ''}

      ${c.insuranceCost > 0 ? `
      <!-- 保險 -->
      <div class="price-row" style="margin-top: 12px;">
        <span>🛡️ 旅遊保險（${fmt(config.insurancePerPerson)}/人 × ${people}人）</span>
        <span style="font-weight:bold;">${fmt(c.insuranceCost)} 泰銖</span>
      </div>
      ` : ''}

      <div class="price-total"><span>總計</span><span>${fmt(c.totalPrice)} 泰銖</span></div>
    </div>

    <!-- Per Person Price -->
    <div class="price-box">
      <div style="font-size: 14px; opacity: 0.9;">每人費用</div>
      <div class="amount">NT$ ${fmt(c.perPersonTWD)}</div>
      <div style="font-size: 12px; opacity: 0.8;">約 ${fmt(Math.round(c.perPersonTHB))} 泰銖 ÷ ${people}人</div>
    </div>

    <!-- Includes/Excludes -->
    <div class="includes">
      <div class="box yes">
        <h4>✅ 費用包含</h4>
        <ul>
          ${includeAccommodation ? `<li>• ${totalNights}晚住宿</li>` : ''}
          ${includeMeals ? `<li>• ${c.mealDays}天午晚餐</li>` : ''}
          <li>• 全程包車（${c.carCount}台）</li>
          ${includeGuide ? `<li>• 專業中文導遊</li>` : ''}
          ${c.selectedTickets.length > 0 ? `<li>• ${c.selectedTickets.length}項門票活動</li>` : ''}
          ${c.thaiDressPrice > 0 ? `<li>• 泰服體驗</li>` : ''}
          ${c.insuranceCost > 0 ? `<li>• 旅遊保險</li>` : ''}
        </ul>
      </div>
      <div class="box no">
        <h4>❌ 費用不含</h4>
        <ul>
          <li>• 來回機票</li>
          ${!includeAccommodation ? `<li>• 住宿</li>` : ''}
          ${!includeMeals ? `<li>• 餐費</li>` : ''}
          ${c.selectedTickets.length === 0 ? `<li>• 門票（現場付費）</li>` : ''}
          ${!includeGuide ? `<li>• 導遊</li>` : ''}
          <li>• 個人消費</li>
                    <li>• 小費</li>
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
    <div style="margin-top: 20px;">
      <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; font-size: 11px; margin-bottom: 12px;">
        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">📋 退款政策</div>
        <div style="color: #555; line-height: 1.8;">
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
      <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; font-size: 11px;">
        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">🔒 隱私政策</div>
        <div style="color: #555; line-height: 1.6;">
          • 您的護照資料僅提供給飯店辦理入住登記與泰國當地 TM30 移民局申報（法規必備）<br />
          • 我們遵守各飯店之隱私權政策<br />
          • 行程結束後不保留您的個人資料
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="brand">清微旅行 Chiangway Travel</div>
      <div style="margin: 12px 0; display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
        <a href="https://chiangway-travel.com" target="_blank">🌐 官網</a>
        <a href="https://line.me/R/ti/p/@037nyuwk" target="_blank">💬 LINE 諮詢</a>
      </div>
      <div style="color: #999; font-size: 11px; margin-top: 12px;">
        報價日期：${new Date().toLocaleDateString('zh-TW')}｜本報價有效期 14 天
      </div>
    </div>
  </div>
</body>
</html>`

  // 使用 html2pdf.js 直接產生 PDF
  const filename = `清微旅行報價_${people}人_${new Date().toISOString().slice(0, 10)}.pdf`

  // 建立臨時 iframe 來渲染完整 HTML（包含 head 和 styles）
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '0'
  iframe.style.top = '0'
  iframe.style.width = '650px'
  iframe.style.height = '2000px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-1'
  document.body.appendChild(iframe)

  // 寫入 HTML 到 iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    console.error('無法存取 iframe document')
    document.body.removeChild(iframe)
    alert('PDF 產生失敗')
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  // 等待 iframe 載入完成
  setTimeout(() => {
    const content = iframeDoc.body

    // 設定 html2pdf 選項
    const opt = {
      margin: [5, 5, 5, 5],
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        windowWidth: 650,
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }

    // 產生並下載 PDF
    html2pdf()
      .set(opt)
      .from(content)
      .save()
      .then(() => {
        document.body.removeChild(iframe)
      })
      .catch((err: Error) => {
        console.error('PDF 產生失敗:', err)
        document.body.removeChild(iframe)
        alert('PDF 產生失敗，請稍後再試')
      })
  }, 500) // 給一點時間讓樣式載入
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

export function PricingCalculator() {
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

  const [hotels, setHotels] = useState<Hotel[]>([
    {
      id: 1,
      name: '香格里拉酒店',
      nights: 3,
      rooms: {
        double: [
          { name: 'Horizon俱樂部豪華雙人間', quantity: 2, price: 3500, hasExtraBed: true },
          { name: '行政樓層俱樂部尊貴雙人間', quantity: 3, price: 3000, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        ],
        twin: [
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
          { name: '', quantity: 0, price: 2500, hasExtraBed: false },
        ],
        triple: [
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
        ],
        family: [
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
        ],
      },
      hasDeposit: true,
      depositPerRoom: 3000
    },
    {
      id: 2,
      name: '美平洲際酒店',
      nights: 2,
      rooms: {
        double: [
          { name: '豪華雙人房', quantity: 5, price: 3000, hasExtraBed: false },
          { name: '', quantity: 0, price: 3000, hasExtraBed: false },
          { name: '', quantity: 0, price: 3000, hasExtraBed: false },
        ],
        twin: [
          { name: '', quantity: 0, price: 3000, hasExtraBed: false },
          { name: '', quantity: 0, price: 3000, hasExtraBed: false },
          { name: '', quantity: 0, price: 3000, hasExtraBed: false },
        ],
        triple: [
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
          { name: '', quantity: 0, price: 3500, hasExtraBed: false },
        ],
        family: [
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
          { name: '', quantity: 0, price: 4500, hasExtraBed: false },
        ],
      },
      hasDeposit: true,
      depositPerRoom: 3000
    },
  ])
  const [nextHotelId, setNextHotelId] = useState(3)

  const [mealLevel, setMealLevel] = useState(900)
  const [tickets, setTickets] = useState(DEFAULT_TICKETS)
  const [thaiDressCloth, setThaiDressCloth] = useState(true)
  const [thaiDressPhoto, setThaiDressPhoto] = useState(true)  // 攝影師預設勾選
  const [makeupCount, setMakeupCount] = useState(0)
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

  // 飯店管理函數
  const addHotel = () => {
    setHotels(prev => [...prev, {
      id: nextHotelId,
      name: '新飯店',
      nights: 1,
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

  // 計算總住宿晚數
  const totalNights = hotels.reduce((sum, h) => sum + h.nights, 0)

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
    const { mealDays, guideDays, dailyCarFees, guidePerDay, luggagePerTrip, insurancePerPerson, thaiDress } = config
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
    const hasPackageServices = includeAccommodation || includeMeals || selectedTickets.length > 0
    const insuranceCost = hasPackageServices ? insurancePerPerson * people : 0

    // Totals
    const totalCost = accommodationCost + mealCost + transportCost + ticketCost + thaiDressCost + insuranceCost + luggageCost
    const totalPrice = accommodationCost + mealCost + transportPrice + ticketPrice + thaiDressPrice + insuranceCost

    const yourTotalProfit = transportProfit + ticketYourProfit + thaiDressYourProfit
    const partnerTotalProfit = ticketPartnerProfit + thaiDressPartnerProfit

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
  }, [config, people, exchangeRate, hotels, totalNights, mealLevel, tickets, thaiDressCloth, thaiDressPhoto, makeupCount, luggageCar, babySeatCount, childSeatCount, includeAccommodation, includeMeals, includeTickets, includeGuide])

  const fmt = (n: number) => n.toLocaleString()

  const toggleTicket = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t))
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
      <h1 style={{ color: '#5c4a2a', marginBottom: 5 }}>🚐 清邁 6天5夜 報價計算器</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>內部工具 v3 — 含車導明細</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('input')} style={{ padding: '10px 20px', background: activeTab === 'input' ? '#5c4a2a' : '#ddd', color: activeTab === 'input' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📝 輸入</button>
        <button onClick={() => setActiveTab('internal')} style={{ padding: '10px 20px', background: activeTab === 'internal' ? '#5c4a2a' : '#ddd', color: activeTab === 'internal' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📊 內部明細</button>
        <button onClick={() => setActiveTab('external')} style={{ padding: '10px 20px', background: activeTab === 'external' ? '#5c4a2a' : '#ddd', color: activeTab === 'external' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📄 對外報價單</button>
        <button onClick={() => downloadExternalQuote(calculation, people, exchangeRate, hotels, mealLevel, thaiDressCloth, thaiDressPhoto, makeupCount, config, includeAccommodation, includeMeals, includeGuide, totalNights, babySeatCount, childSeatCount, collectDeposit)} style={{ padding: '10px 20px', background: '#b89b4d', color: 'white', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📥 下載報價</button>
      </div>

      {/* Input Tab */}
      {activeTab === 'input' && (
        <>
          {/* 報價類型 */}
          <Section title="📋 報價類型">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeAccommodation} onChange={e => setIncludeAccommodation(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 15 }}>🏨 含住宿</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeMeals} onChange={e => setIncludeMeals(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 15 }}>🍜 含餐費</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={allActivitiesSelected} onChange={e => e.target.checked ? selectAllActivities() : deselectAllActivities()} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 15 }}>🎫 含門票/活動</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeGuide} onChange={e => setIncludeGuide(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 15 }}>🧑‍💼 含導遊</span>
              </label>
              {calculation.totalDeposit > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={collectDeposit} onChange={e => setCollectDeposit(e.target.checked)} style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 15, color: collectDeposit ? '#9a6b2a' : '#666' }}>💳 代收押金</span>
                </label>
              )}
            </div>
            {(!includeAccommodation || !includeMeals || noActivitiesSelected || !includeGuide) && (
              <div style={{ marginTop: 8, padding: 8, background: '#fff3e0', borderRadius: 6, fontSize: 13 }}>
                💡 {[
                  !includeAccommodation && '住宿',
                  !includeMeals && '餐費',
                  noActivitiesSelected && '門票/活動',
                  !includeGuide && '導遊'
                ].filter(Boolean).join('、')}由客人自理
              </div>
            )}
          </Section>

          {/* 人數 */}
          <Section title="👥 人數">
            <Row>
              <label style={{ minWidth: 100 }}>總人數</label>
              <input type="number" value={people} onChange={e => setPeople(Number(e.target.value) || 4)} style={{ ...inputStyle, width: 100 }} />
              <span style={noteStyle}>4人起</span>
            </Row>
            {people < 4 && <div style={warningStyle}>⚠️ 最低 4 人成團</div>}
            <Row style={{ marginTop: 12 }}>
              <label style={{ minWidth: 100 }}>匯率</label>
              <input type="number" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} min={0.85} max={1.05} step={0.01} style={{ ...inputStyle, width: 100 }} />
              <span style={noteStyle}>泰銖 ÷ 匯率 = 台幣</span>
            </Row>
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

                {totalNights !== config.nights && (
                  <div style={{ ...warningStyle, marginTop: 12 }}>
                    ⚠️ 總晚數 {totalNights} 晚，與預設 {config.nights} 晚不同（行程天數會自動調整）
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
          <Section title="🎫 門票活動">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <p style={{ ...noteStyle, margin: 0 }}>格式：成本｜★ 表示有退款對分（含泰服）</p>
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
            <p style={{ ...noteStyle, marginTop: 12 }}>
              已選 {calculation.selectedTickets.length}/{tickets.length} 項｜門票成本/人：{fmt(calculation.selectedTickets.reduce((sum, t) => sum + (t.price - t.rebate), 0))} 泰銖
            </p>
          </Section>

          {/* 泰服 */}
          <Section title="👘 D1 泰服體驗" style={{ background: '#fff9e6', border: '1px solid #f0d000' }}>
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
          </Section>

          {/* Result */}
          <div style={{ background: '#5c4a2a', color: 'white', textAlign: 'center', padding: 24, position: 'sticky', bottom: 0, borderRadius: 12 }}>
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
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 'bold' }}>清邁 6天5夜 親子包車行程</div>
          </div>

          {/* Itinerary */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#5c4a2a', fontSize: 16, borderBottom: '2px solid #5c4a2a', paddingBottom: 8 }}>📅 行程概覽</h3>
            {ITINERARY.map((day, i) => (
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
              👥 <strong>{people} 人</strong>｜🗓️ {totalNights + 1}天{totalNights}夜
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
                    • {mealLevel === 900 ? '平價' : mealLevel === 1200 ? '精選' : '高級'}餐廳 {fmt(mealLevel)}/人/天 × {people}人 × {calculation.mealDays}天
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
              {calculation.selectedTickets.length > 0 && (
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
                {calculation.selectedTickets.length > 0 && <>• {calculation.selectedTickets.length}項門票活動<br /></>}
                {calculation.thaiDressPrice > 0 && <>• 泰服體驗<br /></>}
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
