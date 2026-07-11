# 清微旅行 LINE Rich Menu Production Spec

> **版本：2026-07-10 v1；狀態：已核准規格，尚未上線。**
> 本文件取代 `docs/line-oa-rich-menu-documentation.md`、`docs/line-oa-mop-execution-plan.md`、`docs/line-oa-quick-guide.md` 的版型、價格、關鍵字與上線步驟；舊文件只保留歷史脈絡。
> **硬性閘門：**建立測試 rich menu、連結測試帳號、修改歡迎訊息／關鍵字回覆、設為 default 或刪除任何 live 設定前，都必須在執行當下取得 Eric 明確確認。本文不授權外部 mutation。

---

## 1. 目標與資訊架構

圖文選單不是第二個內容網站，也不保存價格。它只負責把客人送到官網的 canonical section，或開始一段可結構化的詢價對話。

```text
┌────────────────┬────────────────┬────────────────┐
│ 一日遊          │ 多日客製        │ 包車價格        │
│ URI             │ URI             │ URI             │
├────────────────┼────────────────┼────────────────┤
│ 用車須知        │ 爸媽開的        │ 開始詢價        │
│ URI             │ URI             │ MESSAGE         │
└────────────────┴────────────────┴────────────────┘
```

### 六格精確 action

| 格 | 顯示文字 | Action | 精確目的地／訊息 |
|---:|---|---|---|
| 1 上左 | 一日遊 | URI | `https://chiangway-travel.com/tours#day-tours` |
| 2 上中 | 多日客製 | URI | `https://chiangway-travel.com/tours#packages` |
| 3 上右 | 包車價格 | URI | `https://chiangway-travel.com/services/car-charter#pricing` |
| 4 下左 | 用車須知 | URI | `https://chiangway-travel.com/services/car-charter#faq` |
| 5 下中 | 爸媽開的 | URI | `https://chiangway-travel.com/blog/eric-story-taiwan-to-chiang-mai` |
| 6 下右 | 開始詢價 | Message | `我要詢價` |

規則：**只有「開始詢價」可發送訊息。**其餘五格全部使用 HTTPS URI，不建立 `VIP 價格`、`小車價格`、固定 5／7／9 天或票券／民宿關鍵字入口。

品牌故事 URL 已由以下 active code 交叉確認，不可改猜其他路徑：

- `src/lib/navigation.ts`
- `src/components/sections/WhoWeAre.tsx`
- `src/sanity/schemas/landingPage.ts`

## 2. 圖像與點擊座標

本案採 LINE 官方 large rich-menu 範例尺寸 **2500 × 1686 px**。官方支援 JPEG／PNG、寬 800–2500 px、高至少 250 px、寬高比至少 1.45、檔案最大 1 MB；本案固定輸出 2500 × 1686，避免多尺寸漂移。詳見 [LINE Developers: Use rich menus](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/) 與 [Messaging API: Upload rich menu image](https://developers.line.biz/en/reference/messaging-api/#upload-rich-menu-image)。

### 2.1 點擊區域（完整覆蓋、無縫隙、無重疊）

| 格 | x | y | width | height |
|---:|---:|---:|---:|---:|
| 1 | 0 | 0 | 833 | 843 |
| 2 | 833 | 0 | 834 | 843 |
| 3 | 1667 | 0 | 833 | 843 |
| 4 | 0 | 843 | 833 | 843 |
| 5 | 833 | 843 | 834 | 843 |
| 6 | 1667 | 843 | 833 | 843 |

### 2.2 內部安全區（清微製作規則，不是 LINE 平台限制）

每格的文字、Logo 與主要圖示離左右邊界至少 72 px、上下邊界至少 64 px；分隔線兩側 48 px 內不放關鍵字。對應安全內容矩形：

| 格 | safe x | safe y | safe width | safe height |
|---:|---:|---:|---:|---:|
| 1 | 72 | 64 | 689 | 715 |
| 2 | 905 | 64 | 690 | 715 |
| 3 | 1739 | 64 | 689 | 715 |
| 4 | 72 | 907 | 689 | 715 |
| 5 | 905 | 907 | 690 | 715 |
| 6 | 1739 | 907 | 689 | 715 |

### 2.3 視覺與檔案

- 主色：品牌黃＋奶油白；深炭色文字，維持 WCAG 對比方向。
- 每格只放一個簡單圖示、精確中文標籤與最多一行輔助詞；不在選單底圖排價格。
- 圖示／裝飾可由 image model 生成，但最終中文、Logo、格線與對齊必須用 HTML/CSS、SVG 或 Canvas 合成。
- 「開始詢價」使用最清楚的高對比 CTA；其餘五格視覺權重一致。
- Master：`public/images/line/rich-menu-main-v2026-07-10.png`
- 檢視用：`public/images/line/rich-menu-main-v2026-07-10-preview.png`
- API body 建議保存：`scripts/line/rich-menu-main-v2026-07-10.json`（Task 8 產出，不在本文件階段建立）。
- 上傳前確認像素為 2500 × 1686、格式 PNG、檔案**小於 1,000,000 bytes**。若優化 PNG 仍超限，才改高品質 JPEG，並重新檢查中文字邊緣。

## 3. 可重現的 rich-menu object

`name` 供後台辨識，`chatBarText` 顯示在聊天室底部。以下 body 可先送官方 validate endpoint；`selected: true` 代表打開聊天室時預設展開選單。

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": true,
  "name": "chiangway-main-2026-07-10-v1",
  "chatBarText": "清微旅行選單",
  "areas": [
    {
      "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "label": "一日遊",
        "uri": "https://chiangway-travel.com/tours#day-tours"
      }
    },
    {
      "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
      "action": {
        "type": "uri",
        "label": "多日客製",
        "uri": "https://chiangway-travel.com/tours#packages"
      }
    },
    {
      "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "label": "包車價格",
        "uri": "https://chiangway-travel.com/services/car-charter#pricing"
      }
    },
    {
      "bounds": { "x": 0, "y": 843, "width": 833, "height": 843 },
      "action": {
        "type": "uri",
        "label": "用車須知",
        "uri": "https://chiangway-travel.com/services/car-charter#faq"
      }
    },
    {
      "bounds": { "x": 833, "y": 843, "width": 834, "height": 843 },
      "action": {
        "type": "uri",
        "label": "爸媽開的",
        "uri": "https://chiangway-travel.com/blog/eric-story-taiwan-to-chiang-mai"
      }
    },
    {
      "bounds": { "x": 1667, "y": 843, "width": 833, "height": 843 },
      "action": {
        "type": "message",
        "label": "開始詢價",
        "text": "我要詢價"
      }
    }
  ]
}
```

建立順序以官方流程為準：準備圖片 → validate／create rich menu → upload image → set default。Rich-menu 圖片不能原地替換；更新圖像時必須新建 rich menu object，不能覆蓋舊圖。詳見 [Rich menus overview](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/)。

## 4. Exact welcome message

以下文字逐字使用，不混入固定套餐價或「中文司機」承諾：

```text
嗨，歡迎來到清微旅行 👋

我們是住在清邁的台灣爸爸 Eric 和泰國媽媽 Min。
標準包車安排泰國司機，出發前先確認行程，旅途中有 LINE 中文支援；需要隨車中文溝通或景點導覽時，可另外選配中文導遊。

你可以點下方選單看一日遊、多日客製、包車價格與用車須知。
想詢價，請點「開始詢價」，或直接傳「我要詢價」。

我們會依旅行日期、總佔位人數、路線與車型提供正式報價。
```

歡迎訊息只負責定位與下一步，不一次塞完整表單。表單由 `我要詢價` 的唯一回覆承接。

## 5. `我要詢價` 的唯一 intake 回覆

### 5.1 精確回覆文字

```text
收到，我來幫你整理詢價 🙌
請複製下列格式回覆；還不確定的項目可以寫「未定」。

【旅行日期／天數】
【成人人數】
【3–11 歲兒童人數＋年齡】
【0–2 歲嬰幼兒人數＋年齡】
【想去的地點／必排行程】
【飯店或接送地點】
【航班編號與時間】沒有接送機可留白
【行李箱／嬰兒車數量】
【安全座椅需求】請附孩子年齡、體重與張數
【中文導遊】需要／不需要／想先了解

每位乘客（含嬰幼兒）各佔一席；安全座椅安裝在該孩子的乘客座位，不另加算一人，但需納入車內座位配置。收到資料後，我們會確認車型、行程與泰銖 THB 正式報價。

接送機行李車會依客人人數自動安排：6–7 人不加；8–9 人加 1 台；10–14 人分乘兩台 Van 後不加；15–18 人加 1 台。行李車 THB 500／台／趟，載客 Van 仍為 THB 700／台／趟。
```

### 5.2 回覆所有權

上線前必須從普通 LINE 帳號實測，確認目前是 LINE OA Manager 關鍵字回覆、Messaging API webhook 或 AI agent 哪一層回應 `我要詢價`。production 最終只能有**一個 owner**：

- 若 webhook／AI agent 已正式承接，Manager 不再建立同字關鍵字回覆。
- 若 webhook 尚未上線，才在 Manager 建立上述 exact reply。
- 不得同時開兩層造成重複訊息；也不得先停掉現有 owner 再測試新 owner。

## 6. 上線前備份

### 6.1 執行當下確認

在任何 live 寫入前，先向 Eric 展示「舊狀態 → 新狀態」差異並取得一次明確確認。確認內容至少包含：

- 新圖預覽與 SHA-256。
- 六格 action 表與 JSON body。
- welcome message 與 `我要詢價` 回覆全文。
- 現行 default rich menu ID／來源（Messaging API 或 OA Manager）。
- 回覆 owner、預定切換時間與 rollback owner。

### 6.2 備份目錄與檔案

備份放在使用者私有、未追蹤且不含 token 的位置，例如：

```text
%USERPROFILE%\line-oa-backups\chiangway\YYYYMMDD-HHmm\
  current-default-source.txt
  current-default-rich-menu-id.txt
  rich-menu-list.json
  current-rich-menu.json
  current-rich-menu-image.png
  welcome-message.txt
  keyword-and-auto-replies.md
  oa-manager-settings.png
  rollback-steps.txt
```

不得把 Channel access token、secret、登入 cookie 或客戶資料寫進 repo 或備份說明。

### 6.3 讀取現況（只讀）

| 目的 | Method／endpoint 或 UI |
|---|---|
| 列出 API rich menus | `GET https://api.line.me/v2/bot/richmenu/list` |
| 查 API default | `GET https://api.line.me/v2/bot/user/all/richmenu` |
| 查指定 object | `GET https://api.line.me/v2/bot/richmenu/{richMenuId}` |
| 下載指定圖片 | `GET https://api-data.line.me/v2/bot/richmenu/{richMenuId}/content` |
| Manager default／期間／版型 | LINE Official Account Manager 截圖＋文字抄錄 |
| 歡迎訊息、關鍵字、自動回覆、Webhook response mode | Manager 各頁截圖＋全文抄錄，再由普通帳號發一次測試訊息確認 |

注意：per-user rich menu 優先於 Messaging API default，而 Messaging API default 又優先於 Manager default；備份時必須記錄來源，否則 rollback 可能看似成功卻仍顯示另一層選單。官方優先序見 [Rich menus overview](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/#display-priority-of-rich-menus)。

## 7. Preview、建立與切換 runbook

以下每個寫入步驟都在 §6 的 action-time confirmation 之後才可執行。

### Phase A：離線預覽（無外部寫入）

1. 渲染 2500 × 1686 主圖，驗證像素、格式、byte size、SHA-256。
2. 在 375 px 與 430 px 等效手機寬度縮放檢查中文字，不可只看桌面原圖。
3. 將六個座標框疊在 preview 上，檢查分隔線與圖示／文字落點。
4. 在瀏覽器逐一開五個 URL，確認網址、HTTPS、section anchor 與返回 LINE 的體驗。
5. 將 preview、JSON、welcome、intake 與 rollback 摘要一次交給 Eric 確認。

### Phase B：建立未公開的新 menu

1. `POST https://api.line.me/v2/bot/richmenu/validate` 驗證 §3 JSON。
2. `POST https://api.line.me/v2/bot/richmenu` 建立新 object，保存回傳的 `newRichMenuId`。
3. `POST https://api-data.line.me/v2/bot/richmenu/{newRichMenuId}/content` 上傳 final PNG，`Content-Type: image/png`。
4. `GET` 新 object 與 image 回讀，核對尺寸、六格 action、名稱與圖片 hash。
5. **尚未設 default；尚未刪除舊 menu。**

若使用 OA Manager 而非 API，必須選官方 2 × 3 template，逐格貼入 §1 的 action，並保存 Manager preview；不可自由拖拉出與 §2 不同的點擊區。

### Phase C：普通帳號 canary

優先用一個已知 user ID 的普通測試帳號做 per-user link canary；這也是外部 mutation，仍須取得確認。若無安全的測試 user ID，使用 OA Manager preview，並將普通帳號實測延至 default 切換後立即執行。

Canary 驗收完成後才處理 welcome／`我要詢價` owner，避免選單尚未可用就先改對話入口。

### Phase D：切換 default

1. 再次確認 `newRichMenuId`、舊 default／來源與 rollback 指令。
2. `POST https://api.line.me/v2/bot/user/all/richmenu/{newRichMenuId}` 設為 Messaging API default；或在 OA Manager 發布，但兩者只選一種主控來源。
3. 關閉並重新打開普通帳號聊天室；Messaging API default 可能需最多約一分鐘才在重開聊天室後生效。
4. 執行 §8 全部驗收。任何 P0／P1 失敗立刻 rollback，不先邊改邊觀察。
5. 新舊 menu 都保留至少 7 天；穩定期內不刪舊 menu／圖片。

## 8. 普通 LINE 帳號驗收

測試帳號必須是非管理員的普通 LINE 帳號；若測歡迎訊息，使用從未加好友的乾淨帳號，或在清楚知道影響下 block／unblock 專用測試帳號。

| # | 操作 | 預期結果 |
|---:|---|---|
| 1 | 重開 OA 聊天室 | 顯示新 2 × 3 選單；格線、文字與圖示清楚 |
| 2 | 點「一日遊」 | LINE 內建瀏覽器開啟 `/tours#day-tours` 並落在一日遊區 |
| 3 | 點「多日客製」 | 開啟 `/tours#packages` 並落在多日套裝區 |
| 4 | 點「包車價格」 | 開啟 `/services/car-charter#pricing` 並落在價格區 |
| 5 | 點「用車須知」 | 開啟 `/services/car-charter#faq` 並落在 FAQ 區 |
| 6 | 點「爸媽開的」 | 開啟品牌故事 `/blog/eric-story-taiwan-to-chiang-mai`，不是 `/about` 或首頁 |
| 7 | 點「開始詢價」 | 聊天室只送出一次精確文字 `我要詢價` |
| 8 | 觀察回覆 | 只收到一次 §5 exact intake；沒有重複 Manager／webhook 回覆 |
| 9 | 檢查服務用字 | 沒有中文司機、強制導遊、固定台幣／`$` 價格、票券或民宿舊入口 |
| 10 | 新好友測試 | 只收到一次 §4 welcome，且選單可開啟 |
| 11 | iOS／Android | 至少各一台檢查五個 anchor、訊息 action 與圖像可讀性 |
| 12 | 既有 per-user menu 帳號 | 記錄是否被較高優先序覆蓋；不可把特例誤判成 default 失敗 |

驗收證據保存：日期時間、LINE app／OS 版本、截圖、五個實際落地 URL、`newRichMenuId`、welcome／intake 是否各一次、發現與處理結果。

## 9. Rollback

### 9.1 舊版原為 Messaging API default

1. `POST https://api.line.me/v2/bot/user/all/richmenu/{oldRichMenuId}` 把舊 ID 設回 default。
2. 恢復備份的 welcome／關鍵字／response owner。
3. 普通帳號重開聊天室並重測舊選單與一個文字回覆。

### 9.2 舊版原為 OA Manager default

1. `DELETE https://api.line.me/v2/bot/user/all/richmenu` 解除新 Messaging API default，讓較低優先序的 Manager default 重新生效；或直接在 Manager 發布備份版本，依本次選定的主控方式執行。
2. 恢復備份的 welcome／關鍵字／response owner。
3. 普通帳號重開聊天室並確認 Manager default 回復。

### 9.3 Canary per-user link

若只連結過測試帳號，先解除該 user 的 per-user rich menu；否則它會繼續蓋過 default，造成 rollback 誤判。

Rollback 完成後不要立刻刪除失敗的新 menu；先保存 object、圖片、錯誤證據與時間線。確認舊版恢復後，再另開修正版 ID。

## 10. Go／No-go checklist

- [ ] 官網五個 URL 與 section anchors 已部署且以 LINE 內建瀏覽器實測。
- [ ] 圖片 2500 × 1686、PNG/JPEG、< 1 MB，文字在手機縮圖仍清楚。
- [ ] 六格 action JSON 通過 validate；只有第 6 格是 message。
- [ ] `我要詢價` 只有一個回覆 owner，exact intake 已測。
- [ ] 現行 menu、圖片、welcome、關鍵字／自動回覆與 response mode 已備份。
- [ ] 已判定舊 default 是 API 還是 Manager，rollback 分支可立即執行。
- [ ] Eric 已看到精確差異並在**執行當下**明確確認。
- [ ] 普通帳號 canary 全過；任何 P0／P1 均為 No-go。
- [ ] 上線後證據、ID、時間與結果已回填；舊 menu 保留至少 7 天。

## 11. 本版明確淘汰的舊內容

- 1 大＋3 小或舊六格版型。
- `VIP 價格`、`小車價格` 與 `$`／NT$ 固定車價回覆。
- 票券代訂、芳縣民宿、家庭實拍作為主選單入口。
- 固定 5／7／9 天套餐自動回覆。
- 「中文司機」、依人數強制導遊、司機與導遊各收 THB 200 超時等舊話術。
- 多個按鈕同時送訊息；本版只有「開始詢價」送出 `我要詢價`。
