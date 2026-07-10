# Public Pricing Alignment Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將包車服務官網、共用人頭計價引擎與 Sanity 公開內容，對齊 2026-07-11 已定案的司機／導遊、兒童與套餐規則。

**Architecture:** `perPersonRates.ts` 繼續作為所有每日價的單一事實來源；公開元件只從引擎算價格，不複製數字。官網保留「泰國司機」與「含中文導遊」兩套價目表，CMS 僅承載流程、FAQ 等可編輯內容。舊 CMS 中的評論換優惠文案直接修正，避免部署後仍被 Sanity 覆蓋。

**Tech Stack:** Next.js 14、React、TypeScript、Tailwind CSS、Vitest、Testing Library、Sanity CMS。

---

### Task 1: 對齊導遊選配政策與價格引擎

**Files:**
- Modify: `src/lib/pricing/perPersonRates.test.ts`
- Modify: `src/lib/pricing/perPersonRates.ts`
- Modify: `src/sanity/tools/pricing/__tests__/perPersonAdapter.test.ts`
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`

**Steps:**
1. 先將測試改為：2–3 人可選導遊、8–9 人不再強制導遊、10–18 人為兩台 Van 且導遊可選。
2. 執行相關測試，確認因舊規則而失敗。
3. 最小幅修改 `resolveFleet` 與後台提示文字。
4. 重跑價格引擎、adapter 與 UI 測試至通過。

### Task 2: 重整官網公開價格區

**Files:**
- Modify: `src/components/cms/__tests__/PerPersonPricingTable.test.tsx`
- Modify: `src/components/cms/PerPersonPricingTable.tsx`

**Steps:**
1. 先寫公開口徑測試：兩種方案、2–3 人可選導遊、8 人以上為建議、兒童只報全家總價、不公開折扣比例、安全座椅僅 0–2 歲。
2. 執行元件測試確認失敗。
3. 將三張舊表收斂成兩個清楚區塊：泰國司機、泰國司機＋中文導遊；每張依 2–9 人呈現。
4. 更新包含／不含、用車時間、詢價所需資訊與 10 人以上整團報價說明。
5. 接送機行李規則改為「每台載客達 7 位即逐台確認」，確認空間不足後才加 THB 700／台／趟，不依總人數自動加價。
6. 重跑元件測試。

### Task 3: 讓熱門套餐卡可點擊並更新錨點價

**Files:**
- Create: `src/app/services/car-charter/packageAnchors.ts`
- Create: `src/app/services/car-charter/packageAnchors.test.ts`
- Modify: `src/app/services/car-charter/page.tsx`

**Steps:**
1. 先寫測試鎖定三個套餐的名稱、6 人成人參考價與 `/quote/...` 對應網址。
2. 執行測試確認模組尚不存在而失敗。
3. 建立純資料模組並把卡片改為 Next.js `Link`，提供可辨識的 hover、focus 與「查看套餐」文字。
4. 更新錨點：清邁 5 天 4 夜 6,000、清萊 2 天 3,750、泰北 6 天 5 夜 9,200。
5. 更新安全座椅預設文案為 0–2 歲。

### Task 4: 清理 Sanity 公開優惠文案

**Files:**
- Modify external document: production Sanity singleton `carCharter`

**Steps:**
1. 讀取目前流程與 FAQ，保存文件 id 與 revision 供核對。
2. 將「評論／分享換優惠」改為不綁評論的服務完成文案。
3. 將優惠 FAQ 改為「正式報價已含人數與長包優惠；特殊活動依公告，夥伴不另外承諾折扣」。
4. 重新查詢 Sanity，確認禁用文案不再存在。

### Task 5: 驗證與交付

**Steps:**
1. 執行聚焦 Vitest、完整 Vitest、ESLint、TypeScript 與 `next build`。
2. 啟動本機站點，以 375px 與桌面寬度檢查表格、套餐連結與無水平溢位。
3. 執行 `git diff --check` 並檢查變更範圍。
4. 若全部通過，再進行分支整合與正式網站部署。

### Task 6: 對客 LINE 報價模板

**Files:**
- Create: `docs/operations/customer-line-quote-template.md`

**Steps:**
1. 提供首次正式報價與需求修改後兩種可複製格式。
2. 對客只呈現全家總價，不拆兒童比例、車導成本或司導外宿。
3. 明列大件行李、嬰兒車與已確認的行李車台數。
4. 複製一份至 Eric 桌面供夥伴直接使用。
