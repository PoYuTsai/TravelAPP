# Dashboard 功能完成報告

**日期:** 2026-01-22
**狀態:** ✅ 完成並部署到 Production

---

## 功能總覽

在 Sanity Studio 建立財務監控 Dashboard，連接 Notion 資料庫顯示業務數據。

### 已完成功能

1. **年月切換**
   - 支援 2025 / 2026 年份切換
   - 12 個月份選擇

2. **統計卡片**
   - 當月利潤與訂單數
   - 待收款項與未收筆數（含警告提示）

3. **年度比較**
   - 今年 vs 去年同期累計
   - 成長率計算與顯示

4. **年度趨勢圖**
   - 12 個月利潤柱狀圖
   - 全年累計統計

5. **待收款清單**
   - 顯示所有未付款訂單
   - 客戶名稱、日期、金額

---

## 技術實作

### 資料庫連接

```typescript
// 資料庫 ID 對應表
const DATABASE_IDS: Record<number, string> = {
  2025: '15c37493475d80a5aa89ef025244dc7b',
  2026: '26037493475d80baa727dd3323f2aad8',
}
```

### 重要修復：Notion SDK v5 Bug

**問題:** Notion SDK v5 的 `dataSources.query` API 無法正常運作，即使權限正確也回傳 404。

**解決:** 改用標準 Notion REST API 直接呼叫：

```typescript
async function queryNotionDatabase(databaseId: string, startCursor?: string) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ page_size: 100, ... }),
  })
  return response.json()
}
```

---

## 檔案結構

```
src/
├── lib/notion/
│   ├── client.ts          # Notion API 連接（使用 REST API）
│   ├── types.ts           # 型別定義
│   └── profit-parser.ts   # 利潤文字解析
├── app/api/dashboard/
│   └── route.ts           # Dashboard API 端點
└── sanity/tools/dashboard/
    ├── index.tsx          # Tool 定義
    ├── DashboardTool.tsx  # 主元件
    ├── styles.css         # 樣式
    └── components/
        ├── StatCard.tsx
        ├── PendingTable.tsx
        ├── YearMonthSelector.tsx
        ├── YearComparison.tsx
        └── YearlyTrendChart.tsx
```

---

## 環境變數

Production (Vercel) 需要設定：

| 變數 | 說明 |
|------|------|
| `NOTION_TOKEN` | Notion Integration Token |

---

## 相關 Commits

```
c8e85c0 fix: use Notion REST API instead of SDK v5 dataSources
955de76 feat: Dashboard 支援雙資料庫、年月切換、年度比較
```

---

## 截圖

Dashboard 顯示：
- 2026 年 1-4 月累計：$195,235（31 筆訂單）
- 2025 年同期：$45,450（18 筆訂單）
- 成長率：330%
- 待收款：$92,500（19 筆）

---

## 後續可優化

- [ ] 匯出報表功能（Excel/PDF）
- [ ] 更多篩選條件（支付狀態、負責人）
- [ ] 利潤趨勢預測
- [ ] 客戶分析圖表
