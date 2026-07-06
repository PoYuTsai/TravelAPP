# 檢索閉環刀 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 沉澱進 Notion「沉澱問答 DB」的已批准 QA 回流到 partner-group responder 的 system prompt（fail-open、TTL 10min、cap 30），讓 bot 答得出群裡沉澱過的知識。

**Architecture:** 設計見 `docs/plans/2026-06-12-qa-knowledge-retrieval-loop-design.md`。四個觸點：新 `qa-knowledge-source.ts`（讀已批准 QA → 知識區塊文字，mirror `distilled-qa-writer.ts` 紀律）、`system-prompt.ts` 加 optional 知識參數、`anthropic-responder.ts` 加 optional `knowledgeSource` dep（fail-open）、config/factory/composition-root 接線（三件齊閘 default off）。快取核心從 `cached-rag-source.ts` 抽泛型 `cached-loader.ts` 兩邊共用。

**Tech Stack:** TypeScript、vitest（`npx vitest run <file>`）、@notionhq/client v5（data source 模型）、注入式 SDK fake 測試。

**鐵律（每個 task 都適用）：**
- Fail-open：知識是 enhancement；任何失敗 ⇒ 退回現行 prompt，行為 byte-identical。
- Leak guard：raw SDK error 可能夾 token / db id / notion url — 一律吞掉、只 log fixed code。
- 閘 default off：不開閘 ⇒ source 不接線 ⇒ 零行為差異、零 Notion 讀。
- 每個 task 完成即 commit＋**立即 push**（全域規則）。

---

### Task 1: 抽 `cached-loader.ts` 泛型核心（TTL＋single-flight）

`createCachedRagAnswerSource` 的快取核心（`getIndex`）跟 `PartnerRagDraftSource` 的 `answer(index, input)` 簽名耦合，知識源用不上。抽一個純泛型 loader，rag 那邊改為委派 — 既有 `cached-rag-source.test.ts` 全綠就是迴歸鎖。

**Files:**
- Create: `src/lib/line-agent/partner-group/cached-loader.ts`
- Create: `src/lib/line-agent/__tests__/cached-loader.test.ts`
- Modify: `src/lib/line-agent/partner-group/cached-rag-source.ts`

**Step 1: 寫 failing test**

`src/lib/line-agent/__tests__/cached-loader.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import { createCachedLoader } from '../partner-group/cached-loader'

describe('createCachedLoader', () => {
  it('TTL 內重用快取（load 只跑一次）', async () => {
    let t = 0
    const load = vi.fn(async () => 'v1')
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => t })
    expect(await get()).toBe('v1')
    t = 999
    expect(await get()).toBe('v1')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('TTL 到期（>=）重新 load', async () => {
    let t = 0
    let n = 0
    const load = vi.fn(async () => `v${++n}`)
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => t })
    expect(await get()).toBe('v1')
    t = 1000
    expect(await get()).toBe('v2')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('single-flight：併發呼叫 join 同一次 load', async () => {
    let resolve!: (v: string) => void
    const load = vi.fn(
      () => new Promise<string>((r) => { resolve = r })
    )
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => 0 })
    const [a, b] = [get(), get()]
    resolve('shared')
    expect(await a).toBe('shared')
    expect(await b).toBe('shared')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('load 失敗：error 上拋且不快取 — 下一次重試', async () => {
    let n = 0
    const load = vi.fn(async () => {
      if (++n === 1) throw new Error('boom')
      return 'recovered'
    })
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => 0 })
    await expect(get()).rejects.toThrow('boom')
    expect(await get()).toBe('recovered')
  })
})
```

**Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/cached-loader.test.ts`
Expected: FAIL — `Cannot find module '../partner-group/cached-loader'`

**Step 3: 實作**

`src/lib/line-agent/partner-group/cached-loader.ts`（邏輯一字不差搬自 `cached-rag-source.ts` 的 `getIndex`，只是去掉 rag 型別）：

```ts
/**
 * cached-loader.ts — 檢索閉環刀：TTL + single-flight 快取的泛型核心，
 * 從 cached-rag-source.ts 抽出（design 2026-06-12 §2 快取）。
 *
 * 兩個消費者、兩種失敗語意：
 *  - cached-rag-source（fail-closed）：error 上拋，rag responder 轉 unavailable reply。
 *  - qa-knowledge-source（fail-open）：呼叫端 catch error 轉 null。
 * 共同點：error 永不快取 — 下一次呼叫重試，絕不為整個 TTL 供應 stale failure。
 */

export interface CachedLoaderDeps<T> {
  /** Expensive load（如讀 Notion）。成功結果快取一個 TTL 窗。 */
  load: () => Promise<T>
  /** 快取壽命 ms。建置時間 >= ttlMs 即視為過期重建。 */
  ttlMs: number
  /** 注入時鐘（ms）。預設 wall clock；測試 pin 死。 */
  now?: () => number
}

export function createCachedLoader<T>(deps: CachedLoaderDeps<T>): () => Promise<T> {
  const { load, ttlMs } = deps
  const now = deps.now ?? (() => Date.now())

  let entry: { value: T; builtAt: number } | null = null
  let inFlight: Promise<T> | null = null

  return async function get(): Promise<T> {
    if (entry !== null && now() - entry.builtAt < ttlMs) {
      return entry.value
    }
    if (inFlight !== null) {
      return inFlight
    }
    inFlight = (async () => {
      try {
        const value = await load()
        // builtAt 在 load 之後才蓋章 — TTL 只涵蓋可用快取時間。
        entry = { value, builtAt: now() }
        return value
      } finally {
        // 永遠清 in-flight latch — 成功則下一個呼叫讀 fresh entry；失敗則
        // entry 未動 ⇒ 失敗不被快取，下一次呼叫重試。
        inFlight = null
      }
    })()
    return inFlight
  }
}
```

**Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/line-agent/__tests__/cached-loader.test.ts`
Expected: 4 PASS

**Step 5: refactor `cached-rag-source.ts` 委派泛型核心**

把 `getIndex` 整段（`let entry` 到函式結尾）換成委派；檔頭註解補一行出處。函式體改為：

```ts
import { createCachedLoader } from './cached-loader'

export function createCachedRagAnswerSource<TIndex>(
  deps: CachedRagAnswerSourceDeps<TIndex>,
): PartnerRagDraftSource {
  // TTL + single-flight 核心抽到 cached-loader.ts（檢索閉環刀）— 行為不變：
  // fail-closed（loadIndex error 上拋且不快取）由泛型核心同樣保證。
  const getIndex = createCachedLoader({
    load: deps.loadIndex,
    ttlMs: deps.ttlMs,
    now: deps.now,
  })

  return async (input) => {
    const index = await getIndex()
    return deps.answer(index, input)
  }
}
```

（介面 `CachedRagAnswerSourceDeps` 與檔頭設計註解保留不動。）

**Step 6: 跑迴歸鎖**

Run: `npx vitest run src/lib/line-agent/__tests__/cached-rag-source.test.ts src/lib/line-agent/__tests__/cached-loader.test.ts`
Expected: 全 PASS（rag 測試一字未改仍綠 = 行為不變證明）

**Step 7: Commit＋push**

```bash
git add src/lib/line-agent/partner-group/cached-loader.ts src/lib/line-agent/partner-group/cached-rag-source.ts src/lib/line-agent/__tests__/cached-loader.test.ts
git commit -m "refactor(line-agent): 抽 cached-loader 泛型核心 — TTL＋single-flight 兩刀共用（檢索閉環刀 §2）"
git push
```

---

### Task 2: `qa-knowledge-config.ts` — 讀取閘 resolver

Mirror `knowledge-write-config.ts`（同檔幾乎逐行對應）：三件齊才 enabled — `QA_KNOWLEDGE_READ_ENABLED='true'`＋`NOTION_KNOWLEDGE_TOKEN`＋`NOTION_DISTILLED_QA_DB`。

**Files:**
- Create: `src/lib/line-agent/partner-group/qa-knowledge-config.ts`
- Create: `src/lib/line-agent/__tests__/qa-knowledge-config.test.ts`

**Step 1: 寫 failing test**

```ts
import { describe, expect, it } from 'vitest'
import { resolveQaKnowledgeReadConfig } from '../partner-group/qa-knowledge-config'

const FULL = {
  QA_KNOWLEDGE_READ_ENABLED: 'true',
  NOTION_KNOWLEDGE_TOKEN: 'secret-token',
  NOTION_DISTILLED_QA_DB: 'abcdef1234abcdef1234abcdef123456',
}

describe('resolveQaKnowledgeReadConfig', () => {
  it('三件齊 ⇒ enabled＋token＋databaseId', () => {
    const config = resolveQaKnowledgeReadConfig(FULL)
    expect(config).toEqual({
      enabled: true,
      token: 'secret-token',
      databaseId: 'abcdef1234abcdef1234abcdef123456',
    })
  })

  it('閘未開（缺/false/空白）⇒ disabled 且不帶 reason', () => {
    expect(resolveQaKnowledgeReadConfig({})).toEqual({ enabled: false })
    expect(
      resolveQaKnowledgeReadConfig({ ...FULL, QA_KNOWLEDGE_READ_ENABLED: 'false' })
    ).toEqual({ enabled: false })
  })

  it('閘開但缺 token ⇒ disabled＋missing_knowledge_token', () => {
    expect(
      resolveQaKnowledgeReadConfig({ ...FULL, NOTION_KNOWLEDGE_TOKEN: ' ' })
    ).toEqual({ enabled: false, reason: 'missing_knowledge_token' })
  })

  it('閘開但缺 db id ⇒ disabled＋missing_database_id', () => {
    expect(
      resolveQaKnowledgeReadConfig({ ...FULL, NOTION_DISTILLED_QA_DB: '' })
    ).toEqual({ enabled: false, reason: 'missing_database_id' })
  })
})
```

**Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/qa-knowledge-config.test.ts`
Expected: FAIL — module not found

**Step 3: 實作**

`src/lib/line-agent/partner-group/qa-knowledge-config.ts`：

```ts
/**
 * qa-knowledge-config.ts — 檢索閉環刀：沉澱 QA 讀取閘 env resolver（pure）.
 *
 * Mirror knowledge-write-config.ts、方向相反（讀不是寫）：三件齊才 enabled —
 * QA_KNOWLEDGE_READ_ENABLED='true' ＋ NOTION_KNOWLEDGE_TOKEN ＋
 * NOTION_DISTILLED_QA_DB。任一缺 ⇒ enabled:false ＋ fixed reason code。
 * 讀寫閘獨立：CC 寫入（KNOWLEDGE_WRITE_ENABLED）與 bot 讀取可分開開關。
 */

import { normaliseDatabaseId } from '../notion/notion-rag-config'

export type QaKnowledgeReadConfig =
  | { enabled: true; token: string; databaseId: string }
  | {
      enabled: false
      reason?: 'missing_knowledge_token' | 'missing_database_id'
    }

export function resolveQaKnowledgeReadConfig(
  env: Record<string, string | undefined>
): QaKnowledgeReadConfig {
  if ((env.QA_KNOWLEDGE_READ_ENABLED ?? '').trim() !== 'true') {
    return { enabled: false }
  }
  const token = (env.NOTION_KNOWLEDGE_TOKEN ?? '').trim()
  if (token === '') return { enabled: false, reason: 'missing_knowledge_token' }
  const databaseId = normaliseDatabaseId((env.NOTION_DISTILLED_QA_DB ?? '').trim())
  if (databaseId === '') return { enabled: false, reason: 'missing_database_id' }
  return { enabled: true, token, databaseId }
}
```

**Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/line-agent/__tests__/qa-knowledge-config.test.ts`
Expected: 4 PASS

**Step 5: Commit＋push**

```bash
git add src/lib/line-agent/partner-group/qa-knowledge-config.ts src/lib/line-agent/__tests__/qa-knowledge-config.test.ts
git commit -m "feat(line-agent): 檢索閉環刀 — QA 知識讀取閘 resolver（三件齊才 enabled，default off）"
git push
```

---

### Task 3: `qa-knowledge-source.ts` — 核心讀取源

讀已批准 QA → 知識區塊文字。Mirror `distilled-qa-writer.ts`（SDK 注入、data_source_id lazy cache、leak guard）＋ Task 1 的 `createCachedLoader`（TTL 10min＋single-flight）。**Fail-open**：error 收斂成 null（對照 rag 的 fail-closed）。

**Files:**
- Create: `src/lib/line-agent/partner-group/qa-knowledge-source.ts`
- Create: `src/lib/line-agent/__tests__/qa-knowledge-source.test.ts`

**Step 1: 寫 failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  createQaKnowledgeSource,
  QA_KNOWLEDGE_HEADER,
  type QaKnowledgeSdkClient,
} from '../partner-group/qa-knowledge-source'

const page = (q: string, a: string, status = '已批准') => ({
  properties: {
    問題: { title: [{ plain_text: q }] },
    答案: { rich_text: [{ plain_text: a }] },
    狀態: { select: { name: status } },
  },
})

function fakeSdk(results: unknown[], hasMore = false): QaKnowledgeSdkClient {
  return {
    databases: {
      retrieve: vi.fn(async () => ({ data_sources: [{ id: 'ds-1' }] })),
    },
    dataSources: {
      query: vi.fn(async () => ({ results, has_more: hasMore })),
    },
  }
}

const make = (
  sdk: QaKnowledgeSdkClient,
  extra: Partial<{ ttlMs: number; now: () => number; log: any }> = {}
) =>
  createQaKnowledgeSource({
    sdk,
    databaseId: 'db-1',
    ttlMs: extra.ttlMs ?? 1000,
    now: extra.now ?? (() => 0),
    log: extra.log,
  })

describe('createQaKnowledgeSource', () => {
  it('撈已批准 QA → 知識區塊（header＋Q/A 條目）', async () => {
    const source = make(fakeSdk([page('兩大兩小坐小轎車會不會擠', '會擠，建議 Toyota Commuter 10 人座 Van')]))
    const text = await source()
    expect(text).toContain(QA_KNOWLEDGE_HEADER)
    expect(text).toContain('Q：兩大兩小坐小轎車會不會擠')
    expect(text).toContain('A：會擠，建議 Toyota Commuter 10 人座 Van')
  })

  it('過濾非已批准（防衛性 client-side filter）與空 Q/A', async () => {
    const source = make(
      fakeSdk([
        page('好問題', '好答案'),
        page('未批准的', '不該出現', '候選'),
        page('', '沒問題文字'),
      ])
    )
    const text = await source()
    expect(text).toContain('好問題')
    expect(text).not.toContain('不該出現')
    expect(text).not.toContain('沒問題文字')
  })

  it('0 條已批准 ⇒ null（不注入空區塊）', async () => {
    const source = make(fakeSdk([page('x', 'y', '候選')]))
    expect(await source()).toBeNull()
  })

  it('超過 cap 30 ⇒ 截斷照用＋log qa_knowledge_truncated', async () => {
    const log = vi.fn()
    const many = Array.from({ length: 35 }, (_, i) => page(`Q${i}`, `A${i}`))
    const source = make(fakeSdk(many), { log })
    const text = await source()
    expect(text).toContain('Q：Q29')
    expect(text).not.toContain('Q：Q30')
    expect(log).toHaveBeenCalledWith(
      'qa_knowledge_truncated',
      expect.objectContaining({ total: 35, kept: 30 })
    )
  })

  it('Notion 錯誤 ⇒ null＋log qa_knowledge_unavailable（fail-open，不上拋）', async () => {
    const log = vi.fn()
    const sdk = fakeSdk([])
    ;(sdk.dataSources.query as any).mockRejectedValue(
      new Error('secret-token leaked notion.so/db-1')
    )
    const source = make(sdk, { log })
    expect(await source()).toBeNull()
    expect(log).toHaveBeenCalledWith('qa_knowledge_unavailable', expect.any(Object))
  })

  it('TTL 快取：窗內只 query 一次；過期重撈', async () => {
    let t = 0
    const sdk = fakeSdk([page('q', 'a')])
    const source = make(sdk, { now: () => t, ttlMs: 1000 })
    await source()
    t = 999
    await source()
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(1)
    t = 1000
    await source()
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(2)
  })

  it('single-flight：併發只打一次 Notion', async () => {
    const sdk = fakeSdk([page('q', 'a')])
    const source = make(sdk)
    await Promise.all([source(), source()])
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(1)
  })

  it('錯誤不快取：第一次失敗回 null，下一則訊息重試成功', async () => {
    const sdk = fakeSdk([page('q', 'a')])
    ;(sdk.dataSources.query as any).mockRejectedValueOnce(new Error('boom'))
    const source = make(sdk)
    expect(await source()).toBeNull()
    expect(await source()).toContain('Q：q')
  })
})
```

**Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/qa-knowledge-source.test.ts`
Expected: FAIL — module not found

**Step 3: 實作**

`src/lib/line-agent/partner-group/qa-knowledge-source.ts`：

```ts
/**
 * qa-knowledge-source.ts — 檢索閉環刀：沉澱問答 DB（已批准）→ system prompt
 * 知識區塊（design 2026-06-12 §1 觸點 1）。
 *
 * Mirror distilled-qa-writer.ts 紀律、方向相反（讀不是寫）：
 *  - SDK 注入式最小面（databases.retrieve ＋ dataSources.query）；真 Client
 *    只在 composition root（install-default-qa-knowledge-source.ts）構建。
 *  - data_source_id 在實例內 lazy cache（單 source DB）。
 *  - Leak guard：raw SDK error 可能夾 token / db id / notion url — 一律吞掉，
 *    只 log fixed code。
 *
 * FAIL-OPEN（對照 cached-rag-source 的 fail-closed）：知識是 enhancement，
 * 任何失敗 ⇒ 回 null，responder 退回現行 prompt。錯誤不快取（cached-loader
 * 保證）— 下一則訊息重試。0 條已批准＝成功的空結果 ⇒ null 且**會**快取
 * （KB 空時不必每則訊息打 Notion）。
 *
 * 全量注入（無 per-message 檢索）：cap 30 條量級下全量比相似度檢索簡單且夠用，
 * 也因此 source 簽名零參數 — 與當則訊息無關，快取一份全群共用。
 */

import { createCachedLoader } from './cached-loader'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'

/** 零參數：全量知識區塊文字；無知識/失敗 ⇒ null。 */
export type QaKnowledgeSource = () => Promise<string | null>

/** 注入 SDK 的最小結構面（真 @notionhq/client v5 Client 結構相容）。 */
export interface QaKnowledgeSdkClient {
  databases: {
    retrieve(args: { database_id: string }): Promise<{
      data_sources?: Array<{ id: string }>
    }>
  }
  dataSources: {
    query(args: {
      data_source_id: string
      filter?: unknown
      page_size?: number
    }): Promise<{ results: unknown[]; has_more?: boolean }>
  }
}

/** 注入上限 — 超過截斷照用＋log（design §2 失敗路徑表）。 */
export const QA_KNOWLEDGE_CAP = 30
/** TTL 10 分鐘 — CC 寫新知識最慢 10 分鐘生效（design §2 快取）。 */
export const QA_KNOWLEDGE_TTL_MS = 10 * 60 * 1000

export const QA_KNOWLEDGE_HEADER =
  '【清微旅行沉澱問答｜以下為過往已確認的問答知識，優先依此回答】'

const APPROVED_STATUS = '已批准'

/** Notion title / rich_text fragment 陣列 → 純文字。 */
function plainText(fragments: unknown): string {
  if (!Array.isArray(fragments)) return ''
  return fragments
    .map((f) =>
      typeof (f as { plain_text?: unknown })?.plain_text === 'string'
        ? ((f as { plain_text: string }).plain_text)
        : ''
    )
    .join('')
    .trim()
}

interface QaEntry {
  question: string
  answer: string
}

/** Page → QaEntry；非已批准 / 缺 Q 或 A ⇒ null（防衛性 client-side filter）。 */
function toApprovedQaEntry(result: unknown): QaEntry | null {
  const properties = (result as { properties?: Record<string, unknown> })?.properties
  if (typeof properties !== 'object' || properties === null) return null
  const status = (properties['狀態'] as { select?: { name?: unknown } })?.select?.name
  if (status !== APPROVED_STATUS) return null
  const question = plainText((properties['問題'] as { title?: unknown })?.title)
  const answer = plainText((properties['答案'] as { rich_text?: unknown })?.rich_text)
  if (question === '' || answer === '') return null
  return { question, answer }
}

export interface QaKnowledgeSourceDeps {
  sdk: QaKnowledgeSdkClient
  databaseId: string
  /** 測試覆寫；prod 用 QA_KNOWLEDGE_TTL_MS。 */
  ttlMs?: number
  /** 注入時鐘 — cached-loader 同款。 */
  now?: () => number
  /** 快取/截斷事件非綁單一 request — 預設 '-' requestId logger。 */
  log?: AgentLogger
}

export function createQaKnowledgeSource(deps: QaKnowledgeSourceDeps): QaKnowledgeSource {
  const log = deps.log ?? createAgentLogger({ requestId: '-' })
  let dataSourceId: string | null = null

  const load = async (): Promise<string | null> => {
    if (dataSourceId === null) {
      const db = await deps.sdk.databases.retrieve({ database_id: deps.databaseId })
      const sources = Array.isArray(db?.data_sources) ? db.data_sources : []
      if (sources.length === 0) throw new Error('qa knowledge db has no data source')
      dataSourceId = sources[0].id
    }
    // Server-side filter 已批准＋page_size 100（單頁即超 cap 3 倍，不翻頁）；
    // client-side toApprovedQaEntry 再防衛性過濾一次。
    const res = await deps.sdk.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: '狀態', select: { equals: APPROVED_STATUS } },
      page_size: 100,
    })
    const entries = res.results
      .map(toApprovedQaEntry)
      .filter((e): e is QaEntry => e !== null)
    if (entries.length === 0) return null
    if (entries.length > QA_KNOWLEDGE_CAP || res.has_more === true) {
      log('qa_knowledge_truncated', {
        total: entries.length,
        kept: Math.min(entries.length, QA_KNOWLEDGE_CAP),
      })
    }
    const kept = entries.slice(0, QA_KNOWLEDGE_CAP)
    return [
      QA_KNOWLEDGE_HEADER,
      ...kept.map((e) => `Q：${e.question}\nA：${e.answer}`),
    ].join('\n')
  }

  const cachedLoad = createCachedLoader({
    load,
    ttlMs: deps.ttlMs ?? QA_KNOWLEDGE_TTL_MS,
    now: deps.now,
  })

  return async () => {
    try {
      return await cachedLoad()
    } catch {
      // FAIL-OPEN＋leak guard：raw error 吞掉（可能夾 token/db id/url），
      // fixed code log；cached-loader 保證失敗不快取 ⇒ 下一則重試。
      log('qa_knowledge_unavailable', {})
      return null
    }
  }
}
```

注意：`structured-log` 的 `AgentLogger` 簽名以實際檔案為準（`log(event, fields)`）— 動手前先開 `src/lib/line-agent/observability/structured-log.ts` 確認，必要時微調呼叫處與測試斷言。

**Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/line-agent/__tests__/qa-knowledge-source.test.ts`
Expected: 8 PASS

**Step 5: Commit＋push**

```bash
git add src/lib/line-agent/partner-group/qa-knowledge-source.ts src/lib/line-agent/__tests__/qa-knowledge-source.test.ts
git commit -m "feat(line-agent): 檢索閉環刀 — qa-knowledge-source（已批准 QA→知識區塊，fail-open＋TTL＋cap 30）"
git push
```

---

### Task 4: `system-prompt.ts` — 知識區塊接尾端

**Files:**
- Modify: `src/lib/line-agent/partner-group/system-prompt.ts:56-65`（`buildPartnerGroupSystemPrompt`）
- Modify: `src/lib/line-agent/__tests__/system-prompt.test.ts`（加測試，不動既有）

**Step 1: 加 failing tests**（先讀既有測試檔，沿用其 input fixture 寫法）

```ts
describe('buildPartnerGroupSystemPrompt — 檢索閉環刀知識區塊', () => {
  it('無知識（undefined/null）⇒ 輸出與現行 byte-identical（迴歸鎖）', () => {
    expect(buildPartnerGroupSystemPrompt(baseInput)).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(buildPartnerGroupSystemPrompt(baseInput, null)).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(buildPartnerGroupSystemPrompt(baseInput, '  ')).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('有知識 ⇒ 區塊接在 frozen persona 尾端', () => {
    const knowledge = '【清微旅行沉澱問答】\nQ：q\nA：a'
    const prompt = buildPartnerGroupSystemPrompt(baseInput, knowledge)
    expect(prompt.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
    expect(prompt).toContain(knowledge)
  })

  it('知識＋引用脈絡並存 ⇒ 知識在前、引用在後', () => {
    const knowledge = '【清微旅行沉澱問答】\nQ：q\nA：a'
    const prompt = buildPartnerGroupSystemPrompt(
      { ...baseInput, quotedBotContent: '之前的草稿' },
      knowledge
    )
    expect(prompt.indexOf(knowledge)).toBeGreaterThan(-1)
    expect(prompt.indexOf(knowledge)).toBeLessThan(prompt.indexOf('【引用脈絡】'))
    expect(prompt).toContain('「之前的草稿」')
  })
})
```

**Step 2: 跑測試確認新測試 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/system-prompt.test.ts`
Expected: 新 3 條 FAIL（簽名沒有第二參數）、既有全 PASS

**Step 3: 實作**

`buildPartnerGroupSystemPrompt` 改為：

```ts
/**
 * Lightweight assembly hook (design §5 step 2).  Frozen persona + guardrails
 * verbatim；刀A：引用脈絡接尾端；檢索閉環刀：沉澱知識區塊接 persona 之後、
 * 引用之前（引用語意最貼近當則訊息，留最尾）。知識缺席 ⇒ 與現行 byte-identical。
 */
export function buildPartnerGroupSystemPrompt(
  input: PartnerGroupRespondInput,
  knowledge?: string | null
): string {
  const sections = [PARTNER_GROUP_SYSTEM_PROMPT]
  const trimmedKnowledge = knowledge?.trim()
  if (trimmedKnowledge) {
    sections.push('', trimmedKnowledge)
  }
  const quoted = input.quotedBotContent?.trim()
  if (quoted) {
    sections.push(
      '',
      '【引用脈絡】使用者引用了你之前說的這句話，他的訊息是針對這句的回應；解讀口語、代稱與省略時，以這段引用為脈絡：',
      `「${quoted}」`
    )
  }
  return sections.join('\n')
}
```

（純 quote、無知識時輸出與現行逐字相同 — 既有測試就是證明。）

**Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/line-agent/__tests__/system-prompt.test.ts`
Expected: 全 PASS

**Step 5: Commit＋push**

```bash
git add src/lib/line-agent/partner-group/system-prompt.ts src/lib/line-agent/__tests__/system-prompt.test.ts
git commit -m "feat(line-agent): 檢索閉環刀 — system prompt 知識區塊（缺席 byte-identical 迴歸鎖）"
git push
```

---

### Task 5: `anthropic-responder.ts` — optional `knowledgeSource` 注入

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts`
- Modify: `src/lib/line-agent/__tests__/anthropic-responder.test.ts`（加測試；先讀既有 fake transport / costCap fixture 寫法並沿用）

**Step 1: 加 failing tests**

```ts
describe('AnthropicPartnerGroupResponder — 檢索閉環刀 knowledgeSource', () => {
  it('注入 knowledgeSource ⇒ 送出的 system 含知識區塊', async () => {
    // 沿用既有 fake transport（攔 body）＋ ok costCap fixture
    const responder = new AnthropicPartnerGroupResponder({
      ...baseDeps,
      knowledgeSource: async () => '【清微旅行沉澱問答】\nQ：q\nA：a',
    })
    await responder.respond(baseInput)
    const body = JSON.parse(capturedRequestBody())
    expect(body.system).toContain('Q：q')
    expect(body.system.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
  })

  it('knowledgeSource 回 null ⇒ system 與現行 byte-identical', async () => {
    const responder = new AnthropicPartnerGroupResponder({
      ...baseDeps,
      knowledgeSource: async () => null,
    })
    await responder.respond(baseInput)
    expect(JSON.parse(capturedRequestBody()).system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('knowledgeSource throw ⇒ fail-open：照常回覆、原 prompt', async () => {
    const responder = new AnthropicPartnerGroupResponder({
      ...baseDeps,
      knowledgeSource: async () => {
        throw new Error('boom')
      },
    })
    const result = await responder.respond(baseInput)
    expect(result.meta?.responder).toBe('llm')
    expect(JSON.parse(capturedRequestBody()).system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })
})
```

（未注入 ⇒ 行為不變 — 既有測試全綠就是證明，不必新寫。）

**Step 2: 跑測試確認新測試 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 新 3 條 FAIL、既有全 PASS

**Step 3: 實作**

`anthropic-responder.ts` 三處：

```ts
// ① import 加：
import type { QaKnowledgeSource } from './qa-knowledge-source'

// ② deps 介面加（researchModel 之後、costCap 之前）：
  /**
   * 沉澱 QA 知識源（檢索閉環刀）— OPTIONAL＋fail-open：未注入或失敗 ⇒
   * prompt 與現行 byte-identical。對照 costCap 的 REQUIRED fail-closed —
   * 知識是 enhancement，預算是 brake。
   */
  knowledgeSource?: QaKnowledgeSource

// ③ class field ＋ ctor 照抄既有欄位模式；respond() 內，budget gate 通過後、
//    const system = ... 那行改成：

    // 檢索閉環刀 — 沉澱知識（fail-open）：source 內部已收斂錯誤為 null，
    // 這層 try-catch 是 belt-and-braces — 任何 throw 都不得擋住回覆。
    let knowledge: string | null = null
    if (this.knowledgeSource) {
      try {
        knowledge = await this.knowledgeSource()
      } catch {
        log('qa_knowledge_unavailable', {})
      }
    }

    const system = buildPartnerGroupSystemPrompt(input, knowledge)
```

**Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 全 PASS

**Step 5: Commit＋push**

```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts src/lib/line-agent/__tests__/anthropic-responder.test.ts
git commit -m "feat(line-agent): 檢索閉環刀 — anthropic responder 注入 knowledgeSource（fail-open）"
git push
```

---

### Task 6: factory passthrough＋installer＋webhook-runtime 接線＋.env.example

**Files:**
- Modify: `src/lib/line-agent/partner-group/responder-factory.ts`（`CreatePartnerGroupResponderInput` 加 optional `knowledgeSource`，傳給 adapter）
- Create: `src/lib/line-agent/line/install-default-qa-knowledge-source.ts`
- Create: `src/lib/line-agent/__tests__/install-default-qa-knowledge-source.test.ts`
- Modify: `src/lib/line-agent/line/webhook-runtime.ts:476-491`（`getPartnerGroupResponder`）
- Modify: `.env.example`（`KNOWLEDGE_WRITE_ENABLED` 附近）

**Step 1: 寫 installer failing test**（mirror `install-default-distilled-qa-writer.test.ts` — 先讀它沿用寫法）

```ts
import { describe, expect, it, vi } from 'vitest'
import { buildDefaultQaKnowledgeSource } from '../line/install-default-qa-knowledge-source'

const FULL_ENV = {
  QA_KNOWLEDGE_READ_ENABLED: 'true',
  NOTION_KNOWLEDGE_TOKEN: 'secret',
  NOTION_DISTILLED_QA_DB: 'abcdef1234abcdef1234abcdef123456',
}

describe('buildDefaultQaKnowledgeSource', () => {
  it('閘關 ⇒ 無 source＋reason disabled', () => {
    expect(buildDefaultQaKnowledgeSource({})).toEqual({ reason: 'disabled' })
  })

  it('缺 token ⇒ reason missing_knowledge_token', () => {
    expect(
      buildDefaultQaKnowledgeSource({ ...FULL_ENV, NOTION_KNOWLEDGE_TOKEN: '' })
    ).toEqual({ reason: 'missing_knowledge_token' })
  })

  it('三件齊＋fake sdk factory ⇒ 回 source（token 進 factory、不外洩）', () => {
    const createSdkClient = vi.fn(() => ({
      databases: { retrieve: vi.fn() },
      dataSources: { query: vi.fn() },
    }))
    const result = buildDefaultQaKnowledgeSource(FULL_ENV, createSdkClient as any)
    expect(typeof result.source).toBe('function')
    expect(createSdkClient).toHaveBeenCalledWith('secret')
  })

  it('sdk factory throw ⇒ reason sdk_init_failed（吞 raw error）', () => {
    const result = buildDefaultQaKnowledgeSource(FULL_ENV, () => {
      throw new Error('auth secret leaked')
    })
    expect(result).toEqual({ reason: 'sdk_init_failed' })
  })
})
```

**Step 2: 跑測試確認 fail**，然後實作 installer

`src/lib/line-agent/line/install-default-qa-knowledge-source.ts`（逐行 mirror `install-default-distilled-qa-writer.ts`）：

```ts
/**
 * install-default-qa-knowledge-source.ts — 檢索閉環刀 composition root：唯一
 * 構建真 @notionhq/client 讀取 SDK 之處（mirror install-default-distilled-qa-writer）。
 * webhook 只 dynamic import 本模組 — 靜態圖零 SDK。Fail-open＋leak-safe：
 * 缺 config / 構建失敗 ⇒ source undefined ＋ fixed reason code，永不 throw。
 */

import { Client } from '@notionhq/client'
import { resolveQaKnowledgeReadConfig } from '../partner-group/qa-knowledge-config'
import {
  createQaKnowledgeSource,
  type QaKnowledgeSdkClient,
  type QaKnowledgeSource,
} from '../partner-group/qa-knowledge-source'

export interface BuildQaKnowledgeSourceResult {
  source?: QaKnowledgeSource
  reason?:
    | 'disabled'
    | 'missing_knowledge_token'
    | 'missing_database_id'
    | 'sdk_init_failed'
}

export function buildDefaultQaKnowledgeSource(
  env: Record<string, string | undefined> = process.env,
  createSdkClient: (auth: string) => QaKnowledgeSdkClient = (auth) =>
    new Client({ auth }) as unknown as QaKnowledgeSdkClient
): BuildQaKnowledgeSourceResult {
  const config = resolveQaKnowledgeReadConfig(env)
  if (!config.enabled) return { reason: config.reason ?? 'disabled' }
  let sdk: QaKnowledgeSdkClient
  try {
    sdk = createSdkClient(config.token)
  } catch {
    return { reason: 'sdk_init_failed' } // raw error 可能夾 token — 吞掉
  }
  return { source: createQaKnowledgeSource({ sdk, databaseId: config.databaseId }) }
}
```

Run: `npx vitest run src/lib/line-agent/__tests__/install-default-qa-knowledge-source.test.ts`
Expected: 4 PASS

**Step 3: factory passthrough**

`responder-factory.ts`：
- import 加 `import type { QaKnowledgeSource } from './qa-knowledge-source'`
- `CreatePartnerGroupResponderInput` 加欄位（costCap 之後）：

```ts
  /**
   * 沉澱 QA 知識源（檢索閉環刀）— optional：閘關時 caller 不接線，
   * adapter 行為與本刀落地前 byte-identical。
   */
  knowledgeSource?: QaKnowledgeSource
```

- `new AnthropicPartnerGroupResponder({...})` 加 `knowledgeSource: input.knowledgeSource,`

驗證走既有 factory 測試＋Task 5 的 adapter 測試（factory 是純 passthrough，不另寫 factory 測試 — YAGNI）。

**Step 4: webhook-runtime 接線**

`getPartnerGroupResponder()` 內、`const base = createPartnerGroupResponder({...})` 之前加：

```ts
    // 檢索閉環刀 — 沉澱 QA 知識源。閘（QA_KNOWLEDGE_READ_ENABLED 三件齊）在
    // 這裡同步判：閘關 ⇒ undefined ⇒ adapter 行為 byte-identical、零 Notion 讀。
    // 閘開 ⇒ lazy thunk：首次呼叫才 dynamic import installer（靜態圖零 SDK，
    // mirror distilled-qa-writer 的 lazy seam）；installer 失敗 ⇒ 永久 null
    // source（fail-open，adapter 端照常 try-catch）。
    const qaKnowledgeConfig = resolveQaKnowledgeReadConfig(process.env)
    let installedQaKnowledgeSource: QaKnowledgeSource | null = null
    const knowledgeSource = qaKnowledgeConfig.enabled
      ? async () => {
          if (installedQaKnowledgeSource === null) {
            const mod = await import('./install-default-qa-knowledge-source')
            const built = mod.buildDefaultQaKnowledgeSource()
            installedQaKnowledgeSource = built.source ?? (async () => null)
          }
          return installedQaKnowledgeSource()
        }
      : undefined
```

並把 `const base = createPartnerGroupResponder({ models, transport: fetch, costCap })` 改為帶 `knowledgeSource`。import 區加：

```ts
import { resolveQaKnowledgeReadConfig } from '../partner-group/qa-knowledge-config'
import type { QaKnowledgeSource } from '../partner-group/qa-knowledge-source'
```

**Step 5: `.env.example`**（`KNOWLEDGE_WRITE_ENABLED=false` 行後加）：

```
# 檢索閉環刀：沉澱問答（已批准）回流 partner-group system prompt。default off；
# 另需 NOTION_KNOWLEDGE_TOKEN＋NOTION_DISTILLED_QA_DB（同刀3 那組）。讀寫閘獨立。
QA_KNOWLEDGE_READ_ENABLED=false
```

**Step 6: 全套迴歸**

Run: `npx vitest run src/lib/line-agent`
Expected: 全 PASS（閘 default off ⇒ 既有 webhook/responder 測試零差異）

**Step 7: Commit＋push**

```bash
git add src/lib/line-agent/partner-group/responder-factory.ts src/lib/line-agent/line/install-default-qa-knowledge-source.ts src/lib/line-agent/__tests__/install-default-qa-knowledge-source.test.ts src/lib/line-agent/line/webhook-runtime.ts .env.example
git commit -m "feat(line-agent): 檢索閉環刀 — 閘＋installer＋webhook 接線（default off，靜態圖零 SDK）"
git push
```

---

### Task 7: CLI 黑箱入口 `agent:partner-respond`

驗收入口（design §2 驗收）：CLI 直打真 anthropic responder（帶知識源），問「兩大兩小小車會不會擠」。Mirror 刀A `approve-parse` 的紀律：**不碰真 store、不貼群**；costCap 必接 KV（cost 紀律不因離線而豁免 — memory 教訓：CLI 載 `.env.local`，閘＋key 齊就是真打 API）。

**Files:**
- Modify: `scripts/agent-command.mjs`（parse 分支＋`loadPartnerRespondKit`＋`runPartnerRespondCommand`＋main dispatch — 全部仿 `approve-parse` 段落，位置接在它後面）
- Modify: `package.json`（scripts 加一行）

**Step 1: parse 分支**（`approve-parse` 分支之後）：

```js
  if (command === 'partner-respond' || command === '/partner-respond') {
    const query = args.slice(1).filter((a) => !a.startsWith('--')).join(' ').trim()
    if (query === '') {
      throw new Error('partner-respond · 失敗：請帶要問的話（npm run agent:partner-respond -- "兩大兩小小車會不會擠"）')
    }
    return { commandText: 'partner-respond', query }
  }
```

**Step 2: kit loader＋runner**（仿 `loadApproveParseKit` / `runApproveParseCommand`，接在該段之後）：

```js
// ---------------------------------------------------------------------------
// partner-respond — 檢索閉環刀 CLI 黑箱驗收入口（design 2026-06-12 §2 驗收）
// ---------------------------------------------------------------------------
// 一句話 → 真 anthropic responder（含沉澱知識源，若閘開）→ 印回覆。鐵律同
// approve-parse：不碰真 store、不貼群；costCap 必接 KV。

export async function loadPartnerRespondKit(ctx = {}) {
  const {
    importFactoryModule = () =>
      import('../src/lib/line-agent/partner-group/responder-factory.ts'),
    importConfigModule = () =>
      import('../src/lib/line-agent/partner-group/responder-config.ts'),
    importInstallerModule = () =>
      import('../src/lib/line-agent/line/install-default-qa-knowledge-source.ts'),
    importCostCapModule = () =>
      import('../src/lib/line-agent/observability/daily-cost-cap.ts'),
    importKvModule = () => import('../src/lib/line-agent/storage/kv-store.ts'),
  } = ctx
  try {
    const factoryMod = await importFactoryModule()
    const configMod = await importConfigModule()
    const installerMod = await importInstallerModule()
    const costCapMod = await importCostCapModule()
    const kvMod = await importKvModule()
    const kit = {
      createPartnerGroupResponder: factoryMod?.createPartnerGroupResponder ?? null,
      getPartnerResponderConfig: configMod?.getPartnerResponderConfig ?? null,
      buildDefaultQaKnowledgeSource: installerMod?.buildDefaultQaKnowledgeSource ?? null,
      createDailyCostCap: costCapMod?.createDailyCostCap ?? null,
      createKvClientFromEnv: kvMod?.createKvClientFromEnv ?? null,
    }
    if (Object.values(kit).some((v) => !v)) return null
    return kit
  } catch {
    return null
  }
}

/**
 * 檢索閉環刀黑箱驗收：throws ⇒ main 印訊息＋exit 1；return string ⇒ exit 0。
 * 知識閘關不擋跑（照樣問 — 用來對照「有知識 vs 無知識」答案差異）。
 */
export async function runPartnerRespondCommand(options = {}) {
  const env = options.env ?? process.env
  const kit = options.kit ?? (await loadPartnerRespondKit())
  if (!kit) {
    throw new Error('partner-respond · 失敗（模組未載入，請用 tsx 執行）')
  }

  const models = kit.getPartnerResponderConfig(env)
  if (models.partnerResponderMode !== 'anthropic') {
    throw new Error(
      'partner-respond · 失敗：AI_AGENT_PARTNER_RESPONDER_MODE 不是 anthropic（黑箱要打真 API）'
    )
  }
  if (!models.anthropicApiKey) {
    throw new Error('partner-respond · 失敗：缺 ANTHROPIC_API_KEY')
  }

  const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
  if (!kvClient) {
    throw new Error('partner-respond · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（cost cap 要 KV）')
  }
  const costCap = kit.createDailyCostCap({ env, kv: kvClient })

  const built = kit.buildDefaultQaKnowledgeSource(env)
  const knowledgeSource = built.source

  const responder = kit.createPartnerGroupResponder({
    models,
    transport: options.transport ?? fetch,
    costCap,
    knowledgeSource,
  })

  const result = await responder.respond({
    event: { kind: 'group_text', sourceChannel: 'partner_group', mentionsBot: true },
    intent: 'respond',
    text: options.query,
    botDirected: true,
  })

  return [
    'partner-respond（黑箱驗收 — 不碰真 store、不貼群）',
    `輸入：「${options.query}」`,
    `知識源：${knowledgeSource ? '已接（QA_KNOWLEDGE_READ_ENABLED 閘開）' : `未接（${built.reason}）`}`,
    `meta：${JSON.stringify(result.meta)}`,
    '--- 回覆 ---',
    result.text,
  ].join('\n')
}
```

注意：`event` 是最小 fake（CLI 是 .mjs 無型別檢查；anthropic responder 只讀 `text`/`intent`/`quotedBotContent`/`log`）。`intent` 值動手前對一下 `src/lib/line-agent/commands/intent.ts` 的 `CommandIntent` 合法值（`'respond'` 預期存在 — `model-routing.ts` 以它走 defaultModel）。

**Step 3: main dispatch**（`commandText === 'approve-parse'` 分支之後）：

```js
  if (commandText === 'partner-respond') {
    return runPartnerRespondCommand({ env: options.env ?? process.env, query })
  }
```

（沿用 main 既有的 query 解構與 throws→exit 1 慣例 — 動手前看 `approve-parse` 在 main 的實際接法照抄。）

**Step 4: `package.json` scripts 加**：

```json
    "agent:partner-respond": "tsx --env-file=.env.local scripts/agent-command.mjs partner-respond",
```

**Step 5: 驗證（不打真 API 的部分）**

Run: `node scripts/agent-command.mjs partner-respond` （缺 query）
Expected: exit 1＋「請帶要問的話」

Run: `npx vitest run src/lib/line-agent`
Expected: 全 PASS（CLI 不在 vitest 範圍，這是整體迴歸）

**Step 6: Commit＋push**

```bash
git add scripts/agent-command.mjs package.json
git commit -m "feat(line-agent): 檢索閉環刀 — agent:partner-respond CLI 黑箱驗收入口（零 store、costCap 必接）"
git push
```

---

### Task 8: 黑箱驗收＋docs 收尾

**Step 1: 真 API 黑箱驗收**（需 `.env.local` 有 ANTHROPIC_API_KEY＋KV＋`AI_AGENT_PARTNER_RESPONDER_MODE=anthropic`；知識閘用 inline env 開，不寫進 `.env.local`）：

```bash
# 對照組（無知識）：
npm run agent:partner-respond -- "兩大兩小小車會不會擠"
# 實驗組（知識閘開 — 前提：沉澱問答 DB 已有「小車會擠」相關已批准條目）：
QA_KNOWLEDGE_READ_ENABLED=true npm run agent:partner-respond -- "兩大兩小小車會不會擠"
```

Expected: 實驗組答案含「會擠、建議大車（Toyota Commuter 10 人座 Van）」方向，且輸出第三行顯示「知識源：已接」。對照組顯示「未接（disabled）」。
（若 DB 還沒有對應條目：先用 `agent:distill-flush --write` 流程補一條已批准 QA 再驗。）

**Step 2: docs commit**

- 本 plan 檔尾補一節「驗收結果」（黑箱輸出摘要、過/不過、Eric 拍板事項）。
- README build trigger 行更新（repo 慣例 — 照前幾個 docs commit 的做法）。

```bash
git add docs/plans/2026-06-12-qa-knowledge-retrieval-loop-implementation-plan.md README.md
git commit -m "docs(line-agent): 檢索閉環刀驗收結果＋README build trigger"
git push
```

**Step 3: 真群重測**（Eric 拍板後）：Vercel env 補 `QA_KNOWLEDGE_READ_ENABLED=true`（其餘兩件 production 已有），真群 Chun 場景重問一次。

---

## 驗收清單（對齊 design §2）

- [ ] 撈已批准、過濾非批准、cap 截斷、錯誤→null、TTL 命中/過期、single-flight（Task 3 測試）
- [ ] 有知識→區塊在尾端；null→byte-identical 迴歸鎖（Task 4 測試）
- [ ] knowledgeSource 注入後 system 含知識；source throw 不影響回覆（Task 5 測試）
- [ ] 閘關→不接線（Task 2/6 測試）
- [ ] CLI 黑箱「兩大兩小小車會不會擠」→「會擠、建議大車」方向（Task 8）
- [ ] 真群 Chun 場景重測（Task 8 Step 3，Eric 拍板後）

---

## 驗收結果（2026-06-12，CC subagent-driven 執行）

**Commits（Task 1→7＋加固）**：`0f47424` cached-loader 抽取 → `0ba111b` 讀取閘 → `b9e4060` qa-knowledge-source → `72b11e6` system-prompt 知識區塊 → `9a1a6cf` responder 注入 → `ddf4dc6` 接線＋installer → `3859d12` CLI 入口 → `12ac841` 驗收閘加固。每 task 過雙段 review（spec＋quality），全套 124 檔 / 1629 tests 綠。

**CLI 黑箱（真 API，claude-sonnet-4-6，共 ~$0.013）**：

- 對照組（閘關）：`知識源：未接（disabled）` → 答「兩大兩小 OK，不會太擠」（prompt 硬規則：帶小朋友可坐 4 位）
- 實驗組（`QA_KNOWLEDGE_READ_ENABLED=true` inline）：`知識源：已接` → 答「**會擠，不建議。建議直接升大車（Toyota Commuter 10 人座 Van）**」— 命中 design §2 驗收方向；input tokens 1425→1587（知識區塊 ~160 tokens）；cost cap 兩次都正常記帳

**判定：通過。** 真群 Chun 場景重測排在 Eric 拍板後（Vercel env 補 `QA_KNOWLEDGE_READ_ENABLED=true`）。

**計畫偏離（皆 review 認可的改良）**：installer 加 Notion Client `timeoutMs: 5000`（讀取在 reply 關鍵路徑，SDK 預設 60s 不可接受）；CLI `intent` 用 `CommandIntent` 物件（plan 草稿字串版型別不合法）；CLI 拒收 flag＋缺 model/cap env 明確 throw（驗收絕不 exit 0 印 stub）；webhook install 失敗 log fixed reason。

**Prod 行為註記**：若 `AI_AGENT_NOTION_RAG_ENABLED` 雙閘開，符合 rag 觸發詞的訊息走 rag 路徑、不經 anthropic adapter ⇒ 該則無沉澱知識注入（設計內：rag 路徑自帶檢索）。排查「為何這則沒帶知識」時先看 `route_decision` log。

**遞延 Minor（下一刀順手清，不值單獨 commit）**：`qa_knowledge_unavailable.reason` 死欄位（無法區分 retrieve/query/timeout 失敗）；`qa_knowledge_truncated` 在 has_more 時 `total===kept` 語意模糊；leak-guard 測試缺「不含 secret」反向斷言。
