# Itinerary Template and Parser Format SOP

> Scope: LINE AI Agent 產生初版行程、整理 Eric pasted cases、以及未來貼到後台報價解析頁時使用。客人看得懂優先，parser 能解析第二優先；但格式不要過度自由。
>
> `last_verified: 2026-07-10`

## 三層結構

1. 案例庫：`docs/ai-agent-knowledge/cases/itinerary-templates/*.md`
2. SOP：本檔與 `rules/` 內其他營運規則。
3. Parser 格式契約：行程主體維持 `customer_itinerary_v1`，報價另放 `<報價>` 區塊，不混入行程主體。

## Case YAML Metadata

每個完整案例檔都要用 YAML frontmatter 開頭：

```yaml
type: itinerary_template
title:
days:
nights:
area:
themes:
audience:
vehicle_notes:
flight_notes:
must_confirm:
parser_format: customer_itinerary_v1
source: Eric_pasted_thread
status: draft
confidence: medium
last_reviewed: 2026-06-05
```

`themes` 建議使用：`family`, `kids`, `elderly`, `chiangmai`, `chiangrai`, `lampang`, `lamphun`, `mae_kampong`, `fang`, `inthanon`, `elephant`, `night_safari`, `rainy_season`, `cafe`, `market`, `adventure`, `slow_travel`。

`must_confirm` 可放：日期、人數、小孩年齡/身高、兒童座椅、是否加購旅遊保險、航班、住宿/上車地點、行李件數與尺寸、是否需要導遊、是否有長輩、是否有指定景點/餐廳。

## Parser Body Format

行程主體請統一接近：

```text
<套餐訂製>標題
📅 日期：YYYY/MM/DD～YYYY/MM/DD
👨‍👩‍👧‍👦 人數：幾大幾小（幾歲，身高，需不需要兒童座椅，有無長輩，有無特殊備註事項）

Day 1｜主題標題
**8:30 出發**
・景點/活動
午餐：餐廳名稱（備註）
・景點/活動
晚餐：餐廳名稱（備註）
・住宿：
```

格式規則：

- 每天必須用 `Day X｜...`。
- 景點/活動盡量用 `・`。
- 午餐/晚餐固定用 `午餐：`、`晚餐：`。
- 出發時間建議用 bold，例如 `**8:30 出發**` 或 `**9:00 出發**`。
- 住宿欄位要保留，使用 `・住宿：` 或 `住宿：`。
- 備註可以保留，但不要破壞 parser 主要結構。
- Google Map 連結不是必要。
- 如果資訊不完整，保留空欄或加 `待確認`，不要亂補不存在的內容。
- 不要把餐廳/景點藏在自然語句裡。
- 不要混用太多格式。
- 不要亂補不存在的價格。
- 不要把尚未確認的資料寫成確定。

## 航班/第一天最後一天 SOP

- 長榮/華航多為早上抵達，可第一天直接旅遊。
- 亞航常晚上抵達，可能建議 Grab 或單點接送。
- 星宇多為傍晚抵達，通常只接送到飯店。
- 亞航回程若跨凌晨，最後一天可能包車到晚間送機，需注意超時。
- 早班機抵達可排換匯、午餐、輕量市區/泰服/點心。
- 中午前回程通常最後一天以送機為主，不硬排行程。
- 純機場單程接送是轎車 THB 500／趟或 Van THB 700／趟，不算完整包車日；同日若排明顯旅遊行程，改按包車日計價。

## 市集/公休 SOP

- 真心市集、椰林市集多為週末；預設只排一個，除非客人要求。
- Baan Kang Wat 週二休。
- 黑森林餐廳週三休。
- 公休與營業時間屬可變資訊，正式產出前需 web search 或請 Eric 確認。

## 車型/行李 SOP

- 接送機先按客人人數分車：6–7 人不加行李車；8–9 人固定加 1 台；10–14 人分乘兩台 Van 後不加；15–18 人固定加 1 台。行李車 THB 500／台／趟；載客 Van 仍為 THB 700／台／趟。19 人以上人工確認。

- 成人、兒童與嬰幼兒都計入總佔位人數；兒童安全座椅安裝在該孩子的座位，不另加算一位旅客。
- 2–3 位乘客使用小轎車；一位乘客人工確認。
- 4–9 位乘客使用一台 Toyota Commuter 10 人座 Van；四人親子家庭也一樣，不因有小朋友改用公開轎車價。
- 10–18 位乘客使用兩台 Van；19 人以上人工確認車隊與報價。
- 中文導遊是選配且 2–3 人也可自動報價；人數不會產生強制導遊規則。
- SUV 不是公開車型或價格承諾，只能作為不加價的偶發內部調度／升等；客人指定 SUV 或有特殊空間需求時人工確認。
- 機場接送 + 行李 6 件以上，必須確認尺寸/件數，必要時評估行李車或第二台車。

## 用車費用守門

- 旅遊保險為選配，THB 100／人／趟；加購時嬰幼兒也計入。
- 兒童安全座椅 THB 500／日／張，不重複計算乘客人數。
- 清邁包車日 10 小時；清萊／金三角包車日 12 小時；現場另有 30 分鐘彈性。
- 超過彈性後 THB 300／小時／台，不另收導遊超時費。

## 報價解析格式 SOP

- Day X 標題要保留。
- 每天景點用 `・`。
- 午餐/晚餐標籤要固定。
- 出發時間建議用 bold。
- 住宿欄位要保留。
- 報價另放 `<報價>` 區塊，不要混入行程主體。
- 門票另列，避免 parser 漏抓。
- 若有括號門票，例如 `大象門票（大人）950*4`，parser 已修過，但仍建議整理成清楚文字。

## AI Agent Output Rules

- 先檢索 itinerary template，再依客人條件做取捨。
- 內部已知案例與上網查到資訊要分開標示。
- 若使用模板但缺日期、人數、小孩年齡、航班、住宿或行李資訊，列入 `must_confirm`，不要假設。
- 住宿推薦可以比較與建議，但不代訂、不代付。
- 正式報價仍需另走 quote gate；不要在 itinerary template 主體內塞價格。
