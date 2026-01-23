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
| Phase 4 | 客戶體驗優化 | ✅ 完成 |
| Phase 5 | 綜合審查優化 | ✅ 完成 |

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

### Phase 4：客戶體驗優化
- **行程頁面**：豐富行程展示、照片輪播、FAQ
- **民宿頁面**：民宿介紹、設施列表、預約引導
- **包車介紹**：車型介紹、價格透明化、服務流程
- **About Us**：品牌故事、團隊介紹、移民緣由

### Phase 5：綜合審查優化
10 角度專業審查並實施改進：

- **安全性**：API 安全 headers、CORS 配置
- **效能優化**：Notion 快取機制（5 分鐘 TTL）、Loading Skeletons
- **SEO 強化**：Blog 搜尋功能、分類頁面 SEO URLs、相關文章推薦、內部連結優化
- **開發者體驗**：OpenAPI/Swagger 文件、集中式 Logger
- **UX 改善**：404 頁面優化、動態家庭數量顯示
- **iOS 相容性**：Safari 觸控事件、CSS 動畫優化
- **品牌一致性**：Footer 分類連結、協作開發署名

## 技術架構

```
├── 前端：Next.js 14 (App Router)
├── CMS：Sanity Studio v3
├── 樣式：Tailwind CSS
├── 資料來源：Sanity + Notion API（含快取）
├── 部署：Vercel
├── 追蹤：GA4 + Google Ads
├── API 文件：OpenAPI 3.0 / Swagger UI (/api-docs)
└── 監控：集中式 Logger
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

*由 Eric 與 [Claude Code](https://claude.ai/claude-code) 協作開發*
