# Phase B — Notion 2026 Team Collaboration **Read** Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓 line-agent 能從 Notion 2026 團隊協作資料表「**只讀**」既有已確認案例，產出可給 partner group / AI 檢索的乾淨摘要與相似案例排序——全程不寫 Notion、不暴露敏感欄位。

**Architecture:** 在 `src/lib/line-agent/notion/` 新增三個純函式模組：`field-policy`（欄位分類與遮蔽邊界）、`notion-mapper`（Notion page → CaseReferenceSummary）、`team-collaboration`（read path：similar-case search，deterministic scoring）。三者皆不持有 side-effect 寫入路徑；Notion API client 只用於 read，並以 fixtures 在測試中替身，不打真 Notion。資料流：`Notion page (raw) → field-policy 過濾 → notion-mapper 整形 → team-collaboration 搜尋/排序 → 摘要輸出（partner-safe / operator-full 兩種視角）`。

**Tech Stack:** TypeScript、Vitest、`@notionhq/client`（既有相依，僅 read）、line-agent 既有 `AgentCase.knownFacts` 作為 query 來源之一。

**範圍鐵律（本 Phase 明確不做）：** 不 insert / update / 改 confirmed records；不碰 `parser.ts` / quote URL / Sanity write;不接 LLM/RAG（先 deterministic）;不改 `src/lib/notion/client.ts`（舊私人 dashboard adapter，獨立）。write path 另開 Phase B2 / Phase D。

### 本輪明確聲明（Eric 2026-06-02 拍板）

- **No Notion writes.** 本 Phase 不對 Notion 做任何 insert / update / archive;Notion API 只用 read。
- **真實 Notion schema 尚未導入。** 本輪以「canonical fixture 欄位 + alias map」設計;fixtures 的假欄位**不是唯一真相**,等 Eric 給真實 2026 DB schema 後再補 mapping，不把假欄位寫死。
- **`partner_group` 永遠只拿 safe summary。** 任何路徑都不可讓 partner 看到成本 / 分潤 / 姓名 / 2025-2026 private 全文 / Notion link / token。
- **`operator_only` 仍不是 raw / private full access。** Eric/DC 只多拿一點 operational context（內部備註 truncate、內部標籤、quoteTier range），仍**不**含成本明細 / 分潤 / private 原始全文 / Notion link / token / 任何 manual_only 欄位。

---

## 0. 既有錨點（動工前先讀）

- `src/lib/line-agent/cases/case-state.ts` — `AgentCase` / `knownFacts: Record<string, unknown>`（query 來源）。
- `src/lib/line-agent/audit/*` — read 也要留 audit（誰、何時、查了什麼 query、回傳幾筆），但**不含**寫入。
- `.claude/skills/chiangway-notion-fill/SKILL.md` — 已定義 field 分類四級與「private 2025/2026 不可吐 partner group」原則，本 plan 與其對齊。
- `.env.example` — 需有 `NOTION_TOKEN`、`NOTION_TEAM_2026_DATABASE_ID`;read path 只接受 `NOTION_TEAM_2026_DATABASE_ID`,其他 database id 一律拒絕。

---

## 1. 資料模型（型別定義）

新增 `src/lib/line-agent/notion/types.ts`：

```ts
// 欄位保護分級 —— 與 chiangway-notion-fill 對齊
export type FieldSensitivity =
  | 'read_only'        // 可讀可摘要（行程結構、城市、天數、人數…）
  | 'draft_write'      // 本 Phase 不寫;分類僅供日後 write path
  | 'confirmed_write'  // 本 Phase 不寫
  | 'manual_only'      // 永不自動處理
  | 'private'          // Eric/DC 私人上下文,絕不進 partner output（成本/分潤/私人備註/2025-2026 private）

// 哪些視角看得到該欄位
export type AudienceScope = 'partner_group' | 'operator_only' | 'never'

// 最小 fixture shape —— 先不模擬完整 Notion SDK,真 SDK adapter 後面再接
export interface NotionPageFixture {
  id: string
  databaseId: string
  properties: Record<string, unknown>
}

// 報價級距 bucket —— 永不對 partner 暴露精準金額（MVP：每 10,000 THB 一級）
export type QuoteTier =
  | '<10k' | '10k-20k' | '20k-30k' | '30k-50k' | '50k+' | 'unknown'

export interface FieldPolicyEntry {
  /** Notion property 名稱（以 fixtures schema 為準） */
  property: string
  sensitivity: FieldSensitivity
  /** partner_group：可分享摘要;operator_only：Eric/DC 才可見;never：完全不輸出 */
  audience: AudienceScope
  /** 輸出時是否需遮蔽（如金額只給級距、備註截斷） */
  mask?: 'range' | 'omit' | 'truncate'
}

/** 乾淨摘要 —— 不複製整頁、不含 Notion link、不含 token */
export interface CaseReferenceSummary {
  /** 內部參考用的去識別 id（非 Notion page url） */
  refId: string
  dates?: string          // 日期 / 天數
  nights?: number
  adults?: number
  children?: number
  childAges?: number[]    // 親子年齡
  cityArea?: string       // 城市 / 區域
  tripType?: string       // 行程類型
  highlights?: string[]   // 景點 / 餐廳（已過濾敏感）
  quoteTier?: QuoteTier   // 報價級距 bucket（partner 永遠只拿 bucket,不拿精準金額）
  carGuideSetup?: string  // 車導配置（若允許）
  specialNeeds?: string
  internalNotes?: string  // 內部備註 —— 僅 operator_only,且 truncate 前 120 字;partner omit
  internalTags?: string[] // 內部標籤 —— 僅 operator_only;partner omit
  lastStatus?: string
  /** 哪些敏感欄位被遮蔽 / 省略,供透明追蹤 */
  omittedFields: string[]
}

export interface SimilarCaseQuery {
  /** 結構化條件（多來自 case.knownFacts） */
  adults?: number
  children?: number
  childAges?: number[]
  cityArea?: string
  tripType?: string
  nights?: number
  dates?: string
  /** 自由文字（使用者貼的行程 / DC command） */
  freeText?: string
}

export interface SimilarCaseResult {
  summary: CaseReferenceSummary
  score: number            // 0–1 deterministic 分數
  matchedOn: string[]      // 為什麼相似（命中的維度）
  referencePoints: string[]// 可參考點
  uncertain: string[]      // 不確定 / 缺資料
}

export interface SimilarCaseSearchOutput {
  audience: AudienceScope
  query: SimilarCaseQuery
  results: SimilarCaseResult[]
  notes: string[]          // 全域缺資料 / 搜尋限制提醒
}
```

---

## 2. Field Policy（遮蔽邊界）

`src/lib/line-agent/notion/field-policy.ts` 提供 deterministic 分類表 + alias 正規化 + 過濾函式。預設「**未知欄位 = private + never**」（白名單制,安全優先）。

**Canonical 欄位 + alias map（真實 Notion schema 未導入，先穩定 alias）：** policy 不直接吃 raw property 字串，先用 alias map 正規化成 canonical key，再分類。真實 2026 DB 欄位等 Eric 給 schema 後補進 alias map，不改 canonical 集合。

```ts
// canonical 欄位集合（fixtures 與 policy 的唯一真相）
export type CanonicalField =
  | 'dates' | 'nights' | 'partySize' | 'adults' | 'children' | 'childAges'
  | 'cityArea' | 'tripType' | 'itinerarySummary' | 'highlights'
  | 'carGuideSetup' | 'quoteTotal' | 'status' | 'specialNeeds'
  | 'internalNotes' | 'internalTags' | 'cost' | 'profitShare'

// alias → canonical（範例,可擴充;真實欄位後補）
export const FIELD_ALIASES: Record<string, CanonicalField> = {
  '日期': 'dates', '出發日期': 'dates', '旅遊日期': 'dates',
  '天數': 'nights', '人數': 'partySize', '大人': 'adults',
  '小孩': 'children', '小孩年齡': 'childAges', '城市區域': 'cityArea',
  '行程類型': 'tripType', '行程摘要': 'itinerarySummary',
  '景點餐廳': 'highlights', '車導配置': 'carGuideSetup',
  '報價總額': 'quoteTotal', '狀態': 'status', '特殊需求': 'specialNeeds',
  '內部備註': 'internalNotes',
  '內部標籤': 'internalTags', '標籤': 'internalTags', 'Tags': 'internalTags',
  '成本': 'cost', '分潤': 'profitShare',
}
```

| canonical 欄位 | sensitivity | partner_group | operator_only | mask |
|---|---|---|---|---|
| dates / nights / partySize / adults / children / childAges / cityArea / tripType / itinerarySummary / highlights / status / specialNeeds | `read_only` | ✅ | ✅ | — |
| carGuideSetup | `read_only` | ✅ | ✅ | — |
| quoteTotal | `read_only` | ✅（**只給 quoteTier bucket**） | ✅（bucket） | `range` |
| internalNotes（內部備註） | `read_only` | ❌ omit | ✅ truncate 前 120 字 | `truncate` |
| internalTags（內部標籤） | `read_only` | ❌ omit | ✅ | — |
| cost（成本）/ profitShare（分潤）/ 利潤 | `private` | ❌ never | ❌ never | `omit` |
| 客人姓名 / 聯絡方式 | `private` | ❌ never | ❌ never | `omit` |
| 2025/2026 private 表任何欄位 | `private` | ❌ never | ❌ never | `omit` |
| Formula / rollup / relation / 任何 manual_only | `manual_only` | ❌ omit | ❌ omit | `omit` |

> **operator_only ≠ 全開：** 只比 partner 多拿 internalNotes(truncate 120)、internalTags、quoteTier range;cost / profitShare / private 全文 / Notion link / token / manual_only 一律仍 omit。

**API surface：**
```ts
/** raw property 名 → canonical key（吃 FIELD_ALIASES;未知回 null） */
export function normalizeField(property: string): CanonicalField | null
export function classifyField(property: string): FieldPolicyEntry  // 內部先 normalizeField,未知 → private+never
export function isVisibleTo(property: string, audience: AudienceScope): boolean
/** 過濾一筆 raw page properties → 只留某 audience 可見的鍵（已正規化）,並記錄 omitted */
export function filterProperties(
  raw: Record<string, unknown>,
  audience: AudienceScope,
): { visible: Record<string, unknown>; omitted: string[] }
/** 精準金額 → bucket;partner/operator 都只拿 bucket（每 10,000 THB 一級） */
export function toQuoteTier(amount: number | null | undefined): QuoteTier
```

---

## 3. Mapper

`src/lib/line-agent/notion/notion-mapper.ts`：
```ts
/** Notion page（已過 field-policy 的 visible 子集）→ 乾淨摘要 */
export function mapPageToSummary(
  page: NotionPageFixture,
  audience: AudienceScope,
): CaseReferenceSummary
```
- 不貼 Notion link、不複製整頁。
- 缺值欄位 → undefined,並列入 `omittedFields`（區分「敏感遮蔽」vs「本來就沒填」可用 notes，但 MVP 先合併到 omittedFields + matchedOn 即可，YAGNI）。

---

## 4. Read Path（similar-case search）

`src/lib/line-agent/notion/team-collaboration.ts`：
```ts
export interface NotionReadClient {
  /** 只讀;只接受 NOTION_TEAM_2026_DATABASE_ID,其他 id throw */
  queryTeam2026(databaseId: string): Promise<NotionPageFixture[]>
}

export async function searchSimilarCases(
  client: NotionReadClient,
  query: SimilarCaseQuery,
  audience: AudienceScope,
  opts?: {
    auditSink?: NotionReadAuditSink   // 有給才 append notion_read;不硬塞 CaseStore.appendAudit
    databaseId?: string
    limit?: number                    // 預設 5
    actor?: NotionReadAuditEntry['actor']
    caseId?: string
  },
): Promise<SimilarCaseSearchOutput>
```
- Deterministic scoring（先不 LLM）：各維度加權命中
  - 親子組成（adults/children/childAges 區間）權重最高
  - cityArea 完全/部分匹配
  - tripType 匹配
  - nights ±1 容忍
  - freeText → 對 highlights/tripType 做 keyword 命中
- 每筆輸出 `matchedOn`（命中維度）、`referencePoints`、`uncertain`（缺的維度）。
- audience 控制：`partner_group` 只吐 partner-safe 摘要;`operator_only` 較完整但仍**不**裸露 token/secret。
- 全程 read，**寫一筆 audit**（見 §4.5），不寫 Notion。

---

## 4.5 Read Audit（`notion_read` 型別）

新增一個 line-agent 內部 read audit 型別 **+ 獨立 sink**。**不**複用既有 CaseStore audit——既有 `AuditEntry` 是 case transition（`from`/`to`/`eventType` + 必填 `caseId`），而 `notion_read` 不是 state transition，且可能是 DC/operator 直接查詢、**不一定綁 case**。因此 caseId 為 optional，並走獨立 sink，不塞進 case state。

```ts
export interface NotionReadAuditEntry {
  type: 'notion_read'
  actor: 'eric' | 'tsai' | 'chun' | 'ai-agent'
  audience: AudienceScope
  querySummary: string        // 人類可讀的 query 摘要,不含 secret
  databaseLabel: string       // label 或短 hash,不記完整 secret-like id
  resultCount: number
  omittedSensitiveCount: number
  caseId?: string             // optional —— DC/operator 查詢可不綁 case
  timestamp: number           // 注入,不在內部呼叫 Date.now()
}

/** 獨立 read audit sink —— 與 CaseStore transition audit 分開 */
export interface NotionReadAuditSink {
  appendNotionRead(entry: NotionReadAuditEntry): Promise<void>
}
```

- `searchSimilarCases` 透過 `opts.auditSink`（optional DI;測試用 in-memory fake）每次查詢 append 一筆;**不硬塞 `CaseStore.appendAudit`**。沒給 sink 時不寫 audit（MVP 可接受）。
- `databaseLabel` 用固定 label（如 `team-2026`）或短 hash，**不**記完整 database id。
- MVP sink 實作可先 in-memory / 既有 agent audit log append；**不**寫 Notion、**不**呼叫 CaseStore transition API。

- mock Notion page fixtures,不打真 Notion 也能測 mapper / search。
- field-policy 有測試鎖住敏感欄位（成本/分潤/姓名/private）**不會**出現在 partner output。
- search 有測試：親子 / 日期 / 城市 / 景點 / 行程類型能找到相似案例並合理排序。
- no customer auto-reply / no Notion writes / no secrets。
- 不碰 quote URL / parser.ts / Sanity write。

---

## 6. Tasks（TDD,bite-sized,frequent commits）

### Task 1：型別 + fixtures 骨架
- Create: `src/lib/line-agent/notion/types.ts`（§1 全部型別）
- Create: `src/lib/line-agent/notion/__fixtures__/team-2026-schema.ts`（fixtures database schema：property 名稱清單，對齊真實 Notion 後可調）
- Create: `src/lib/line-agent/notion/__fixtures__/pages.ts`（≥4 筆 fixture pages，型別 `NotionPageFixture`：親子5天清邁、情侶蜜月、純玩拍、含敏感成本/分潤欄位的案例）
- Create: `src/lib/line-agent/__tests__/notion-fixtures.smoke.test.ts`（minimal smoke：import types + fixtures，斷言 `pages.length >= 4` 且每筆有 `id`/`databaseId`/`properties`）—— 讓 vitest 此時就有測試可跑，符合 TDD 節奏
- Step：先寫型別 + fixtures + smoke test → `npm run test:run -- src/lib/line-agent/notion src/lib/line-agent/__tests__/notion-fixtures.smoke.test.ts`（**預期 PASS**，非 compile-only）→ commit `chore(line-agent): add notion read types + fixtures + smoke test`

### Task 2：field-policy（TDD）
- Test: `src/lib/line-agent/__tests__/notion-field-policy.test.ts`
  - 寫失敗測試：
    - alias：`normalizeField('出發日期')`/`normalizeField('旅遊日期')` → `'dates'`;未知 → `null`。
    - `classifyField('成本')`/`classifyField('分潤')` → `private`/`never`（partner+operator 皆否）;`classifyField('日期')` → `read_only`/partner✅;未知欄位 → `private`/`never`。
    - `filterProperties(rawWithCost, 'partner_group')` **不含** cost/profitShare/姓名/internalNotes/internalTags 鍵,`omitted` 含這些。
    - operator_only：`filterProperties(raw, 'operator_only')` **含** internalTags、internalNotes(truncate≤120),但仍**不含** cost/profitShare/private 全文。
    - `toQuoteTier(15000)` → `'10k-20k'`;`toQuoteTier(undefined)` → `'unknown'`;`toQuoteTier(50000)` → `'50k+'`。
  - 跑測試確認 fail → 實作 `field-policy.ts` 最小碼 → 跑測試 pass → commit `feat(line-agent): notion field-policy with alias map + audience masking`

### Task 3：notion-mapper（TDD）
- Test: `src/lib/line-agent/__tests__/notion-mapper.test.ts`
  - 失敗測試：fixture page → `CaseReferenceSummary`,partner audience 下 `omittedFields` 含成本;`highlights`/`adults`/`children`/`cityArea` 正確;無 Notion link 字串、無 token。
  - fail → 實作 `notion-mapper.ts` → pass → commit `feat(line-agent): notion page to case reference summary mapper`

### Task 4：similar-case search（TDD）
- Test: `src/lib/line-agent/__tests__/notion-similar-search.test.ts`
  - 用 fake `NotionReadClient`（回 fixtures,不打真 Notion）+ fake `NotionReadAuditSink`（in-memory 收 entries）。
  - 失敗測試：query{children:2, cityArea:'清邁', tripType:'親子'} → top result 是親子5天案例,`matchedOn` 含 children/cityArea/tripType;非 2026 databaseId → throw;partner audience 輸出不含敏感欄位;`uncertain` 正確列缺維度;`limit` 生效。
  - audit 測試：查詢後 fake sink 收到**剛好一筆** `notion_read`,含 `audience`/`resultCount`/`omittedSensitiveCount`,`databaseLabel` 非完整 id;無 caseId 時不 throw（optional）;**確認沒呼叫 CaseStore transition API**。
  - fail → 實作 `team-collaboration.ts`（含 deterministic scoring + audit 呼叫）→ pass → commit `feat(line-agent): deterministic notion similar-case read search`

### Task 5：env + audit 收尾
- Modify: `.env.example`（補 `NOTION_TOKEN` / `NOTION_TEAM_2026_DATABASE_ID` 若缺）
- 確認 search 有寫 audit（read 事件:actor/query/count/audience）、無 write。
- 全套：`npm run test:run -- src/lib/line-agent` 綠 → `npm run lint` → commit `chore(line-agent): wire notion read env + read audit`

> **install / 測試提醒（踩過的坑）：** 一律走 WSL linux `npm`;Windows gate 用 `npm.cmd run test:run -- src/lib/line-agent/notion`。

---

## 7. 已拍板決議（Eric 2026-06-02）

1. **fixtures property 名稱**：不假裝知道真實 schema。用 canonical 欄位 + alias map（§2）;真實 2026 DB 欄位等 Eric 給 schema 後補進 `FIELD_ALIASES`，不把假欄位寫死成唯一真相。
2. **quoteTier**：MVP 每 10,000 THB 一級 → `<10k / 10k-20k / 20k-30k / 30k-50k / 50k+ / unknown`;partner summary 不暴露精準金額。先不做複雜定價級距。
3. **operator_only**：多拿 internalNotes(truncate 120) + internalTags + quoteTier range;仍不顯示成本明細 / 分潤 / 2025-2026 private 全文 / Notion link / token / manual_only。operator ≠ 全開。
4. **read audit**：新增 `notion_read` 型別（§4.5）;本輪不寫 Notion audit，只寫 agent / local CaseStore audit;不硬塞成 case state transition。

## 8. 仍待補（不阻擋本輪 read 實作）

- 真實 2026 DB schema 導入後，補 `FIELD_ALIASES` 真實欄位 mapping。
- write path（insert/update confirmed records）整個延到 Phase B2 / Phase D。

---

## 9. 實作完成記錄（2026-06-02，Codex 驗證）

**status: implemented** · branch `codex/line-oa-agent-mvp` · tip `2de7e79`（finishing Option 3：保留 branch，不 merge / 不開 PR）

5 顆 TDD task 全收，commit 鏈：

| Task | 內容 | commit | tests |
|---|---|---|---|
| 1 | types + fixtures + smoke | `938aace` | 4 |
| 2 | field-policy（alias map + audience masking） | `59df4c5` | 13 |
| 3 | notion-mapper（page → CaseReferenceSummary） | `e85b724` | 7 |
| 4 | similar-case search + `notion_read` audit | `97e2294` | 8 |
| 5 | `.env.example` 收尾（read-only 註解） | `2de7e79` | — |

新增檔：`src/lib/line-agent/notion/{types,field-policy,notion-mapper,team-collaboration}.ts`、`notion/__fixtures__/{team-2026-schema,pages}.ts`、`__tests__/{notion-fixtures.smoke,notion-field-policy,notion-mapper,notion-similar-search}.test.ts`。

**驗證**：line-agent 285 + full suite 471 tests 綠、`npm run lint` clean、`next build` exit 0、`git diff main..HEAD` clean。

**鐵律守住**：read-only（無 Notion writes）、白名單 field-policy（未知欄位 → private+never）、masking 在 policy 層完成（partner 永不見精準金額/cost/profit/姓名）、`notion_read` audit 走獨立 injected sink（caseId optional、不碰 CaseStore transition）、未動 `parser.ts` / quote URL / Sanity write / customer auto-reply。

**下一步 = Phase C（quote URL Task 10）**：開乾淨 session，先 Eric 批准才動 parser；動 `src/lib/itinerary/parser.ts` 前必先補 golden fixture 鎖住括號門票 gap（例：`大象門票（大人）950*4`）。
