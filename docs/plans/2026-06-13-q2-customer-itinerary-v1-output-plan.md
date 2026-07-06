# Q2 排行程輸出改 customer_itinerary_v1 — 實作計畫（B 案）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** partner persona 排行程（intent.action==='draft'）輸出改為報價器可解析的 `customer_itinerary_v1`，輸出後掛 round-trip+lint tripwire，失敗重產 1 次→再失敗降級自由初稿＋未過檢註記。

**Architecture:** 純函式 tripwire（新檔 `notion/customer-itinerary-gate.ts`）疊用既有 `checkCustomerItineraryRoundTrip` ＋ `lintCustomerItinerary`，只需從草稿推導 `days`、固定 `customerVersion:true`，其餘 constraints 缺則該規則不觸發。anthropic-responder 在 draft intent 路徑把單次 LLM 呼叫抽成可重呼的 `runOnce`，gate 失敗則帶 problems 重產一次，再失敗降級。system-prompt 第 30 條改要求直吐 v1＋附 golden 形狀範本。

**Tech Stack:** TypeScript, Vitest（line-agent 既有 1648 測試）, 既有 notion/ 行程模組。

設計來源：`docs/plans/2026-06-13-q2-customer-itinerary-v1-output-design.md`

---

## Task 1: tripwire 閘 `gateCustomerItineraryDraft`

**Files:**
- Create: `src/lib/line-agent/notion/customer-itinerary-gate.ts`
- Test: `src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts`

**Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from 'vitest'
import { gateCustomerItineraryDraft } from '../notion/customer-itinerary-gate'
import { LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY } from '../notion/__fixtures__/customer-itinerary-golden'

describe('gateCustomerItineraryDraft', () => {
  it('golden 李家 7D6N → ok', () => {
    const r = gateCustomerItineraryDraft(LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
  })

  it('自由 markdown 散文 → fail（推不出 Day 或 parser 不乾淨）', () => {
    const prose = '幫你排個 5 天行程：\n第一天去古城逛逛，第二天上山看大象，很棒喔！'
    const r = gateCustomerItineraryDraft(prose)
    expect(r.ok).toBe(false)
    expect(r.problems.length).toBeGreaterThan(0)
  })

  it('缺一天（Day 3 不見）→ fail', () => {
    const broken = LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(/Day 3｜[^\n]*/, '')
    const r = gateCustomerItineraryDraft(broken)
    expect(r.ok).toBe(false)
  })
})
```

**Step 2: 跑測試確認 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts`
Expected: FAIL（`gateCustomerItineraryDraft is not a function`）

**Step 3: 最小實作**

```ts
/**
 * customer-itinerary-gate.ts — 排行程草稿輸出前的 tripwire（design 2026-06-13 §①）.
 *
 * Deterministic、零 LLM 信任：不管草稿是 persona LLM 吐的還是手打的，輸出前都先
 * 過 round-trip（真 parser 吃得下）＋ lint（v1 格式/結構/禁詞）。任一 error → ok=false，
 * 呼叫端 fail-closed 降級。lint 只餵 {days, customerVersion}，其餘 case-profile
 * constraints 缺則該規則不觸發（皆被 if(constraints.X) 守著）。
 */
import { checkCustomerItineraryRoundTrip } from './customer-itinerary-roundtrip'
import { lintCustomerItinerary } from './customer-itinerary-lint'

export interface ItineraryGateResult {
  ok: boolean
  problems: string[]
}

/** 掃草稿最大的 `Day N` 標題推導天數；推不出回 0。 */
function deriveDeclaredDays(text: string): number {
  let max = 0
  for (const m of text.matchAll(/^Day\s+(\d+)\s*｜/gmu)) {
    const n = Number(m[1])
    if (n > max) max = n
  }
  return max
}

export function gateCustomerItineraryDraft(draftText: string): ItineraryGateResult {
  const problems: string[] = []

  const days = deriveDeclaredDays(draftText)
  if (days < 1) {
    return { ok: false, problems: ['草稿無可辨識的 Day N 標題，非 customer_itinerary_v1 格式'] }
  }

  const rt = checkCustomerItineraryRoundTrip(draftText, { days })
  if (!rt.ok) problems.push(...rt.problems)

  const lint = lintCustomerItinerary(draftText, { days, customerVersion: true })
  for (const issue of lint.issues) {
    if (issue.severity === 'error') problems.push(`lint: ${issue.message}`)
  }

  return { ok: problems.length === 0, problems }
}
```

注意：`CustomerItineraryConstraints` 必填欄位若不只 `days`，需確認型別——若 `stayArea` 等為必填，改傳最小合法值（用 `as CustomerItineraryConstraints` 前先讀型別，勿硬轉）。

**Step 4: 跑測試確認 pass**

Run: `npx vitest run src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts`
Expected: PASS（3 綠）

**Step 5: commit**

```bash
git add src/lib/line-agent/notion/customer-itinerary-gate.ts src/lib/line-agent/__tests__/customer-itinerary-gate.test.ts
git commit -m "feat(line-agent): Q2 tripwire 閘 gateCustomerItineraryDraft — round-trip+lint，golden PASS/散文 FAIL"
```

---

## Task 2: anthropic-responder draft intent 接線（重產 1 次→降級）

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts`（draft 路徑、return 點 ~309）
- Test: `src/lib/line-agent/__tests__/partner-group-responder.test.ts`（沿用既有 fetch mock 模式）

**Step 1: 寫失敗測試**（依既有 test 的 fetch/responder 建構模式；intent.action='draft'）

```ts
// 壞格式→好格式：第一次 fetch 回非 v1 散文，第二次回 golden → 最終 ok、無 ⚠️
it('draft：v1 過不了閘→重產一次成功', async () => {
  const fetchMock = sequenceFetch([badProseCompletion, goldenCompletion])
  const r = await makeResponder(fetchMock).respond(draftInput('排個李家7天行程'))
  expect(r.text).toContain('Day 1｜')
  expect(r.text).not.toContain('未過自動檢查')
})

// 兩次都壞→降級：保留原文＋附 ⚠️ 未過檢註記
it('draft：兩次都過不了閘→降級＋未過檢註記', async () => {
  const fetchMock = sequenceFetch([badProseCompletion, badProseCompletion])
  const r = await makeResponder(fetchMock).respond(draftInput('排個行程'))
  expect(r.text).toContain('未過自動檢查')
  expect(r.meta?.degraded).toBe(true)
})
```

（`sequenceFetch`/`badProseCompletion`/`goldenCompletion`/`draftInput` 依檔內既有 helper 命名實作；若無 sequence helper，新增一個回傳遞增 index 的 mock。）

**Step 2: 跑確認 fail**

Run: `npx vitest run src/lib/line-agent/__tests__/partner-group-responder.test.ts -t draft`
Expected: FAIL

**Step 3: 實作**

1. 把現有「build messages → fetch → parse → finalText」抽成內部 `async function runOnce(correctionNote?: string): Promise<string>`，`correctionNote` 非空時附加到 system/末段要 LLM 依 problems 修正。
2. draft 路徑（`input.intent.action === 'draft'`）才走 gate：

```ts
const DEGRADE_NOTE =
  '\n\n⚠️ 此行程草稿格式未過自動檢查，報價器可能無法直接解析，請 Eric 確認。'

if (input.intent.action === 'draft') {
  let text = await runOnce()
  let gate = gateCustomerItineraryDraft(text)
  if (!gate.ok) {
    text = await runOnce(gate.problems.join('；'))   // 重產 1 次
    gate = gateCustomerItineraryDraft(text)
  }
  if (!gate.ok) {
    return { text: text + DEGRADE_NOTE, meta: { responder: 'llm', model, degraded: true, error: 'itinerary_gate_failed' } }
  }
  return { text, meta: { responder: 'llm', model } }
}
// 非 draft：維持現行 finalText 路徑（含 citations），零變化
```

非 draft intent **完全不動**（citations/cost 路徑零變化）。

**Step 4: 跑確認 pass + 全檔回歸**

Run: `npx vitest run src/lib/line-agent/__tests__/partner-group-responder.test.ts`
Expected: PASS（含原有測試不退）

**Step 5: commit**

```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts src/lib/line-agent/__tests__/partner-group-responder.test.ts
git commit -m "feat(line-agent): Q2 draft intent 掛 tripwire — 過閘原樣回/失敗重產1次/再失敗降級＋未過檢註記"
```

---

## Task 3: system-prompt 改要求直吐 v1 ＋ 凍結斷言更新

**Files:**
- Modify: `src/lib/line-agent/partner-group/system-prompt.ts:30`
- Test: `src/lib/line-agent/__tests__/system-prompt.test.ts`（byte-identical 凍結斷言）

**Step 1: 改寫測試的凍結斷言**先反映新文案（含 v1 要求），跑 → 應 FAIL（prompt 尚未改）

**Step 2: 改 system-prompt.ts:30**——在現行「先用合理假設排初稿、標明假設、文末問修正」之上，補要求：
- 排行程一律輸出 `customer_itinerary_v1` 格式（給形狀範本：`<XX套餐訂製> 標題` / `📅 日期：YYYY/MM/DD～YYYY/MM/DD` / `👨‍👩‍👧‍👦 人數：…` / 每天 `Day N｜標題`、`・活動`、`午餐：`、`晚餐：`、`・住宿：`）
- 假設註記放進**人數 header 自由文字**（如 golden 的「需確認…」），結構區塊**之後**再問「以上哪些需要修正」
- 範本取自 golden 形狀，勿貼整段李家內容（避免幻覺成預設答案）

**Step 3: 跑 system-prompt.test.ts → PASS**

**Step 4: 補 prompt tripwire 測試**——斷言新增句存在（v1 關鍵詞如 `customer_itinerary_v1` 或 `Day N｜`），與既有 75efd83 tripwire 風格一致

**Step 5: line-agent 全測試回歸**

Run: `npx vitest run src/lib/line-agent`
Expected: 全綠（原 1648 + 新增）

**Step 6: commit**

```bash
git add src/lib/line-agent/partner-group/system-prompt.ts src/lib/line-agent/__tests__/system-prompt.test.ts
git commit -m "feat(line-agent): Q2 persona 排行程改直吐 customer_itinerary_v1＋假設註記相容（凍結斷言更新）"
```

---

## 完成後

- 全 line-agent 測試綠；gate golden PASS / 散文 FAIL；responder 重產→降級路徑有 ⚠️
- 不 merge / 不開 PR（branch as-is，依專案現況）
- docs follow-up：design doc 已 commit（3bdc508）；如行為與 design 有出入，回寫 design doc
