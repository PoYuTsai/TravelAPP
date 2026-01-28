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
| Phase 5.1 | UX 精緻化 | ✅ 完成 |
| Phase 5.2 | 10 角色全面審查 | ✅ 完成 |
| Phase 5.3 | 安全性與無障礙優化 | ✅ 完成 |
| Phase 5.4 | 綜合審查後續優化 | ✅ 完成 |
| Phase 5.5 | 手機 UX 優化 | ✅ 完成 |
| Phase 5.6 | 政策與 FAQ 優化 | ✅ 完成 |
| Phase 6 | 記帳系統 + 知識庫 | ✅ 完成 |

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

### Phase 5.1：UX 精緻化
基於實際使用回饋的細節優化：

- **Notion 整合強化**：動態家庭數量、泰國時區狀態判斷、旅遊日期排序
- **行程案例狀態**：已完成 / 旅遊中（綠色）/ 即將出發 三種狀態
- **2025 過往案例**：預設隱藏、展開/收回功能
- **Trust Badge 優化**：文案改進、星星 hover 發光效果
- **LINE CTA 精簡**：移除重複按鈕、保留浮動按鈕 + Header
- **故事連結**：WhoWeAre 區塊新增「閱讀我們的故事」按鈕

### Phase 5.2：10 角色全面審查
從 10 個專業角度進行全面審查並實施優化：

- **SA 架構**：Sanity CDN 啟用、Logger 整合
- **後端**：API Key 生產強制、輸入驗證強化、Email whitelist 修復
- **QA 測試**：Lightbox 鍵盤支援（Esc 關閉）、背景滾動防止
- **SEO**：Canonical URLs、Sitemap 完善、FAQ Schema、OG Image
- **行銷**：文章閱讀追蹤、表單提交追蹤
- **資安**：CORS 修復、Debug log 清理、HSTS Header
- **UI/UX**：Hero 圖片比例修復、表單驗證完善、Loading Skeleton
- **開發者體驗**：10 角色審查 Skill 文件（自學習機制）

### Phase 5.3：安全性與無障礙優化
基於綜合審查的深度安全與無障礙改進：

- **安全性**：Revalidate API 時間攻擊防護（timingSafeEqual）、Authorization header 支援
- **SEO**：Blog 分類頁 Schema（CollectionPage + BreadcrumbList）、內部連結優化
- **無障礙**：Lightbox focus trap、aria-expanded/aria-current、Touch target 44px+
- **程式碼品質**：API 路由統一使用集中式 Logger
- **防索引**：/api-docs noindex 設定

### Phase 5.4：綜合審查後續優化
10 角色全面審查後的關鍵問題修復：

- **SEO**：Canonical URLs 統一為絕對路徑（blog + tours 頁面）
- **安全性**：PDF/Excel 模板 HTML 轉義（XSS 防護）、移除 REVALIDATE_SECRET URL 參數
- **日誌系統**：Notion client 統一使用集中式 Logger
- **配置完善**：.env.example 補齊遺漏環境變數
- **表單驗證**：ContactForm 電話欄位長度驗證
- **UX 改善**：SearchBox 觸控目標增大至 44px+

### Phase 5.5：手機 UX 優化
修復手機端水平滾動問題，提升移動裝置瀏覽體驗：

- **水平滾動防止**：html/body 加入 `overflow-x: hidden`
- **響應式媒體**：img/video/iframe/pre 統一加入 `max-width: 100%` 約束
- **測試驗證**：production build 通過，確保無破壞性變更

### Phase 5.6：政策與 FAQ 優化
完善取消政策與包車服務說明：

- **服務方式說明**：泰文司機 + 中文導遊專業分工模式、行程事先確定
- **超時費用政策**：清邁 10 小時 / 清萊 12 小時、超時費 200 泰銖/小時
- **旺季連續用車**：2月春節、4月潑水節、11月水燈節、12-1月跨年不接受跳天
- **入境須知**：TDAC 填寫提醒、20,000 泰銖現金要求
- **包車 FAQ 優化**：新增司機語言、超時計算等常見問題（Sanity CMS）

### Phase 6：記帳系統 + 知識庫
個人財務追蹤與業務知識傳承系統：

- **個人記帳**：Sanity Studio 記帳工具（/studio → 💰 記帳）
  - 日期區間 + 餘額輸入、入金記錄管理
  - Notion 業務成本自動串接、40 萬門檻警示
- **成本解析器**：Notion 自由格式文字解析（規則式 + 不確定值標記）
- **知識庫系統**：Notion 資料庫（96 筆）+ 連結審計腳本
  - 🍜 餐廳推薦：21 筆
  - ☕ 咖啡廳推薦：10 筆
  - 🏨 飯店推薦：19 筆
  - 🏔️ 景點推薦：8 筆
  - 🎫 門票資訊：22 筆
  - 💬 話術範本：16 筆

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

<!-- Last build trigger: 2026-01-28 Phase 6 完成確認 -->
