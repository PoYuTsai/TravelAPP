// src/lib/accounting/types.ts

/**
 * 入金記錄
 */
export interface TransferRecord {
  id: string
  date: string          // YYYY-MM-DD
  twdAmount: number     // 台幣金額
  thbAmount: number     // 泰銖到帳
  exchangeRate: number  // 實際匯率（自動計算）
  note?: string         // 備註
}

/**
 * 記帳查詢參數
 */
export interface AccountingQuery {
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
}

/**
 * Notion 訂單成本
 */
export interface OrderCost {
  id: string
  customerName: string
  travelDate: string
  costRaw: string       // 原始文字
  costValue: number     // 解析後的值
  confident: boolean    // 是否確定
  warning?: string      // 警告訊息
}

/**
 * 記帳計算結果
 */
export interface AccountingResult {
  // 輸入資料
  startDate: string
  endDate: string
  startBalance: number
  endBalance: number
  transfers: TransferRecord[]

  // 計算結果
  totalTransferTwd: number      // 總入金（台幣）
  totalTransferThb: number      // 總入金（泰銖）
  avgExchangeRate: number       // 平均匯率
  totalExpense: number          // 總支出（泰銖）
  businessCost: number          // 業務成本（泰銖）
  livingExpense: number         // 生活開銷（泰銖）
  dailyExpense: number          // 日均支出
  daysCount: number             // 天數

  // 40萬門檻
  thresholdStatus: 'safe' | 'warning' | 'danger'
  thresholdRemaining: number    // 距離門檻餘額

  // Notion 資料
  orders: OrderCost[]
  hasUncertainCosts: boolean

  // 時間戳
  calculatedAt: string
}

/**
 * 記帳輸入表單
 */
export interface AccountingFormData {
  startDate: string
  endDate: string
  startBalance: number
  endBalance: number
  transfers: TransferRecord[]
}

/**
 * 驗證錯誤
 */
export interface ValidationError {
  field: string
  message: string
}
