/**
 * agent-command-notion-rag.test.ts
 *
 * RED-first spec for the operator `notion-rag-dry-run` command wrapper that
 * lives in scripts/agent-command.mjs. The wrapper lets Eric run the Notion RAG
 * traverse dry-run report from the existing operator CLI WITHOUT hitting a real
 * Notion API and WITHOUT going through the live HTTP path.
 *
 * This cut deliberately does NOT instantiate a real @notionhq/client: when the
 * gate is enabled but no real client is wired, the command surfaces a safe
 * "client not wired" error. The report formatter is a pure projection that may
 * only surface status / counts / issue codes — never a db id, token, notion.so
 * url, customer PII, cost, or profit.
 */

import { describe, expect, test } from 'vitest'
import {
  formatNotionRagTraverseReport,
  parseAgentCommandArgs,
  runNotionRagDryRunCommand,
} from '../../../../scripts/agent-command.mjs'

// 32-hex Notion-database-id shape — must never echo back through the command.
const DB_PRIVATE_2025 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

/** Spy client mirroring the loader port — records every db id it was asked for. */
function spyClient() {
  const calls: string[] = []
  return {
    calls,
    async listPages(databaseId: string) {
      calls.push(databaseId)
      return []
    },
  }
}

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

describe('parseAgentCommandArgs — notion-rag-dry-run', () => {
  // 5) unknown command behavior intact; inbox + new command both parse.
  test('parses notion-rag-dry-run (with and without slash)', () => {
    expect(parseAgentCommandArgs(['notion-rag-dry-run'])).toEqual({
      commandText: 'notion-rag-dry-run',
    })
    expect(parseAgentCommandArgs(['/notion-rag-dry-run'])).toEqual({
      commandText: 'notion-rag-dry-run',
    })
  })

  test('still parses inbox and still throws on unknown commands', () => {
    expect(parseAgentCommandArgs(['inbox'])).toEqual({ commandText: 'inbox' })
    expect(() => parseAgentCommandArgs(['totally-unknown'])).toThrow()
  })
})

describe('runNotionRagDryRunCommand — gate', () => {
  // 1) disabled gate → skipped summary, injected client never called.
  test('disabled gate → skipped summary, client not called', async () => {
    const client = spyClient()
    const output = await runNotionRagDryRunCommand({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'false' },
      client,
    })

    expect(output).toContain('略過')
    expect(client.calls).toHaveLength(0)
  })

  // 2) enabled but real client not wired → safe error, no secret env values.
  test('enabled but real client not wired → safe error, no secrets leaked', async () => {
    const output = await runNotionRagDryRunCommand({ env: enabledEnv() })

    expect(output).toContain('失敗')
    expect(output).toContain('client_not_wired')
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain('notion.so')
  })
})

describe('formatNotionRagTraverseReport', () => {
  // 3) ok report → status + source counts + total records.
  test('ok report renders status, source counts, total records', () => {
    const output = formatNotionRagTraverseReport({
      status: 'ok',
      sources: [
        { sourceTable: 'private_2025', status: 'loaded', pageCount: 2, recordCount: 5 },
        { sourceTable: 'team_2026', status: 'loaded', pageCount: 1, recordCount: 3 },
      ],
      index: {
        totalRecords: 8,
        sourceCounts: { private_2025: 5, team_2026: 3 },
        areaTokenCount: 4,
        themeTokenCount: 2,
      },
      issues: [],
    })

    expect(output).toContain('完成')
    expect(output).toContain('總筆數：8')
    expect(output).toContain('私帳 2025')
    expect(output).toContain('團隊 2026')
    expect(output).toContain('5')
    expect(output).toContain('3')
  })

  // 4) error report → issue / error code only, never db id / token / url.
  test('error report surfaces issue + error code, no db id/token/url', () => {
    const output = formatNotionRagTraverseReport({
      status: 'error',
      sources: [],
      index: { totalRecords: 0, sourceCounts: {}, areaTokenCount: 0, themeTokenCount: 0 },
      issues: ['missing_database_id'],
      errorCode: 'missing_database_id',
    })

    expect(output).toContain('失敗')
    expect(output).toContain('missing_database_id')
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(NOTION_LINK)
    expect(output).not.toContain('notion.so')
  })

  test('skipped report renders skipped summary with zero records', () => {
    const output = formatNotionRagTraverseReport({
      status: 'skipped',
      sources: [],
      index: { totalRecords: 0, sourceCounts: {}, areaTokenCount: 0, themeTokenCount: 0 },
      issues: [],
    })

    expect(output).toContain('略過')
    expect(output).toContain('總筆數：0')
  })
})
