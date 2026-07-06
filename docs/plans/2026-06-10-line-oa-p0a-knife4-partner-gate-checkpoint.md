# P0-A 刀 4 — 正式夥伴群 partner gate 開啟 · 收尾 checkpoint

> 日期：2026-06-10 · branch `codex/line-oa-agent-mvp`（as-is，不 merge / 不 PR）
> 前置：M3.6 私測群 Tier A/B 已過、P0-A 刀 2 observability（structured log + requestId + 每日成本上限雙 fail-closed）已上、刀 3 scanRefinePromptLeak 已進 production。

## 1. 刀 4 做了什麼

| 項目 | Commit | 內容 |
|------|--------|------|
| 群 ID 切換 | （env-only，無 commit） | Vercel preview env `LINE_PARTNER_GROUP_ID` 由私測群改指**正式夥伴群** |
| 群 ID 捕捉 log | `ffe9210` → revert `3466ac1` | 臨時 log-only capture 取得正式群 groupId，取得後即 revert（不留 log 面） |
| 語氣/身分條款 | `70e32d4` | system prompt 加自我介紹 + 語氣分流條款（`partner-group/system-prompt.ts` +8 行、測試 +27 行） |
| 地域錨點 | `2b4c4ca` | system prompt 加清邁地域錨點，防 free-form 回答預設台灣地點（+2 行、測試 +10 行） |
| 部署生效 | `67179ff` | 觸發 preview deploy，使群 ID env 生效 |

## 2. 驗收狀態

| 驗收項 | 狀態 |
|--------|------|
| @bot 在正式群回覆（單則、無重複） | ✅ 已驗 |
| 自我介紹 / 語氣 / 清邁錨點 | ✅ 已驗（system prompt 測試綠 + 群內實測） |
| **未 tag 不回** | ⬜ 待 Eric 在正式群驗 |
| **OA 私訊零自動回覆** | ⬜ 待 Eric 親測（最高優先；結構性應不可能觸發，仍須實證一次） |

驗收基準沿用 M3.6 runbook §2（A1、A4 兩條對應上表未驗項）。

## 3. 目前 gate / 防線實況（程式碼實證）

- **路由結構閘**：`LINE_PARTNER_GROUP_ID`（`event-normalizer.ts:190-199`，groupId 不符 → 事件不標 `line_partner_group`，整條 partner 路徑不啟用）。
  ⚠️ `LINE_ROUTE_MODE` **不是閘**——production 無消費者，翻它無效。M3.5 / M3.6 runbook 的過時敘述已於 2026-06-10 就地修正。
- **send gate**：`shouldReplyToPartnerGroup`（`partner-reply-gate.ts`，七條件純閘；條件 1+2 雙重釘死 partner 群，OA 客人結構性永不被回）。
- **回滾**：`LINE_PARTNER_GROUP_ID` 改占位值＋重部署（必填 env 不可清空），或把 bot 踢出群；退 billed = `AI_AGENT_PARTNER_RESPONDER_MODE=stub`。
- **成本**：每日 cost cap（KV-backed，雙 fail-closed：cap env 未設或 KV 壞 → 退 stub，永不打 LLM）。

## 4. 下一步

1. **正式群驗收剩 2 條**（§2 ⬜ 項）— Eric 在 LINE 端操作，CC 依結果記錄。
2. **P0-A #5**：跑 1–2 週真實對話，觀察 structured log（requestId 串接收件→路由→LLM→送出）與成本。
3. **P1 候選**：「未回覆超時提醒」——夥伴群訊息 @bot 後若 bot/Eric 超時未處理，主動提醒。本刀僅列候選，未設計。
