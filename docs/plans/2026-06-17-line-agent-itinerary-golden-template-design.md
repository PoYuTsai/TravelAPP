# LINE OA Agent — 行程類截圖走 Golden 範本設計（itinerary golden template）

> 狀態：brainstorm 定案（2026-06-17），待下個 session 進 writing-plans / TDD 實作
> 分支：`codex/line-oa-agent-mvp`（branch as-is，暫不 merge/PR）
> 前情：取代「截圖智慧回覆對行程類也走通用 agentic 自由寫手」——實測思思案輸出不佳（見 §1）。

## 1. 背景：思思案實測為什麼不行

2026-06-16 跑 `agent:partner-image-respond -- tmp/sisi-case.jpg` 兩次，Eric 不滿意：

- **搜證開那版**：vision 把 `7/1–7/5`（5 天）OCR 成 `1月7日–7月5日`（跨半年）→ 整篇變氣候小論文＋三條外部連結，不能直接複製給客人。
- **根因（結構性，非 prompt 微調可解）**：smart-reply 掛的 RAG 工具 `search_chiangmai_cases` 回 `OperatorSafeCaseSummary`，**故意丟掉逐日行程內文**（`itinerarySnippetPreview?: never`，防 PII）。LLM 拿不到任何可複製的行程骨架，只能憑 hints 瞎掰；web search 一開更把它帶離題。
- **諷刺**：搜證**關**那版反而較乾淨（沒被 web 汙染）。

Eric 結論：行程類要走「**抓範本→套日期→依需求微調（不大改、架構不變）**」，不要 RAG＋web 混產物。

## 2. 四項定案（brainstorm 2026-06-17）

| # | 決策 | 選定 |
|---|------|------|
| 1 | 行程類路由 | 走**現有 golden draft 路**（`selectItineraryReference` + `customer_itinerary_v1` + `gateCustomerItineraryDraft`），不走通用 agentic 自由寫手 |
| 2 | 「是不是行程類」怎麼判 | **複用現有 intent classifier**：vision 抽完 need→summary 丟 classifier 判 `draft`/`respond` |
| 3 | golden 參考源 | **兩套 curated 標準範本**（見 §4）為主幹；第二階 RAG 掃 private_2026「行程框架」找相似真實案當微調素材 |
| 4 | 兩套範本怎麼選 | **LLM 依客人需求自選**（兩套都餵進 prompt，依人數/天數/是否跨清萊深度選最近一套再微調） |

附帶：**web_search 對行程類全關**（解決「RAG＋web 混在一起很怪」）。web search 搜尋品質是**另一案**，本刀不碰。

## 3. 架構與資料流

```
截圖 + tag bot（webhook 現路，不動）
  └─① vision 抽 need（修日期 OCR bug）
        VisionNeedBrief{ summary, dates, party, kids, themes, region, gaps[] }
  └─② 複用 intent classifier 判 summary
        ├─ respond（非行程開放題）→ 現有 agentic smart-reply ＋ web_search（不變）
        └─ draft（行程類）→ golden 路（↓）
  └─③ golden 排程（行程類專走）
        a. LLM 依需求選範本：清邁親子5D4N / 泰北深度6D5N（兩套都餵 prompt）
        b. RAG 掃 private_2026 itinerarySnippet 找相似真實案 → 當「微調素材」
        c. 以 golden 架構為主幹，套日期＋依客人需求微調內容（不大改、架構不變）
        d. 過 gateCustomerItineraryDraft（round-trip + lint）→ 失敗重產1次→再失敗降級標 ⚠️
  └─ 回夥伴群（兩段：對外可複製 ＋ 內部待確認）
```

**關鍵反轉**：現有 draft 路是「RAG 骨架為主、範本 fallback」；本設計改成**「golden 範本為主幹、RAG 相似案只當微調素材」**——優先序對調，是 `selectItineraryReference` 角色要改的地方。

## 4. 兩套 Golden 標準範本（Eric 的 LINE 圖文招牌套餐設計，權威範本）

> 這兩套**不在 Notion**，是 Eric 手工招牌設計。實作時收成 curated fixture/reference（比照 `customer-itinerary-golden.ts` 的 李家 7D6N），進版控當行程類輸出的**架構/格式標準**。客人沒特殊需求時可近乎照貼（只換日期/人數 header）。

### 4.1 清邁親子 5 天 4 夜

```
<清邁5天4夜>
📅 日期：2026//～/
👨‍👩‍👧‍👦 人數：幾大幾小（幾歲，身高，需不需要兒童座椅，有無長輩，有無特殊備註事項）

Day 1｜抵達清邁・放鬆展開旅程
・機場接機 (長榮 BR257 7:20~10:35)
・Nakhonping Exchange換匯
午餐：Neng's Clay Oven Roasted Pork – Muang Mai Market (清邁必吃脆皮豬)
・泰服體驗1小時，請專業攝影師拍攝 (古城塔配門/柴迪隆寺，統計女生幾位化妝)
・芒果糯米飯 (下午茶點心)
晚餐: Kung Yim Shop (2nd Branch) (泰國蝦吃到飽)
・住宿：

Day 2｜大象互動 + 黏黏瀑布
**8:00出發**
・大象保護營 (洗澡+做大象午餐+餵食+跟象拍照)
午餐：營區附近好吃的泰式熱炒
・黏黏瀑布
晚餐：Samsen Villa (米其林)
人妖秀 (Miracle Cabaret Chiang Mai，20:00 開始表演)
・住宿：

Day 3｜水上樂園 + 夜間動物園
**8:00出發**
・清邁大峽谷水上樂園
午餐: 水上樂園區裡用餐
・藝術村 (Baan Kangwat，禮拜二沒開)
・夜間動物園
晚餐：黑森林餐廳 (禮拜三沒開)
・住宿：

Day 4｜湄林親子活動
**8:30出發**
・鳳凰冒險公園Phoenix Adventure
午餐：The Kad Farang Mae Rim
・蛇園表演
・豬豬溜滑梯
・Big C採買紀念品
晚餐: 清邁康托克帝王餐晚宴＆文化表演秀
・住宿：

Day 5｜收心慢遊・送機回國
早餐後退房
**9:30送機**
・安排送機服務 (長榮 BR258  11:50~16:30) ，結束愉快又充實的泰北親子旅程
```

### 4.2 泰北芳縣深度 7 天 6 夜

```
Day 1｜抵達清邁 -> 湄登 -> 清道 -> 芳縣
機場接機 (長榮 BR257 7:20~10:35)
換匯所: Nakhonping Exchange
午餐: Pang Pao Beach (泰北森林美學莊園)
出發前往芳縣
・清道溶洞
・清道咖啡館
(沿途經過清道休息一下，車程比較長約3~3.5小時)
抵達芳縣 (約傍晚18:00左右抵達)
晚餐: 雲南火鍋 （一起用餐！）
住宿: 芳縣 Huen San Fang hotel (我們家的民宿)

Day 2｜芳縣 -> 金三角
**8:30出發**
・翠峰茶園 (享用特色茶餐點)
・美塞關口
・天空步道
・金三角大佛 (湄公河遊船)
・寮國一日遊
晚餐: 清萊道地熱炒
逛清萊夜市、按摩
住宿：清萊 Sann Hotel Chiang Rai

Day 3｜清萊 -> 清邁
**8:30出發**
用完早餐返回清邁 (預估傍晚15:30抵達清邁市區)
途中經過清萊溫泉（休息站）
・湄康蓬村
・瓦洛洛市場 (買伴手禮便宜)
・古城的1~2個特色廟宇 (柴狄龍寺/帕刑寺)
・按摩
晚餐: Kung Yim Shop (2nd Branch) (泰國蝦吃到飽)
住宿: 清邁古城 The Empress Premier Chiang Mai

Day 4｜茵他儂國家公園
**8:30出發**
・茵他儂國家公園主峰與雙龍塔
・Ban Mae Klang Luang 卡倫族社區生態村
午餐：苗族市場用餐
・參觀苗族市場
・The Garden Inthanon Cafe'
・瓦吉拉瀑布
晚餐: Ribs & Co Chiang Mai (豬、牛肋排)
住宿: 清邁古城 The Empress Premier Chiang Mai

Day 5｜南邦一日
**9:00 出發**
・南邦馬車遊城 5 公里（Museum Lampang 上車，先以 5 公里方案估算）
  備註：若想中途停留拍照或調整路線，可改為包車自由路線；也可依需求改選 3 公里方案。
  參考路線：白橋 / 黑橋（Ratsadaphisek Bridge；สะพานรัษฎาภิเศก；Black Bridge，兩座橋距離約 10 分鐘）
・南邦壁畫街
午餐：แสร้งว่าไทยโมเดิร์นคูซีน
・南邦鑾寺 Wat Phra That Lampang Luang
・南邦野味市場（通堅市場）Kad Tung Kwian Market
晚餐：Samsen Villa (米其林)
住宿：清邁古城 The Empress Premier Chiang Mai

Day 6｜收心慢遊・送機回國
・早餐後退房 9:30送機
送機 (長榮 BR258 11:25-15:50)，平安返家
```

> 註：泰北深度＝**6天5夜**（Day 1–6 完整，原「7天6夜」為筆誤，已更正）。

## 5. 要焊/要改的點（實作清單，下個 session）

1. **修日期 OCR bug**：vision 抽 need 要正確讀 `7/1–7/5`（5 天），不可誤成跨月。加 fixture 回歸（思思圖→正確 dates）。
2. **vision→intent classifier 接線**：summary 丟現有 classifier 判 draft/respond（決策 #2）。
3. **golden 範本資產**：§4 兩套收成 curated fixture/reference 進版控。
4. **`selectItineraryReference` 優先序反轉**：golden 範本為主幹、RAG private_2026 相似案為微調素材（決策 #3 反轉）。
5. **LLM 選範本**：兩套 golden 餵 prompt，依需求自選＋微調（決策 #4）。
6. **行程類關 web_search**：draft 路不掛 web 工具。
7. **沿用** `gateCustomerItineraryDraft`（round-trip + lint）：過閘原樣回／失敗重產1次／再失敗降級標 ⚠️。

## 6. 護欄與紀律

- 三閘 default off ⇒ gate-off byte-identical（沿用現規）。
- bot 只回夥伴群；客人 OA 永不自動回（CLAUDE.md Operating Boundaries）。
- 微調「不大改、架構不變」＝system prompt 規範 + gate round-trip 結構檢查雙保險。
- PII：golden 是 Eric 自有招牌範本（無客人 PII）；RAG 相似案仍走 sanitizer。

## 7. 明確排除（YAGNI / 另案）

- **web search 搜尋品質**＝Eric 指定「後續再討論」，本刀不碰。
- 非行程開放題的 agentic smart-reply 路徑**不動**（維持現狀）。
- 報價計算器串接＝另案。

## 8. 下一步

新 session（綠區）：`superpowers:writing-plans` 對本 doc 出 implementation plan → subagent-driven TDD。風險最高＝§5.4 優先序反轉與 §5.1 日期 bug 回歸。
