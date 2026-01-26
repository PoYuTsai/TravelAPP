// src/lib/accounting/calculator.ts

import type { AccountingFormData, AccountingResult, TransferRecord, OrderCost } from './types'

const THRESHOLD = 400000 // 40萬泰銖

/**
 * 計算兩個日期之間的天數
 */
function daysBetween(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = endDate.getTime() - startDate.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

/**
 * 計算記帳結果
 */
export function calculateAccounting(
  form: AccountingFormData,
  orders: OrderCost[]
): AccountingResult {
  const { startDate, endDate, startBalance, endBalance, transfers } = form

  // 計算入金總額
  const totalTransferTwd = transfers.reduce((sum, t) => sum + t.twdAmount, 0)
  const totalTransferThb = transfers.reduce((sum, t) => sum + t.thbAmount, 0)

  // 計算平均匯率
  const avgExchangeRate = totalTransferTwd > 0
    ? totalTransferThb / totalTransferTwd
    : 0

  // 計算總支出
  // 公式：總支出 = 起始餘額 + 入金 - 結束餘額
  const totalExpense = startBalance + totalTransferThb - endBalance

  // 計算業務成本（從 Notion）
  const businessCost = orders.reduce((sum, o) => sum + o.costValue, 0)

  // 計算生活開銷
  const livingExpense = totalExpense - businessCost

  // 計算天數和日均支出
  const daysCount = daysBetween(startDate, endDate)
  const dailyExpense = daysCount > 0 ? Math.round(totalExpense / daysCount) : 0

  // 40萬門檻判斷
  const thresholdRemaining = endBalance - THRESHOLD
  let thresholdStatus: 'safe' | 'warning' | 'danger' = 'safe'
  if (thresholdRemaining < 0) {
    thresholdStatus = 'danger'
  } else if (thresholdRemaining < 50000) {
    thresholdStatus = 'warning'
  }

  // 是否有不確定的成本
  const hasUncertainCosts = orders.some(o => !o.confident)

  return {
    startDate,
    endDate,
    startBalance,
    endBalance,
    transfers,
    totalTransferTwd,
    totalTransferThb,
    avgExchangeRate,
    totalExpense,
    businessCost,
    livingExpense,
    dailyExpense,
    daysCount,
    thresholdStatus,
    thresholdRemaining,
    orders,
    hasUncertainCosts,
    calculatedAt: new Date().toISOString(),
  }
}

/**
 * 驗證表單資料
 */
export function validateForm(form: AccountingFormData): string[] {
  const errors: string[] = []

  const { startDate, endDate, startBalance, endBalance, transfers } = form

  // 日期驗證
  if (!startDate) {
    errors.push('請選擇起始日期')
  }
  if (!endDate) {
    errors.push('請選擇結束日期')
  }
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    const minDate = new Date('2025-01-01')

    if (start >= end) {
      errors.push('起始日期必須早於結束日期')
    }
    if (end > today) {
      errors.push('結束日期不能是未來日期')
    }
    if (start < minDate) {
      errors.push('起始日期不能早於 2025/01/01')
    }
  }

  // 餘額驗證
  if (startBalance < 0) {
    errors.push('起始餘額不能為負數')
  }
  if (endBalance < 0) {
    errors.push('結束餘額不能為負數')
  }

  // 入金記錄驗證
  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i]
    if (!t.date) {
      errors.push(`入金記錄 ${i + 1}：請選擇日期`)
    } else if (startDate && endDate) {
      const transferDate = new Date(t.date)
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (transferDate < start || transferDate > end) {
        errors.push(`入金記錄 ${i + 1}：日期必須在查詢區間內`)
      }
    }
    if (t.twdAmount <= 0) {
      errors.push(`入金記錄 ${i + 1}：台幣金額必須大於 0`)
    }
    if (t.thbAmount <= 0) {
      errors.push(`入金記錄 ${i + 1}：泰銖到帳必須大於 0`)
    }
  }

  return errors
}

/**
 * 產生唯一 ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * 建立空的入金記錄
 */
export function createEmptyTransfer(): TransferRecord {
  return {
    id: generateId(),
    date: '',
    twdAmount: 0,
    thbAmount: 0,
    exchangeRate: 0,
  }
}

/**
 * 格式化金額
 */
export function formatCurrency(amount: number, currency: 'THB' | 'TWD' = 'THB'): string {
  const symbol = currency === 'THB' ? '฿' : 'NT$'
  return `${symbol}${amount.toLocaleString('zh-TW')}`
}

/**
 * 格式化匯率
 */
export function formatRate(rate: number): string {
  return rate.toFixed(4)
}
