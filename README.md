# 清微旅行 Chiangway Travel

清邁親子自由行包車服務官方網站 + 內部營運系統

## 專案資訊

- **品牌**: 清微旅行 Chiangway Travel
- **網站**: https://chiangway-travel.com
- **服務**: 清邁親子包車、客製旅遊、中文導遊
- **技術架構**: Next.js 14 + Sanity CMS + Tailwind CSS

## 開發狀態

| Phase | 名稱 | 狀態 |
|-------|------|------|
| Phase 1 | 官網 + Landing Page | ✅ 完成 |
| Phase 2 | SEO 優化 + 部落格 | ✅ 完成 |
| Phase 3 | 內部營運工具 | ✅ 完成 |

### Phase 1：官網
- 響應式 Landing Page
- LINE CTA 整合
- GA4 + Google Ads 追蹤

### Phase 2：SEO 優化
- 部落格系統
- SEO 文章內容策略
- 結構化資料

### Phase 3：內部營運工具
- **客戶行程表系統**：快速建立、結構化編輯、PDF/Excel/文字匯出
- **財務 Dashboard**：Notion 資料視覺化、年度比較、趨勢圖
- **Google Ads 轉換追蹤**：頁面瀏覽、LINE 點擊事件

## 技術架構

```
├── 前端：Next.js 14 (App Router)
├── CMS：Sanity Studio v3
├── 樣式：Tailwind CSS
├── 資料來源：Sanity + Notion API
├── 部署：Vercel
└── 追蹤：GA4 + Google Ads
```

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置
npm run build

# 測試
npm run test
```

## 環境變數

```env
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=
SANITY_API_TOKEN=

# Notion (Dashboard)
NOTION_TOKEN=
```

## 相關連結

- [官網](https://chiangway-travel.com)
- [LINE](https://line.me/R/ti/p/@037nyuwk)
- [Instagram](https://www.instagram.com/chiangway_travel)
- [Facebook](https://www.facebook.com/profile.php?id=61569067776768)

---

*Developed with Claude Code*
