# 網站優化實施計畫

**Goal:** 優化清微旅行網站的效能、SEO 和程式碼品質

**狀態:** ✅ 已完成

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Sanity CMS

---

## 完成項目總覽

| 任務 | 內容 | 狀態 |
|------|------|------|
| Task 1 | 移除未使用的 styled-components 依賴 | ✅ 完成 |
| Task 2 | 修正 Schema 網域錯誤 | ✅ 完成 |
| Task 3 | 新增 Error Boundary | ✅ 完成 |
| Task 4 | 完善 OpenGraph 元資料 | ✅ 完成 |
| Task 5 | 動態 Sitemap 加入部落格文章 | ✅ 完成 |
| Task 6 | 改善手機選單無障礙功能 | ✅ 完成 |
| Task 7 | 移除 LineFloatButton 元件 | ✅ 完成 |

---

## 實作細節

### Task 1: 移除 styled-components ✅

- 執行 `npm uninstall styled-components`
- 減少打包大小

### Task 2: 修正 Schema 網域 ✅

- 修正 `ArticleSchema.tsx` 和 `Breadcrumb.tsx`
- 網域統一為正確的 URL

### Task 3: Error Boundary ✅

- 新增 `src/app/error.tsx`
- 新增 `src/app/global-error.tsx`
- 提供友善的錯誤頁面

### Task 4: OpenGraph 元資料 ✅

- 完善 `layout.tsx` 的 metadata
- 加入 OG 圖片、Twitter Card 設定

### Task 5: 動態 Sitemap ✅

- `sitemap.ts` 自動抓取 Sanity CMS 的部落格文章
- 包含靜態頁面和動態文章

### Task 6: 手機選單無障礙 ✅

- 加入 `aria-expanded`、`aria-controls` 屬性
- 支援 Escape 鍵關閉選單

### Task 7: LineFloatButton 移除 ✅

- 移除 `LineFloatButton.tsx` 元件
- 清理 `layout.tsx` 引用

---

*最後更新: 2026-01-15*
