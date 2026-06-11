/**
 * distill-qa-writer.test.ts
 *
 * RED-first spec for 沉澱刀3's Notion QA writer — the SDK-free injected adapter
 * that turns one approved/modified DistillCandidate into a page in the 沉澱問答
 * DB. Mirrors notion-rag-client.ts discipline in the WRITE direction:
 *   - v5 data-source model: databases.retrieve → data_sources[0] → pages.create
 *     with a data_source_id parent; the id is lazily cached per writer instance.
 *   - Property mapping verified against the REAL DB schema (Task 3 Step 0,
 *     2026-06-12): 問題=title, 答案=rich_text, 出處=rich_text, 出現次數=number,
 *     狀態=select, 收錄日期=date, 地區/主題=multi_select (left unset).
 *   - Leak guard: any SDK error is re-thrown as a sanitized DistilledQaWriteError
 *     whose message/stack NEVER carries a token / db id / notion.so url.
 *   - rich_text segments are defensively capped at 1900 chars (Notion 2000 cap).
 *
 * Spec: docs/plans/2026-06-11-distill-knife3-plan.md Task 3
 */

import { describe, it, expect } from 'vitest'
import type { DistillCandidate } from '../distill/pending'
import {
  createDistilledQaWriter,
  DistilledQaWriteError,
  type DistilledQaSdkClient,
} from '../distill/distilled-qa-writer'

// --- fixtures ----------------------------------------------------------------

const DB_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const NOW_MS = Date.UTC(2026, 5, 12, 3, 4, 5) // 2026-06-12T03:04:05Z

function approvedCandidate(
  overrides: Partial<DistillCandidate> = {}
): DistillCandidate {
  return {
    id: 1,
    question: '素萬那普機場到市區包車多少錢？',
    answer: '單程 1200 泰銖，含舉牌接機。',
    sourceMessageIds: ['msg-100', 'msg-104'],
    occurrences: 3,
    status: 'approved',
    missedCount: 0,
    ...overrides,
  }
}

/** Fake of the minimal injected SDK surface — records every call's args. */
function fakeSdk(options?: {
  dataSources?: Array<{ id: string }>
  retrieveError?: Error
  createError?: Error
}) {
  const retrieveCalls: Array<{ database_id: string }> = []
  const createCalls: Array<{
    parent: { type: 'data_source_id'; data_source_id: string }
    properties: Record<string, unknown>
  }> = []
  let pageCounter = 0

  const sdk: DistilledQaSdkClient = {
    databases: {
      async retrieve(args) {
        retrieveCalls.push(args)
        if (options?.retrieveError) throw options.retrieveError
        return { data_sources: options?.dataSources ?? [{ id: 'ds-1' }] }
      },
    },
    pages: {
      async create(args) {
        createCalls.push(args)
        if (options?.createError) throw options.createError
        pageCounter += 1
        return { id: `page-${pageCounter}` }
      },
    },
  }
  return { sdk, retrieveCalls, createCalls }
}

type RichText = Array<{ type: 'text'; text: { content: string } }>

function richTextContent(prop: unknown): string {
  const segments =
    (prop as { rich_text?: RichText; title?: RichText }).rich_text ??
    (prop as { title?: RichText }).title ??
    []
  return segments.map((s) => s.text.content).join('')
}

// --- case 1: approved candidate → full property mapping ----------------------

describe('createDistilledQaWriter — approved candidate mapping', () => {
  it('creates a page under data_sources[0] with the verified property mapping', async () => {
    const { sdk, createCalls } = fakeSdk()
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    await writer.write(approvedCandidate(), NOW_MS)

    expect(createCalls).toHaveLength(1)
    const call = createCalls[0]
    expect(call.parent).toEqual({
      type: 'data_source_id',
      data_source_id: 'ds-1',
    })

    const props = call.properties
    expect(richTextContent(props['問題'])).toBe(
      '素萬那普機場到市區包車多少錢？'
    )
    expect(richTextContent(props['答案'])).toBe('單程 1200 泰銖，含舉牌接機。')
    expect(props['出現次數']).toEqual({ number: 3 })
    expect(props['狀態']).toEqual({ select: { name: '已批准' } })
    expect(props['收錄日期']).toEqual({ date: { start: '2026-06-12' } })

    const provenance = richTextContent(props['出處'])
    expect(provenance).toContain('LINE 夥伴群沉澱')
    expect(provenance).toContain('msg-100')
    expect(provenance).toContain('msg-104')
    expect(provenance).toContain('2 則')
    // approved (not modified) — no original-answer trailer
    expect(provenance).not.toContain('原候選答案')
  })
})

// --- case 2: modified candidate → modifiedAnswer wins, original in 出處 ------

describe('createDistilledQaWriter — modified candidate', () => {
  it('writes modifiedAnswer as 答案 and keeps the original answer in 出處', async () => {
    const { sdk, createCalls } = fakeSdk()
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    await writer.write(
      approvedCandidate({
        status: 'modified',
        modifiedAnswer: '單程 1300 泰銖（2026 新價），含舉牌接機。',
      }),
      NOW_MS
    )

    const props = createCalls[0].properties
    expect(richTextContent(props['答案'])).toBe(
      '單程 1300 泰銖（2026 新價），含舉牌接機。'
    )
    expect(richTextContent(props['出處'])).toContain(
      '原候選答案：單程 1200 泰銖，含舉牌接機。'
    )
  })
})

// --- case 3: returns the created page id --------------------------------------

describe('createDistilledQaWriter — return value', () => {
  it("resolves with the create response's page id", async () => {
    const { sdk } = fakeSdk()
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    await expect(writer.write(approvedCandidate(), NOW_MS)).resolves.toBe(
      'page-1'
    )
  })
})

// --- case 4: data source id is cached across writes ---------------------------

describe('createDistilledQaWriter — data source caching', () => {
  it('calls databases.retrieve only once across two writes', async () => {
    const { sdk, retrieveCalls, createCalls } = fakeSdk()
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    await writer.write(approvedCandidate(), NOW_MS)
    await writer.write(approvedCandidate({ id: 2 }), NOW_MS)

    expect(retrieveCalls).toHaveLength(1)
    expect(retrieveCalls[0]).toEqual({ database_id: DB_ID })
    expect(createCalls).toHaveLength(2)
    expect(createCalls[1].parent.data_source_id).toBe('ds-1')
  })
})

// --- case 5: missing data sources → structural failure ------------------------

describe('createDistilledQaWriter — structural failure', () => {
  it('throws DistilledQaWriteError when data_sources is empty', async () => {
    const { sdk, createCalls } = fakeSdk({ dataSources: [] })
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    await expect(writer.write(approvedCandidate(), NOW_MS)).rejects.toThrow(
      DistilledQaWriteError
    )
    expect(createCalls).toHaveLength(0)
  })
})

// --- case 6: leak guard — SDK errors are sanitized -----------------------------

describe('createDistilledQaWriter — leak guard', () => {
  const SECRET = `unauthorized token secret_ntn_LEAK for db ${DB_ID} at https://notion.so/leak`

  it('re-throws pages.create errors as DistilledQaWriteError without the raw message', async () => {
    const { sdk } = fakeSdk({ createError: new Error(SECRET) })
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    let caught: unknown
    try {
      await writer.write(approvedCandidate(), NOW_MS)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(DistilledQaWriteError)
    const err = caught as DistilledQaWriteError
    expect(err.code).toBe('notion_write_failed')
    expect(err.message).toBe('Notion write failed for a distilled QA candidate')
    expect(err.message).not.toContain('secret_ntn_LEAK')
    expect(err.message).not.toContain(DB_ID)
    expect(err.message).not.toContain('notion.so')
    expect(err.stack ?? '').not.toContain('secret_ntn_LEAK')
    expect(err.stack ?? '').not.toContain(DB_ID)
    expect(err.stack ?? '').not.toContain('notion.so')
  })

  it('re-throws databases.retrieve errors as DistilledQaWriteError too', async () => {
    const { sdk } = fakeSdk({ retrieveError: new Error(SECRET) })
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    let caught: unknown
    try {
      await writer.write(approvedCandidate(), NOW_MS)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(DistilledQaWriteError)
    expect((caught as Error).message).not.toContain('secret_ntn_LEAK')
    expect((caught as Error).stack ?? '').not.toContain('secret_ntn_LEAK')
  })
})

// --- case 7: oversize text is capped at 1900 chars ----------------------------

describe('createDistilledQaWriter — rich_text cap', () => {
  it('slices question/answer/出處 segments to 1900 chars', async () => {
    const { sdk, createCalls } = fakeSdk()
    const writer = createDistilledQaWriter({ sdk, databaseId: DB_ID })

    const long = 'x'.repeat(2500)
    await writer.write(
      approvedCandidate({ question: long, answer: long }),
      NOW_MS
    )

    const props = createCalls[0].properties
    expect(richTextContent(props['問題'])).toHaveLength(1900)
    expect(richTextContent(props['答案'])).toHaveLength(1900)
    expect(richTextContent(props['問題'])).toBe('x'.repeat(1900))

    // 出處 also capped: a modified candidate carrying the long original answer
    const { sdk: sdk2, createCalls: createCalls2 } = fakeSdk()
    const writer2 = createDistilledQaWriter({ sdk: sdk2, databaseId: DB_ID })
    await writer2.write(
      approvedCandidate({
        answer: long,
        status: 'modified',
        modifiedAnswer: '短版',
      }),
      NOW_MS
    )
    expect(
      richTextContent(createCalls2[0].properties['出處']).length
    ).toBeLessThanOrEqual(1900)
  })
})
