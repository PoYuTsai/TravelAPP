# 報價計算器大改版

**日期**: 2026-03-12
**狀態**: ✅ 完成

## 改版目標

1. 門票管理 GUI 化
2. 人數拆分成人/小孩
3. 住宿留空 Bug 修復
4. 刪除 Sanity 活動資料庫

---

## 完成項目

### 1. 門票管理 GUI 化

**localStorage 儲存**
- Key: `chiangway-pricing-tickets-v1`
- 自動儲存，無需手動點擊

**UI 變更**
- 「💾 全域門票設定」面板（綠色邊框）
- 表格編輯：名稱、成人價、兒童價、退佣、對分、刪除
- 「➕ 新增門票」「🔄 重置預設」按鈕

**價格修正**
| 門票 | 舊價 | 新價 |
|------|------|------|
| 鳳凰冒險公園 | 1500 | 90 |
| 天使瀑布 | 100 | 80 |

### 2. 人數拆分成人/小孩

**State 變更**
```typescript
// 舊
const [people, setPeople] = useState(10)

// 新
const [adults, setAdults] = useState(8)
const [children, setChildren] = useState(2)
const people = adults + children  // 計算屬性
```

**計算邏輯**
- 門票費用：成人票數 × 成人價 + 兒童票數 × 兒童價
- 每人報價：**總價 ÷ 成人數**（小孩不計入）
- 配車：總人數（成人 + 小孩都佔座位）

**UI 顯示**
- 輸入區：成人 [8] 人　小孩 [2] 人（12歲以下）共 10 人
- 報價單：👥 8 成人 + 2 小孩

### 3. 門票成人/兒童獨立輸入

**勾選門票後展開**
```
[✓] 夜間動物園 ★
    成人 [5] × [1200] = 6,000  ← 可覆寫價格
    兒童 [3] × [800]  = 2,400
    小計: 8,400
```

**區分全域 vs 當前報價**
- 全域設定（綠色）：儲存到 localStorage，新行程會用
- 當前報價（橘色）：只影響這份報價

### 4. 住宿留空 Bug 修復

**問題**
取消勾選「含住宿」但飯店仍有預設值時，內部明細還是顯示飯店

**修復**
- 對外報價行程預覽：加入 `includeAccommodation` 檢查
- 內部明細：用 `{includeAccommodation && ...}` 包裝

### 5. 刪除 Sanity 活動資料庫

**刪除檔案**
- `src/sanity/schemas/activity.ts`

**更新檔案**
- `src/sanity/schemas/index.ts` - 移除 activity
- `src/sanity/structure.ts` - 移除「活動資料庫」選單
- `PricingCalculator.tsx` - 移除 `useClient`、`client.fetch`

**匹配邏輯調整**
```typescript
// 舊：mergeActivitiesForMatching(dbActivities)
// 新：getActivitiesForMatching()  // 直接用 localStorage 或 DEFAULT_TICKETS
```

---

## Commits

| Hash | 說明 |
|------|------|
| `29e7744` | fix: 門票明細正確綁定覆寫值 + 清楚區分全域/當前報價 |
| `6599bc4` | feat: 門票成人/兒童票數+價格獨立輸入 |
| `1d9ff46` | feat: 報價計算器大改版 - 門票管理 + 成人/小孩 + Bug修復 |

---

## 測試方式

1. 打開報價計算器
2. **全域設定**：點「⚙️ 管理門票」→ 修改價格 → 重新載入頁面確認儲存
3. **成人/小孩**：輸入 5 成人 + 3 小孩 → 確認每人報價只除以 5
4. **當前報價覆寫**：勾選門票 → 改價格 → 確認只影響這份報價
5. **住宿 Bug**：取消勾選「含住宿」→ 確認明細不顯示飯店
