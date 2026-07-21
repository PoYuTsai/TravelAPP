# Pricing Save Safety — 2026-07-11

## Outcome

Sanity 報價後台現在會明確更新「目前載入的那一筆」，並以載入時的 `_rev` 做 optimistic concurrency control。若另一位夥伴已先更新，這次儲存會被拒絕，不再用舊表單靜默覆蓋新資料。

## Root cause

- 舊流程以隱藏的 `editingQuoteId` 決定目的文件，畫面沒有清楚顯示更新目標。
- `createOrReplace()` 每次重建整份 Sanity 文件，沒有 revision guard。
- 固定公開套餐也使用通用試算器重建 `_quoteSnapshot`；只改匯率時，核定套餐 THB 總價可能被通用車價取代。
- 雲端同步失敗時，舊流程仍寫入 localStorage 並顯示近似成功狀態。

## New invariants

1. 載入案例時一併保存 `_rev`、`publicSlug` 與當下資料；背景同步不會偷換掉這次編輯所依據的 revision。
2. 更新既有案例使用 `patch().ifRevisionId().set().commit()`；新案例使用 `create()`，不使用 `createOrReplace()`。
3. 儲存失敗不再回寫本機假成功資料。
4. 後台顯示「目前儲存會更新」的案例名稱與公開網址，按鈕也直接顯示更新目標。
5. 三個固定套餐使用獨立 2–18 人核定表，不再落回通用車價：
   - `chiang-mai-5d4n` → `/quote/k8oeyepp`
   - `chiang-rai-2d1n` → `/quote/uao33058`
   - `northern-thailand-6d5n` → `/quote/lyx5aysy`
6. 套餐可直接改人數、匯率、保險、安全座椅與已勾選門票；泰北套餐會依成人＋兒童自動重算芳縣房數。
7. 改天數、車價／路線級距、是否含導遊、餐食、住宿或司導外宿時，原公開套餐禁止直接覆寫，需先「複製」成客製報價。

## Recovery / calibration

`scripts/refresh-package-quotes.mjs` 會替三個既有公開文件寫入 `packagePricingId` 與固定套餐的基礎包含／不含文案；`--apply` 使用 Sanity transaction + `_rev` guard，且寫入前建立 payload 備份。

## Verification

- Fixed-package anchors：THB 33,600 / 19,800 / 55,950。
- Unit tests cover package tables, Fang room calculation, optional extras, occupancy guard, package detection, structure guard, revision patching, and `_rev`/slug round-trip parsing.
- Full Vitest suite and Next.js production build must pass before deployment.

## Exchange-rate decision

2026-07-11 依 Eric 決策，正式報價預設匯率改為 `1 THB/TWD`；三個公開套餐同步更新台幣約值，THB 核定總價維持不變。

## 2026-07-21 六人口徑統一（方案 A）

依 Eric 定案，三張公開套餐統一為 6 人同行口徑，與 `/services/car-charter` 卡片每人參考價一致：

- `k8oeyepp` 清邁 5D4N：維持 4 大 2 小＝6 人，THB 33,600。
- `uao33058` 清萊 2D1N：3 位成人 → **6 位成人，THB 22,500**（3,750／人）。
- `lyx5aysy` 泰北 6D5N：7 大 1 小 → **6 位成人，THB 55,200**（9,200／人；芳縣 3 房、6 人不觸發行李車）。

同步：套餐頁大字總價下新增「約 THB X／人・以 N 人同行估算」（`QuoteCostDashboard`，僅 package mode）；首頁 `Services.tsx` 起價改由 `CAR_CHARTER_PUBLIC_COPY.startingPrices.cityDayFromThb` 推導。數字皆出自 `packageQuotePricing.ts` 引擎表並有 unit tests 鎖定。
