# Phase 7：LINE OA AI 客服助理系統 - 規格審查與實作風險備忘

**日期**: 2026-03-22
**狀態**: Review only，尚未進入實作
**對應規格**: `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md`

---

## 一、結論

這份 Phase 7 規格方向是對的，產品價值也很明確：

- 不碰前台 UX，直接優化 Eric 每天最花時間的營運流程
- 維持「AI 草稿 + 人工決策」，沒有走高風險的全自動回覆
- 跟現有 Next.js + Vercel + Sanity 架構相容，整體可落地

但目前還有幾個 **先補再做會比較安全** 的缺口，主要集中在：

1. **對話狀態機與 webhook 冪等性還不夠明確**
2. **舊客識別、資料保留與學習資料界線還不夠嚴謹**
3. **規格缺少測試策略、code review gate、失敗復原流程**
4. **部分環境變數與現有 codebase 不一致，直接做會出現實作漂移**

換句話說：**不是不能做，而是建議先把 spec 補到「可安全實作」的程度再開始。**

---

## 二、阻塞級問題（建議先修規格）

### 1. Webhook / Callback 缺少明確冪等設計

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:124`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:130`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:191`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:691`

**風險**

- LINE webhook retry 時，可能重複建立 Topic、重複產草稿、重複推送到 Telegram
- Eric 多次點按鈕或 TG callback retry 時，可能重複送出同一則訊息到 LINE
- 客人已經回新訊息，但舊草稿仍被送出，會造成上下文錯位

**建議補規格**

- 所有 LINE event 以 `eventId` 或等價唯一鍵做去重
- 所有 TG callback action 以 `actionId` / `draftId` 做單次執行保證
- `Conversation` 要補 `pendingDraftId`、`lastProcessedLineEventId`、`lastSentMessageId`、`sendStatus`
- 明確定義「客人新訊息到達後，舊草稿是否自動失效」

### 2. 舊客識別邏輯太模糊，容易誤判

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:128`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:129`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:256`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:546`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:656`

**風險**

- 如果靠 `displayName` 對 Notion 客戶名稱比對，會有同名、暱稱變動、錯字、夫妻共用帳號等問題
- 一旦誤判成舊客，AI 可能拉錯歷史上下文，甚至讓 Eric 看到不該關聯的舊資料

**建議補規格**

- 系統識別主鍵應以 `lineUserId` 為主
- `isReturningCustomer` 應拆成：
  - `hasSeenBeforeInSystem`
  - `notionMatchConfidence`
  - `matchedNotionRecordIds`
- Notion 比對應定義成「提示資訊」，不是唯一真相來源

### 3. 安全性章節不足以覆蓋個資與學習資料風險

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:381`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:447`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:801`

**風險**

- 規格會存客戶姓名、LINE user id、旅遊日期、孩童年齡、特殊需求、原始對話
- 但目前只寫「只存後端，符合 PDPA」，沒有保留期限、刪除策略、學習資料抽樣規則
- `7 天無互動直接刪除` 和 `成交保留供 AI 學習` 之間，缺少明確資料生命週期

**建議補規格**

- 明確拆分「營運資料」與「學習資料」
- 為每類資料定義 retention policy：
  - 原始未成交對話保留多久
  - 成交對話多久後做匿名化或降敏
  - 哪些欄位不可進入 few-shot / RAG
- 至少要定義：
  - 刪除請求怎麼處理
  - 匯出請求怎麼處理
  - 哪些欄位在 Telegram 不顯示完整內容

### 4. 目前規格把太多事情塞進 1 秒 webhook 路徑

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:124`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:132`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:600`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:608`

**風險**

- webhook 路徑同時要驗簽、抓 profile、比 Notion、寫上下文、跑 AI、推送 TG
- 在 Vercel serverless 上，這會增加 timeout、重試、重複處理和觀測困難

**建議補規格**

- 改成兩段式：
  1. `/api/line-webhook` 只做驗簽、去重、落 event、快速回 200
  2. 背景 worker / async job 再處理 profile lookup、AI、TG 推送
- 若不引入 queue，至少先定義一個 durable event store + retry worker

---

## 三、高風險但可在實作時一起解的問題

### 5. 「Rate Limiting 防 webhook 重放」不等於 replay protection

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:538`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:806`

**現有 codebase 現況**

- `src/lib/api-auth.ts:133` 到 `src/lib/api-auth.ts:189` 是簡單記憶體 Map
- 註解已明寫 production 應改用 Redis 或類似方案

**風險**

- Vercel 多 instance 或 cold start 下，記憶體 rate limit 不能防重播
- replay attack 和正常 burst traffic 也不是同一件事

**建議**

- 用 durable KV / DB 記錄已處理 event id
- 將 rate limit 和 idempotency 拆成兩層機制，不要混用

### 6. 環境變數與現有 Notion 架構有漂移

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:790`

**現有 codebase 現況**

- `.env.example:7` 使用 `NOTION_TOKEN`
- `src/lib/notion/client.ts:9` 也讀 `NOTION_TOKEN`
- `src/lib/notion/client.ts:11` 到 `src/lib/notion/client.ts:14` 是年度分開的 database id

**風險**

- 規格寫 `NOTION_API_TOKEN` + 單一 `NOTION_DATABASE_ID`
- 直接照 spec 做，會和既有 dashboard / notion 客資邏輯產生兩套命名與兩套資料模型

**建議**

- 先定一版命名規則，再開發
- 若 Phase 7 真的只吃單一 DB，也要明說與既有 dashboard Notion client 是否共用

### 7. 資料模型還缺審計欄位，之後 debug 會很痛

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:418`

**建議至少補上**

- `sourceEventId`
- `draftId`
- `actionId`
- `replyTokenExpiresAt`
- `lineMessageId`
- `telegramMessageId`
- `updatedBy`
- `deletedAt`
- `cleanupReason`

### 8. Housekeeping 規則可能誤刪重要對話

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:355`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:705`

**風險**

- 7 天沒互動直接刪除，可能刪掉正在考慮中的客人
- 也可能把之後可回收分析的詢價資料全丟掉

**建議**

- 將 `cold` 與 `deleted` 分開
- 先自動封存，再延遲硬刪除
- 保留極簡 metadata，避免完全失去營運分析資訊

### 9. 圖片流程還缺內容安全與儲存規則

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:278`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:697`

**風險**

- LINE 圖片訊息需要額外抓內容
- 需要限制大小、MIME type、暫存時間、可重送方式
- TG 端常用照片庫若沒有明確儲存規範，會慢慢變成無治理的媒體倉庫

---

## 四、中度技術債與營運風險

### 10. 成本估算與 Push 配額需要再確認

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:817`

**風險**

- 規格目前預設 Push Message 是主要回覆方式
- 若 LINE OA 方案或可用 push 配額與規格假設不一致，月成本和送信策略會被打亂

**建議**

- 在實作前重新確認官方目前方案、配額、reply/push 差異
- 規格裡加一條「若超量時的降級策略」

### 11. Telegram Topics 的生命週期還沒定義完整

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:166`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:237`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:623`

**風險**

- Topic 已刪除但客人又回來怎麼辦
- 同客人在 Topic 建立前連發多則訊息怎麼串
- 名稱變更或舊客誤判後，Topic 標題如何更新

**建議**

- 增加 topic state machine
- Topic 不要只靠名稱辨識，要用 `lineUserId -> tgTopicId` 映射

### 12. 學習迴圈容易把錯的習慣「學進去」

**規格位置**

- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:210`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:219`
- `docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md:737`

**風險**

- 只靠編輯差異累積，可能會把臨時情境、急件口氣或個別例外錯誤泛化成 prompt 規則

**建議**

- Prompt 更新一定要人工審批，不可自動套用
- `PromptVersion` 補 `approvedBy`、`rollbackToVersion`
- 至少準備一組固定 benchmark cases，更新 prompt 前後都要重跑

---

## 五、和現有專案的落差

### 目前 repo 還沒有的基礎設施

- `package.json` 目前沒有 `@line/bot-sdk`
- `package.json` 目前沒有任何 Vercel KV / Upstash client
- repo 目前沒有 LINE webhook route
- repo 目前沒有 Telegram callback route
- repo 目前沒有這個流程的 API route 測試

### 目前 repo 可直接沿用的部分

- 既有 server-side auth / token 思維可參考 `src/app/api/auth/session/route.ts`
- 既有 logger / route 分層可以沿用
- 現有 `src/lib/api-auth.ts` 的 rate limiting 可以當開發期雛型，但不能直接當正式 replay 保護

---

## 六、目前規格缺少的測試規劃

這部分確實還沒規劃完整，建議在原規格新增一節。

### 6.1 單元測試

- LINE signature 驗證
- webhook event 正規化與 message filtering
- customer identity / returning-customer matcher
- conversation reducer / state transition
- draft invalidation 規則
- Telegram callback action parser
- housekeeping 規則判定
- prompt input builder / context truncation

### 6.2 整合測試

- LINE webhook -> event store -> async processor -> TG push
- TG callback -> draft send -> LINE push -> conversation audit log
- Notion sync -> old customer hint
- KV idempotency store 在 retry 下不重複建立 draft / topic
- 圖片流程：TG 上傳 -> 選客人 -> LINE image push

### 6.3 端對端 / 手動驗收

- 新客首訊息
- 舊客再詢問
- 同客人連續多則訊息
- Eric 送出 / 編輯 / 自己回 / 成交 / 刪除
- 客人訊息在舊草稿生成中途再進來
- 7 天無互動封存 / 清理
- TG / LINE 任一端暫時失敗時的補救流程

### 6.4 建議測試檔案方向

- `src/lib/line/__tests__/signature.test.ts`
- `src/lib/line/__tests__/conversation-state.test.ts`
- `src/lib/line/__tests__/returning-customer.test.ts`
- `src/app/api/line-webhook/__tests__/route.test.ts`
- `src/app/api/telegram-callback/__tests__/route.test.ts`
- `src/lib/ai/__tests__/draft-generation.test.ts`

---

## 七、目前規格缺少的 Code Review / 上線 Gate

這部分也建議補進原 spec，不然之後很容易變成「功能做完了，但不知道能不能安全上」。

### 建議最少要有的 review gate

1. **Security review**
   - 驗簽
   - idempotency
   - callback auth
   - token 泄漏檢查

2. **PII / data governance review**
   - 哪些欄位進 Telegram
   - 哪些欄位能進學習資料
   - retention / deletion policy 是否有落實

3. **Prompt / tone review**
   - 是否真的符合 Eric 風格
   - 是否有過度承諾價格、日期、服務範圍

4. **Failure mode review**
   - LINE 失敗
   - TG 失敗
   - AI timeout
   - Notion timeout
   - 重試是否會重複送出

5. **Quota / cost review**
   - LINE push 使用量
   - Claude token 使用量
   - 圖片與語音的額外成本

6. **Rollout plan**
   - 先 staging webhook
   - 再 limited pilot
   - 再正式切主流程
   - 並保留「完全人工回覆」 fallback

---

## 八、建議先補到原規格的欄位

在正式實作前，建議先把這些內容寫回主 spec：

1. 對話狀態機
2. event idempotency 規則
3. draft lifecycle 規則
4. returning customer 判定分級
5. data retention / deletion policy
6. async processing 架構
7. 測試矩陣
8. code review / rollout gate

---

## 九、給 Claude Code 的接手說明

如果後續由 Claude Code 照這份 Phase 7 規格實作，建議先做下面三件事，再開始寫功能：

1. 先修主 spec，尤其是 idempotency、資料保留、測試策略
2. 先建立 shared domain model，不要直接把 route handler 寫大
3. Phase 7.1 先做最小垂直切片：
   - 驗簽
   - event 落地
   - 新客建立 topic
   - TG 收到摘要
   - 不要一開始就把草稿生成、Notion 比對、圖片流程全部塞進來

**實作優先順序建議**

1. Domain model + storage abstraction
2. LINE webhook fast-ack + idempotency
3. Telegram topic mapping
4. Conversation state transitions
5. Basic extraction pipeline
6. Draft generation
7. Callback actions
8. Housekeeping / reports
9. Voice / advanced learning loop

---

## 十、這次 review 沒有做的事

- 沒有修改主規格內容
- 沒有開始實作任何 Phase 7 功能
- 沒有新增依賴
- 沒有跑 LINE / Telegram 實機整合

這份文件的目的只有一個：**讓後續實作建立在更穩的規格上，而不是邊做邊補洞。**
