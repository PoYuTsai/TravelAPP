// src/sanity/tools/accounting/AccountingTool.tsx

import React, { useState, useCallback } from 'react'
import type { AccountingFormData, AccountingResult, TransferRecord, OrderCost } from '@/lib/accounting'
import {
  calculateAccounting,
  validateForm,
  createEmptyTransfer,
  formatCurrency,
  formatRate,
} from '@/lib/accounting'
import { canAccessStudioTool } from '@/sanity/studio-access'
import { useSessionToken } from '../../hooks/useSessionToken'
import './styles.css'

export function AccountingTool() {
  const { email, getAuthHeaders, isAuthenticated, isLoading: authLoading, error: authError } = useSessionToken()

  // 認證狀態決定存取權限
  const hasAccess = Boolean(email) && canAccessStudioTool('accounting', email) && isAuthenticated()

  // 表單狀態
  const [form, setForm] = useState<AccountingFormData>({
    startDate: '',
    endDate: '',
    startBalance: 0,
    endBalance: 0,
    transfers: [],
  })

  // UI 狀態
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<AccountingResult | null>(null)

  // 更新表單欄位
  const updateField = (field: keyof AccountingFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors([])
  }

  // 新增入金記錄
  const addTransfer = () => {
    setForm(prev => ({
      ...prev,
      transfers: [...prev.transfers, createEmptyTransfer()],
    }))
  }

  // 更新入金記錄
  const updateTransfer = (id: string, field: keyof TransferRecord, value: any) => {
    setForm(prev => ({
      ...prev,
      transfers: prev.transfers.map(t => {
        if (t.id === id) {
          const updated = { ...t, [field]: value }
          // 自動計算匯率
          if (updated.twdAmount > 0 && updated.thbAmount > 0) {
            updated.exchangeRate = updated.thbAmount / updated.twdAmount
          }
          return updated
        }
        return t
      }),
    }))
  }

  // 刪除入金記錄
  const deleteTransfer = (id: string) => {
    setForm(prev => ({
      ...prev,
      transfers: prev.transfers.filter(t => t.id !== id),
    }))
  }

  // 計算
  const handleCalculate = useCallback(async () => {
    // 驗證表單
    const validationErrors = validateForm(form)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)
    setErrors([])

    try {
      // 呼叫 API 取得 Notion 成本資料
      const response = await fetch('/api/accounting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '無法取得資料')
      }

      const data = await response.json()
      const orders: OrderCost[] = data.orders

      // 計算結果
      const calculationResult = calculateAccounting(form, orders)
      setResult(calculationResult)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : '發生錯誤'])
    } finally {
      setLoading(false)
    }
  }, [form, getAuthHeaders])

  // 權限檢查
  if (authLoading) {
    return (
      <div className="accounting-container">
        <div className="loading">驗證中...</div>
      </div>
    )
  }

  if (authError || !hasAccess) {
    return (
      <div className="accounting-container">
        <div className="access-denied">
          <h2>🔒 無權限存取</h2>
          <p>此記帳系統僅限授權人員使用。</p>
          <p className="email-info">目前登入：{email || '未知'}</p>
          {authError && <p className="error-info">錯誤：{authError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="accounting-container">
      <div className="accounting-header">
        <h1>💰 個人記帳</h1>
      </div>

      {/* 期間設定 */}
      <div className="form-section">
        <h2>📅 期間設定</h2>
        <div className="form-row">
          <div className="form-group">
            <label>起始日期</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => updateField('startDate', e.target.value)}
              min="2025-01-01"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="form-group">
            <label>結束日期</label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => updateField('endDate', e.target.value)}
              min="2025-01-01"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {/* 帳戶餘額 */}
      <div className="form-section">
        <h2>💳 帳戶餘額</h2>
        <div className="form-row">
          <div className="form-group">
            <label>起始餘額（泰銖）</label>
            <input
              type="number"
              value={form.startBalance || ''}
              onChange={e => updateField('startBalance', Number(e.target.value))}
              placeholder="例：745668"
              min="0"
            />
          </div>
          <div className="form-group">
            <label>結束餘額（泰銖）</label>
            <input
              type="number"
              value={form.endBalance || ''}
              onChange={e => updateField('endBalance', Number(e.target.value))}
              placeholder="例：500000"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* 入金記錄 */}
      <div className="transfer-section">
        <div className="transfer-header">
          <h2>💵 期間入金（選填）</h2>
          <button className="add-transfer-btn" onClick={addTransfer}>
            + 新增入金
          </button>
        </div>

        {form.transfers.length === 0 ? (
          <div className="no-transfers">
            尚無入金記錄。如果期間有從台灣轉帳到泰國，請點「新增入金」。
          </div>
        ) : (
          <div className="transfer-list">
            {form.transfers.map(transfer => (
              <div key={transfer.id} className="transfer-item">
                <div className="form-group">
                  <label>日期</label>
                  <input
                    type="date"
                    value={transfer.date}
                    onChange={e => updateTransfer(transfer.id, 'date', e.target.value)}
                    min={form.startDate || '2025-01-01'}
                    max={form.endDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label>台幣金額</label>
                  <input
                    type="number"
                    value={transfer.twdAmount || ''}
                    onChange={e => updateTransfer(transfer.id, 'twdAmount', Number(e.target.value))}
                    placeholder="350000"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>泰銖到帳</label>
                  <input
                    type="number"
                    value={transfer.thbAmount || ''}
                    onChange={e => updateTransfer(transfer.id, 'thbAmount', Number(e.target.value))}
                    placeholder="346511"
                    min="0"
                  />
                </div>
                <div className="exchange-rate">
                  <span className="rate-value">
                    {transfer.exchangeRate > 0 ? formatRate(transfer.exchangeRate) : '-'}
                  </span>
                  <span className="rate-label">實際匯率</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => deleteTransfer(transfer.id)}
                  title="刪除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 計算按鈕 */}
      <div className="calculate-section">
        {errors.length > 0 && (
          <div className="validation-errors">
            <h3>⚠️ 請修正以下問題</h3>
            <ul>
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="calculate-btn"
          onClick={handleCalculate}
          disabled={loading}
        >
          {loading ? '計算中...' : '📊 計算支出'}
        </button>
      </div>

      {/* 計算結果 */}
      {result && (
        <div className="results-section">
          <h2>📊 計算結果</h2>

          {result.hasUncertainCosts && (
            <div className="notice-banner">
              ⚠️ 部分業務成本為自動解析，建議核對 Notion 原始資料
            </div>
          )}

          <div className="results-grid">
            <div className="result-card">
              <div className="label">期間總支出</div>
              <div className="value expense">{formatCurrency(result.totalExpense)}</div>
              <div className="subtext">{result.daysCount} 天</div>
            </div>

            <div className="result-card">
              <div className="label">業務成本（Notion）</div>
              <div className="value">{formatCurrency(result.businessCost)}</div>
              <div className="subtext">{result.orders.length} 筆訂單</div>
            </div>

            <div className="result-card">
              <div className="label">生活開銷</div>
              <div className="value expense">{formatCurrency(result.livingExpense)}</div>
              <div className="subtext">總支出 - 業務成本</div>
            </div>

            <div className="result-card">
              <div className="label">日均支出</div>
              <div className="value">{formatCurrency(result.dailyExpense)}</div>
              <div className="subtext">每日平均</div>
            </div>

            {result.totalTransferThb > 0 && (
              <>
                <div className="result-card">
                  <div className="label">期間入金（台幣）</div>
                  <div className="value income">{formatCurrency(result.totalTransferTwd, 'TWD')}</div>
                </div>

                <div className="result-card">
                  <div className="label">期間入金（泰銖）</div>
                  <div className="value income">{formatCurrency(result.totalTransferThb)}</div>
                  <div className="subtext">平均匯率 {formatRate(result.avgExchangeRate)}</div>
                </div>
              </>
            )}

            <div className="result-card threshold-card">
              <div className={`threshold-status ${result.thresholdStatus}`}>
                <div className="icon">
                  {result.thresholdStatus === 'safe' && '✅'}
                  {result.thresholdStatus === 'warning' && '⚠️'}
                  {result.thresholdStatus === 'danger' && '🚨'}
                </div>
                <div className="text">
                  <div className="status-label">
                    {result.thresholdStatus === 'safe' && '40萬門檻：安全'}
                    {result.thresholdStatus === 'warning' && '40萬門檻：注意'}
                    {result.thresholdStatus === 'danger' && '40萬門檻：警告'}
                  </div>
                  <div className="status-detail">
                    結束餘額 {formatCurrency(result.endBalance)}，
                    {result.thresholdRemaining >= 0
                      ? `距門檻還有 ${formatCurrency(result.thresholdRemaining)}`
                      : `低於門檻 ${formatCurrency(Math.abs(result.thresholdRemaining))}`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 訂單明細 */}
          {result.orders.length > 0 && (
            <div className="orders-section">
              <h3>📋 期間業務成本明細</h3>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>客戶</th>
                    <th>日期</th>
                    <th>成本</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orders.map(order => (
                    <tr key={order.id}>
                      <td>{order.customerName || '(無名稱)'}</td>
                      <td>{order.travelDate}</td>
                      <td>
                        <span className="cost">{formatCurrency(order.costValue)}</span>
                        {!order.confident && <span className="uncertain">⚠️</span>}
                        {order.warning && (
                          <span className="warning-text">{order.warning}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
