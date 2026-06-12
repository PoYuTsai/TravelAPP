# 刀A — 輸入理解＋收錄條件刀（設計定稿）

> 日期：2026-06-12 · 狀態：設計定稿（Eric 過目通過）
> 前情：沉澱管線首次真機煙測（夥伴群實打）＝掃描/候選全通，但**批准沒成立、Notion 零寫入**。
> 上游設計：`2026-06-11-line-oa-knowledge-distillation-design.md`（§3 ④ 過目批准）。

## 0. 煙測三層根因（為什麼要這把刀）

1. **批准 regex 太嚴**：`approval.ts` 三條全句 regex（「1 3 要」「都要」「N 改成〇〇再收」），
   Eric 自然語言批准（短句、錯字、口語）必掉 free-form，批准永遠不成立。
2. **收錄條件結構性漏大宗**：prompt 硬規則「同類問題 ≥2 次」——夥伴群知識主型態是
   「夥伴問一次、老闆答一次」，頻率門檻把主型態整類排除。
3. **free-form 零引用 context**：`quotedBotContent` 一路送到 responder 門口
   （`responder.ts:50`、router 已傳），但 `system-prompt.ts` 全文零引用——AI 看不到
   使用者在回哪句。真實案例：Eric 引用球具裝車的討論說「大車保險一點」（口語＝穩一點），
   Haiku 沒有前文，把「保險」誤讀成車險。

Eric 拍板：刀A 優先於刀4；做完先 CLI 黑箱內測，順了才回群展示（首因效應風險）。

## 1. 批准理解 — 三層接話

**訊號判定**：Eric 的習慣是「特意引用 AI 的訊息」回覆＝在跟 bot 講（平常跟夥伴聊不會 tag）。
`botDirected`（mentionsBot OR quote-to-bot）現成，批准路徑這次用上它。

```
收到群訊息（botDirected ＋ 有 pending batch）
  │
  ├─ 層1 老格式 regex 先試（零成本零延遲）─ 命中 → 照舊執行
  │
  ├─ 層2 regex miss → LLM intent parser（Haiku ＋ structured output）
  │     prompt context 三樣：原話、掛著的候選清單全文、引用的 bot 訊息內容（如有）
  │     只能回固定 schema：{動作: approve|approve_all|modify|not_approval,
  │                        行號: [...], 新答案?, 信心: high|low}
  │     │
  │     ├─ not_approval → 落回 responder（日常問答不受劫持）
  │     ├─ 信心 high → 層3 驗證
  │     └─ 信心 low → 複述確認（見下）
  │
  └─ 層3 程式 deterministic 驗證
        行號必須存在於 pending candidates（沿用「超界整批拒絕」紀律）
        驗證過 → 走既有 applyDistillApproval 套用路徑（狀態機不動）
```

**複述確認**（信心 low）：
- bot 回「你是要收 1、3 對嗎？引用這句回『對』就收」
- 確認狀態寫 KV，TTL 10 分鐘；確認語**必須引用那句複述**＋對/要/好
- 過期或講了別的 → 自動作廢，不卡任何路徑

**防呆兜底**：LLM 掛掉 / 回不合法 JSON / cost cap 到頂 → 不靜默，回
「看不懂這句，要收哪幾條？例：1 3 要」——絕不吞掉批准意圖。

**成本紀律**：LLM parser 走既有 DailyCostCap（checkBudget 先行、recordSpend 必記），
觸發面已被「botDirected＋pending batch 存在」雙閘鎖住，日常聊天零 LLM 呼叫。
parse-first 契約演化：非 botDirected 訊息仍零 store 讀取；botDirected＋無 pending → 一次
KV 讀後即落回 responder。

## 2. 收錄條件放寬（純 prompt 改動）

`DISTILL_SYSTEM_INSTRUCTION`（`distill-llm-adapter.ts`）硬規則改為三個入選門，滿足任一即收：

1. 同類問題出現 ≥2 次（原規則保留）
2. 已標記「記一下」（原規則保留）
3. **老闆明確回答、且答案可重複使用**——判斷標準：「下次別的客人/夥伴問同樣的事，
   這答案還成立嗎？」成立就收（例：燭光晚餐要先訂、景點車程）；
   只對單一客人成立的不收（特殊喬價、單次特例）

排除規則不變：一次性個案談判不收、答案只能來自對話原文不得腦補、最多 5 條。
`candidates.ts` 零信任解析不動（本來就沒有 occurrences hard filter）。

## 3. 引用 context 進 prompt

`buildPartnerGroupSystemPrompt` 加一段（僅當 `quotedBotContent` 存在）：
「使用者引用了你之前說的這句話：『…』，他的訊息是針對這句的回應。」
口語詞（「保險一點」「那個再大一點」）靠引用脈絡消歧。

## 4. CLI 黑箱內測入口

新增 `agent:approve-parse` 離線指令：
- 輸入：一句話＋模擬候選清單（fixture）
- 輸出：LLM 解析結果＋deterministic 驗證結果
- **不碰真 store、不貼群**；用 Eric 平常會講的話（錯字、超短句、口語）跑一輪
- 順了才回群展示

## 5. 改動點地圖

| 改動 | 檔案 |
|------|------|
| 層2 LLM intent parser | `distill/approval.ts`（新增 LLM 路徑）＋新 adapter 或共用 |
| 複述確認狀態 | `distill/pending.ts` 或新 confirmation store（KV TTL 10m） |
| webhook 接線 | `line/webhook-runtime.ts` getDistillSeams（approve 加 LLM fallback） |
| 收錄三門 | `distill/distill-llm-adapter.ts` DISTILL_SYSTEM_INSTRUCTION |
| 引用 context | `partner-group/system-prompt.ts` |
| CLI 內測 | `scripts/`（沿用 agent:distill-dry-run 模式） |

## 6. 不做（YAGNI）

- 不動批准後的套用狀態機（applyDistillApproval 的移動/flush 邏輯原樣）
- 不做多輪對話式批准（一句話＋至多一次複述確認，到此為止）
- 不搬群、不開新群測；OA 1:1 終局維持暫不開
- 刀4 隨手標的獨立指令後移（本刀的「已標記」訊號接住它）
