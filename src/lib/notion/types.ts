// src/lib/notion/types.ts

export interface NotionOrder {
  id: string
  customerName: string
  travelDate: {
    start: string
    end: string | null
  } | null
  travelers: string
  profit: {
    raw: string
    value: number
    confident: boolean
  }
  revenue: {
    raw: string
    value: number
    confident: boolean
  }
  paymentStatus: '已付尾款' | '未付款' | '未開始' | string
  updateStatus: '完成' | '未開始' | string
}

export interface MonthlyStats {
  month: string
  profit: number
  count: number
}

export interface YearComparison {
  currentYear: number
  currentYearProfit: number
  currentYearCount: number
  lastYear: number
  lastYearProfit: number
  lastYearCount: number
  growthPercent: number | null
}

export interface DashboardData {
  // 選擇的年月
  selectedYear: number
  selectedMonth: number
  // 當月數據
  monthlyProfit: number
  monthlyOrderCount: number
  hasUncertainValues: boolean
  // 待收款（全部）
  pendingPayment: number
  pendingPaymentCount: number
  pendingOrders: NotionOrder[]
  // 年度比較（累計到選擇月份）
  yearComparison: YearComparison
  // 年度月趨勢（選擇年的 12 個月）
  yearlyTrend: MonthlyStats[]
  // 可用年份列表
  availableYears: number[]
  // 更新時間
  lastUpdated: string
}

export interface DashboardQuery {
  year?: number
  month?: number
}
