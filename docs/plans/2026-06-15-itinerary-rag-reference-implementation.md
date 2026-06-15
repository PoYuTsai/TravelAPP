# 排行程 RAG 參考 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓排行程草稿從**真 Notion 全部過往案例**撈最像的一筆，經確定性 sanitizer 刷掉別人個資後，當活動骨架範本注入 persona，由 LLM 套本案參數產 `customer_itinerary_v1`，並以**本案推導的 per-case constraints** 過 lint 把關。

**Architecture:** 四塊新建 + 兩處小改，全部沿用現有 RAG pipeline（pipeline 結構已接通，缺的只有 sanitizer 這「最後一哩」）。新增模組純函式、可測、零 env/fetch/LLM 信任；reference 走跟 `knowledgeSource` 一樣的 **optional + fail-open source 注入**，responder「不讀 env、不 import Notion client」鐵律不破。sanitizer 用**確定性正則 + fail-closed denylist**（不用 LLM 刷）。

**Tech Stack:** Next.js 14 / TypeScript / Vitest（`@notionhq` v5 RAG corpus 已接）。

**Source design:** `docs/plans/2026-06-14-itinerary-rag-reference-design.md`（§ 對照於下）。

---

## Pre-flight（執行前必讀）

**Branch:** `codex/line-oa-agent-mvp`，**as-is，不 merge/PR**。同 branch 有別處在推 → **每次 push 前先 `git fetch` 再 rebase**。

**Gate（真連線）:** `AI_AGENT_NOTION_RAG_ENABLED` default off，待真群驗收。真連線前先檢查 `.env.local` 三閘 + key + SDK（CLI 會載 .env.local，齊了就實打真 API）。本計畫所有任務皆為**純函式 + 注入式 source**，TDD 全程不需真連線。

**Test commands:**
- 單檔：`npx vitest run src/lib/line-agent/__tests__/<file>.test.ts`
- 全套：`npm run test:run`
- 測試放 `src/lib/line-agent/__tests__/`，原始碼放 `src/lib/line-agent/notion/`（partner-group 流程在 `src/lib/line-agent/partner-group/`）。

**重用既有（已測，勿重造）:**

| 模組 | 用途 |
|------|------|
| `notion/rag-index.ts` `RagCaseFacts.itinerarySnippet?: string` | 每筆案例帶行程框架原文（含別人 PII） |
| `notion/rag-query.ts` `retrieveRagCases(index, text): RagIndexRecord[]` | 靠 area/theme/partySize 排序匹配；無訊號回 `[]` |
| `notion/notion-rag-search.ts` `toOperatorSafeCaseSummary(record)` | **平行範本**：白名單投影，但**故意丟 snippet（GAP-1）**；本計畫的 reference 投影要**保留 sanitized snippet** |
| `notion/customer-itinerary-lint.ts` `lintCustomerItinerary(text, constraints)` | v1 格式/結構/禁詞把關；`CustomerItineraryConstraints` 型別 |
| `notion/customer-itinerary-gate.ts` `gateCustomerItineraryDraft(draftText)` | tripwire：round-trip + lint。**現況只推中性最小 constraints（結構-only）** |
| `partner-group/system-prompt.ts` `buildPartnerGroupSystemPrompt(input, knowledge, opts)` | persona；`knowledge` 注入在 frozen persona 與 web-search 段之間 |
| `partner-group/anthropic-responder.ts` `runOnce(correctionNote?)` | draft intent 的 tripwire 重產迴圈；reference 注入落點在 `baseSystem` |
| `docs/ai-agent-knowledge/cases/itinerary-templates/chiang-mai-family-5d4n-classic.md` | **fallback 骨架已存在**（curated、無 PII）；low_confidence 退回它 |

**對 design 的兩處校正（執行時以本節為準）:**

1. **design §39「lint 現釘死李家 constraints」**：實際上 `gateCustomerItineraryDraft` 餵的是**中性最小 constraints**（`sameLodgingAllTrip:false` / `stayArea:''` / mobility 全缺），只恆開 Rule 13（Day 連續）。`LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS` 只存在於 **fixture**。Task 5 要做的是「讓 gate 能接受本案 profile 餵真規則」，不是「拆掉李家」。
2. **fail-closed 的真價值**：scrub 用已知 pattern 盡力刷，**assert 用更嚴的 denylist**（多含敬稱 `先生/小姐/太太/一家`、日期、email）把關——殘留任一即整筆丟。這順手解掉「body 殘留姓氏」洩漏：李先生若留在內文，assert 會 trip → 整筆 drop（寧缺勿漏）。

**刀序（= design §7）:** sanitizer + fixtures → reference 投影 → reference 檢索/fallback → persona 注入 → per-case lint → triage 兩小改 → 航班預設 →（兩張表落地另案）。

---

## Task 1：itinerary-reference sanitizer + fixtures（最核心）

**對應 design §3。** 確定性正則，兩刀 + fail-closed denylist。輸入 = `RagCaseFacts.itinerarySnippet`（真 Notion 原文）；輸出 = 刷乾淨的活動骨架或「整筆丟」。

**Files:**
- Create: `src/lib/line-agent/notion/itinerary-reference-sanitizer.ts`
- Create: `src/lib/line-agent/notion/__fixtures__/itinerary-reference-snippets.ts`
- Test: `src/lib/line-agent/__tests__/itinerary-reference-sanitizer.test.ts`

### Step 1.1：寫 fixtures（真實「會漏的」輸入）

> design §61 明確要求「拿真實會漏的輸入釘住」。fixtures 是**手寫擬真**樣本（無真客資料），覆蓋每種 PII 形態 + 一個乾淨樣本 + 一個「scrub 後仍殘留」的 fail-closed 樣本。

`__fixtures__/itinerary-reference-snippets.ts`：
```typescript
/**
 * 擬真 itinerarySnippet 樣本（非真客資料）— 釘 sanitizer 行為。
 * 每筆刻意塞一種 PII 形態，驗證 scrub / fail-closed。
 */

/** 完整髒樣本：標題姓名 + 人數/日期 header + 內文航班/金額/電話/URL。 */
export const DIRTY_SNIPPET_FULL = `<李先生一家套餐訂製> 清邁親子5天4夜
👨‍👩‍👧‍👦 人數：2大2小（4歲、6歲）
📅 日期：2025/08/04～2025/08/08
Day 1｜抵達清邁
・搭華航 CI851 13:20 抵清邁，司機接機
・午餐：本地小館
・晚餐：千人火鍋
・住宿：古城區飯店
Day 2｜大象與夜間動物園
・上午大象保護營（半日）
・晚間夜間動物園，遊園車
・訂金 NT$5000，尾款 8 萬泰銖現場付
・有問題打 0912-345-678 或看 https://notion.so/abc123`

/** 乾淨骨架（已無 PII，sanitize 後應與輸入等價，僅去掉空 header）。 */
export const CLEAN_SKELETON = `Day 1｜抵達清邁
・司機接機
・午餐：本地小館
・住宿：古城區飯店`

/** fail-closed 樣本：scrub 漏網的殘留姓氏敬稱（內文「王太太」），assert 應 trip → drop。 */
export const RESIDUAL_HONORIFIC_SNIPPET = `Day 1｜抵達
・送王太太回飯店休息
・午餐：本地小館`

/** fail-closed 樣本：內文殘留 email。 */
export const RESIDUAL_EMAIL_SNIPPET = `Day 1｜抵達
・聯絡 minguide@gmail.com 安排接機`
```

### Step 1.2：寫 failing test

`__tests__/itinerary-reference-sanitizer.test.ts`：
```typescript
import { describe, expect, it } from 'vitest'
import { sanitizeItinerarySnippet } from '../notion/itinerary-reference-sanitizer'
import {
  DIRTY_SNIPPET_FULL,
  CLEAN_SKELETON,
  RESIDUAL_HONORIFIC_SNIPPET,
  RESIDUAL_EMAIL_SNIPPET,
} from '../notion/__fixtures__/itinerary-reference-snippets'

describe('sanitizeItinerarySnippet', () => {
  it('strips header lines (title surname / 人數 / 日期)', () => {
    const r = sanitizeItinerarySnippet(DIRTY_SNIPPET_FULL)
    expect(r.ok).toBe(true)
    expect(r.skeleton).not.toMatch(/李先生|套餐訂製/)
    expect(r.skeleton).not.toMatch(/人數[：:]/)
    expect(r.skeleton).not.toMatch(/日期[：:]/)
  })

  it('redacts flight codes / amounts / phone / url from body', () => {
    const r = sanitizeItinerarySnippet(DIRTY_SNIPPET_FULL)
    expect(r.ok).toBe(true)
    expect(r.skeleton).not.toMatch(/CI851|華航/)
    expect(r.skeleton).not.toMatch(/NT\$|泰銖|萬/)
    expect(r.skeleton).not.toMatch(/0912-345-678/)
    expect(r.skeleton).not.toMatch(/notion\.so|https?:\/\//)
  })

  it('keeps activity / restaurant / lodging skeleton', () => {
    const r = sanitizeItinerarySnippet(DIRTY_SNIPPET_FULL)
    expect(r.skeleton).toMatch(/大象保護營/)
    expect(r.skeleton).toMatch(/午餐：本地小館/)
    expect(r.skeleton).toMatch(/住宿：古城區飯店/)
    expect(r.skeleton).toMatch(/Day 1｜抵達清邁/)
  })

  it('passes an already-clean skeleton through (header-less)', () => {
    const r = sanitizeItinerarySnippet(CLEAN_SKELETON)
    expect(r.ok).toBe(true)
    expect(r.skeleton).toMatch(/Day 1｜抵達清邁/)
  })

  it('FAIL-CLOSED: drops record when honorific surname survives', () => {
    const r = sanitizeItinerarySnippet(RESIDUAL_HONORIFIC_SNIPPET)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('residual_pii')
    expect(r.skeleton).toBeUndefined()
  })

  it('FAIL-CLOSED: drops record when email survives', () => {
    const r = sanitizeItinerarySnippet(RESIDUAL_EMAIL_SNIPPET)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('residual_pii')
  })

  it('FAIL-CLOSED: drops empty/blank snippet', () => {
    expect(sanitizeItinerarySnippet('').ok).toBe(false)
    expect(sanitizeItinerarySnippet('   \n  ').ok).toBe(false)
  })
})
```

### Step 1.3：run → 確認 FAIL

Run: `npx vitest run src/lib/line-agent/__tests__/itinerary-reference-sanitizer.test.ts`
Expected: FAIL `sanitizeItinerarySnippet is not a function`。

### Step 1.4：寫最小實作

`itinerary-reference-sanitizer.ts`：
```typescript
/**
 * itinerary-reference-sanitizer.ts — design 2026-06-14 §3。
 *
 * 把真 Notion `itinerarySnippet`（帶別人 PII）刷成可複用的活動骨架。
 * 確定性正則、零 LLM、可 fail-closed、零成本零延遲。
 *
 *  - scrub：刪 header 三行（標題姓名 / 人數 / 日期）+ 內文 redact 航班/金額/電話/URL。
 *  - assert（更嚴 denylist）：殘留任一 PII pattern（含敬稱/日期/email）⇒ ok:false，
 *    整筆 record 丟出 reference（寧缺勿漏）。
 *
 * 保留：活動名、餐廳名、出發時間、節奏備註。
 */

export interface SanitizeResult {
  ok: boolean
  /** 僅 ok 時存在：刷乾淨的活動骨架。 */
  skeleton?: string
  /** 僅 !ok 時存在：固定 code，永不帶原文。 */
  reason?: 'residual_pii' | 'empty'
}

/** 第一刀：整行刪的 header pattern（個資集中、對參考零價值）。 */
const HEADER_LINE_RES: RegExp[] = [
  /^\s*<.*?(?:先生|小姐|太太|一家).*?訂製>/u, // 標題姓名
  /^\s*[👨‍👩‍👧‍👦🧑👪]*\s*人數[：:]/u,
  /^\s*📅?\s*日期[：:]/u,
]

/** 第二刀：內文 redact 的高精度 pattern（redact 掉、保留行其餘）。 */
const BODY_SCRUB_RES: RegExp[] = [
  /(?:華航|長榮|泰航|虎航|亞航)[^，。、\n]*?\d{1,2}[:：]\d{2}/gu, // 航空+時間
  /\b[A-Z]{2}\s?\d{2,4}\b/g, // 航班碼 CI851
  /(?:NT\$|THB|฿)\s?[\d,]+/g, // 幣別金額
  /[\d,]+\s?(?:萬|泰銖)/g, // 中文金額
  /分潤[^，。、\n]*/gu,
  /(?:\+?886|0)\d[\d\- ]{6,}\d/g, // 電話
  /https?:\/\/\S+/g,
  /\S*notion\.(?:so|site)\/\S+/g,
]

/**
 * fail-closed denylist（比 scrub 更嚴）：scrub 後仍命中任一 ⇒ 整筆丟。
 * 多含 scrub 不處理但必須阻擋的：敬稱姓氏、ISO/slash 日期、email。
 */
const RESIDUAL_PII_RES: RegExp[] = [
  /[A-Z]{2}\s?\d{2,4}/, // 航班碼
  /NT\$|THB|฿|泰銖|分潤/u, // 金額
  /(?:\+?886|0)\d[\d\- ]{6,}\d/, // 電話
  /https?:\/\/|notion\.(?:so|site)/u, // URL
  /[\w.+-]+@[\w.-]+\.\w+/u, // email
  /\d{4}[/／-]\d{1,2}[/／-]\d{1,2}/u, // 日期
  /(?:先生|小姐|太太|一家)/u, // 敬稱姓氏
]

export function sanitizeItinerarySnippet(raw: string): SanitizeResult {
  if (!raw || raw.trim() === '') return { ok: false, reason: 'empty' }

  const kept = raw
    .split('\n')
    .filter((line) => !HEADER_LINE_RES.some((re) => re.test(line)))
    .map((line) => BODY_SCRUB_RES.reduce((acc, re) => acc.replace(re, ''), line))
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/g, ''))
    .filter((line) => line.trim() !== '')

  const skeleton = kept.join('\n').trim()
  if (skeleton === '') return { ok: false, reason: 'empty' }

  // fail-closed：scrub 漏網的任一 PII pattern ⇒ 整筆丟（寧缺勿漏）。
  if (RESIDUAL_PII_RES.some((re) => re.test(skeleton))) {
    return { ok: false, reason: 'residual_pii' }
  }

  return { ok: true, skeleton }
}
```

### Step 1.5：run → 確認 PASS

Run: `npx vitest run src/lib/line-agent/__tests__/itinerary-reference-sanitizer.test.ts`
Expected: PASS（7 個 case 全綠）。

### Step 1.6：commit

```bash
git add src/lib/line-agent/notion/itinerary-reference-sanitizer.ts \
        src/lib/line-agent/notion/__fixtures__/itinerary-reference-snippets.ts \
        src/lib/line-agent/__tests__/itinerary-reference-sanitizer.test.ts
git commit -m "feat(line-agent): itinerary-reference sanitizer（確定性正則 + fail-closed denylist）"
```

---

## Task 2：itinerary-reference 投影（平行 OperatorSafeCaseSummary，保留 sanitized snippet）

**對應 design §37。** 新 view，**保留** sanitized skeleton，專供 LLM 參考。**絕不**走夥伴問答 surfacing 那條（那條故意丟 snippet，GAP-1）。

**Files:**
- Create: `src/lib/line-agent/notion/itinerary-reference.ts`
- Test: `src/lib/line-agent/__tests__/itinerary-reference.test.ts`

### Step 2.1：寫 failing test
```typescript
import { describe, expect, it } from 'vitest'
import { toItineraryReference } from '../notion/itinerary-reference'
import type { RagIndexRecord } from '../notion/rag-index'

function record(facts: Partial<RagIndexRecord['facts']>): RagIndexRecord {
  return {
    facts: { ...facts },
    identity: { sourceTables: ['private_2025'], sourceRecordIds: ['x'] },
  } as RagIndexRecord
}

describe('toItineraryReference', () => {
  it('returns sanitized skeleton + structural facts when snippet is clean-able', () => {
    const ref = toItineraryReference(
      record({
        days: 5,
        nights: 4,
        areaHints: ['chiangmai'],
        themeHints: ['family'],
        itinerarySnippet: '<李先生一家套餐訂製> x\nDay 1｜抵達\n・大象保護營',
      }),
    )
    expect(ref).not.toBeNull()
    expect(ref?.skeleton).toMatch(/大象保護營/)
    expect(ref?.skeleton).not.toMatch(/李先生/)
    expect(ref?.days).toBe(5)
  })

  it('returns null (drop) when snippet missing', () => {
    expect(toItineraryReference(record({ days: 5 }))).toBeNull()
  })

  it('returns null (drop) when sanitizer fails closed', () => {
    expect(
      toItineraryReference(record({ itinerarySnippet: 'Day 1｜送王太太回飯店' })),
    ).toBeNull()
  })
})
```

### Step 2.2：run → FAIL（`toItineraryReference is not a function`）

### Step 2.3：實作
```typescript
/**
 * itinerary-reference.ts — design 2026-06-14 §2(2)。
 *
 * 平行 toOperatorSafeCaseSummary（notion-rag-search.ts），但**保留** sanitized
 * skeleton，專供產 customer_itinerary_v1 的 LLM 當骨架範本。
 * 絕不走夥伴問答 surfacing（那條故意丟 snippet，GAP-1）。snippet 必過 sanitizer，
 * fail-closed ⇒ 整筆 null（不降級成沒骨架）。
 */
import type { RagIndexRecord } from './rag-index'
import { sanitizeItinerarySnippet } from './itinerary-reference-sanitizer'

export interface ItineraryReference {
  /** sanitized 活動骨架（無 PII），LLM 的主範本。 */
  skeleton: string
  days?: number
  nights?: number
  partySize?: number
  areaHints: string[]
  themeHints: string[]
}

export function toItineraryReference(record: RagIndexRecord): ItineraryReference | null {
  const f = record.facts
  if (!f.itinerarySnippet) return null

  const sanitized = sanitizeItinerarySnippet(f.itinerarySnippet)
  if (!sanitized.ok || !sanitized.skeleton) return null

  const ref: ItineraryReference = {
    skeleton: sanitized.skeleton,
    areaHints: f.areaHints ?? [],
    themeHints: f.themeHints ?? [],
  }
  if (f.days !== undefined) ref.days = f.days
  if (f.nights !== undefined) ref.nights = f.nights
  if (f.partySize !== undefined) ref.partySize = f.partySize
  return ref
}
```

### Step 2.4：run → PASS
### Step 2.5：commit
```bash
git add src/lib/line-agent/notion/itinerary-reference.ts \
        src/lib/line-agent/__tests__/itinerary-reference.test.ts
git commit -m "feat(line-agent): itinerary-reference 投影（保留 sanitized skeleton，平行 operator-safe view）"
```

---

## Task 3：reference 檢索 + low_confidence fallback 到 markdown 範本

**對應 design §4。** top-1 當主骨架（多餵易拼貼錯亂）；沒夠像的退回手工範本（已無個資）。

**Files:**
- Create: `src/lib/line-agent/notion/itinerary-reference-source.ts`
- Test: `src/lib/line-agent/__tests__/itinerary-reference-source.test.ts`

### Step 3.1：先確認 fallback 範本路徑可讀

fallback 骨架 = `docs/ai-agent-knowledge/cases/itinerary-templates/chiang-mai-family-5d4n-classic.md`（Task 0 已確認存在、curated、無 PII）。實作以 frontmatter 之後的 markdown body 當骨架；讀法比照 `itinerary-template-knowledge.test.ts` 的 `fs.readFileSync(path.join(process.cwd(), rel))`。

### Step 3.2：寫 failing test
```typescript
import { describe, expect, it } from 'vitest'
import { selectItineraryReference } from '../notion/itinerary-reference-source'
import type { RagIndex } from '../notion/rag-index'

// 用既有 index builder fixture 造一個含 family/chiangmai 案例的 index。
// （沿用 notion-rag-index.test.ts 的建構 helper；見該檔。）

describe('selectItineraryReference', () => {
  it('returns top-1 sanitized reference when a like case exists', () => {
    const index = buildIndexWithFamilyCase() // helper, see notion-rag-index.test.ts
    const r = selectItineraryReference(index, '清邁親子5天4夜 大象 水上樂園')
    expect(r.source).toBe('case')
    expect(r.skeleton).toMatch(/Day 1｜/)
  })

  it('falls back to markdown template when low_confidence (no signal/hit)', () => {
    const index = buildEmptyIndex()
    const r = selectItineraryReference(index, '隨便問問')
    expect(r.source).toBe('template')
    expect(r.skeleton.length).toBeGreaterThan(0)
  })

  it('falls back to template when top-1 sanitizer fails closed', () => {
    const index = buildIndexWithOnlyDirtyCase() // snippet 殘留敬稱 → null
    const r = selectItineraryReference(index, '清邁親子5天')
    expect(r.source).toBe('template')
  })
})
```

> 注：`buildIndexWith*` helper 沿用 `notion-rag-index.test.ts` 既有建構式；執行時 import 或抽共用 test util，**勿**新串真 Notion。

### Step 3.3：run → FAIL

### Step 3.4：實作
```typescript
/**
 * itinerary-reference-source.ts — design 2026-06-14 §4。
 *
 * 新客需 → retrieveRagCases 取 top-1 → toItineraryReference（含 sanitizer）。
 * 有真案例優先；low_confidence（無訊號/無命中）或 top-1 fail-closed ⇒ 退回手工
 * 「清邁親子5天4夜經典套餐」markdown 骨架。絕不讓 LLM 從零亂編。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { RagIndex } from './rag-index'
import { retrieveRagCases } from './rag-query'
import { toItineraryReference } from './itinerary-reference'

const TEMPLATE_REL =
  'docs/ai-agent-knowledge/cases/itinerary-templates/chiang-mai-family-5d4n-classic.md'

export interface SelectedReference {
  source: 'case' | 'template'
  skeleton: string
}

/** 去 YAML frontmatter，回 markdown body 當骨架。 */
function templateSkeleton(): string {
  const md = fs.readFileSync(path.join(process.cwd(), TEMPLATE_REL), 'utf8')
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

export function selectItineraryReference(index: RagIndex, need: string): SelectedReference {
  const hits = retrieveRagCases(index, need)
  for (const hit of hits) {
    const ref = toItineraryReference(hit)
    if (ref) return { source: 'case', skeleton: ref.skeleton } // top-1 可用即用
  }
  return { source: 'template', skeleton: templateSkeleton() }
}
```

> 設計取捨：迴圈取「第一個 sanitize 成功的」而非死守 top-1——top-1 若 fail-closed 被丟，往下找次像的仍比退範本貼近本案；全滅才退範本。符合 design「有真案例優先；沒有用範本墊底」。

### Step 3.5：run → PASS
### Step 3.6：commit
```bash
git add src/lib/line-agent/notion/itinerary-reference-source.ts \
        src/lib/line-agent/__tests__/itinerary-reference-source.test.ts
git commit -m "feat(line-agent): reference 檢索 top-1 + low_confidence 退手工範本骨架"
```

---

## Task 4：reference 注入 persona（responder 新增 optional source，draft intent only，fail-open）

**對應 design §2(3)。** 把「檢索 top-1 + sanitize 後」的骨架接進產 v1 的 LLM 呼叫。沿用 `knowledgeSource` 的 **optional + fail-open** 注入紀律；responder 不讀 env、不 import Notion client（source 由 composition root 注入）。

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts`
- Modify: `src/lib/line-agent/partner-group/system-prompt.ts`
- Test: `src/lib/line-agent/__tests__/partner-rag-draft-surfacing.test.ts`（既有，加 case）或新 `partner-itinerary-reference-injection.test.ts`

### Step 4.1：system-prompt 加 reference 段

`system-prompt.ts` `buildPartnerGroupSystemPrompt`：在 `knowledge` 注入之後、web-search 之前，加 optional reference 範本段。

寫 failing test（新檔 `partner-itinerary-reference-injection.test.ts`）：
```typescript
import { describe, expect, it } from 'vitest'
import { buildPartnerGroupSystemPrompt } from '../partner-group/system-prompt'

const baseInput = { /* 最小 PartnerGroupRespondInput，見既有 system-prompt.test.ts */ } as any

describe('buildPartnerGroupSystemPrompt itinerary reference', () => {
  it('injects reference skeleton block when provided', () => {
    const sys = buildPartnerGroupSystemPrompt(baseInput, null, {
      itineraryReference: 'Day 1｜抵達\n・大象保護營',
    })
    expect(sys).toMatch(/參考骨架/)
    expect(sys).toMatch(/大象保護營/)
  })

  it('byte-identical to current when no reference (fail-open)', () => {
    const without = buildPartnerGroupSystemPrompt(baseInput, null, {})
    const baseline = buildPartnerGroupSystemPrompt(baseInput, null)
    expect(without).toBe(baseline)
  })
})
```

實作（`opts` 加 `itineraryReference?: string`）：
```typescript
// system-prompt.ts — buildPartnerGroupSystemPrompt opts 型別加：
//   itineraryReference?: string
// 在 web-search 段之前插入：
const reference = opts?.itineraryReference?.trim()
if (reference) {
  sections.push(
    '',
    '【排行程參考骨架】下面是一份過往同型行程的活動骨架（已去個資）。' +
      '請**參考其節奏與活動安排**，再**套用本案的日期/人數/天數/特殊需求**重出，' +
      '不得照抄日期或人名，務必符合 customer_itinerary_v1 格式：',
    reference,
  )
}
```

### Step 4.2：responder 接 referenceSource（draft intent only）

`anthropic-responder.ts`：
- `AnthropicPartnerGroupResponderDeps` 加 optional：
  ```typescript
  /** 排行程參考骨架源（design 2026-06-14）— OPTIONAL + fail-open，比照 knowledgeSource。
   *  只在 draft intent 取用；未注入/throw ⇒ prompt 與現行 byte-identical。 */
  itineraryReferenceSource?: (need: string) => Promise<string | null>
  ```
- ctor 存 `this.itineraryReferenceSource = deps.itineraryReferenceSource`。
- `respond` 內，**僅 `input.intent.action === 'draft'`** 時取 reference（fail-open try-catch，同 knowledge）：
  ```typescript
  let itineraryReference: string | null = null
  if (input.intent.action === 'draft' && this.itineraryReferenceSource) {
    try {
      itineraryReference = await this.itineraryReferenceSource(input.text)
    } catch {
      log('itinerary_reference_unavailable', {})
    }
  }
  ```
- `runOnce` 的 `buildPartnerGroupSystemPrompt(input, knowledge, { webSearchEnabled: allowWebSearch })` 改成多帶 `itineraryReference: itineraryReference ?? undefined`。

failing test（新增到 draft-surfacing 或新檔）：注入 fake `itineraryReferenceSource` 回固定骨架，斷言 **draft intent** 的 request body `system` 含該骨架；**非 draft intent** 不含；source throw ⇒ 仍正常回覆（fail-open）。用既有 fake transport 攔 `JSON.parse(body).system`。

### Step 4.3：run 相關測試 → 確認新 case FAIL 再實作到 PASS

Run: `npx vitest run src/lib/line-agent/__tests__/partner-itinerary-reference-injection.test.ts src/lib/line-agent/__tests__/partner-rag-draft-surfacing.test.ts`

### Step 4.4：回歸——確保「無 source」byte-identical

Run: `npx vitest run src/lib/line-agent/__tests__/anthropic-responder*.test.ts`（或 partner responder 既有測試），確認未注入 source 時行為零變化。

### Step 4.5：commit
```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts \
        src/lib/line-agent/partner-group/system-prompt.ts \
        src/lib/line-agent/__tests__/partner-itinerary-reference-injection.test.ts
git commit -m "feat(line-agent): 排行程 reference 骨架注入 persona（draft-only，optional+fail-open）"
```

> **Wiring 留待 composition root**：把 `selectItineraryReference(index, need)` 包成 `itineraryReferenceSource` 注入 responder，與 `knowledgeSource` 同處（factory）。受 `AI_AGENT_NOTION_RAG_ENABLED` 控；gate off ⇒ source 不注入 ⇒ byte-identical。此 wiring 與 Task 5 之後一起，於真群驗收前最後一哩落地（另開 wiring 刀，避免本計畫碰 env）。

---

## Task 5：per-case lint 約束（gate 接受本案 profile）

**對應 design §2(4)、§39（依 Pre-flight 校正）。** 現 `gateCustomerItineraryDraft(draftText)` 只推中性最小 constraints（結構-only）。改成**可選**接受本案推導的 profile，餵真規則（mobility/knownFlight/stayArea），無 profile 時維持現行中性行為（回歸零破壞）。

**Files:**
- Modify: `src/lib/line-agent/notion/customer-itinerary-gate.ts`
- Test: `src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts`（既有）

### Step 5.1：寫 failing test（profile 餵 mobility → 不適活動被 lint 擋）
```typescript
import { gateCustomerItineraryDraft } from '../notion/customer-itinerary-gate'

it('with case profile: limited-mobility draft with 叢林飛索 fails the gate', () => {
  const draft = [
    'Day 1｜抵達',
    '・叢林飛索',
    '・午餐：本地小館',
  ].join('\n')
  const gate = gateCustomerItineraryDraft(draft, {
    days: 1,
    stayArea: 'chiangmai_old_city',
    sameLodgingAllTrip: true,
    mobility: 'limited',
  })
  expect(gate.ok).toBe(false)
  expect(gate.problems.join()).toMatch(/飛索|不適/)
})

it('no profile → unchanged neutral behavior (structure-only)', () => {
  const draft = 'Day 1｜抵達\n・大象保護營'
  expect(gateCustomerItineraryDraft(draft).ok).toBe(true) // 中性，僅驗結構
})
```

> 確認 `CustomerItineraryConstraints` 的 mobility 欄位名與 lint Rule 8-9 觸發詞（`MOBILITY_UNSUITABLE_TOKENS`，含「叢林飛索」）；型別見 `customer-itinerary-lint.ts:45-56`、`:96-103`。

### Step 5.2：run → FAIL（簽名只吃一參數）

### Step 5.3：實作——gate 簽名加 optional profile
```typescript
// customer-itinerary-gate.ts
import type { CustomerItineraryConstraints } from './customer-itinerary-lint'

/** 本案推導的部分 constraints（profile）。缺省欄位 fallback 到中性值（現行行為）。 */
export type ItineraryCaseProfile = Partial<
  Pick<
    CustomerItineraryConstraints,
    | 'stayArea'
    | 'sameLodgingAllTrip'
    | 'departureDayTransferTime'
    | 'departureDayPeriod'
    | 'mobility'
    | 'knownFlight'
  >
>

export function gateCustomerItineraryDraft(
  draftText: string,
  profile?: ItineraryCaseProfile,
): ItineraryGateResult {
  // ...deriveDeclaredDays 同現行...
  const lint = lintCustomerItinerary(draftText, {
    days,
    nights: Math.max(0, days - 1),
    stayArea: profile?.stayArea ?? '',
    sameLodgingAllTrip: profile?.sameLodgingAllTrip ?? false,
    ...(profile?.departureDayTransferTime ? { departureDayTransferTime: profile.departureDayTransferTime } : {}),
    ...(profile?.departureDayPeriod ? { departureDayPeriod: profile.departureDayPeriod } : {}),
    ...(profile?.mobility ? { mobility: profile.mobility } : {}),
    ...(profile?.knownFlight ? { knownFlight: profile.knownFlight } : {}),
    customerVersion: true,
  })
  // ...其餘同現行...
}
```

### Step 5.4：run → PASS（含既有 gate 測試回歸）
Run: `npx vitest run src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts`

### Step 5.5：responder 套用 profile（接 Task 4）

`anthropic-responder.ts` 的 draft tripwire 區（`gateCustomerItineraryDraft(result.text)` 兩處）改傳 profile。profile 來源：與 reference 同一 source 一併回傳（擴 `itineraryReferenceSource` 回傳 `{ skeleton, profile }`，或加 sibling source）。**最小作法**：把 case profile 推導獨立成 optional dep `caseProfileSource?: (text) => Promise<ItineraryCaseProfile | null>`，draft 時取一次，兩處 gate 共用。無 source ⇒ `gateCustomerItineraryDraft(text)` 維持現行。

> profile 推導本身（從鬆散對話抽 mobility/stayArea/knownFlight）是另一塊**啟發式**工作，可在 wiring 刀做；本 Task 只把 gate「能接受 profile」做完並測，推導器留 wiring 刀。

### Step 5.6：commit
```bash
git add src/lib/line-agent/notion/customer-itinerary-gate.ts \
        src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts
git commit -m "feat(line-agent): gate 接受本案 profile 餵 per-case lint 規則（缺省維持中性）"
```

---

## Task 6：triage 兩小改（design §5a）

**Files:**
- Modify: `src/lib/line-agent/partner-group/case-intake-triage.ts:51-57`
- Test: `src/lib/line-agent/__tests__/`（找 case-intake-triage 既有測試；無則新建 `case-intake-triage.test.ts`）

### Step 6.1：CASE_INTAKE_CRITICAL_FIELDS 移出物流欄
失敗測試先斷言「缺航班/住宿地點仍 sufficient」。

實作：`CASE_INTAKE_CRITICAL_FIELDS` 由
`['travelDates','partySize','childAges','flightOrPickupInfo','hotelOrPickupLocation']`
改為 `['travelDates','partySize','childAges']`（物流非「排程」必要，缺了仍可先出骨架）。同步更新該常數上方註解的「北極星」說明。

### Step 6.2：兒童座椅只在「有小孩且年齡 < 4」才問
測試：childAges 全 ≥ 4（如 4&6 歲）→ 問題區不含兒童座椅；含 < 4 → 才問。

實作：在組 question block 處，對 `childSeatNeeds` 加條件 `childAges?.some(a => a < 4)`。定位 `childSeatNeeds` 在 question block 的加入點（`case-intake-triage.ts` ~Line 145 附近）。

### Step 6.3：run → PASS（含 triage 既有回歸）
### Step 6.4：commit
```bash
git commit -am "feat(line-agent): triage 物流欄移出 critical + 兒童座椅僅 <4 歲才問"
```

---

## Task 7：航班預設（design §5b）

客人沒給航班 → 預設華航 CI851/852 或長榮 BR257/258 早班，行程標「待確認」。背景知識來源 = 航班時刻表（已入 `docs/ai-agent-knowledge`，見 §5c）。

**最小落點**：此為 persona 行為，不需新模組。於 `system-prompt.ts` 的排行程指示段補一句規則：「客人未提供航班時，Day 1 預設早班（華航 CI851 / 長榮 BR257）並標『待確認』，不得臆造確定航班」。

**Files:** Modify `src/lib/line-agent/partner-group/system-prompt.ts`；測試斷言 persona 字串含該規則關鍵詞。

### Step 7.1：failing test（persona 含「待確認」航班規則關鍵詞）→ 7.2 實作 → 7.3 PASS → 7.4 commit
```bash
git commit -am "feat(line-agent): persona 航班預設規則（早班待確認，不臆造）"
```

---

## Task 8（另案，非本計畫程式刀）：兩張表落地（design §5c）

- **航班時刻表 → Notion RAG 背景知識**（markdown/Notion）：給 §5b 航班預設查。屬內容/知識庫工作。
- **包車價目表 → 報價計算器**（結構化價目，需 THB/NT$ 換算）：屬報價器工作，與 quote-display 計畫交界。

> 兩者是**資料/內容**任務，非本計畫的 TDD 程式刀。建議獨立 issue/commit 處理，避免混入 sanitizer→reference 主線。本計畫完成 Task 1–7 即達「排行程套參考」可驗收狀態。

---

## 驗收（whole feature）

1. `npm run test:run` 全綠（新增 sanitizer/reference/source/injection/gate 測試 + 既有回歸）。
2. **gate off 回歸**：未注入 `itineraryReferenceSource` / `caseProfileSource` 時，responder prompt 與 request body **byte-identical**（Task 4.4 / 5.4 守住）。
3. sanitizer fail-closed + 專屬 fixtures = 上線前硬門檻（design §96）。
4. 真群驗收前：wiring 刀（source 接 `selectItineraryReference` + profile 推導 + `AI_AGENT_NOTION_RAG_ENABLED` 開閘），真連線前先檢查 `.env.local` 三閘 + key + SDK。

---

## 落在 wiring 刀（wiring 刀本體已落地，2026-06-15）

- ✅ composition root 把 `selectItineraryReference` 包成單一 `itineraryReferenceSource` 注入 responder（同 `knowledgeSource` 處），受 `AI_AGENT_NOTION_RAG_ENABLED` 控、gate off byte-identical（commit a40f876）。新 `line/itinerary-reference-wiring.ts`（薄閘）＋ `line/install-default-itinerary-reference-index.ts`（唯一 SDK 邊界，lazy dynamic import，複用 partner-rag 索引建置）。
- ✅ case profile 推導器 `notion/itinerary-case-profile.ts` `deriveCaseProfile`（抽 mobility/stayArea/同住；knownFlight 走保守門檻，commit 70f5068）。days 仍由 gate 自草稿推導，非 profile 欄。
- ⏳ `AI_AGENT_NOTION_RAG_ENABLED` 開閘 + 真群 preview 驗收 —— **真群驗收前最後一哩**：真連線前先查 `.env.local` 三閘 + key + SDK（feedback 鐵律），對外步需 Eric 在場。程式側已就緒，flip env 即生效。
- ✅（技術債 a — 2026-06-15 review：已完成，不擴張）抽共用 `callAnthropicMessages` 早已落地於 `observability/anthropic-call.ts`，共用 distill／approval／case-intake／vision 四個 throw-based adapter。**responder 刻意排除且維持排除**：return-degraded-stub（webhook 絕不 500）、web_search tool＋計費、多 block citations 串接、tripwire retry 皆 responder 專屬，塞進 throw-based 共用層會反向汙染。llm-refine 無 fetch 層、callModel 已注入，亦不適用。
- ⏳（技術債 b — 2026-06-15 Eric 拍板：**排到開閘真群驗收之後**）排行程與 partner-rag 各自建一份 TTL 快取 RagIndex（同語料兩份）。**現在不做的理由**：合併要同時動 composition-root 兩條接線——一條是 live 已驗的 partner-rag（其 index 包進 cached answer source，需拆開吃注入 index），一條是正要真群驗收的 itinerary；而效益小（語料小＋10min TTL＋兩條皆 gated，僅省「兩功能都活躍時每窗多一次 Notion 讀＋一個 lazy SDK client」）。先讓真群驗收驗即將上線的接線本身，不在 live 路徑底下抽換。**驗收通過後再做**：把 partner-rag 已快取 index 共用給排行程 source（全 TDD＋gate-off byte-identical 守位）。

### 開閘前必修（Tasks 1–7 完工後 final review 揪出的跨刀縫，**開閘 = 真群驗收前一律先清**）

> 來源：2026-06-15 whole-feature review。case 路徑 PII 防漏滴水不漏；以下兩項都在 **template fallback** 路徑，per-task review 結構上看不到（範本被當「已 curated 內容」單獨審，沒對照 sanitizer 合約與 persona 自身格式/航班規則）。皆**非** PII 洩漏，但開閘即生效就會劣化本功能。

1. ✅ **【I-1 範本去污 + 兩路徑共用 sanitizer】**（done，commit b7e6747）`chiang-mai-family-5d4n-classic.md` body 目前含具體航班碼（`長榮 BR257/BR258`）與 `**markdown 粗體**`。前者正是 case 路徑 `RESIDUAL_PII_RES` 會 drop 的 token —— 同字串在真案例會被殺、卻從範本逐字注入，直接抵銷 Task 7「不臆造航班、標待確認」；後者誘導 LLM 產出 gate 會擋的 `**`/`#` 格式，拉高 tripwire degrade 率。**修法**：先把範本 body 的航班碼/`**` 清掉，再讓 `templateSkeleton()` 也過 `sanitizeItinerarySnippet`（清乾淨後不會 fail-closed），使「凡注入為骨架者皆過同一 assert」成為統一不變量。最乾淨做法＝把清過的範本 inline 成 TS 常數（順帶解 I-2）。 → **實作**：新增 `notion/itinerary-reference-template.ts` `ITINERARY_TEMPLATE_SKELETON`（航班改「待確認」、去 `**`/`#`）；`templateSkeleton()` 改 `sanitizeItinerarySnippet(常數)`；body 航班碼/`**` 已清。
2. ✅ **【I-2 範本 runtime 可達性】**（done，commit b7e6747）`itinerary-reference-source.ts` 用 `readFileSync(path.join(process.cwd(), TEMPLATE_REL))`。Vercel lambda 的 cwd／檔案 tracing **不保證**含 `docs/**`，檔案缺席即 throw。responder 的 fail-open 會吞掉（不崩，續走無骨架），但後果隱蔽：**無命中時（語料早期最常見）安全網靜默消失、LLM 從零亂編**——正是範本要防的「從零亂編」。且 throw 與 Notion 失敗共用同一 log code，無從區分。**修法**：把範本 inline 成 TS 常數（無檔案相依，首選），或 `next.config` `outputFileTracingIncludes` 把範本納進 bundle。 → **實作**：採 inline 常數，已移除 `fs`/`path`/`readFileSync`/`TEMPLATE_REL`，零檔案相依。
3. ✅ **【M-1 案例/範本來源訊號】**（done，commit fa5fb0d）responder 用合併後 `reference.source` 發 `itinerary_reference` log（固定碼 `case|template`）→ 看得出某筆 draft 用真案例或退範本，調語料涵蓋率的關鍵訊號。
4. ✅ **【M-2 合併雙重檢索】**（done，commit fa5fb0d）`itineraryReferenceSource`＋`caseProfileSource` 併成單一 `ItineraryReferenceSource`，一個 draft turn 對 retrieval 只打一次，同回 `{skeleton, source, profile}`。
5. ✅ **【M-3 範本須保持無敬稱】**（done，commit b7e6747）若 I-1 讓範本過 sanitizer，未來範本若加 example 含「李先生」等敬稱會被整筆 drop → fallback 靜默失效。在範本檔註記「須維持無敬稱/無航班碼」。 → **實作**：`itinerary-reference-template.test.ts` drift-guard 鎖死（無航班碼/無 `**`/`#`/無敬稱、且過 sanitizer ok）；`.md` 加維護鐵律註記（body 與 TS 常數兩處鏡像須同步）。
6. ✅ **【Task 4 型別一致性】**（done，commit fa5fb0d/d517e7a）`itinerary-reference-source.ts` 抽 `ItineraryReferenceResult`／`ItineraryReferenceSource` 型別別名，收斂原兩處 inline 簽名。補測斷言 source 收到 `need === input.text`（responder 與 factory 兩層），把選取合約釘死。
7. ❌ **【persona 航班規則收斂 RAG — won't-do，2026-06-15 Eric 拍板】**。原構想：Task 7 的 `CI851/BR257` 硬寫 persona，待 Task 8 航班時刻表入 RAG 後改「依知識庫早班」避免兩處真相漂移。**決定不做，理由**：(a) persona 是凍結字串、authoring 期不能查 RAG，要做只能 runtime 注入整段航班表，為一個「待確認佔位」不成比例；(b) 知識庫 `rules/flight-and-car-time.md` 刻意不寫具體碼（檔頭明示時刻季節漂移、用前 web-search），逼 persona「依知識庫選早班」只會誘 LLM 幻覺碼或把漂移碼寫進該檔；(c) 航班**號碼**全年穩定、會漂的是**時刻**，而 persona 不寫時刻 → 無可漂真相；(d)「兩處真相」只有在 Task 8 把碼複製進 RAG 後才出現，不做 Task 8 即無第二處，前提消失。**結論**：現狀（明確穩定碼＋待確認＋不寫時刻）即最安全設計；canonical 航班碼＋時刻表已另存於 `src/sanity/components/structured-editor/flight-data.ts`（結構化編輯器用）。`deriveCaseProfile` 的 knownFlight 仍只認客人自報航班、不臆造。
