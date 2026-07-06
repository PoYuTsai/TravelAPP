# 廣告刀1：LINE OA 被動記錄 → 每日轉換表自動填 Sheet（設計定稿）

> 2026-07-06 與 Eric brainstorming 定案。目的：自動產出代操要的每日轉換表，
> 按日期精準對出「多少人加 LINE → 詢問 → 成交」算 CPA／轉換率。
> Eric 唯一手動動作＝在 Sheet 上勾「成交✓」。儲值第二期卡在本刀完成後。

## 決策記錄

| 決策點 | 定案 | 理由 |
|--------|------|------|
| 摘要遞送 | cron 直接寫進代操 Sheet | Eric：越不手動越好；不用記得去拉 |
| 列粒度 | 每個新詢問一列 | 能追個別成交，CPA 算得最準 |
| follow 記法 | 存 KV 不入列，發訊息才升格成列 | 轉換表保持乾淨；加入數留 KV 供漏斗 |
| 詢問項目產生 | cron 批次 Haiku 摘要 | 日均幾分錢；失敗退化原文節錄 |
| cron 頻率 | 每日 09:00（Asia/Bangkok） | 模板即每日轉換表 |

## 邊界（不變的鐵律）

- **OA 客人訊息絕不自動回**——normalizer 對 `line_oa` 的 `mentionsBot` 永遠
  false（`event-normalizer.ts:236`），本刀只加被動記錄，不碰回覆路徑。
- 夥伴群沉澱線（archiver.ts）「OA 客人面永不入檔」的邊界**不動**：本刀是
  獨立檔案＋獨立 KV namespace 的廣告營運線，兩條線隱私邊界各自成立。
- 封存的 agent 線（partner responder）完全不碰。

## 架構

```
LINE OA 1:1                    每日 09:00 (曼谷)
  follow ─┐                          │
  text  ──┤→ webhook → normalizer → oa-contact-recorder → KV
          │   (擴收 follow)           (被動、零 LLM、fail-safe)
          │                           │
          └── 絕不回覆                 ▼
                              /api/cron/ads-daily-sheet
                                │ 掃「有訊息未寫列」的 contact
                                │ Haiku 摘要（閘+cap；敗→原文節錄）
                                ▼
                              Google Sheet append（service account）
                                └ 冪等：KV 標 sheetWritten
```

## §1 被動記錄層（webhook 端）

- **Normalizer**：`event-normalizer.ts` 加收 `follow` 事件 → 新 kind
  `oa_follow`（`sourceChannel:'line_oa'`）；其他非 message 事件維持 fail-closed 照丟。
- **新檔 `oa-contact-recorder.ts`**（archiver 兄弟檔，不改 archiver）：
  - KV key＝userId，存 `OaContactRecord`：
    `{ userId, followedAt?, firstMessageAt?, messages:[{ts,text}](上限20則), sheetWritten? }`
  - follow → 建檔記 `followedAt`；首則文字 → 記 `firstMessageAt` 開始累積
  - 只收文字；圖片/貼圖跳過（webhook 熱路徑零 OCR 零 LLM 零成本）
  - TTL 60 天（寫入 Sheet 後 Sheet 即 source of truth）
  - 獨立閘 `AI_AGENT_OA_CAPTURE_ENABLED`（default off）
  - fail-safe 同 archiver：任何失敗吞掉、絕不堵 webhook、絕不觸發 LINE 重送

## §2 每日 cron ＋ Sheet 寫入

- **排程**：`vercel.json` crons → `/api/cron/ads-daily-sheet`，`CRON_SECRET` 驗證。
- **流程**：掃 KV（有 firstMessageAt 且未 sheetWritten）→ 每客一次 Haiku 呼叫
  抽「詢問項目一句摘要＋人數＋金額」→ Sheets append → 標 `sheetWritten`。
- **LLM 閘**：獨立 `AI_AGENT_ADS_SUMMARY_ENABLED`＋獨立日 cap；LLM 失敗
  退化成客人原文節錄照樣寫列——絕不因 LLM 掛掉漏記。
- **冪等**：靠 KV 標記；cron 重跑不重複寫列。
- **憑證**：Google service account（env 存 base64 JSON）；Sheets 寫入走
  REST＋JWT，不拉 googleapis 大包。Eric 一次性動作＝把 Sheet 分享編輯權給
  SA email。

## Sheet 欄位（優化提案，兼容代操 Date/轉換/詢問項目/備註）

| 日期 | 詢問項目 | 人數 | 預估金額 | 加好友日 | 成交✓ | 成交金額 | 備註 |
|------|----------|------|----------|----------|-------|----------|------|
| 自動 | 自動(AI) | 自動 | 自動 | 自動 | **Eric 勾** | Eric 填(可選) | 自動/手動 |

代操要的「轉換」＝「成交✓」欄。目標 Sheet：
`1DhSGSmaPtlszo4k-nc0wjrHVj1oaaWusk962dYrhjNU`（模板從 07-01 起）。

## 測試策略

全程 TDD（vitest）＋ seam 注入：fake sheet client、fake LLM、MemoryStore，
零網路零 key 全綠；真連線只在最後 smoke。store 契約測試比照
`case-store-contract.ts` 加 OaContactRecord 方法。

## 第一刀不做（YAGNI）

- 成交自動偵測（夥伴群對帳回填）
- 未成交提醒推播（pushMessage 目前零呼叫端，維持）
- follow 數漏斗報表（KV 有存，之後要看再拉）
