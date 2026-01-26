# Comprehensive 10-Role Professional Review

> **Skill 名稱**: comprehensive-review
> **用途**: 從 10 個專業角度全面審查網站，找出潛在問題並提出優化建議
> **觸發方式**: 在對話中輸入 `/comprehensive-review` 或 `請執行全面性審查`

---

## 使用說明

### 如何觸發此 Skill

```
方法 1: /comprehensive-review
方法 2: 請執行全面性審查
方法 3: 從 10 個角色檢視網站
```

### 執行流程

1. **探索階段** - 使用 Task agent 探索 codebase 的各個面向
2. **分析階段** - 從 10 個專業角度分析問題
3. **報告階段** - 產出結構化報告，標註嚴重程度
4. **記錄階段** - 更新此文件的「歷史記錄」區塊
5. **執行階段** - 詢問用戶要優化哪些項目

---

## 10 個專業角色定義

### 1. SA 架構規劃師 (System Architect)

**審查重點**:
- [ ] 專案結構是否清晰
- [ ] API 設計是否符合 RESTful
- [ ] 快取策略是否有效（In-memory vs Redis）
- [ ] 資料流是否合理（CMS → API → Client）
- [ ] 環境變數管理是否正確
- [ ] 錯誤處理模式是否統一
- [ ] Logger 是否集中管理

**常見問題**:
- In-memory 快取在 serverless 環境無效
- Sanity CDN 未開啟
- Logger 重複實作

---

### 2. PM 需求分析師 (Product Manager)

**審查重點**:
- [ ] 核心功能是否完整
- [ ] 用戶旅程是否順暢
- [ ] 功能優先級是否正確
- [ ] 是否有功能缺口
- [ ] 是否有過度設計

**常見問題**:
- 缺少客戶回饋收集機制
- 預訂流程過度依賴外部（LINE）

---

### 3. UI/UX 前端設計師 (Frontend Designer)

**審查重點**:
- [ ] 響應式設計是否完善
- [ ] 無障礙（a11y）是否符合 WCAG
- [ ] 載入狀態是否有視覺回饋
- [ ] 表單驗證是否即時
- [ ] 動畫是否流暢
- [ ] 手機體驗是否優化
- [ ] 圖片是否正確裁切

**常見問題**:
- 表單缺少 aria-invalid 回饋
- 載入狀態使用純文字而非 Skeleton
- Lightbox 缺少鍵盤支援（Esc 關閉）
- 浮動按鈕重疊

---

### 4. 後端設計師 (Backend Developer)

**審查重點**:
- [ ] API 認證是否安全
- [ ] Rate Limiting 是否有效
- [ ] 輸入驗證是否完整
- [ ] 錯誤回應是否一致
- [ ] 資料庫查詢是否優化

**常見問題**:
- API Key 在開發環境可選導致生產環境風險
- Rate Limit 使用 in-memory（serverless 無效）
- 輸入參數缺少邊界檢查（limit, offset）

---

### 5. QA 測試驗證工程師 (QA Engineer)

**審查重點**:
- [ ] 單元測試覆蓋率
- [ ] E2E 測試是否完整
- [ ] API 整合測試
- [ ] 無障礙自動測試（axe-core）
- [ ] 視覺回歸測試
- [ ] 邊界條件處理

**常見問題**:
- parseInt 無 NaN 檢查
- Email whitelist 未 trim 空格
- 圖庫 lightbox 缺少 focus trap

---

### 6. 品牌戰略定位顧問 (Brand Strategist)

**審查重點**:
- [ ] 品牌定位是否清晰
- [ ] 差異化是否明顯
- [ ] 信任元素是否足夠
- [ ] 故事行銷是否到位
- [ ] 視覺一致性

**常見問題**:
- 缺少客戶見證影片
- 信任數字需要動態更新

---

### 7. SEO 內容撰寫顧問 (SEO Specialist)

**審查重點**:
- [ ] Metadata 是否完整
- [ ] Sitemap 是否包含所有頁面
- [ ] 結構化資料（Schema.org）
- [ ] Canonical URLs
- [ ] 內部連結策略
- [ ] OpenGraph/Twitter Cards
- [ ] robots.txt 設定

**常見問題**:
- 缺少 Canonical URLs
- Sitemap 缺少 tour detail pages
- 缺少 FAQ Schema

---

### 8. 市場行銷顧問 (Marketing Consultant)

**審查重點**:
- [ ] GA4 追蹤是否完整
- [ ] 轉換事件是否設定
- [ ] LINE 點擊追蹤
- [ ] 表單提交追蹤
- [ ] 轉換漏斗分析

**常見問題**:
- Blog 閱讀未追蹤
- 表單提交未設定轉換事件

---

### 9. 白帽駭客資安工程師 (Security Engineer)

**審查重點**:
- [ ] 環境變數是否安全
- [ ] API 認證是否強制
- [ ] CORS 設定是否正確
- [ ] CSP 是否配置
- [ ] HSTS 是否啟用
- [ ] 敏感資料是否外洩（console.log）
- [ ] SQL/GROQ 注入防護

**常見問題**:
- .env.local 誤 commit 到 git
- OpenAPI 端點 CORS 設為 *
- Debug console.log 洩漏敏感資料
- 缺少 HSTS Header

---

### 10. 精準 TA 使用者（親子家庭）

**審查重點**:
- [ ] 首頁第一印象
- [ ] 資訊透明度（價格、服務）
- [ ] LINE 諮詢便利性
- [ ] 手機瀏覽體驗
- [ ] 信任感建立

**常見問題**:
- 沒有線上報價功能
- 缺少即時客服

---

## 嚴重程度定義

| 等級 | 符號 | 說明 |
|------|------|------|
| 緊急 | 🔴 | 安全漏洞、資料外洩風險，需立即處理 |
| 高 | 🟠 | 影響核心功能或用戶體驗，應優先處理 |
| 中 | 🟡 | 影響部分功能或體驗，建議改善 |
| 低 | 🟢 | 優化建議，可排入後續迭代 |

---

## 歷史審查記錄

### 審查 #3 - 2026-01-24 (Phase 5.3 安全與 A11y 優化)

**執行範圍**: 安全性、SEO、無障礙 全面優化

**發現問題與處理**:

| 角色 | 問題 | 嚴重度 | 處理結果 |
|------|------|--------|----------|
| 資安 | Sanity Query 參數注入 | 🔴 緊急 | ✅ 加入 encodeURIComponent |
| 資安 | CSP unsafe-eval | 🔴 緊急 | ✅ 已移除 |
| 資安 | Revalidate 無 Rate Limit | 🟠 高 | ✅ 加入簡易 Rate Limit |
| 資安 | Google Ads config 競衝 | 🟡 中 | ✅ 移除重複 config |
| SEO | 首頁缺少 Canonical | 🟠 高 | ✅ 已加入 |
| SEO | Blog 列表缺少 Canonical | 🟠 高 | ✅ 已加入 |
| SEO | Blog 分類缺少 Canonical | 🟡 中 | ✅ 已加入 |
| SEO | Tour 頁面缺少 Schema | 🟡 中 | ✅ 加入 TouristTrip/Product Schema |
| A11y | FAQSection 缺少 aria-controls | 🟠 高 | ✅ 已加入 |
| A11y | Testimonials 缺少 role | 🟡 中 | ✅ 加入 role="region" |
| A11y | ImageGallery 缺少 role | 🟡 中 | ✅ 加入 role="dialog" |
| A11y | SearchBox 缺少 aria-label | 🟡 中 | ✅ 已加入 |

**保留項目（可接受/低優先）**:
- Rate Limiting in-memory（目前規模可接受，大流量需 Redis）
- Dashboard email header 認證（內部工具可接受）
- CSP unsafe-inline（Google Analytics 需要）

**改善項目**:
- Sanity useCdn: false（配合 on-demand revalidation）
- Google Ads 轉換追蹤邏輯優化（更精確的路徑匹配）

---

### 審查 #2 - 2026-01-24 (Phase 5.2 完整優化)

**執行範圍**: UI/UX 完整優化 + Token 安全確認

**發現問題與處理**:

| 角色 | 問題 | 嚴重度 | 處理結果 |
|------|------|--------|----------|
| UI/UX | 表單缺少驗證回饋 | 🟡 中 | ✅ 加入 aria-invalid、即時驗證 |
| UI/UX | Tours 載入純文字 | 🟢 低 | ✅ 改用 CaseGridSkeleton |
| 資安 | Token 安全確認 | 🔴 緊急 | ✅ 確認未洩漏，Vercel 已設定 |

**新增功能**:
- ContactForm 完整驗證（email regex、最小長度）
- CaseSkeleton 元件
- 錯誤狀態視覺回饋（紅色邊框）

---

### 審查 #1 - 2026-01-24 (Phase 5.2 全面審查)

**執行範圍**: 10 角度全面審查

**發現問題與處理**:

| 角色 | 問題 | 嚴重度 | 處理結果 |
|------|------|--------|----------|
| SA | Sanity CDN 未開啟 | 🟡 中 | ✅ 已開啟 (useCdn: true) |
| SA | Logger 重複實作 | 🟢 低 | ✅ 已整合 |
| 後端 | API Key 可選 | 🟠 高 | ✅ 生產環境強制 |
| 後端 | Email whitelist 未 trim | 🟢 低 | ✅ 已修復 |
| 後端 | 輸入驗證不足 | 🟡 中 | ✅ 加入 limit/offset 檢查 |
| QA | 圖庫無鍵盤支援 | 🟡 中 | ✅ 加入 Esc 關閉 |
| QA | 無背景滾動防止 | 🟢 低 | ✅ body overflow hidden |
| SEO | 缺少 Canonical | 🟡 中 | ✅ 已加入 |
| SEO | Sitemap 不完整 | 🟡 中 | ✅ 加入 tours, categories |
| SEO | 缺少 FAQ Schema | 🟡 中 | ✅ 加入 car-charter 頁 |
| SEO | Tour 頁缺 OG 圖片 | 🟢 低 | ✅ 已加入 |
| 行銷 | Blog 閱讀未追蹤 | 🟡 中 | ✅ ArticleViewTracker |
| 行銷 | 表單提交未追蹤 | 🟡 中 | ✅ trackFormSubmit |
| 資安 | OpenAPI CORS * | 🟠 高 | ✅ 改用 allowedOrigins |
| 資安 | Debug log 外洩 | 🟡 中 | ✅ 移除/包裝 debugLog |
| 資安 | 缺少 HSTS | 🟢 低 | ✅ 已加入 |
| UI/UX | Hero 圖片裁切 | 🟡 中 | ✅ aspect-[2/1] + object-center |

**保留項目（可接受/低優先）**:
- In-memory 快取（目前規模可接受，大流量需 Redis）
- Rate Limit in-memory（同上）
- Dashboard 使用 email header 認證（內部工具可接受）
- `.env.local` 密鑰安全（**已確認在 .gitignore 中，未被追蹤，此為誤報**）

---

## 學習與優化建議

### 自動學習機制

每次執行此 Skill 時，Claude 應：

1. **讀取歷史記錄** - 了解過去發現的問題
2. **檢查已修復項目** - 確認修復是否仍有效
3. **發現新問題** - 根據 codebase 變化找出新問題
4. **更新記錄** - 將新發現加入歷史記錄
5. **學習模式** - 識別重複出現的問題類型

### 常見問題模式（持續更新）

| 模式 | 說明 | 預防措施 |
|------|------|----------|
| 開發環境設定帶入生產 | useCdn: false, API Key 可選 | 使用 NODE_ENV 判斷 |
| Debug log 殘留 | console.log 敏感資料 | 使用 Logger 並過濾 |
| 輸入驗證不足 | parseInt 無 NaN 檢查 | 統一驗證函數 |
| 無障礙缺失 | 缺少 aria 屬性 | 使用 a11y checklist |
| SEO 遺漏 | 新頁面忘記加 sitemap | 建立 checklist |

---

## 執行 Checklist

執行審查時，依序完成：

- [ ] 1. 使用 Task agent 探索 codebase 架構
- [ ] 2. 使用 Task agent 探索前端 UX
- [ ] 3. 使用 Task agent 探索 SEO 設定
- [ ] 4. 使用 Task agent 探索安全設定
- [ ] 5. 彙整所有發現，按嚴重程度排序
- [ ] 6. 詢問用戶要處理哪些項目
- [ ] 7. 執行修復
- [ ] 8. 更新此文件的歷史記錄

---

## 相關文件

- `docs/plans/2026-01-23-phase5-comprehensive-review.md` - Phase 5 審查計畫
- `README.md` - 專案說明
- `CLAUDE.md` - Claude 工作指引

---

*最後更新: 2026-01-24*
*版本: 1.0*
