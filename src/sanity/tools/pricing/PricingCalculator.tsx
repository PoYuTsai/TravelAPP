// src/sanity/tools/pricing/PricingCalculator.tsx
// 報價計算器 - 複製 HTML prototype 的 UI

import React, { useState, useEffect, useMemo } from 'react'

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
    { day: 'D6', name: '市區(送機)', cost: 2700, price: 3200, type: 'city' },
  ],
  guidePerDay: { cost: 1500, price: 2500 },
  luggagePerTrip: 600,
  thaiDress: {
    cloth: { price: 500, rebate: 200 },
    makeup: { price: 1000, rebate: 500 },  // HTML v3: 1000/500
    photo: { price: 2500, rebate: 500 },
  },
}

// 門票資料（跟 HTML v3 一樣）
const DEFAULT_TICKETS = [
  // D2
  { id: 'elephant', name: 'D2 大象保護營（不含餐）', price: 1600, rebate: 1100, split: true, checked: true },
  { id: 'shooting', name: 'D2 射擊', price: 1700, rebate: 500, split: true, checked: true },
  { id: 'cabaret', name: 'D2 人妖秀', price: 1000, rebate: 500, split: true, checked: true },
  // D3
  { id: 'whiteTemple', name: 'D3 白廟', price: 0, rebate: 0, split: false, checked: true },
  { id: 'blueTemple', name: 'D3 藍廟', price: 0, rebate: 0, split: false, checked: true },
  { id: 'blackTemple', name: 'D3 黑廟', price: 0, rebate: 0, split: false, checked: true },
  { id: 'longNeck', name: 'D3 長頸村', price: 300, rebate: 200, split: true, checked: true },
  // D4
  { id: 'waterPark', name: 'D4 水上樂園 ⚠️待補', price: 950, rebate: 0, split: true, checked: true },
  { id: 'nightSafari', name: 'D4 夜間動物園', price: 1200, rebate: 550, split: true, checked: true },
  // D5
  { id: 'zipline', name: 'D5 叢林飛索', price: 2400, rebate: 500, split: true, checked: true },
  { id: 'snakeFarm', name: 'D5 蛇園', price: 200, rebate: 100, split: true, checked: true },
  { id: 'pigSlide', name: 'D5 豬豬溜滑梯', price: 200, rebate: 30, split: true, checked: true },
]

// 下載 PDF 功能
function downloadPDF(
  c: any,
  people: number,
  exchangeRate: number,
  roomDouble: number,
  roomTriple: number,
  roomFamily: number,
  priceDouble: number,
  priceTriple: number,
  priceFamily: number,
  mealLevel: number,
  thaiDressCloth: boolean,
  thaiDressPhoto: boolean,
  makeupCount: number,
  config: any
) {
  const fmt = (n: number) => n.toLocaleString()
  const mealLabels: Record<number, string> = { 900: '平價', 1200: '精選', 1500: '高級' }

  // 房間資訊
  const rooms = []
  if (roomDouble > 0) rooms.push(`雙人房x${roomDouble} (${priceDouble}/晚)`)
  if (roomTriple > 0) rooms.push(`三人房x${roomTriple} (${priceTriple}/晚)`)
  if (roomFamily > 0) rooms.push(`家庭房x${roomFamily} (${priceFamily}/晚)`)

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>清微旅行報價單</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2d5a3d; text-align: center; }
    .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
    .section { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .section h3 { margin: 0 0 12px 0; color: #2d5a3d; border-bottom: 2px solid #2d5a3d; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background: #f5f5f5; }
    td:first-child { text-align: left; }
    .section-header td { background: #2d5a3d; color: white; font-weight: bold; text-align: left !important; }
    .subtotal td { background: #e8f5e9; font-weight: bold; }
    .profit-you { background: #c8e6c9; }
    .profit-partner { background: #fff3cd; }
    .total-box { background: #2d5a3d; color: white; padding: 20px; border-radius: 12px; text-align: center; margin-top: 20px; }
    .total-box .price { font-size: 32px; font-weight: bold; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 32px; margin-bottom: 8px;">🚐</div>
    <h1 style="color: white; margin: 0;">清微旅行 Chiangway Travel</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">台灣爸爸 × 泰國媽媽｜清邁在地親子包車</p>
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 18px;">清邁 6天5夜 親子包車行程 - 內部報價單</div>
  </div>

  <div class="section">
    <h3>📋 基本資訊</h3>
    <p>👥 人數：${people} 人</p>
    <p>🏨 住宿：${rooms.join('、')}（${c.nights}晚）</p>
    <p>🍜 餐費：${mealLabels[mealLevel] || '標準'} ${mealLevel}/人/天（${c.mealDays}天）</p>
    <p>🚗 車輛：${c.carCount} 台${c.needLuggageCar ? ' + 行李車' : ''}</p>
    <p>💱 匯率：${exchangeRate}</p>
  </div>

  <div class="section">
    <h3>📊 成本/售價/利潤明細</h3>
    <table>
      <thead>
        <tr><th>項目</th><th>成本</th><th>售價</th><th>利潤</th></tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="4">🏨 住宿 (${c.nights}晚)</td></tr>
        <tr><td>住宿費</td><td>${fmt(c.accommodationCost)}</td><td>${fmt(c.accommodationCost)}</td><td>-</td></tr>

        <tr class="section-header"><td colspan="4">🍜 餐費 (${c.mealDays}天)</td></tr>
        <tr><td>餐費 (${mealLevel}/人/天)</td><td>${fmt(c.mealCost)}</td><td>${fmt(c.mealCost)}</td><td>-</td></tr>

        <tr class="section-header"><td colspan="4">🚗 車費明細 (${c.carCount}台)</td></tr>
        ${c.dailyCarFees.map((d: any) => `<tr><td>${d.day} ${d.name}</td><td>${fmt(d.cost * c.carCount)}</td><td>${fmt(d.price * c.carCount)}</td><td>${fmt((d.price - d.cost) * c.carCount)}</td></tr>`).join('')}
        <tr class="subtotal"><td>車費小計</td><td>${fmt(c.carCostTotal)}</td><td>${fmt(c.carPriceTotal)}</td><td>${fmt(c.carPriceTotal - c.carCostTotal)}</td></tr>

        <tr class="section-header"><td colspan="4">👤 導遊</td></tr>
        <tr><td>導遊 (${c.guideDays}天)</td><td>${fmt(c.guideCost)}</td><td>${fmt(c.guidePrice)}</td><td>${fmt(c.guidePrice - c.guideCost)}</td></tr>
        ${c.needLuggageCar ? `<tr><td>行李車 (2趟)</td><td>0</td><td>${fmt(c.luggageCost)}</td><td>${fmt(c.luggageCost)}</td></tr>` : ''}
        <tr class="subtotal"><td>車導總計</td><td>${fmt(c.transportCost)}</td><td>${fmt(c.transportPrice)}</td><td>${fmt(c.transportProfit)}</td></tr>

        <tr class="section-header"><td colspan="4">🎫 門票活動（${people}人）</td></tr>
        ${c.selectedTickets.map((t: any) => `<tr><td>${t.name}${t.split && t.rebate > 0 ? ' ★' : ''}</td><td>${fmt((t.price - t.rebate) * people)}</td><td>${fmt(t.price * people)}</td><td>${fmt(t.rebate * people)}</td></tr>`).join('')}
        <tr class="subtotal"><td>門票總計</td><td>${fmt(c.ticketCost)}</td><td>${fmt(c.ticketPrice)}</td><td>${fmt(c.ticketYourProfit + c.ticketPartnerProfit)}</td></tr>
        <tr class="profit-you"><td>　→ 你的利潤（退款½）</td><td></td><td></td><td>${fmt(c.ticketYourProfit)}</td></tr>
        <tr class="profit-partner"><td>　→ 郭姐利潤（退款½）</td><td></td><td></td><td>${fmt(c.ticketPartnerProfit)}</td></tr>

        ${c.thaiDressPrice > 0 ? `
        <tr class="section-header"><td colspan="4">👘 D1 泰服體驗（利潤對分）</td></tr>
        ${thaiDressCloth ? `<tr><td>泰服衣服 (${people}人)</td><td>${fmt((config.thaiDress.cloth.price - config.thaiDress.cloth.rebate) * people)}</td><td>${fmt(config.thaiDress.cloth.price * people)}</td><td>${fmt(config.thaiDress.cloth.rebate * people)}</td></tr>` : ''}
        ${makeupCount > 0 ? `<tr><td>化妝 (${makeupCount}人)</td><td>${fmt((config.thaiDress.makeup.price - config.thaiDress.makeup.rebate) * makeupCount)}</td><td>${fmt(config.thaiDress.makeup.price * makeupCount)}</td><td>${fmt(config.thaiDress.makeup.rebate * makeupCount)}</td></tr>` : ''}
        ${thaiDressPhoto ? (() => { const photographerCount = people <= 10 ? 1 : 2; return `<tr><td>攝影師 (${photographerCount}位)</td><td>${fmt((config.thaiDress.photo.price - config.thaiDress.photo.rebate) * photographerCount)}</td><td>${fmt(config.thaiDress.photo.price * photographerCount)}</td><td>${fmt(config.thaiDress.photo.rebate * photographerCount)}</td></tr>` })() : ''}
        <tr class="subtotal"><td>泰服小計</td><td>${fmt(c.thaiDressCost)}</td><td>${fmt(c.thaiDressPrice)}</td><td>${fmt(c.thaiDressYourProfit + c.thaiDressPartnerProfit)}</td></tr>
        ` : ''}

        <tr class="section-header"><td colspan="4">🛡️ 保險</td></tr>
        <tr><td>旅遊保險 (${people}人)</td><td>${fmt(c.insuranceCost)}</td><td>${fmt(c.insuranceCost)}</td><td>-</td></tr>

        <tr class="section-header"><td colspan="4">💰 總計</td></tr>
        <tr class="subtotal"><td>總計</td><td>${fmt(c.totalCost)}</td><td>${fmt(c.totalPrice)}</td><td>${fmt(c.yourTotalProfit + c.partnerTotalProfit)}</td></tr>

        <tr class="section-header"><td colspan="4">📈 利潤分配</td></tr>
        <tr class="profit-you"><td>✅ 你的利潤（車導差價 + 門票½）</td><td></td><td></td><td>${fmt(c.yourTotalProfit)}</td></tr>
        <tr class="profit-partner"><td>🤝 郭姐利潤（門票½）</td><td></td><td></td><td>${fmt(c.partnerTotalProfit)}</td></tr>
        <tr class="profit-partner"><td>💵 付給郭姐（成本）</td><td>${fmt(c.transportCost + c.ticketCost + c.mealCost + c.thaiDressCost)}</td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>

  <div class="total-box">
    <div style="font-size: 14px; opacity: 0.9;">每人報價</div>
    <div class="price">NT$ ${fmt(c.perPersonTWD)}</div>
    <div style="font-size: 12px; opacity: 0.8;">約 ${fmt(Math.round(c.perPersonTHB))} 泰銖</div>
  </div>

  <div style="margin-top: 20px; text-align: center; color: #666; font-size: 12px;">
    <p>💬 LINE：@037nyuwk ｜ 🌐 chiangway-travel.com</p>
    <p>報價日期：${new Date().toLocaleDateString('zh-TW')}</p>
  </div>
</body>
</html>`

  // 下載 HTML 檔案
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `清微旅行報價_${people}人_${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 行程資料（跟 HTML v3 一樣）
const ITINERARY = [
  { day: 'DAY 1', title: '抵達清邁・放鬆展開旅程', items: ['🛬 機場接機', '💱 巫宗雄換匯', '🍽️ 午餐：脆皮豬', '👘 泰服體驗＋攝影', '🥭 阿嬤芒果糯米飯', '🍽️ 晚餐：EKACHAN'], hotel: '香格里拉酒店' },
  { day: 'DAY 2', title: '大象互動 + 射擊體驗', items: ['🐘 大象保護營', '☕ AIR DIAMOND CAFE', '🍽️ 午餐：MAI HEUN 60', '🔫 射擊體驗', '🍽️ 晚餐：SAMSEN VILLA 米其林', '💃 人妖秀'], hotel: '香格里拉酒店' },
  { day: 'DAY 3', title: '清萊一日遊（經典三廟）', items: ['⛪ 白廟', '🍽️ 午餐：LALITTA CAFÉ', '💙 藍廟', '🖤 黑廟', '👩 長頸村', '🍽️ 晚餐：泰式烤肉'], hotel: '香格里拉酒店' },
  { day: 'DAY 4', title: '水上樂園 + 夜間動物園', items: ['🏊 清邁大峽谷水上樂園', '🍽️ 午餐：園區內', '🎨 藝術村 BAAN KANGWAT', '🦁 夜間動物園', '🍽️ 晚餐：黑森林餐廳'], hotel: '清邁美平洲際酒店' },
  { day: 'DAY 5', title: '湄林探險一日', items: ['🌲 叢林飛索 ZIPLINE', '🍽️ 午餐：FLEUR CAFE', '🐍 蛇園表演', '🐷 豬豬溜滑梯', '🛒 BIG C 採買', '🍽️ 晚餐：康托克帝王餐'], hotel: '清邁美平洲際酒店' },
  { day: 'DAY 6', title: '收心慢遊・送機回國', items: ['🍳 早餐後退房', '🛫 專車送機'], hotel: null },
]

export function PricingCalculator() {
  // Form states
  const [people, setPeople] = useState(10)
  const [exchangeRate, setExchangeRate] = useState(0.93)
  const [roomDouble, setRoomDouble] = useState(5)
  const [roomTriple, setRoomTriple] = useState(0)
  const [roomFamily, setRoomFamily] = useState(0)
  // 房價可編輯
  const [priceDouble, setPriceDouble] = useState(2500)
  const [priceTriple, setPriceTriple] = useState(3500)
  const [priceFamily, setPriceFamily] = useState(4500)
  const [mealLevel, setMealLevel] = useState(900)
  const [tickets, setTickets] = useState(DEFAULT_TICKETS)
  const [thaiDressCloth, setThaiDressCloth] = useState(true)
  const [thaiDressPhoto, setThaiDressPhoto] = useState(false)
  const [makeupCount, setMakeupCount] = useState(0)
  const [luggageCar, setLuggageCar] = useState(true)
  const [includeAccommodation, setIncludeAccommodation] = useState(true)
  const [includeMeals, setIncludeMeals] = useState(true)
  const [activeTab, setActiveTab] = useState<'input' | 'internal' | 'external'>('input')
  const config = DEFAULT_CONFIG

  // 動態房價
  const roomPrices = { double: priceDouble, triple: priceTriple, family: priceFamily }

  // Auto-adjust rooms when people changes
  useEffect(() => {
    setRoomDouble(Math.ceil(people / 2))
    setRoomTriple(0)
    setRoomFamily(0)
  }, [people])

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
    const { nights, mealDays, guideDays, dailyCarFees, guidePerDay, luggagePerTrip, insurancePerPerson, thaiDress } = config
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

    // Room - 使用動態房價（可選擇不含住宿）
    const roomCapacity = roomDouble * 2 + roomTriple * 3 + roomFamily * 4
    const accommodationCost = includeAccommodation
      ? (roomDouble * priceDouble + roomTriple * priceTriple + roomFamily * priceFamily) * nights
      : 0

    // Meal（可選擇不含餐費）
    const mealCost = includeMeals ? people * mealLevel * mealDays : 0

    // Car
    let carCostTotal = 0, carPriceTotal = 0
    dailyCarFees.forEach((d: any) => {
      carCostTotal += (d.cost || 0) * carCount
      carPriceTotal += (d.price || 0) * carCount
    })

    // Guide
    const guideCost = guidePerDay.cost * guideDays
    const guidePrice = guidePerDay.price * guideDays

    // Luggage
    const luggageCost = needLuggageCar ? luggagePerTrip * 2 : 0

    const transportCost = carCostTotal + guideCost
    const transportPrice = carPriceTotal + guidePrice + luggageCost
    const transportProfit = transportPrice - transportCost - luggageCost

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

    // Insurance
    const insuranceCost = insurancePerPerson * people

    // Totals
    const totalCost = accommodationCost + mealCost + transportCost + ticketCost + thaiDressCost + insuranceCost + luggageCost
    const totalPrice = accommodationCost + mealCost + transportPrice + ticketPrice + thaiDressPrice + insuranceCost

    const yourTotalProfit = transportProfit + ticketYourProfit + thaiDressYourProfit
    const partnerTotalProfit = ticketPartnerProfit + thaiDressPartnerProfit

    const perPersonTHB = totalPrice / people
    const perPersonTWD = Math.round(perPersonTHB / exchangeRate)

    return {
      people, carCount, carDistribution, maxPerCar, luggageStatus, suggestLuggageCar, needLuggageCar, roomCapacity, nights, mealDays, guideDays, mealLevel,
      includeAccommodation, includeMeals,
      accommodationCost, mealCost, transportCost, transportPrice, transportProfit,
      carCostTotal, carPriceTotal, guideCost, guidePrice, luggageCost,
      selectedTickets, ticketCost, ticketPrice, ticketYourProfit, ticketPartnerProfit,
      thaiDressCost, thaiDressPrice, thaiDressYourProfit, thaiDressPartnerProfit,
      insuranceCost, totalCost, totalPrice, yourTotalProfit, partnerTotalProfit,
      perPersonTHB, perPersonTWD, exchangeRate,
      dailyCarFees,
    }
  }, [config, people, exchangeRate, roomDouble, roomTriple, roomFamily, priceDouble, priceTriple, priceFamily, mealLevel, tickets, thaiDressCloth, thaiDressPhoto, makeupCount, luggageCar, includeAccommodation, includeMeals])

  const fmt = (n: number) => n.toLocaleString()

  const toggleTicket = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t))
  }

  const selectAllTickets = () => {
    setTickets(prev => prev.map(t => ({ ...t, checked: true })))
  }

  const deselectAllTickets = () => {
    setTickets(prev => prev.map(t => ({ ...t, checked: false })))
  }

  const allTicketsSelected = tickets.every(t => t.checked)
  const noTicketsSelected = tickets.every(t => !t.checked)

  const copyTextQuote = () => {
    const c = calculation
    const rooms = []
    if (roomDouble > 0) rooms.push(`雙人房x${roomDouble}`)
    if (roomTriple > 0) rooms.push(`三人房x${roomTriple}`)
    if (roomFamily > 0) rooms.push(`家庭房x${roomFamily}`)
    const mealLabels: Record<number, string> = { 900: '平價', 1200: '精選', 1500: '高級' }

    const text = [
      '🚐 清微旅行｜清邁 6天5夜 親子包車行程',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '📅 行程概覽',
      'D1｜抵達清邁・泰服體驗',
      'D2｜大象保護營・夜間動物園',
      'D3｜清萊一日遊（白廟/藍廟/黑廟）',
      'D4｜泰服拍照・素帖山',
      'D5｜市區購物',
      'D6｜送機回國',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💰 報價明細',
      `👥 人數：${people} 人`,
      `🏨 住宿：${rooms.join('、')}（${c.nights}晚）`,
      `🍜 餐費：${mealLabels[mealLevel] || '標準'}（${c.mealDays}天）`,
      `🚗 包車：${c.carCount} 台 + 中文導遊`,
      '🎫 門票：含',
      '🛡️ 保險：含',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '💵 每人費用',
      `★ NT$ ${fmt(c.perPersonTWD)}`,
      `（約 ${fmt(Math.round(c.perPersonTHB))} 泰銖）`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '💬 LINE 諮詢：@037nyuwk',
      '🌐 chiangway-travel.com',
    ].join('\n')

    navigator.clipboard.writeText(text)
    alert('✅ 已複製報價文字！')
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', maxWidth: 1100, margin: '0 auto', padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ color: '#2d5a3d', marginBottom: 5 }}>🚐 清邁 6天5夜 報價計算器</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>內部工具 v3 — 含車導明細</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('input')} style={{ padding: '10px 20px', background: activeTab === 'input' ? '#2d5a3d' : '#ddd', color: activeTab === 'input' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📝 輸入</button>
        <button onClick={() => setActiveTab('internal')} style={{ padding: '10px 20px', background: activeTab === 'internal' ? '#2d5a3d' : '#ddd', color: activeTab === 'internal' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📊 內部明細</button>
        <button onClick={() => setActiveTab('external')} style={{ padding: '10px 20px', background: activeTab === 'external' ? '#2d5a3d' : '#ddd', color: activeTab === 'external' ? 'white' : 'black', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📄 對外報價單</button>
        <button onClick={() => downloadPDF(calculation, people, exchangeRate, roomDouble, roomTriple, roomFamily, priceDouble, priceTriple, priceFamily, mealLevel, thaiDressCloth, thaiDressPhoto, makeupCount, config)} style={{ padding: '10px 20px', background: '#4a7c59', color: 'white', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📥 下載報價</button>
        <button onClick={copyTextQuote} style={{ padding: '10px 20px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>📋 複製文字</button>
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
            </div>
            {(!includeAccommodation || !includeMeals) && (
              <div style={{ marginTop: 8, padding: 8, background: '#fff3e0', borderRadius: 6, fontSize: 13 }}>
                💡 {!includeAccommodation && '住宿'}{!includeAccommodation && !includeMeals && '、'}{!includeMeals && '餐費'}由客人自理
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
          <Section title={`🏨 住宿（${calculation.nights}晚）`} style={!includeAccommodation ? { opacity: 0.5 } : {}}>
            {!includeAccommodation ? (
              <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, textAlign: 'center', color: '#666' }}>
                客人自理住宿
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <RoomCardEditable name="雙人房" priceValue={priceDouble} onPriceChange={setPriceDouble} countValue={roomDouble} onCountChange={setRoomDouble} capacity={2} />
                  <RoomCardEditable name="三人房" priceValue={priceTriple} onPriceChange={setPriceTriple} countValue={roomTriple} onCountChange={setRoomTriple} capacity={3} />
                  <RoomCardEditable name="家庭房" priceValue={priceFamily} onPriceChange={setPriceFamily} countValue={roomFamily} onCountChange={setRoomFamily} capacity={4} />
                </div>
                {calculation.roomCapacity < people && <div style={warningStyle}>⚠️ 房間不足！需容納 {people} 人，目前只有 {calculation.roomCapacity} 人</div>}
                <p style={{ ...noteStyle, marginTop: 12 }}>房間容納：{calculation.roomCapacity} 人 ｜ 住宿費：{fmt(calculation.accommodationCost)} 泰銖</p>
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
            <div style={{ background: '#e3f2fd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#1565c0', fontSize: 15 }}>
                🚗 {calculation.carCount} 台車：<span style={{ fontFamily: 'monospace' }}>{calculation.carDistribution}</span>
                {calculation.needLuggageCar ? ' + 🧳行李車' : ''}
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#555' }}>
                舒適配車（單車最多 {calculation.maxPerCar} 人）
              </p>
            </div>
            {calculation.luggageStatus === 'ok' ? (
              <div style={{ background: '#e8f5e9', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
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
            <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8, padding: 12, fontSize: 13 }}>
              <strong>⏱️ 超時費規則</strong><br />
              • 清邁行程：10 小時/天<br />
              • 清萊行程：12 小時/天<br />
              • 超時費：200 泰銖/小時
            </div>
          </Section>

          {/* 門票 */}
          <Section title="🎫 門票活動">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <p style={{ ...noteStyle, margin: 0 }}>格式：成本｜★ 表示有退款對分</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={selectAllTickets}
                  disabled={allTicketsSelected}
                  style={{ padding: '6px 12px', background: allTicketsSelected ? '#ccc' : '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: allTicketsSelected ? 'not-allowed' : 'pointer', fontSize: 13 }}
                >
                  ✅ 全選
                </button>
                <button
                  onClick={deselectAllTickets}
                  disabled={noTicketsSelected}
                  style={{ padding: '6px 12px', background: noTicketsSelected ? '#ccc' : '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: noTicketsSelected ? 'not-allowed' : 'pointer', fontSize: 13 }}
                >
                  ❌ 全不選
                </button>
              </div>
            </div>
            {noTicketsSelected && (
              <div style={{ background: '#fff3e0', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                💡 門票由客人現場付給導遊
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
              {tickets.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: t.checked ? '#e8f5e9' : '#f5f5f5', borderRadius: 6, opacity: t.checked ? 1 : 0.7 }}>
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
          <div style={{ background: '#2d5a3d', color: 'white', textAlign: 'center', padding: 24, position: 'sticky', bottom: 0, borderRadius: 12 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>每人報價（台幣）</div>
            <div style={{ fontSize: 36, fontWeight: 'bold' }}>NT$ {fmt(calculation.perPersonTWD)}</div>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 12 }}>
              總計 {fmt(calculation.totalPrice)} 泰銖 ÷ {people}人 ÷ {exchangeRate}
            </p>
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
              <SectionRow title={`🏨 住宿 (${calculation.nights}晚)`} />
              <DataRow name="住宿費" cost={calculation.accommodationCost} price={calculation.accommodationCost} profit={0} />

              <SectionRow title={`🍜 餐費 (${calculation.mealDays}天)`} />
              <DataRow name={`餐費 (${mealLevel}/人/天)`} cost={calculation.mealCost} price={calculation.mealCost} profit={0} />

              <SectionRow title={`🚗 車費明細 (${calculation.carCount}台)`} />
              {calculation.dailyCarFees.map((d: any, i: number) => (
                <DataRow key={i} name={`${d.day} ${d.name}`} cost={d.cost * calculation.carCount} price={d.price * calculation.carCount} profit={(d.price - d.cost) * calculation.carCount} className="day-row" />
              ))}
              <SubtotalRow name="車費小計" cost={calculation.carCostTotal} price={calculation.carPriceTotal} profit={calculation.carPriceTotal - calculation.carCostTotal} />

              <SectionRow title="👤 導遊" />
              <DataRow name={`導遊 (${calculation.guideDays}天)`} cost={calculation.guideCost} price={calculation.guidePrice} profit={calculation.guidePrice - calculation.guideCost} />
              {calculation.needLuggageCar && <DataRow name="行李車 (2趟)" cost={0} price={calculation.luggageCost} profit={calculation.luggageCost} />}
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
                <td style={{ ...tdStyle, color: '#2d5a3d', fontWeight: 'bold' }}>{fmt(calculation.ticketYourProfit)}</td>
              </tr>
              <tr style={{ background: '#fff3cd' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>　→ 郭姐利潤（退款½）</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, color: '#2d5a3d', fontWeight: 'bold' }}>{fmt(calculation.ticketPartnerProfit)}</td>
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
                <td style={{ ...tdStyle, color: '#2d5a3d', fontWeight: 'bold' }}>{fmt(calculation.yourTotalProfit)}</td>
              </tr>
              <tr style={{ background: '#fff3cd' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>🤝 郭姐利潤（門票½）</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, color: '#2d5a3d', fontWeight: 'bold' }}>{fmt(calculation.partnerTotalProfit)}</td>
              </tr>
              <tr style={{ background: '#fff3cd' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>💵 付給郭姐（成本）</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(calculation.transportCost + calculation.ticketCost + calculation.mealCost + calculation.thaiDressCost)}</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
              </tr>

              <SectionRow title="🏷️ 每人報價" />
              <tr style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>每人報價</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}>{fmt(Math.round(calculation.perPersonTHB))} 泰銖</td>
                <td style={{ ...tdStyle, color: '#2d5a3d', fontWeight: 'bold' }}>NT$ {fmt(calculation.perPersonTWD)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* External Tab */}
      {activeTab === 'external' && (
        <div style={{ background: 'white', border: '2px solid #2d5a3d', borderRadius: 12, padding: 24, maxWidth: 600, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #2d5a3d, #4a7c59)', color: 'white', borderRadius: '12px 12px 0 0', margin: '-24px -24px 20px -24px', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚐</div>
            <h2 style={{ margin: 0, fontSize: 24 }}>清微旅行 Chiangway Travel</h2>
            <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: 14 }}>台灣爸爸 × 泰國媽媽｜清邁在地親子包車</p>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 'bold' }}>清邁 6天5夜 親子包車行程</div>
          </div>

          {/* Itinerary */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#2d5a3d', fontSize: 16, borderBottom: '2px solid #2d5a3d', paddingBottom: 8 }}>📅 行程概覽</h3>
            {ITINERARY.map((day, i) => (
              <div key={i} style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: '4px solid #2d5a3d' }}>
                <div style={{ fontWeight: 'bold', color: '#2d5a3d', marginBottom: 6 }}>{day.day}｜{day.title}</div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{day.items.join('　')}</div>
                {day.hotel && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>🏨 {day.hotel}</div>}
              </div>
            ))}
          </div>

          {/* Price */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#2d5a3d', fontSize: 16, borderBottom: '2px solid #2d5a3d', paddingBottom: 8 }}>💰 報價明細</h3>
            <QuoteItem label="👥 人數" value={`${people} 人`} />
            {includeAccommodation && (
              <QuoteItem label="🏨 住宿" value={`${roomDouble > 0 ? `雙人房x${roomDouble}` : ''}${roomTriple > 0 ? ` 三人房x${roomTriple}` : ''}${roomFamily > 0 ? ` 家庭房x${roomFamily}` : ''}（${calculation.nights}晚）`} />
            )}
            {includeMeals && (
              <QuoteItem label="🍜 餐費" value={`${mealLevel === 900 ? '平價' : mealLevel === 1200 ? '精選' : '高級'}（${calculation.mealDays}天午晚餐）`} />
            )}
            <QuoteItem label="🚗 包車" value={`D1接機旅遊 + ${calculation.guideDays - 1}天包車 + D6送機｜中文導遊1位`} />
            <QuoteItem label="🎫 門票" value={calculation.selectedTickets.length > 0 ? `${calculation.selectedTickets.length} 項活動（含）` : '現場付費'} />
            <QuoteItem label="🛡️ 保險" value="含" />
          </div>

          {/* Total */}
          <div style={{ background: 'linear-gradient(135deg, #2d5a3d, #4a7c59)', color: 'white', padding: 20, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>每人費用</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', margin: '8px 0' }}>NT$ {fmt(calculation.perPersonTWD)}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>約 {fmt(Math.round(calculation.perPersonTHB))} 泰銖</div>
          </div>

          {/* Includes */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', color: '#2d5a3d', marginBottom: 8 }}>✅ 費用包含</div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                {includeAccommodation && `• ${calculation.nights}晚住宿`}{includeAccommodation && <br />}
                {includeMeals && `• ${calculation.mealDays}天午晚餐`}{includeMeals && <br />}
                • D1接機旅遊 + {calculation.guideDays - 1}天包車 + D6送機<br />
                • 中文導遊1位（{calculation.guideDays}天）<br />
                {calculation.selectedTickets.length > 0 && `• 門票活動（${calculation.selectedTickets.length}項）`}{calculation.selectedTickets.length > 0 && <br />}
                • 旅遊保險
              </div>
            </div>
            <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8 }}>
              <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: 8 }}>❌ 費用不含</div>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
                • 來回機票<br />
                {!includeAccommodation && '• 住宿'}{!includeAccommodation && <br />}
                {!includeMeals && '• 餐費'}{!includeMeals && <br />}
                {calculation.selectedTickets.length === 0 && '• 門票（現場付費）'}{calculation.selectedTickets.length === 0 && <br />}
                • 個人消費<br />
                • 按摩 SPA<br />
                • 超時費用
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
      <h2 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#333', borderBottom: '2px solid #2d5a3d', paddingBottom: 8 }}>{title}</h2>
      {children}
    </div>
  )
}

function Row({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap', ...style }}>{children}</div>
}

function RoomCard({ name, price, value, onChange, note }: { name: string; price: string; value: number; onChange: (v: number) => void; note: string }) {
  return (
    <div style={{ border: '2px solid #ddd', borderRadius: 8, padding: 12, textAlign: 'center' }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{name}</div>
      <div style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>{price}</div>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={0} max={10} style={{ width: 60, textAlign: 'center', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{note}</div>
    </div>
  )
}

function RoomCardEditable({ name, priceValue, onPriceChange, countValue, onCountChange, capacity }: {
  name: string;
  priceValue: number;
  onPriceChange: (v: number) => void;
  countValue: number;
  onCountChange: (v: number) => void;
  capacity: number;
}) {
  return (
    <div style={{ border: '2px solid #ddd', borderRadius: 8, padding: 12, textAlign: 'center' }}>
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{name}</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: '#666' }}>單價/晚</label>
        <input
          type="number"
          value={priceValue}
          onChange={e => onPriceChange(Number(e.target.value))}
          min={0}
          step={100}
          style={{ width: 80, textAlign: 'center', padding: 6, border: '1px solid #ddd', borderRadius: 6, marginLeft: 4 }}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <label style={{ fontSize: 12, color: '#666' }}>數量</label>
        <input
          type="number"
          value={countValue}
          onChange={e => onCountChange(Number(e.target.value))}
          min={0}
          max={10}
          style={{ width: 60, textAlign: 'center', padding: 6, border: '1px solid #ddd', borderRadius: 6, marginLeft: 4 }}
        />
      </div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>容納 {capacity} 人</div>
    </div>
  )
}

function SectionRow({ title }: { title: string }) {
  return <tr><td colSpan={4} style={{ background: '#2d5a3d', color: 'white', padding: 8, fontWeight: 'bold', textAlign: 'left' }}>{title}</td></tr>
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
    <tr style={{ background: '#e8f5e9', fontWeight: 'bold' }}>
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
      <td colSpan={4} style={{ textAlign: 'left', color: '#666', fontSize: 12, background: '#f9f9f9', padding: 8, border: '1px solid #ddd' }}>{text}</td>
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
