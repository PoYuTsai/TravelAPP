# M3.2 Partner-RAG 草稿 — 手動 Preview Smoke Runbook

> **狀態**：docs-only。本文**不翻 gate、不跑正式夥伴群、不改 code、不印 secret**。
> 給 Eric 未來要實機試跑 partner-group RAG 內部草稿時，照此安全開 gate / 回滾。
>
> - branch：`codex/line-oa-agent-mvp`
> - 對應設計：`2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md`、`2026-06-07-line-oa-m3-2-rag-call-site-wiring-design.md`
> - 程式現況：M3.2 runtime lazy-install seam 已完成，line-agent 840/840 綠，**gate 全關**（production 不會真跑）。

---

## 0. 心智模型（先讀，30 秒）

Partner 內部草稿要真的產出，**四個前置必須同時成立**（`shouldUsePartnerRagDraft`，缺一即走原 responder、永不讀 Notion）：

1. `sourceChannel === 'line_partner_group'`（只有夥伴群，OA 永遠到不了這條路）
2. `botDirected`（@機器人 **或** quote-to-bot 引用）
3. `detectPartnerRagIntent(text)`：訊息含明確 intent 字（見下）
4. `isPartnerRagDraftEnabled(env)`：**兩個** env gate 都精確等於 `"true"`

> **結構性 gate 即安全邊界**：lazy installer（`ensure-partner-rag-installed.ts`）自身不做 env 檢查；只有四前置全中、thunk 才會 `await` 它去 lazy import 真 Notion source。所以 OA / untagged / 無 intent 根本到不了安裝層 → 零 SDK import、零 Notion read。

**明確 intent 字**（`PARTNER_RAG_INTENT_TOKENS`，命中任一即可）：

```
查內部案例 ／ 幫我草稿 ／ 參考過往 ／ 內部參考 ／ RAG（大小寫不拘）
```

**固定文案（驗收時對照）**：

- 安全橫幅：`【夥伴內部草稿】這不是正式報價；未經 Eric／夥伴確認前請勿直接轉貼給客人。`
- fail-closed 回覆：`目前內部案例查詢暫時不可用，稍後再試或請 Eric 確認。`

---

## 1. 前置檢查（preflight）

> 全部在 **preview / 本機**，不碰 production 夥伴群。

| 檢查項 | 實際 env 變數（以 code 為準） | 說明 |
|---|---|---|
| Notion 權杖存在 | `NOTION_TOKEN` | `install-default-partner-rag.ts` 只認這個；缺 → `missing_notion_token`、不建 SDK、不裝、fail-closed |
| RAG 主 gate | `AI_AGENT_NOTION_RAG_ENABLED=true` | config 解析的第一道；非 `"true"` → disabled、完全不解析來源/ id |
| 啟用來源清單 | `AI_AGENT_NOTION_RAG_ACTIVE_SOURCES` 需含 `private_2026` | **顯式**啟用，不是「有 id 就自動開」 |
| 2026 私庫 DB id | `NOTION_PRIVATE_2026_DATABASE_ID` | 缺 → `missing_database_id`、loader throw、fail-closed |
| integration 權限 | （Notion 後台）integration 必須有該 `private_2026` database 的存取權 | 否則 client_error → fail-closed |
| Partner 草稿 gate | `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED` **先保持 false／不設** | 第 3 階段才翻 |

> 接受 DB id 的格式很寬：bare 32-hex / dashed UUID / 完整 Notion URL（含 `?v=` 也會剝掉）皆可（`normaliseDatabaseId`）。

**preflight 結論**：1–5 全綠、第 6 仍關 → 可進第 2 階段 operator smoke。

---

## 2. Operator Smoke（CLI，不接 LINE live path）

> 這三條走 operator-masked CLI，**不需要** partner gate；只驗 Notion 讀 + 投影遮罩正確。
> 全部用 `--env-file=.env.local`（npm script 已內建）。

依序執行：

```bash
# 2-1 連線 / config dry-run（不應出現 token / db id）
npm run agent:notion-rag-dry-run

# 2-2 檢索預覽（masked 投影）
npm run agent:notion-rag-search -- "清邁 親子 大象 夜間動物園"

# 2-3 草稿答案組裝預覽
npm run agent:notion-rag-answer -- "清邁 親子 大象 夜間動物園"
```

**逐條檢查（必須全中）**：

- [ ] 輸出**無** `NOTION_TOKEN` 值、**無** database id、**無** Notion URL
- [ ] 輸出**無**客戶姓名 / 電話 / 任何 PII
- [ ] 輸出**無**成本 / 收入 / 利潤 / 內部報價數字
- [ ] 零訊號查詢回 `low_confidence`，不是硬掰
- [ ] 若主 gate 沒開，CLI **不**去讀 Notion（disabled 短路）

> 任一條失血 → **停**，不要進第 3 階段。回報時只貼 code label，不貼 secret。

---

## 3. Preview 群 Gate 開啟順序

> **只在 preview / 測試群**。**先不要**正式夥伴群。

1. 確認當前在**測試群**（非正式夥伴群、非 OA）。
2. 設 `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED=true`（此時 `AI_AGENT_NOTION_RAG_ENABLED` 也須為 `true`）。
3. 依序丟訊息驗證：

| # | 測試輸入（在測試群） | 預期 |
|---|---|---|
| 3-1 | **tag + explicit intent**：`@bot 幫我草稿 清邁親子三天兩夜` | 產**夥伴內部草稿**，**含安全橫幅** |
| 3-2 | **tag 無 intent**：`@bot 早安` | **不**產草稿，走原 responder |
| 3-3 | **quote-to-bot + intent**：引用 bot 報價訊息再回 `參考過往案例` | 產草稿（botDirected 由引用滿足） |
| 3-4 | **OA 客戶訊息** | **完全不回**（OA auto-reply ban，永遠到不了 rag path） |
| 3-5 | **untagged 群訊息**：`今天天氣不錯` | **不**回、不產草稿 |

---

## 4. 成功標準（驗收）

- [ ] **只有** explicit intent（且 tag/quote）會產「夥伴內部草稿」
- [ ] 每則草稿都**含**「`【夥伴內部草稿】…這不是正式報價…`」橫幅
- [ ] 無 PII / 無 private / 無 secret（token / db id / URL / 客名 / 成本利潤）
- [ ] 低信心查詢 **fail-safe**（low_confidence，不捏造）
- [ ] Notion error / timeout **fail-closed**：回固定 unavailable reply，**never** 捏造草稿
- [ ] OA 不回、untagged 不回

---

## 5. Rollback（出問題立即）

1. **立刻**設 `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED=false`（preview env）。
   - 雙閘門設計：單翻這個即可讓 `isPartnerRagDraftEnabled` 回 false → 後續訊息全走原 responder。
2. **不需改 code**、不需 redeploy code（純 env 切換）。
3. 若要連 operator CLI 也斷，另設 `AI_AGENT_NOTION_RAG_ENABLED=false`。
4. 回報問題時：**只**保留 code label（`partner_rag_install_start/success/failed/timeout` 等），**不貼** secret / 原始 error / Notion URL。

> 設計保證：timeout / installer error **不快取**（`_done` 不變），下一則合格訊息會重試；翻 gate off 後即不再有合格訊息。

---

## 6. 已知限制

- **cache 為 in-memory only**：索引快取活在單一 function instance（Fluid Compute），TTL 預設 10 分鐘（`DEFAULT_PARTNER_RAG_TTL_MS`）。
- **serverless cold start 會重建**：新 instance 第一則合格訊息會 lazy install + 重建索引。
- **install timeout 只是 install 層**：`DEFAULT_PARTNER_RAG_INSTALL_TIMEOUT_MS = 8000ms` 限的是安裝/索引建構這一層；**Notion read 本身仍可能慢**（§3.8 提到的 index build 內層 timeout 尚未做）。
- **M3.3 可補**：operator refresh / cache 控制（手動清快取、強制重建）、§6 operator refresh 機制。

---

## 附錄：未做事項（不在本 runbook 範圍）

- §3.8 index build 內層 timeout
- §6 operator refresh（M3.3）
- Vercel preview 實機 smoke（CLI 未登入，待 `vercel login`）
- 翻 gate（本文僅描述「如何安全翻」，不代為翻）
