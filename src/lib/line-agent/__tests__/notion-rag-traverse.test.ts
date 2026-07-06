/**
 * notion-rag-traverse.test.ts
 *
 * RED-first spec for the operator-only Notion RAG *dry-run traverse* entry.
 * It is the thin glue that wires the two already-green units
 *
 *   resolveNotionRagConfig(env)        → { config, issues }
 *   buildNotionRagIndex(config, client) → NotionRagBuildResult
 *
 * into one operator-safe summary report. NO real Notion API (an injected fake
 * client supplies pages), NO Sanity, NO webhook/send, NO file writes.
 *
 * The report's whole job is a PROJECTION: collapse a RagIndex that carries
 * cost / profit / PII / db id / Notion url down to counts + enum source tables
 * + issue codes. The leak guard tests assert nothing private survives that
 * projection.
 *
 * Spec: handoff brief 2026-06-06 (operator traverse job dry-run CLI, small cut).
 */

import { describe, it, expect } from 'vitest'
import type { NotionApiPage } from '../notion/page-flattener'
import type { NotionRagClient } from '../notion/notion-rag-loader'
import { runNotionRagTraverseDryRun } from '../notion/notion-rag-traverse'

// --- secret-shaped fixtures -------------------------------------------------

const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'
const CUSTOMER_NAME = '王先生'

// 32-hex Notion-database-id shape — the report must never echo these back.
const DB_PRIVATE_2025 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const DB_TEAM_2026 = '0f1e2d3c4b5a69788796a5b4c3d2e1f0'

function richText(...parts: string[]) {
  return parts.map((plain_text) => ({ plain_text }))
}

/** Realistic envelope carrying PII + private money + a page url + a db id. */
function fakePage(id: string, db: string, dateStart = '2026-04-12'): NotionApiPage {
  return {
    id,
    url: NOTION_LINK,
    parent: { type: 'database_id', database_id: db },
    properties: {
      客戶名稱: { type: 'title', title: richText(CUSTOMER_NAME) }, // PII — dropped by adapter
      日期: { type: 'date', date: { start: dateStart, end: '2026-04-16' } },
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

// --- env helpers ------------------------------------------------------------

function enabledEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
    NOTION_PRIVATE_2025_DATABASE_ID: DB_PRIVATE_2025,
    ...overrides,
  }
}

// --- tests ------------------------------------------------------------------

describe('runNotionRagTraverseDryRun', () => {
  // 1) disabled env → skipped report, client never touched
  it('disabled env → skipped report, client not called', async () => {
    const client = fakeClient({ [DB_PRIVATE_2025]: [fakePage('p1', DB_PRIVATE_2025)] })
    const env = enabledEnv({ AI_AGENT_NOTION_RAG_ENABLED: 'false' })

    const report = await runNotionRagTraverseDryRun(env, client)

    expect(report.status).toBe('skipped')
    expect(report.index.totalRecords).toBe(0)
    expect(client.calls).toHaveLength(0)
  })

  // 2) enabled happy path → ok report with safe counts
  it('enabled happy path with fake pages → ok report includes safe counts', async () => {
    const client = fakeClient({
      [DB_PRIVATE_2025]: [
        fakePage('p1', DB_PRIVATE_2025, '2026-04-12'),
        fakePage('p2', DB_PRIVATE_2025, '2026-05-01'),
      ],
    })

    const report = await runNotionRagTraverseDryRun(enabledEnv(), client)

    expect(report.status).toBe('ok')
    expect(report.sources).toHaveLength(1)
    expect(report.sources[0]).toMatchObject({
      sourceTable: 'private_2025',
      status: 'loaded',
      pageCount: 2,
    })
    expect(report.sources[0].recordCount).toBeGreaterThan(0)
    expect(report.index.totalRecords).toBeGreaterThan(0)
    expect(report.index.sourceCounts.private_2025).toBeGreaterThan(0)
    expect(client.calls).toEqual([DB_PRIVATE_2025])
  })

  // 3) multi-source → per-source counts reported, deterministic order
  it('multi-source fake pages → per-source counts are reported', async () => {
    const client = fakeClient({
      [DB_PRIVATE_2025]: [fakePage('a', DB_PRIVATE_2025, '2026-04-12')],
      [DB_TEAM_2026]: [fakePage('b', DB_TEAM_2026, '2026-06-01')],
    })
    const env = enabledEnv({
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025,team_2026',
      NOTION_TEAM_2026_DATABASE_ID: DB_TEAM_2026,
    })

    const report = await runNotionRagTraverseDryRun(env, client)

    expect(report.status).toBe('ok')
    expect(report.sources.map((s) => s.sourceTable)).toEqual([
      'private_2025',
      'team_2026',
    ])
    expect(report.sources.every((s) => s.status === 'loaded')).toBe(true)
    expect(report.index.sourceCounts.private_2025).toBeGreaterThan(0)
    expect(report.index.sourceCounts.team_2026).toBeGreaterThan(0)
    expect(client.calls).toEqual([DB_PRIVATE_2025, DB_TEAM_2026])
  })

  // 4) missing DB id → error report with code, no client call
  it('missing DB id → error report with code, no client call', async () => {
    const client = fakeClient({})
    const env = enabledEnv({ NOTION_PRIVATE_2025_DATABASE_ID: undefined })

    const report = await runNotionRagTraverseDryRun(env, client)

    expect(report.status).toBe('error')
    expect(report.errorCode).toBe('missing_database_id')
    expect(report.issues).toContain('missing_database_id')
    expect(report.index.totalRecords).toBe(0)
    expect(client.calls).toHaveLength(0)
  })

  // 5) client throws → error report sanitized
  it('client throws → error report sanitized, no db id/token/notion.so', async () => {
    const client = throwingClient()

    const report = await runNotionRagTraverseDryRun(enabledEnv(), client)

    expect(report.status).toBe('error')
    expect(report.errorCode).toBe('client_error')

    const surfaced = JSON.stringify(report)
    expect(surfaced).not.toContain(SECRET_TOKEN)
    expect(surfaced).not.toContain(DB_PRIVATE_2025)
    expect(surfaced).not.toContain(NOTION_LINK)
    expect(surfaced).not.toContain('notion.so')
  })

  // 6) full report leak guard — happy path, nothing private survives projection
  it('report JSON contains no secret-shaped db id / token / url / customer / cost / profit', async () => {
    const client = fakeClient({
      [DB_PRIVATE_2025]: [fakePage('p1', DB_PRIVATE_2025)],
    })

    const report = await runNotionRagTraverseDryRun(enabledEnv(), client)
    expect(report.status).toBe('ok')

    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain(DB_PRIVATE_2025)
    expect(serialized).not.toContain(SECRET_TOKEN)
    expect(serialized).not.toContain(NOTION_LINK)
    expect(serialized).not.toContain('notion.so')
    expect(serialized).not.toContain(CUSTOMER_NAME)
    expect(serialized).not.toContain('22000') // 成本
    expect(serialized).not.toContain('8000') // 分潤
  })
})
