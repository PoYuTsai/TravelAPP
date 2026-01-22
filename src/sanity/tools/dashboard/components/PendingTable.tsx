// src/sanity/tools/dashboard/components/PendingTable.tsx

import React from 'react'
import type { NotionOrder } from '@/lib/notion/types'

interface PendingTableProps {
  orders: NotionOrder[]
}

export function PendingTable({ orders }: PendingTableProps) {
  if (orders.length === 0) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <span className="card-title">待收款清單</span>
          <span className="success-badge">✓ 全部已收</span>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <span className="card-title">待收款清單</span>
        <span className="warning-badge">⚠️ {orders.length} 筆未收</span>
      </div>
      <table className="pending-table">
        <thead>
          <tr>
            <th>客戶</th>
            <th>日期</th>
            <th>金額</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.customerName}</td>
              <td>{order.travelDate?.start || '-'}</td>
              <td className="amount">
                {new Intl.NumberFormat('zh-TW', {
                  style: 'currency',
                  currency: 'TWD',
                  minimumFractionDigits: 0,
                }).format(order.profit.value)}
                {!order.profit.confident && <span className="uncertain">⚠️</span>}
              </td>
              <td>
                <span className="status-pending">未付款</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
