# 刀5 Production 規格：對外一日遊價目圖與夥伴快查卡

> **狀態：2026-07-10 production calibration 定案。**本版取代本文件先前的 #2.1 prompt 與所有「中文司機／人數強制導遊」說法。
> 定價單一事實來源：`src/lib/pricing/perPersonRates.ts`；服務口徑見 `2026-07-10-per-person-pricing-framework.md`。
> 產圖分工：image model 只生成**無字插畫／背景**；中文、價格、Logo、表格與 CTA 必須用 HTML/CSS 或 Canvas 確定性排版。

---

## 0. 對外產品與服務口徑

1. 一日遊是半客製私家團：不併團、行程可依家庭節奏調整；不是含票含餐的制式團。
2. 公開標準服務為泰國司機、行程事先確認與 LINE 中文支援；中文導遊依需求選配。
3. 2–3 人是轎車＋泰國司機、不含中文導遊。4–9 人在這張**一日遊價目圖**採「含中文導遊一日遊方案」，必須清楚標示這是選配後的方案，而不是依人數或法規強制。
4. 10–18 人為兩台 Van，圖上不塞完整價表，統一引導 LINE 取得整團報價；19 人以上人工確認。
5. 兒童 8 折與嬰幼兒半價都只能稱為「試算」；每位乘客（含嬰幼兒）各佔一席，正式總價受最低成團／核心團費保護。
6. 門票、餐食、保險、安全座椅與超時另計；圖片不得把付費項目放進「包含」。

## 1. 六條 day tour 與三個價格帶

| 價格帶 | 官網既有路線 | 圖上短標 |
|---|---|---|
| T1 市區 | 泰服體驗一日遊 | 泰服體驗 |
| T2 近郊 | 大象保護營、茵他儂、南邦、南奔 | 大象保護營・茵他儂・南邦・南奔 |
| T3 清萊 | 清萊白廟一日遊 | 清萊白廟 |

圖片只列路線名稱，不放密集停點清單。統一補一句「以上為行程範例，停點可依家庭需求調整」。官網 day tour 只保存 `pricingTier`，不再展示舊 `basePrice` 或固定導遊加價。

## 2. 最終圖像架構

### 2.1 可直接交付 imagegen 的**背景 prompt**

> 這段 prompt 只用來生成視覺底圖，不得要求模型排中文或價格。最終文字版由 §2.2 的確定性 overlay 合成。

```text
Create a warm, parent-friendly vertical background illustration for Chiang Mai family travel pricing artwork.

Aspect ratio: exactly 4:5 portrait. Composition must remain calm and spacious for a deterministic text overlay.
Style: refined editorial vector-and-gouache illustration, creamy ivory background, warm Chiangway yellow accents, muted terracotta, soft sage and sky blue, rounded friendly shapes, subtle handmade texture, premium but approachable, designed for Taiwanese parents viewing on a phone.

Visual motifs only:
- a small Thai sedan and a comfortable passenger van driven safely on a gentle curved road;
- a Taiwanese-Thai family with young children as small supporting figures;
- restrained Chiang Mai cues: a northern Thai roof silhouette, elephant motif, mountain layers and a white-temple-inspired silhouette;
- light botanical details in the outer edges.

Layout constraints:
- reserve the top 18% as a quiet, low-detail header zone;
- reserve the middle 58% as three clean stacked card zones with very low visual detail;
- reserve the bottom 24% as a quiet information and CTA zone;
- keep all important illustrations outside the central text columns and away from card interiors;
- preserve at least 7% empty margin on all four edges;
- high contrast must be possible for dark charcoal overlay text.

Strict exclusions:
NO text, NO Chinese characters, NO Latin letters, NO numbers, NO price symbols, NO currency symbols, NO logo, NO brand mark, NO watermark, NO road signs, NO shop signs, NO license-plate lettering, NO tables, NO UI labels, NO pseudo-text or gibberish. Do not draw a tour guide badge or imply that every group includes a guide.
```

### 2.2 確定性文字 overlay 規格

- Master：2160 × 2700 px（4:5）；社群輸出：1080 × 1350 px。
- 外框安全區：左右 144 px、上下 135 px；任何價格、CTA、Logo 不得超出。
- 字型：Noto Sans TC（或專案已載入且可嵌入的繁中字型）；數字使用 tabular numerals。
- 所有價格從 canonical engine 產生後注入模板；不得手動在背景圖修字。
- 品牌 Logo 以正式向量／PNG 疊加，不交給 image model 重畫。
- 建議檔名：
  - 背景：`public/images/pricing/day-tour-price-bg-v2026-07-10.png`
  - 最終主檔：`public/images/pricing/day-tour-price-v2026-07-10.png`
  - 分享檔：`public/images/pricing/day-tour-price-v2026-07-10-1080x1350.png`

### 2.3 Overlay 的精確文案與數字

以下內容是排版輸入，不是 imagegen prompt。

#### 頂部品牌帶

```text
清微旅行｜清邁私家一日遊
成人每人參考價・泰銖 THB
不併團・行程可調整・爸媽開的親子包車
```

#### 卡 1：T1 市區線

```text
市區線｜泰服體驗
2人 2,300｜3人 1,600
轎車＋泰國司機｜不含中文導遊

4人 2,050｜5人 1,650｜6人 1,400
7人 1,250｜8人 1,100｜9人 1,000
含中文導遊一日遊方案（選配方案）
```

#### 卡 2：T2 近郊線

```text
近郊線｜大象保護營・茵他儂・南邦・南奔
2人 2,550｜3人 1,750
轎車＋泰國司機｜不含中文導遊

4人 2,250｜5人 1,850｜6人 1,550
7人 1,350｜8人 1,200｜9人 1,100
含中文導遊一日遊方案（選配方案）
```

#### 卡 3：T3 清萊線

```text
清萊線｜清萊白廟（12 小時日）
2人 3,200｜3人 2,200
轎車＋泰國司機｜不含中文導遊

4人 2,550｜5人 2,100｜6人 1,750
7人 1,550｜8人 1,350｜9人 1,250
含中文導遊一日遊方案（選配方案）
```

#### 包含／不含與說明

```text
包含
車輛・泰國司機・油費・過路費・停車費
行程事先確認・LINE 中文支援
4–9 人上列方案另含中文導遊

另計
門票・餐食・小費
旅遊保險 THB 100／人／趟
兒童安全座椅 THB 500／日／張（裝在孩子座位，不另加算一人）

用車時間
清邁 10 小時｜清萊 12 小時
保留 30 分鐘彈性；其後超時 THB 300／小時／台
```

#### 兒童／團費保護與 CTA

```text
3–11 歲 8 折試算｜0–2 歲半價試算
每位乘客（含嬰幼兒）各佔一席；安全座椅不另加算一人。
正式報價依家庭組合與最低成團價保護後確認。

10–18 人：兩台 Van，請 LINE 取得整團報價
19 人以上：人工確認車輛與服務安排
不需要導遊？官網另有泰國司機方案。

以上為行程範例，停點可依家庭需求調整。
多日客製與正式報價｜LINE @037nyuwk
```

### 2.4 排版層級

1. 首屏先看懂「每人參考價・THB」與私家團。
2. 三張卡各只保留價格帶、路線名、人數價與服務標籤；不得加入逐站行程。
3. 每張卡把 2–3 人與 4–9 人視覺分區，避免讀者誤以為同一人力配置。
4. 「含中文導遊一日遊方案（選配方案）」必須與價格同卡、同視線範圍，不能只放最底小字。
5. 兒童試算、最低成團保護、10–18 兩車與 19+ 人工不可刪除；若版面不足，先刪裝飾或次要圖示。

## 3. 夥伴快查卡（LINE 內部貼文）

```text
📋 清微報價快查｜v2026-07-10

【公開服務】
標準＝泰國司機＋行程事先確認＋LINE 中文支援
中文導遊依需求選配；司機與導遊是不同專業
不可承諾中文司機，也不可用人數或法規話術強制導遊

【看總佔位人數】成人＋兒童＋嬰幼兒；每位乘客各佔一席
安全座椅裝在該孩子的座位，不另加算一人，但要納入車內配置
1人＝人工確認
2–3人＝轎車＋泰國司機；加導遊須先確認車型
4–9人＝Van×1＋泰國司機；導遊可選配
10–18人＝Van×2＋泰國司機×2；導遊可選配1位、兩車共用
19人以上＝人工報價，不拆單

【親子試算】
12+成人價｜3–11歲8折試算｜0–2歲半價試算
正式總價需套最低成團／核心底價與加人不降總團費保護

【加購與時數】
安全座椅 500／日／張｜保險 100／人／趟
清邁10小時｜清萊／金三角12小時｜保留30分鐘彈性
其後超時 300／小時／台；不另收導遊超時

完整價表與兩車檔：
docs/plans/2026-07-10-per-person-pricing-framework.md
```

### 內部導遊錨點

| 車數 | cost（THB／日） | sell（THB／日） | 處理 |
|---:|---:|---:|---|
| 1 | 1,500 | 2,500 | 自動 |
| 2 | 2,000 | 2,500 | 自動 |
| 3 | 2,500 | 未定 | 人工 |
| 4+ | 未定 | 未定 | 人工 |

J 姊偶發可開轎車只屬內部供應例外，不能出現在快查對客話術、價目圖或公開 FAQ；會中文也不代表包含導覽。

## 4. 產圖與上線驗收

- [ ] 背景像素內沒有任何文字、數字、Logo、價錢、招牌或偽文字。
- [ ] Overlay 價格由 `calcPerPersonDay()` 產生，與本文件三卡逐項比對。
- [ ] 2–3 人寫「泰國司機／不含中文導遊」。
- [ ] 4–9 人清楚寫「含中文導遊一日遊方案（選配方案）」。
- [ ] 沒有法規強制導遊、中文司機、拆單或 8–9 人自動導遊說法。
- [ ] 兒童兩種優惠都標「試算」、嬰幼兒佔位、最低成團保護完整可讀。
- [ ] 10–18 人兩台 Van／LINE 詢價與 19+ 人工都在圖上。
- [ ] 加購、時數、30 分鐘彈性與超時 THB 300／小時／台正確。
- [ ] 1080 × 1350 手機實機檢查：最小正文仍可讀，沒有表格擠壓或截字。
- [ ] Eric 看過預覽並明確同意後，才替換官網／LINE 既有素材。

## 5. 後續產物

- [ ] 依 §2.1 生成無字背景。
- [ ] 以 HTML/CSS 或 Canvas 合成 exact overlay，保留可重跑來源。
- [ ] 同時輸出 master 與社群分享尺寸，逐項核對 hash／檔名／價格版本。
- [ ] LINE 圖文選單另依 `2026-07-10-line-rich-menu-production-spec.md` 製作；本價目圖不是 rich-menu 點擊底圖。
