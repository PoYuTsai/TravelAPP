/**
 * notion-rag-loader.test.ts
 *
 * RED-first spec for the Notion RAG *read orchestrator* (config + traversal +
 * build-helper layer). It wires the three already-green pure units
 *
 *   client.listPages(dbId)            → NotionApiPage[]
 *   flattenNotionPage                 → NotionPageFixture[]
 *   notionPagesToRagRecords({source}) → RagIndexRecord[]
 *   buildRagIndex(records)            → RagIndex
 *
 * via an INJECTED NotionRagClient port. No real Notion API, no real db ids, no
 * Sanity, no webhook/send gate. Privacy/leak guard is asserted explicitly.
 *
 * Spec: docs/plans/2026-06-06-notion-rag-loader-design.md
 */

import { describe, it, expect } from 'vitest'
import type { NotionApiPage } from '../notion/page-flattener'
import { toPartnerSafeView } from '../notion/rag-index'
import {
  buildNotionRagIndex,
  type NotionRagClient,
  type NotionRagConfig,
} from '../notion/notion-rag-loader'

// --- fakes -----------------------------------------------------------------

const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

const DB_PRIVATE_2025 = 'db-private-2025'
const DB_TEAM_2026 = 'db-team-2026'

function richText(...parts: string[]) {
  return parts.map((plain_text) => ({ plain_text }))
}

/** A realistic envelope carrying PII + private money + a page url + a db id. */
function fakePage(id: string, db: string): NotionApiPage {
  return {
    id,
    url: NOTION_LINK,
    parent: { type: 'database_id', database_id: db },
    properties: {
      客戶名稱: { type: 'title', title: richText('王先生') }, // PII — dropped by adapter
      日期: { type: 'date', date: { start: '2026-04-12', end: '2026-04-16' } },
      天數: { type: 'number', number: 5 },
      大人: { type: 'number', number: 2 },
      小孩: { type: 'number', number: 2 },
      城市區域: { type: 'select', select: { name: '清邁' } },
      行程類型: { type: 'multi_select', multi_select: [{ name: '親子' }] },
      行程摘要: { type: 'rich_text', rich_text: richText('清邁親子 5 天') },
      成本: { type: 'number', number: 22000 }, // private money
      分潤: { type: 'number', number: 8000 }, // private money
    },
  }
}

/** Spy client: records every db id it was asked for. */
function fakeClient(pagesByDb: Record<string, NotionApiPage[]>): NotionRagClient & {
  calls: string[]
} {
  const calls: string[] = []
  return {
    calls,
    async listPages(databaseId: string) {
      calls.push(databaseId)
      return pagesByDb[databaseId] ?? []
    },
  }
}

/** Client whose listPages always throws (with a secret in the raw message). */
function throwingClient(): NotionRagClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async listPages(databaseId: string) {
      calls.push(databaseId)
      throw new Error(`Notion 500 at ${NOTION_LINK} token=${SECRET_TOKEN}`)
    },
  }
}

// --- tests -----------------------------------------------------------------

describe('buildNotionRagIndex', () => {
  // 1) disabled gate short-circuits FIRST
  it('disabled gate → skipped, empty index, never touches the client', async () => {
    const client = fakeClient({ [DB_PRIVATE_2025]: [fakePage('p1', DB_PRIVATE_2025)] })
    const config: NotionRagConfig = {
      enabled: false,
      activeSources: ['private_2025'],
      databaseIds: { private_2025: DB_PRIVATE_2025 },
    }

    const result = await buildNotionRagIndex(config, client)

    expect(result.status).toBe('skipped')
    if (result.status === 'skipped') {
      expect(result.reason).toBe('disabled')
      expect(result.index.records).toHaveLength(0)
    }
    expect(client.calls).toHaveLength(0)
  })

  // 2) happy path → ok, builds a RagIndex with records
  it('enabled + private_2025 id + fake pages → ok with a populated RagIndex', async () => {
    const client = fakeClient({
      [DB_PRIVATE_2025]: [
        fakePage('p1', DB_PRIVATE_2025),
        fakePage('p2', DB_PRIVATE_2025),
      ],
    })
    const config: NotionRagConfig = {
      enabled: true,
      activeSources: ['private_2025'],
      databaseIds: { private_2025: DB_PRIVATE_2025 },
    }

    const result = await buildNotionRagIndex(config, client)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.index.records.length).toBeGreaterThan(0)
      expect(result.sources).toHaveLength(1)
      expect(result.sources[0]).toMatchObject({
        sourceTable: 'private_2025',
        status: 'loaded',
        pageCount: 2,
      })
      expect(result.sources[0].recordCount).toBeGreaterThan(0)
    }
    expect(client.calls).toEqual([DB_PRIVATE_2025])
  })

  // 3) missing required id → error, empty index, no client call for the run
  it('active source missing its db id → error missing_database_id, empty index, no client call', async () => {
    const client = fakeClient({})
    const config: NotionRagConfig = {
      enabled: true,
      activeSources: ['private_2025'],
      databaseIds: {}, // private_2025 id NOT resolved
    }

    const result = await buildNotionRagIndex(config, client)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('missing_database_id')
      expect(result.error.failedSources).toContain('private_2025')
      expect(result.index.records).toHaveLength(0)
    }
    expect(client.calls).toHaveLength(0)
  })

  // 4) client throws → error client_error, empty index, per-source report still produced
  it('client throws → error client_error, empty index, leak-safe per-source report', async () => {
    const client = throwingClient()
    const config: NotionRagConfig = {
      enabled: true,
      activeSources: ['private_2025'],
      databaseIds: { private_2025: DB_PRIVATE_2025 },
    }

    const result = await buildNotionRagIndex(config, client)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('client_error')
      expect(result.error.failedSources).toContain('private_2025')
      expect(result.index.records).toHaveLength(0)

      const report = result.sources.find((s) => s.sourceTable === 'private_2025')
      expect(report).toBeDefined()
      expect(report?.status).toBe('error')

      // leak guard: no token, db id, or Notion url anywhere in surfaced errors
      const surfaced = JSON.stringify({ error: result.error, sources: result.sources })
      expect(surfaced).not.toContain(SECRET_TOKEN)
      expect(surfaced).not.toContain(DB_PRIVATE_2025)
      expect(surfaced).not.toContain(NOTION_LINK)
    }
  })

  // 5) multiple active sources → deterministic order, metadata preserved
  it('multiple active sources → one report each, in activeSources order', async () => {
    const client = fakeClient({
      [DB_PRIVATE_2025]: [fakePage('a', DB_PRIVATE_2025)],
      [DB_TEAM_2026]: [fakePage('b', DB_TEAM_2026)],
    })
    const config: NotionRagConfig = {
      enabled: true,
      activeSources: ['private_2025', 'team_2026'],
      databaseIds: {
        private_2025: DB_PRIVATE_2025,
        team_2026: DB_TEAM_2026,
      },
    }

    const result = await buildNotionRagIndex(config, client)

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.sources.map((s) => s.sourceTable)).toEqual([
        'private_2025',
        'team_2026',
      ])
      expect(result.sources.every((s) => s.status === 'loaded')).toBe(true)

      const tables = new Set(
        result.index.records.flatMap((r) => r.identity.sourceTables)
      )
      expect(tables.has('private_2025')).toBe(true)
      expect(tables.has('team_2026')).toBe(true)
    }
    expect(client.calls).toEqual([DB_PRIVATE_2025, DB_TEAM_2026])
  })

  // 6) partner-safe projection still hides private fields
  it('partner-safe projection of loaded records leaks no cost / profit / db id / url', async () => {
    const client = fakeClient({
      [DB_PRIVATE_2025]: [fakePage('p1', DB_PRIVATE_2025)],
    })
    const config: NotionRagConfig = {
      enabled: true,
      activeSources: ['private_2025'],
      databaseIds: { private_2025: DB_PRIVATE_2025 },
    }

    const result = await buildNotionRagIndex(config, client)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      const safe = result.index.records.map(toPartnerSafeView)
      const serialized = JSON.stringify(safe)
      expect(serialized).not.toContain('22000') // 成本
      expect(serialized).not.toContain('8000') // 分潤
      expect(serialized).not.toContain(DB_PRIVATE_2025)
      expect(serialized).not.toContain(NOTION_LINK)
    }
  })
})
