# 人頭計價改造 — 實作計畫（後台報價器＋前台＋套餐＋LINE 選單＋夥伴對照）

> [!WARNING]
> **HISTORICAL / SUPERSEDED.** 本文件記錄 calibration 前的分階段實作，內文仍含 8–9 人自動導遊與 10+ 拆單等已淘汰假設，不能作為現行服務或報價規則。production 規則以 [`2026-07-10-per-person-pricing-framework.md`](2026-07-10-per-person-pricing-framework.md) 與 [`2026-07-10-pricing-line-production-calibration-implementation.md`](2026-07-10-pricing-line-production-calibration-implementation.md) 為準。

> 2026-07-10。定價架構見 `2026-07-10-per-person-pricing-framework.md`（參數：G=T1/T2 1,000、T3/T4 1,500；V=150；小孩 12+全價/3-11 八折/0-2 半價）。
> 分 5 個 Phase，每 Phase 一個 session 刀。對外幣別 THB、收現金；TWD 降為內部參考。

---

## 關鍵設計決定

1. **明細不隱藏、改重組**：`externalQuote` items 從成本拆項（包車費/導遊費）改為售價結構（「大人 6 × 1,550」「兒童 2 × 1,240」「安全座椅 1 × 500/日」）。成本自然不露出，比加隱藏開關乾淨。
2. **單一事實來源**：新增 `src/lib/pricing/perPersonRates.ts`（app 與 Sanity tool 共用），黃表車價降級為內部成本參考（報價器保留 cost 欄看毛利）。
3. **舊報價相容**：舊 snapshot（成本拆項格式）前台照舊渲染，不遷移；三個示範套餐報價用新報價器重出、換新 slug。

---

## Phase 0 — 定價引擎模組（TDD）

新檔 `src/lib/pricing/perPersonRates.ts` ＋ unit tests：

- 常數：4 tier 基準車價（轎車/van）、G、V、兒童折扣三段、50 進位、長包折扣（≥3日 −50、≥5日 −100）
- `resolveFleet(occupiedSeats)` → 車型/台數/導遊是否必配（2-3 轎車；4-7 van 導遊選配；8-9 van＋必配導遊；10+ 兩台）
- `calcPerPersonDay(tier, groupSize, withGuide)` → 每人日價
- `calcTrip({ days:[{tier, isAirportDay}], adults, children, infants, addons })` → 總價＋售價結構 items
- 規則內建：機場日佔位 ≥8 自動加行李車 700/趟；級距用總佔位數、收費分三段
- 匯率 fallback 統一（後台 0.93 vs 前台 `fetchQuote.ts:169` 的 1.1 目前不一致，一併修）

## Phase 1 — 後台報價器（PricingCalculator.tsx）

- 輸入改三欄：`adults / children(3-11) / infants(0-2)`（現只有 adults+children）
- 配車演算法 `:2948-2950` 改用 `resolveFleet()`；8-9 人導遊強制、4-7 選配、10+ 兩台各自計價
- 車費計算 `:3030-3034`（dailyCarFees × carCount）改為 perPersonRates 計價；每日區域選擇映射到 T1-T4
- `buildExternalQuoteBreakdown()`（`externalQuote.ts:71-193`）改組售價結構 items；`ExternalQuoteBreakdownItem` 型別夠用不用改
- 加購項對齊：行李車 600→700、座椅 500/日、保險 100/人維持
- snapshot 欄位不變（`payload` JSON），新增 `pricingModel: 'perPerson'` 標記供前台判別新舊

## Phase 2 — 前台報價頁

- `QuoteCostDashboard.tsx`：主金額改 **THB 大字**（現 NT$ 大字在 `:355-363`，反轉）；TWD 移除或縮為小字註記
- `LineItemBreakdown`：新 items 自然呈現售價結構；舊 snapshot（無 `pricingModel`）維持現行渲染
- 「包含 ✔ / 不含 ✕」清單內容更新（included/excluded 欄位已存在），對齊黃表：車資油費過路停車、司機、導遊、超時費、中文客服
- 三個示範套餐用新報價器重出（k8oeyepp / uao33058 / lyx5aysy 舊連結留存或下架由 Eric 決定）

## Phase 3 — 公開價目頁（官網）

- `/services/car-charter`（`page.tsx:214-223`）：價目區從「車型 × 路線一台車價」改為「人數 × Tier 每人價」三張表＋座位規則＋小孩三段＋加購表——即 framework 文件第 6 節的公開版
- Sanity `carCharter` schema：`pricingVehicleTypes` 新增或替換為 per-person 結構（保留舊欄位向後相容）
- 結構化資料 `page.tsx:93-94` 寫死 `price:'3700'` 更新為每人起價
- `tourPackage` 三套餐：`priceRange` 改「每人 THB X 起」、`priceNote` 註明依人數級距（Sanity 內容修改，非程式）

## Phase 4 — LINE 圖文選單＋夥伴對照表

- 圖文選單「參考價格」入口 → 指向 `/services/car-charter` 新人頭價目區（純 LINE 後台操作＋`docs/line-oa-rich-menu-documentation.md` 更新）；不再讓客人看到任何成本式明細
- **夥伴快查卡**：從 framework 文件產出單頁（LINE 可傳的圖或 PDF）：三張每人價表＋座位硬規則＋小孩三段＋加購＋機場日規則；放 `docs/partner/pricing-cheatsheet-v1.md`（先 md，再轉圖）
- 夥伴報價 SOP：① 數佔位人數（嬰兒也算）→ ② 判斷每日最遠點定 Tier → ③ 查表報每人價 ×天數 → ④ 加購另列 → ⑤ 成單需正式報價頁時回報 Eric/CC 出 quote URL
- 快查卡收款要點：**當日應收 = 團費 + 現場付加購**（門票代收代付含在內，單一收款點同一天結清；見 framework 第 8 節門票設計）
- 快查卡版本號與 framework 文件同步，改參數必同步重發

## 執行順序與風險

| 順序 | 內容 | 依賴 |
|------|------|------|
| 刀1 ✅ | Phase 0 引擎＋tests（2026-07-10 完成，a189e0e） | 無 |
| 刀2 ✅ | Phase 1 報價器（2026-07-10 完成，eae12ed） | 刀1 |
| 刀3 🔶 | Phase 2 前台報價頁（程式面完成 69d7f3c；重出三張套餐待 Eric） | 刀2 |
| 刀4 | Phase 3 公開價目頁 | 刀1（可與刀3 並行） |
| 刀5 | Phase 4 選單＋快查卡 | 刀4 上線後 |

刀1 完成紀錄（a189e0e）：`src/lib/pricing/perPersonRates.ts`＋22 unit tests；匯率 fallback 單一事實來源 `DEFAULT_THB_PER_TWD=1.1`（TWD=THB÷rate；後台舊值 0.93 是方向錯誤、TWD 會灌水 ~7.5%，`PricingCalculator` 三處與 `src/lib/quote/fetchQuote.ts:169` 均改引常數）。

刀2 完成紀錄（eae12ed）：引擎補 `AIRPORT_TRANSFER_FEES`（純接送日按車收 500/700，第5節規則2）；新增 `perPersonAdapter.ts`（type→tier 映射含 goldentriangle T4、機場日 name 推斷、10+ 拆單降級）；報價器三欄人數（嬰兒佔位計級距、餐費排除）、resolveFleet 配車、售價=人頭團費（黃表降內部成本毛利參考）、10+ 擋下載/產連結；externalQuote perPerson 售價結構 items＋`_quoteSnapshot.pricingModel:'perPerson'`（舊 snapshot 路徑不動）；載入舊 quote 匯率 <0.9 自動重設 1.1。Review 遺留建議（未做）：needLuggageCar 文案純看人數不看有無機場日、對外 tab「÷N 成人」舊口徑殘留、`downloadExternalQuote` dead code 可刪、保險改含嬰兒 +100/人需 Eric 確認。

刀3 完成紀錄（69d7f3c，程式面）：修 `pricingModel` 斷鏈——`fetchQuote.ts` 原只取 `snapshot.externalQuote`、`pricingModel` 被丟棄，補傳到 `QuoteData`（types.ts 加 `pricingModel?: 'perPerson'`）；`QuoteCostDashboard` 的 `TotalQuoteCard`＋`LineItemBreakdown` 依 `pricingModel==='perPerson'` 反轉 THB 大字／TWD 縮約值註記，舊快照走現行 NT$ 渲染；included 對齊黃表補「超時費」。新增 fetchQuote mock 測試 3 條＋元件 jsdom/RTL 測試 2 條（mock framer-motion，jsdom 無 IntersectionObserver）。**2026-07-10 Eric 回饋定案（同日補丁）**：① 舊連結維持，套餐展示頁（package mode）下架價格明細區塊；② 超時費按台實收（清邁10hr/清萊金三角12hr 後 THB 300/小時/台），從 included 移除、perPerson excluded 列明；③ 保險客選加購、要保時嬰兒也保 +100/人（刀2 行為確認）。**未完項**：三張示範套餐重出——定價提案已出（6人檔錨點：5天4夜 6,000／清萊2天 3,500／泰北6天 7,700 THB/人，完整試算見 `docs/plans/2026-07-10-package-pricing-proposal.md`），待 Eric 核價後 dry-run 重出；uao33058 payload type 是 suburban 非 chiangrai、lyx5aysy 金三角日 typed chiangrai 非 goldentriangle，重出時要改對 type。

2026-07-10 三套餐錨點價定案：k8oeyepp 5天4夜 **6,000**／uao33058 清萊2天 **3,500（選 T3 口徑）**／lyx5aysy 泰北6天 **7,700** THB/人（Eric 核價，詳見 `2026-07-10-package-pricing-proposal.md` 定案狀態）；三張套餐可進 dry-run 重出。

風險：
- 舊 snapshot 相容（前台以 `pricingModel` 判別，舊格式走現行路徑）
- ~~匯率 fallback 不一致（0.93 vs 1.1）~~——刀1 已統一 1.1
- `PricingCalculator.tsx` 是 3,000+ 行大檔，改動須小步＋既有測試護航（注意 activityTickets.test.ts 有既有 TS2783 錯誤，非本工程引入）
- 10 人以上兩台車的報價器 UX（兩張表加總）先做最簡版：提示拆兩單

---

## 2026-07-11｜三個公開套餐報價已重出

保留既有公開 slug，將 Sanity `pricingExample` 快照改為 `pricingModel: 'perPerson'`，並同步新版行程級距、固定包含項目與加購規則：

| slug | 公開參考案例 | 新版全家總價 |
|---|---|---:|
| `k8oeyepp` | 4 大＋2 位 3–11 歲兒童 | THB 33,600 |
| `uao33058` | 3 位成人 | THB 19,800 |
| `lyx5aysy` | 7 大＋1 位 3–11 歲兒童，另含芳縣第一晚 4 間房 | THB 55,950 |

共同口徑：

- 三個套餐預設含中文導遊；不再顯示「是否含導遊」為價格變因。
- 旅遊保險改為自由加購 THB 100／人／趟。
- 0–2 歲安全座椅改為加購 THB 500／日／張。
- 接送機行李車不預設；每台 Van 載客達 7 位先確認空間，需要後才加 THB 700／台／趟。
- 清萊兩日改為 T3＋T3；泰北改為 T3＋T4＋T3＋T2＋T2＋單趟送機。
- 客人住宿與司導外宿分開表達；泰北只包含第一晚芳縣自家民宿，其餘 4 晚客人自理。
- 舊客人的航班、飯店與預約時間已從公開套餐文字移除，改為可重複使用的參考行程。

更新工具：`scripts/refresh-package-quotes.mjs`，預設只做 dry-run；必須明確加上 `--apply` 才會寫入 Sanity，寫入前自動保留本機 JSON 備份。若某筆套餐被其他流程誤覆成錯誤天數，工具會以該套餐已核定的日程骨架復原後再套用新版快照。
