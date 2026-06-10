# 2026-06-10 全專案總體檢與優先級重排

> 來源：Claude Code 四區並行掃描（網站 / LINE agent / Sanity+報價 / 文件維運），約 72.5K LOC。
> Eric 已確認的背景修正見「前提」。本檔是之後所有 session 的優先級依據。

## 前提（Eric 確認的事實）

1. **Agent 是主線**：目的是協助夥伴回客 + 未來一人經營時的客服對接。不凍結，但改走「最短路徑上線 → 真實對話迭代」，停止離線打磨 edge case（M3.7 類候選擱置）。
2. **金流被外部卡住**：台灣銀行帳戶為警示戶（三方詐騙案波及），待偵查隊解鎖才能串綠界正式環境。**對策：先用綠界測試環境把訂金流程寫完，解鎖日＝換 key 上線日。**
3. **已有 46 則真實 Google 評論**（https://share.google/4iN4rGkoWx3WUJ1Be），資產存在但未上站。
4. Eric 同意：後台報價無用部分可砍、其餘該修就修、文章確實停更已久。

## 體檢結論（嚴厲版摘要）

- **資源倒掛**：agent 佔 41% codebase（~29.7K LOC、85 測試檔）但 gate 全關零營收貢獻；天天賺錢的 `PricingCalculator.tsx` 卻是 6,500+ 行單體、定價硬編、雙 variant 重複。
- **漏斗只進不留**：ContactForm 直接 redirect LINE，無 lead 留存、無 nurturing；GA4 有埋但無回顧機制。
- **Agent 過度工程化**：五層 RAG source + fingerprint dedupe + 完整 field-policy，但檢索是純 keyword、Notion client 還是 mock。Observability 為零（無 structured log / correlation ID / 成本上限）——這是開 gate 的硬前置缺口。
- **報價鏈路頭尾不通**：`src/lib/quote/fetchQuote.ts` 是 stub、寫入路徑不存在、`DRAFT-` URL 客戶不能用。
- **技術債清單**：`html2pdf.js` 死依賴；Puppeteer+143MB Chromium 跑 serverless PDF；Anthropic raw fetch 無 prompt caching；`itinerary-parser.ts` 正則猜餐食格式會 silent 漏項（影響報價金額）；ContactForm URL 超 2000 字 silent 截斷；`tmp/` 1.5GB；專案在 OneDrive+WSL（I/O 風險）。
- **設計**：quote 頁 Three.js+framer-motion 全量載入、force-dynamic 零快取、canvas 無障礙為零——受眾是 4G 手機上的爸媽，不是評審。schema 宣稱三語但全站零 i18n（schema 在說謊）。
- **測試**：1,263 unit tests 全過、7 e2e，但無 CI（本機 only）。

## 優先級（已與 Eric 確認）

### P0 — 立即動工（三條互不阻塞）

**A. Agent 最短上線路徑**（下個 session 從這裡起手 ✅）
1. ~~真 Notion API adapter~~ **查核＝已於 M3.2 完成**（2026-06-10；體檢「還是 mock」為過時敘述，詳見 cut2 設計檔前置）
2. ~~最小 observability~~ **完成**（2026-06-10，commit `4bda558`：structured log + requestId + 每日成本上限雙 fail-closed）
3. ~~`scanRefinePromptLeak()` 接進 production refine path~~ **查核＝體檢敘述過時，零工程跳過**（2026-06-10）：
   scanner 自 M3.4c 起就結構性內建在 `createAnthropicRefineSource`（`llm-refine-adapter.ts:144`，
   `callModel` 前必跑，唯一真 adapter 繞不開；smoke runner 的 pre-check 只是第二道報告用）。
   真正不存在的是「production refine path」本身——`refineCustomerItineraryDraft` 在 production
   零呼叫，僅 offline `refine-smoke` CLI 可達。refine 進 production 時同刀補 cost cap 接線（接點已留）。
4. 開 partner group gate：只回 @點名、Haiku only、小範圍 live
5. 跑 1–2 週真實對話 → 再決定 quote write token 六前置條件（見 2026-06-02 phase-c 設計檔 §114–141）

**B. Google 評論上站**
- 首頁 + quote 頁加真實評論區塊（精選 5–6 則 + 連 Google Maps）
- 注意：**不可**把第三方評論塞進 schema.org review markup（違反 Google 自評政策），純展示。

**C. 清理小刀**
- 移除 `html2pdf.js`；清 `tmp/` 1.5GB；決定 `fetchQuote.ts` stub 砍或接。

### P1 — 等待警示戶解鎖期並行

6. **綠界沙箱訂金流程**：把 `.worktrees/codex-quote-deposit-payment-mvp` 接 ECPay 測試環境寫完。
7. **定價搬 Sanity + PricingCalculator 減肥**：待 Eric 回覆「legacy variant 還在用嗎」——不用就砍，可去掉近半重複邏輯。
8. **文章重啟**：一週一篇，先 #3「清邁玩幾天」（上漏斗關鍵字），再 #5 大象。

### P2 — P0/P1 跑順之後

9. Quote 頁減重（Three.js lazy load 或 opt-in）、ContactForm 截斷靜默失敗修復。
10. OA 1:1 客服（一人經營終局）：需 Eric 先解除「不准 auto-reply 客人」規則，且必須在 partner group 跑出信心之後。

## 待 Eric 回答

- [ ] PricingCalculator 的 legacy variant 還在用嗎？（決定 P1-7 砍法）
- [ ] 警示戶解鎖進度（決定 P1-6 何時切正式 key）

## 設計品味決策框架（備忘）

受眾情境（爸媽/手機/LINE 內開/4G）→ 轉換目標（更想加 LINE 嗎）→ 速度預算（LCP < 2.5s 超過砍特效）→ 品牌一致（爸媽開的＝溫暖真實不炫技）。口訣：像給朋友看的家庭相簿，不像作品集。
