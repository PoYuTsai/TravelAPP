# 沉澱刀3 — Notion 寫入（KNOWLEDGE_WRITE_ENABLED）實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eric 在私測群批准沉澱候選（「1 3 要」「都要」「2 改成…再收」）後，被批准的條目自動寫入 Notion 沉澱問答 DB（`NOTION_DISTILLED_QA_DB`，狀態=已批准）；閘 `KNOWLEDGE_WRITE_ENABLED` default off ⇒ ship 零行為改變（ack 維持刀2 dry-run 文案）。

**Architecture:** 新增 `distill/knowledge-write-config.ts`（pure env resolver）＋`distill/distilled-qa-writer.ts`（SDK-free 注入式 writer，mirror `notion-rag-client.ts` 的 v5 data-source 紀律＋sanitized error）＋`distill/knowledge-flush.ts`（撈 pending batch 裡未寫入的 resolved、逐條寫、逐條標 `notionPageId`）。`applyDistillApproval` 加 optional `knowledgeWriter` seam；webhook `getDistillSeams` 在閘開＋config 齊時 lazy（dynamic import composition root）注入。真 SDK 只活在 composition root（同 `install-default-partner-rag.ts` 前例），webhook 靜態 import 圖不拉 `@notionhq/client`。

**Tech Stack:** TypeScript、Vitest、`@notionhq/client` v5（注入式，測試用 fake）、Upstash KV（沿用 store）。

**設計來源:** `docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md` §3 ⑤＋§3 沉澱問答 db。

---

## 定案的設計決定

| 決策點 | 定案 | 理由 |
|---|---|---|
| 環境閘 | `KNOWLEDGE_WRITE_ENABLED` 字面 `'true'` 才開，default off；另需 `NOTION_KNOWLEDGE_TOKEN`＋`NOTION_DISTILLED_QA_DB` 齊，任一缺 ⇒ writer 不建（形同閘關＋一行 fixed-code log） | 設計 §3 ⑤ 明文；fail-closed 同 `getDistillSeams` 的 key-missing 前例 |
| 寫入 token | **`NOTION_KNOWLEDGE_TOKEN`**（「清微旅行知識庫」integration，讀+寫），**絕不**用 `NOTION_TOKEN` | `.env.example:119-122` 預留；`NOTION_TOKEN` 是 RAG 行程 DB 的 read integration，對 QA DB 無權限也不該有寫權 |
| 寫入時機 | 批准當下 flush「**所有**未寫入的 resolved」（不只本次點名的）— 含刀2 dry-run 期累積的 backlog | 設計 §1「批准的才寫入」；dry-run 累積的 resolved 本來就是「刀3 的輸入」（approval.ts:8） |
| 狀態欄位值 | 一律寫 `已批准`（modify 也算批准——LINE 過目流程即晉升） | 設計 §3 db 註記「狀態=候選由過目流程晉升」：晉升發生在 LINE，入庫即已批准。`候選/已略過` 留給未來變體 |
| modify 兩版保留 | 答案＝`modifiedAnswer`；出處 rich_text 附「原候選答案：…」 | approval.ts:152 註解承諾「刀3 寫 Notion 時兩版都看得到」 |
| 地區/主題 multi-select | 留空 | 刀2 LLM 不產分類；YAGNI，Eric 在 Notion 手動補標 |
| 冪等防線 | `DistillCandidate` 加 `notionPageId?: string`；每條寫成功**立刻** `putDistillPending` 落標 | LINE at-least-once 已由 `claimPartnerReply` 擋；剩下的重複窗是「頁建了、標丟了」→ per-candidate 落標把窗縮到單條 |
| 失敗處理 | 單條寫失敗 → 跳過續寫其他條；ack 報「⚠️ N 條寫入失敗，下次批准補寫」；**絕不**因寫入失敗回滾批准狀態 | 設計 §3 fail-safe 慣例；批准是 Eric 的決定，Notion 只是落地，落地失敗下次 flush 自癒 |
| Notion error | sanitized fixed-code `DistilledQaWriteError`（'notion_write_failed'），訊息**絕不**含 token / db id / notion.so url | mirror `NotionRagClientError`（notion-rag-client.ts:67） |
| v5 建頁 | `databases.retrieve` → `data_sources[0].id` → `pages.create({ parent: { type: 'data_source_id', data_source_id }, … })`；data source id 在 writer 內 lazy cache | 與 notion-rag-client 同款 2025-09-03 data-source 紀律；單 source DB 取第一個 |
| SDK 邊界 | writer/flush/approval 全 SDK-free 注入式；真 `Client` 只在 composition root `install-default-distilled-qa-writer.ts`，由 webhook **dynamic import**（lazy singleton） | 同 `ensure-partner-rag-installed.ts:98` 前例 — webhook 靜態圖零 SDK |
| 閘關零行為改變 | `knowledgeWriter` 未注入 ⇒ `applyDistillApproval` 輸出與刀2 **逐字相同**（含 DRY_RUN_NOTE）— 守門測試鎖定 | 同刀2 Task 7 的零行為改變紀律 |
| 檢索閉環缺口 | QA DB **不會**因刀3 變成 RAG 檢索源（`rag-index.ts` 是 case-shaped：天數/地區/成本，問答頁塞不進）→ ⑥ 自動草擬吃到沉澱知識是**另一刀**，不在刀3 範圍 | 設計 §3「欄位對齊→立刻可被檢索撈到」在現 codebase 不成立；收尾 commit 把這個缺口記回設計文件 |

---

## Task 1: 型別擴充（notionPageId）＋ store contract

**Files:**
- Modify: `src/lib/line-agent/distill/pending.ts`
- Modify: `src/lib/line-agent/__tests__/case-store-contract.ts`（既有 distill-pending round-trip 案例旁）

**Step 1: contract test 先加（紅不會紅——structuredClone 自然通過，仍要鎖定欄位不被未來 store 實作丟掉）**

在既有 `putDistillPending`/`getDistillPending` round-trip 案例裡，resolved 條目加 `notionPageId: 'page-abc'`，斷言讀回保留。

**Step 2: pending.ts 加欄位**（`modifiedAnswer?` 之後）

```typescript
  /**
   * 刀3：寫入 Notion 成功後落的 page id — 有值＝已寫入，flush 跳過（冪等）。
   * resolved 清單裡才會有；undefined ＝ 還沒寫（含刀2 dry-run 期的 backlog）。
   */
  notionPageId?: string
```

**Step 3: 跑測試**

```bash
npx vitest run src/lib/line-agent/__tests__/ -t "distill"
```

全綠。

**Step 4: Commit** `feat(line-agent): 沉澱刀3 型別 — DistillCandidate.notionPageId 寫入冪等標記`

---

## Task 2: 寫入 config resolver（pure）

**Files:**
- Create: `src/lib/line-agent/distill/knowledge-write-config.ts`
- Create: `src/lib/line-agent/__tests__/distill-knowledge-write-config.test.ts`
- Modify: `src/lib/line-agent/notion/notion-rag-config.ts`（把 `normaliseDatabaseId` export — 函式體零改動）

**Step 1: 測試先寫** — 案例：

1. `KNOWLEDGE_WRITE_ENABLED='true'`＋token＋db id 齊 → `{ enabled: true, token, databaseId }`（databaseId 已 normalise 成 32-hex）
2. 閘未設 / `'false'` / `' true '`（trim 後仍須字面 `'true'`，同 `AI_AGENT_NOTION_RAG_ENABLED` 規則）→ `{ enabled: false }`，**不**讀 token/db（disabled short-circuit）
3. 閘開但 `NOTION_KNOWLEDGE_TOKEN` 空/缺 → `{ enabled: false, reason: 'missing_knowledge_token' }`
4. 閘開但 `NOTION_DISTILLED_QA_DB` 空/不可解析（<32 hex）→ `{ enabled: false, reason: 'missing_database_id' }`
5. db id 給 dashed UUID / 完整 notion url → normalise 成 bare 32-hex（直接吃 `normaliseDatabaseId` 既有行為）
6. reason 字串**絕不**含 token 或 raw db id 值（leak guard 斷言）

**Step 2: 實作**

```typescript
/**
 * knowledge-write-config.ts — 沉澱刀3：寫入 Notion 的 env resolver（pure）.
 *
 * 三件齊才 enabled：KNOWLEDGE_WRITE_ENABLED='true' ＋ NOTION_KNOWLEDGE_TOKEN ＋
 * NOTION_DISTILLED_QA_DB。任一缺 ⇒ enabled:false ＋ fixed reason code —
 * 呼叫端（webhook lazy seam）一行 log 即形同閘關，絕不炸 webhook。
 *
 * token 用知識庫 integration（讀+寫），絕不用 NOTION_TOKEN（RAG 行程 DB 的
 * read integration）— .env.example 119-122 預留的那條線。
 */

import { normaliseDatabaseId } from '../notion/notion-rag-config'

export type KnowledgeWriteConfig =
  | { enabled: true; token: string; databaseId: string }
  | {
      enabled: false
      reason?: 'missing_knowledge_token' | 'missing_database_id'
    }

export function resolveKnowledgeWriteConfig(
  env: Record<string, string | undefined>
): KnowledgeWriteConfig {
  // Disabled gate short-circuits FIRST（同 resolveNotionRagConfig 紀律）。
  if ((env.KNOWLEDGE_WRITE_ENABLED ?? '').trim() !== 'true') {
    return { enabled: false }
  }
  const token = (env.NOTION_KNOWLEDGE_TOKEN ?? '').trim()
  if (token === '') return { enabled: false, reason: 'missing_knowledge_token' }
  const databaseId = normaliseDatabaseId((env.NOTION_DISTILLED_QA_DB ?? '').trim())
  if (databaseId === '') return { enabled: false, reason: 'missing_database_id' }
  return { enabled: true, token, databaseId }
}
```

`notion-rag-config.ts:77` 的 `function normaliseDatabaseId` 前加 `export`（其 doc comment 已完整，不動）。

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀3 寫入 config resolver — 三件齊才開、fixed-code reason、復用 db id normalise`

---

## Task 3: Notion QA writer（SDK-free 注入式）

**Files:**
- Create: `src/lib/line-agent/distill/distilled-qa-writer.ts`
- Create: `src/lib/line-agent/__tests__/distill-qa-writer.test.ts`

**Step 0: 真 DB schema 驗證（唯讀，寫 code 前先跑）**

寫入欄位型別**不准猜**。對真 DB 跑（需 `.env.local` 的 `NOTION_KNOWLEDGE_TOKEN`＋`NOTION_DISTILLED_QA_DB`）：

```bash
source <(grep -E '^(NOTION_KNOWLEDGE_TOKEN|NOTION_DISTILLED_QA_DB)=' .env.local | sed 's/^/export /')
DS_ID=$(curl -s "https://api.notion.com/v1/databases/$NOTION_DISTILLED_QA_DB" \
  -H "Authorization: Bearer $NOTION_KNOWLEDGE_TOKEN" -H "Notion-Version: 2025-09-03" \
  | jq -r '.data_sources[0].id')
curl -s "https://api.notion.com/v1/data_sources/$DS_ID" \
  -H "Authorization: Bearer $NOTION_KNOWLEDGE_TOKEN" -H "Notion-Version: 2025-09-03" \
  | jq '.properties | map_values(.type)'
```

預期：`問題=title`、`答案=rich_text`、`出處=rich_text`、`出現次數=number`、`狀態=select`（**若回 `status`，下方 mapping 的狀態行改 `{ status: { name: '已批准' } }`**）、`收錄日期=date`、`地區/主題=multi_select`。任何不符 → 以實測為準改 mapping，並把實測結果記進本檔。無法跑（無 env 環境）→ 先照上述預期實作，**驗收清單第一條補跑**。

**Step 1: 測試先寫**（fake sdk：`databases.retrieve`＋`pages.create` 記錄呼叫參數）— 案例：

1. approved 候選 → `pages.create` 收到 `parent: { type: 'data_source_id', data_source_id: 'ds-1' }`；properties：問題=title、答案=rich_text（原 answer）、出現次數=number、狀態=select 已批准、收錄日期=date（`now` 的 `YYYY-MM-DD`）、出處含「LINE 夥伴群沉澱」＋全部 sourceMessageIds
2. modified 候選 → 答案=modifiedAnswer；出處**另含**「原候選答案：<原 answer>」
3. 回傳值＝create response 的 page `id`
4. `databases.retrieve` 只叫一次（第二次 `write` 用 cache 的 data source id）
5. `data_sources` 空/缺 → throw `DistilledQaWriteError`（structural failure）
6. sdk 任一步 throw（模擬 error message 夾 token/url）→ 重 throw 的是 `DistilledQaWriteError`，`message`/`stack` 不含原文
7. question/answer/出處 超過 1900 chars → slice（Notion rich_text 單段 2000 上限，防衛性留 buffer）

**Step 2: 實作**

```typescript
/**
 * distilled-qa-writer.ts — 沉澱刀3：批准候選 → Notion 沉澱問答 DB 寫入 adapter.
 *
 * Mirror notion-rag-client.ts 的紀律，方向相反（寫不是讀）：
 *   - SDK 注入式（databases.retrieve ＋ pages.create 的最小面），單元測試用 fake，
 *     真 Client 只在 composition root（install-default-distilled-qa-writer.ts）構建。
 *   - v5 data-source 模型：先 retrieve 解析 data_sources[0]，pages.create 用
 *     data_source_id parent；id 在 writer 實例內 lazy cache（單 source DB）。
 *   - Leak guard：SDK error 一律收斂成 DistilledQaWriteError（fixed message），
 *     token / db id / notion.so url 永不外洩。
 *   - 只寫這一個 DB — caller 給什麼 databaseId 寫什麼，但本 writer 永遠由
 *     NOTION_DISTILLED_QA_DB 構建（絕不碰案件 DB — 設計 §3 ⑤ 鐵律）。
 *
 * 欄位型別已對真 DB schema 驗證（2026-06-11，Task 3 Step 0）。
 */

import type { DistillCandidate } from './pending'

/** 注入 SDK 的最小結構面（真 @notionhq/client v5 Client 結構相容）。 */
export interface DistilledQaSdkClient {
  databases: {
    retrieve(args: { database_id: string }): Promise<{
      data_sources?: Array<{ id: string }>
    }>
  }
  pages: {
    create(args: {
      parent: { type: 'data_source_id'; data_source_id: string }
      properties: Record<string, unknown>
    }): Promise<{ id: string }>
  }
}

/** Sanitized 寫入錯誤 — fixed message，絕不帶 token / db id / url。 */
export class DistilledQaWriteError extends Error {
  readonly code = 'notion_write_failed'
  constructor() {
    super('Notion write failed for a distilled QA candidate')
    this.name = 'DistilledQaWriteError'
  }
}

export interface DistilledQaWriter {
  /** 寫一條批准候選；回 Notion page id。失敗 throw DistilledQaWriteError。 */
  write(candidate: DistillCandidate, nowMs: number): Promise<string>
}

/** Notion rich_text 單段 2000 上限 — 防衛性留 buffer。 */
const TEXT_CAP = 1900

const text = (content: string) => [
  { type: 'text' as const, text: { content: content.slice(0, TEXT_CAP) } },
]

function candidateProperties(
  c: DistillCandidate,
  nowMs: number
): Record<string, unknown> {
  // modify ＝ Eric 改寫版為準；原候選答案進出處（approval.ts 承諾兩版都看得到）
  const answer =
    c.status === 'modified' && c.modifiedAnswer !== undefined
      ? c.modifiedAnswer
      : c.answer
  const provenance = [
    'LINE 夥伴群沉澱',
    `出處訊息 ${c.sourceMessageIds.length} 則：${c.sourceMessageIds.join(', ')}`,
    ...(c.status === 'modified' ? [`原候選答案：${c.answer}`] : []),
  ].join('｜')

  return {
    問題: { title: text(c.question) },
    答案: { rich_text: text(answer) },
    出處: { rich_text: text(provenance) },
    出現次數: { number: c.occurrences },
    // LINE 過目流程即晉升 — 入庫即已批准（候選/已略過留給未來變體）
    狀態: { select: { name: '已批准' } },
    收錄日期: { date: { start: new Date(nowMs).toISOString().slice(0, 10) } },
    // 地區/主題 multi-select 留空 — 刀2 LLM 不產分類，Notion 手動補標
  }
}

export function createDistilledQaWriter(deps: {
  sdk: DistilledQaSdkClient
  databaseId: string
}): DistilledQaWriter {
  let dataSourceId: string | null = null

  return {
    async write(candidate, nowMs) {
      try {
        if (dataSourceId === null) {
          const db = await deps.sdk.databases.retrieve({
            database_id: deps.databaseId,
          })
          const sources = Array.isArray(db?.data_sources) ? db.data_sources : []
          if (sources.length === 0) throw new DistilledQaWriteError()
          dataSourceId = sources[0].id
        }
        const page = await deps.sdk.pages.create({
          parent: { type: 'data_source_id', data_source_id: dataSourceId },
          properties: candidateProperties(candidate, nowMs),
        })
        return page.id
      } catch {
        // 吞掉 raw SDK error（可能夾 token / db id / url）→ fixed error
        throw new DistilledQaWriteError()
      }
    },
  }
}
```

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀3 QA writer — v5 data-source 建頁、欄位 mapping、sanitized error`

---

## Task 4: Flush（未寫入 resolved → 逐條寫＋逐條落標）

**Files:**
- Create: `src/lib/line-agent/distill/knowledge-flush.ts`
- Create: `src/lib/line-agent/__tests__/distill-knowledge-flush.test.ts`（MemoryStore＋fake writer）

**Step 1: 測試先寫** — 案例：

1. resolved 3 條全未寫 → writer 被叫 3 次、回 `{ written: 3, failed: 0 }`、store 裡 3 條都有 `notionPageId`
2. 其中 1 條已有 `notionPageId` → writer 只被叫 2 次（冪等跳過）
3. 第 2 條 writer throw → 第 1、3 條照寫且落標、回 `{ written: 2, failed: 1 }`、第 2 條 `notionPageId` 仍 undefined（下次批准補寫）
4. 落標的 store put throw → 不中斷、計入 written（頁已建）、log fixed code `distill_write_marker_failed`（已知風險：該條下次可能重寫一頁，人工刪重複——絕不因標記失敗回滾）
5. 無 batch / resolved 空 / 全部已寫 → writer 零呼叫、`{ written: 0, failed: 0 }`
6. `candidates`（仍 pending 的）原樣保留，**絕不**被 flush 動到

**Step 2: 實作**

```typescript
/**
 * knowledge-flush.ts — 沉澱刀3：把 pending batch 裡「未寫入的 resolved」逐條
 * 寫進 Notion 沉澱問答 DB，逐條落 notionPageId（design §3 ⑤）.
 *
 * 紀律：
 *   - flush 全部 backlog，不只本次點名的 — 刀2 dry-run 期累積的 resolved
 *     就是刀3 的輸入（approval.ts:8 的承諾）。
 *   - 每條寫成功**立刻** putDistillPending 落標 — 把「頁建了標丟了」的重複窗
 *     縮到單條；落標失敗 log 後繼續（頁已存在，回滾只會更糟）。
 *   - 單條寫失敗跳過續寫其他條 — Notion 抖動不該扣住整批。
 *   - 絕不動 candidates（仍 pending 的）— 那是過目流程的狀態。
 */

import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import type { DistilledQaWriter } from './distilled-qa-writer'

export interface FlushResult {
  written: number
  failed: number
}

export async function flushResolvedToNotion(input: {
  store: CaseStore
  groupId: string
  writer: DistilledQaWriter
  now: number
  log?: AgentLogger
}): Promise<FlushResult> {
  const { store, groupId, writer, now, log } = input

  const batch = await store.getDistillPending(groupId)
  if (!batch) return { written: 0, failed: 0 }

  let written = 0
  let failed = 0
  // 對 resolved 的工作副本逐條推進；每寫成一條立刻整 batch 落標寫回。
  const resolved = [...batch.resolved]
  for (let i = 0; i < resolved.length; i += 1) {
    if (resolved[i].notionPageId !== undefined) continue // 冪等：已寫過
    let pageId: string
    try {
      pageId = await writer.write(resolved[i], now)
    } catch {
      failed += 1
      log?.('store_write_failed', { reason: 'distill_notion_write_failed' })
      continue
    }
    written += 1
    resolved[i] = { ...resolved[i], notionPageId: pageId }
    try {
      await store.putDistillPending({ ...batch, resolved })
    } catch {
      // 頁已建、標沒落 — 最壞下次重寫一頁（人工刪重複）。絕不回滾。
      log?.('store_write_failed', { reason: 'distill_write_marker_failed' })
    }
  }
  return { written, failed }
}
```

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀3 flush — backlog 全清、逐條落標、單條失敗不扣整批`

---

## Task 5: approval 接線（writer seam ＋ ack 文案）

**Files:**
- Modify: `src/lib/line-agent/distill/approval.ts`
- Modify: `src/lib/line-agent/__tests__/distill-approval.test.ts`

**Step 1: 測試先寫** — 案例：

1. **零行為改變守門**：`knowledgeWriter` 未注入 → 各 ack 輸出與現行**逐字相同**（含 `（dry-run：刀3 開閘後才寫入 Notion）`）
2. writer 注入＋approve 2 條（resolved 原有 1 條 dry-run backlog 未寫）→ flush 寫 3 條、ack 含 `📥 已寫入 Notion 知識庫 3 條`、**不**含 dry-run note
3. writer 注入＋flush 部分失敗（written 2 / failed 1）→ ack 含 `⚠️ 1 條寫入失敗，下次批准補寫`
4. writer 注入＋超界 index 整批拒絕 → **writer 零呼叫**（沒有狀態變化就沒有 flush）
5. modify 路徑＋writer → 同樣 flush、ack headline 不變

**Step 2: 實作** —

`ApplyDistillApprovalInput` 加：

```typescript
  /**
   * 刀3 seam — webhook 在 KNOWLEDGE_WRITE_ENABLED（＋token＋db id）齊時注入；
   * 未注入 ⇒ 刀2 dry-run 行為逐字不變（ship 零行為改變）。
   */
  knowledgeWriter?: DistilledQaWriter
```

`composeAck` 改收第三參數 `writeLine: string`（取代寫死的 `DRY_RUN_NOTE`）；store put 成功後：

```typescript
  // 刀3：批准狀態落地後 flush（含 dry-run 期 backlog）。flush 自己讀最新
  // batch、自己處理單條失敗 — 這裡只決定 ack 的第三行。
  let writeLine = DRY_RUN_NOTE
  if (input.knowledgeWriter) {
    const flush = await flushResolvedToNotion({
      store,
      groupId,
      writer: input.knowledgeWriter,
      now: input.now,
      log,
    })
    writeLine = [
      `📥 已寫入 Notion 知識庫 ${flush.written} 條`,
      ...(flush.failed > 0
        ? [`⚠️ ${flush.failed} 條寫入失敗，下次批准補寫`]
        : []),
    ].join('\n')
  }
```

`meta` 加 `written`/`writeFailed`（writer 注入時）。

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀3 approval 接線 — writer seam、批准即 flush、閘關文案逐字不變`

---

## Task 6: Webhook 接線（composition root ＋ lazy dynamic import）

**Files:**
- Create: `src/lib/line-agent/line/install-default-distilled-qa-writer.ts`（composition root — 唯一 import 真 SDK 之處之一）
- Create: `src/lib/line-agent/__tests__/install-default-distilled-qa-writer.test.ts`
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（distill seam 區塊 ~line 681-747）
- Modify: `src/lib/line-agent/__tests__/distill-webhook.test.ts`

**Step 1: composition root 測試先寫**（mirror `install-default-partner-rag.test` 模式，SDK factory 注入 fake）：

1. config 三件齊 → `{ writer }`（fake factory 收到 token）
2. 閘關 → `{ writer: undefined, reason: 'disabled' }`，factory 零呼叫
3. 閘開缺 token/db → `{ writer: undefined, reason: 'missing_knowledge_token' | 'missing_database_id' }`
4. factory throw → `{ writer: undefined, reason: 'sdk_init_failed' }`（raw error 不外洩）

**Step 2: composition root 實作**

```typescript
/**
 * install-default-distilled-qa-writer.ts — 沉澱刀3 composition root：唯一
 * 構建真 @notionhq/client 寫入 SDK 之處（mirror install-default-partner-rag.ts）。
 * webhook 只 dynamic import 本模組 — 靜態圖零 SDK。Fail-closed＋leak-safe：
 * 缺 config / 構建失敗 ⇒ writer undefined ＋ fixed reason code，永不 throw。
 */

import { Client } from '@notionhq/client'
import { resolveKnowledgeWriteConfig } from '../distill/knowledge-write-config'
import {
  createDistilledQaWriter,
  type DistilledQaSdkClient,
  type DistilledQaWriter,
} from '../distill/distilled-qa-writer'

export interface BuildDistilledQaWriterResult {
  writer?: DistilledQaWriter
  reason?:
    | 'disabled'
    | 'missing_knowledge_token'
    | 'missing_database_id'
    | 'sdk_init_failed'
}

export function buildDefaultDistilledQaWriter(
  env: Record<string, string | undefined> = process.env,
  createSdkClient: (auth: string) => DistilledQaSdkClient = (auth) =>
    new Client({ auth }) as unknown as DistilledQaSdkClient
): BuildDistilledQaWriterResult {
  const config = resolveKnowledgeWriteConfig(env)
  if (!config.enabled) return { reason: config.reason ?? 'disabled' }
  let sdk: DistilledQaSdkClient
  try {
    sdk = createSdkClient(config.token)
  } catch {
    return { reason: 'sdk_init_failed' } // raw error 可能夾 token — 吞掉
  }
  return { writer: createDistilledQaWriter({ sdk, databaseId: config.databaseId }) }
}
```

**Step 3: webhook 測試先寫**（既有 `distill-webhook.test.ts` 旁加）：

1. `KNOWLEDGE_WRITE_ENABLED` 未設＋批准語句 → reply 文案含 dry-run note（零行為改變）
2. `setDistilledQaWriter(fakeWriter)` 注入＋批准 → reply 含「已寫入 Notion 知識庫」；`setDistilledQaWriter(null)` 重置不串味
3. 閘開但 writer build 回 reason → 一行 fixed-code log、reply 仍 dry-run 文案（形同閘關，絕不炸 webhook）

**Step 4: webhook 實作** — distill seam 區塊（`getDistillSource` 之後）加 lazy singleton：

```typescript
/**
 * 刀3 knowledge writer — LAZY singleton（mirror getDistillSource）：批准語句
 * 真的來才 dynamic import composition root（靜態圖零 @notionhq/client）。
 * 「definitively off」（閘關/缺 config）也 cache — env 在 instance 生命週期
 * 內不變，不用每則批准都重 resolve。
 */
let _distilledQaWriter: DistilledQaWriter | null | undefined // undefined＝未解析

/** Override（測試注入 fake；null ⇒ 重置回 lazy default）。 */
export function setDistilledQaWriter(writer: DistilledQaWriter | null): void {
  _distilledQaWriter = writer ?? undefined
}

async function getDistilledQaWriter(
  log: AgentLogger
): Promise<DistilledQaWriter | undefined> {
  if (_distilledQaWriter !== undefined) return _distilledQaWriter ?? undefined
  const mod = await import('./install-default-distilled-qa-writer')
  const result = mod.buildDefaultDistilledQaWriter()
  if (!result.writer) {
    if (result.reason !== 'disabled') {
      log('route_decision', { reason: `distill_write_${result.reason}` })
    }
    _distilledQaWriter = null // 終態 cache — 形同閘關
    return undefined
  }
  _distilledQaWriter = result.writer
  return result.writer
}
```

（`DistilledQaWriter` type import 自 `@/lib/line-agent/distill/distilled-qa-writer` — type-only，不破壞 SDK-free 靜態圖。）

`getDistillSeams` 的 `approve`：

```typescript
    approve: async (groupId, text) => {
      const approval = parseDistillApproval(text)
      if (approval === null) return null
      return applyDistillApproval({
        store,
        groupId,
        approval,
        now: Date.now(),
        log,
        // 刀3：閘關/缺 config ⇒ undefined ⇒ dry-run 文案逐字不變
        knowledgeWriter: await getDistilledQaWriter(log),
      })
    },
```

注意：`setDistilledQaWriter(null)` 的「重置」語意是回 `undefined`（未解析）— 測試 teardown 用；與 `_distilledQaWriter = null`（終態 off cache）區分清楚，照上方實作即可。

**Step 5: 綠＋全套＋lint**

```bash
npx vitest run src/lib/line-agent/ && npx next lint --dir src/lib/line-agent
```

**Step 6: Commit** `feat(line-agent): 沉澱刀3 webhook 接線 — KNOWLEDGE_WRITE_ENABLED 閘住 lazy writer（default off）`

---

## Task 7: CLI distill-flush（backlog 手動補寫／驗收工具）

**Files:**
- Modify: `scripts/agent-command.mjs`（加 `distill-flush` 子命令，照 `distill-dry-run` 的 GUARD-loaded dynamic import 模式 ~line 1199）
- Modify: `package.json`（`agent:distill-dry-run` 旁加 `"agent:distill-flush": "tsx --env-file=.env.local scripts/agent-command.mjs distill-flush"`）

**Step 1: 子命令實作** — 兩段式：

- **default（唯讀）**：真 KV `getDistillPending(LINE_PARTNER_GROUP_ID)` → 列出 resolved 中未寫入（無 `notionPageId`）的條目（編號/Q/A/status/occurrences）→ 印「dry-run：加 `--write` 才真寫」。零寫入、跑幾次都不留痕。
- **`--write`**：`resolveKnowledgeWriteConfig(process.env)` 不 enabled → 印 reason exit 1（**閘照規矩走，CLI 不繞閘**）；enabled → `buildDefaultDistilledQaWriter()` → `flushResolvedToNotion` → 印 `written/failed`。
- 記得 memory 教訓：CLI 載 `.env.local`，三件齊＋`--write` 就是**真寫 Notion**，跑前向 Eric 確認。

**Step 2: 手動驗證（唯讀模式）**

```bash
npm run agent:distill-flush   # 不帶 --write，列 backlog，零寫入
```

**Step 3: Commit** `feat(line-agent): 沉澱刀3 CLI distill-flush — backlog 預覽 default、--write 走閘真寫`

---

## Task 8: 收尾（docs commit）

**Files:**
- Modify: `.env.example`（`AI_AGENT_DISTILL_LLM_MODEL` 註解行後加 `KNOWLEDGE_WRITE_ENABLED=false`；119-122 行註解改寫：「（未實作，default off）」→「（刀3 已實作；KNOWLEDGE_WRITE_ENABLED 在上方 AI agent 區）」，`# NOTION_DISTILLED_QA_DB=` 保留註解狀態）
- Modify: `docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md:153`（刀3 標 ✅ done＋commits；§3 ⑤ 旁補一行：**檢索閉環缺口** — QA DB 尚非 RAG 檢索源（rag-index 是 case-shaped），⑥ 要吃到沉澱知識需另開一刀）
- Modify: `README.md`（build trigger 行）
- 本計畫文件入庫（若尚未）

**Step 1: docs commit** `docs(line-agent): 沉澱刀3 收尾 — 設計文件標記＋檢索閉環缺口註記＋.env.example 閘＋README build trigger`。Push。

---

## 驗收清單

- [ ] Task 3 Step 0 的真 DB schema 驗證已跑、mapping 與實測一致（特別是 `狀態` 是 select 還是 status）
- [ ] `npx vitest run src/lib/line-agent/` 全綠（既有＋新增）
- [ ] `npx next lint --dir src/lib/line-agent` 零警告
- [ ] 閘未設時：批准 ack 與刀2 行為**逐字相同**（Task 5/6 守門測試固定）
- [ ] `npm run agent:distill-flush`（不帶 `--write`）列出 dry-run 期 backlog，零寫入
- [ ] 開閘後私測群實測：批准 → ack 報「已寫入 N 條」→ Notion DB 出現對應頁、狀態=已批准、（示範）那筆不受影響
- [ ] 再批准一次 → 已寫過的條目不重寫（notionPageId 冪等）

## 已知風險（記錄，不擋刀3）

- **inline 寫入延遲**：批准 ack 前逐條建頁（≤5 條，估 +1–3s），疊在刀2 既有 inline await 上。月跑數次手動觸發，先接受；超時改 post-ack（與刀2 同列）。
- **頁建了標丟了**：`putDistillPending` 在 create 成功後失敗 → 下次 flush 重寫一頁（人工刪重複）。窗已縮到單條，自癒成本＝刪一頁。
- **schema 漂移**：Eric 在 Notion 改欄位名/型別 → 寫入開始 fail（sanitized error、ack 報失敗條數，不炸 webhook）。出現時對照 Task 3 Step 0 重驗。
- **檢索閉環缺口**：寫進 QA DB 的知識**還不會**被 ⑥ 自動草擬撈到（rag-index 是 case-shaped）。這是設計文件的樂觀假設與現實的差距 — 已記回設計文件，是刀3 之後的獨立一刀（QA 檢索 source 或 prompt 注入）。
- **flush 與下一輪沉澱互洗**：flush 落標期間若恰好跑「沉澱」（orchestrator 重寫 batch）→ 後寫贏，可能丟標。同刀2「近距離雙沉澱」風險級別（手動、月跑數次），接受。
