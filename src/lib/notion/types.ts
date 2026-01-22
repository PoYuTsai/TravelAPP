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

export interface DashboardData {
  monthlyProfit: number
  monthlyOrderCount: number
  pendingPayment: number
  pendingPaymentCount: number
  pendingOrders: NotionOrder[]
  monthlyTrend: Array<{
    month: string
    profit: number
    count: number
  }>
  lastUpdated: string
  hasUncertainValues: boolean
}
