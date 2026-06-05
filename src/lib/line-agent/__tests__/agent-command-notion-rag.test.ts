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
import { runNotionRagTraverseDryRun } from '../notion/notion-rag-traverse'
import type { NotionApiPage } from '../notion/page-flattener'

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

// --- bridge: JS command ←→ TS traverse --------------------------------------
// The command's `runDryRun` option is the bridge seam: a plain-JS CLI cannot
// import the TypeScript traverse directly, so it accepts the traverse function
// shape `(env, client) => Promise<report>` by injection. These tests prove the
// real `runNotionRagTraverseDryRun` plugs into that seam offline (mock client,
// no real @notionhq/client, no live HTTP path) and that the command boundary
// stays leak-proof even when an injected runDryRun throws raw.

const CUSTOMER_NAME = '王先生'

/** Spy whose listPages records db ids — mirrors the loader port. */
function spyTraverseClient() {
  const calls: string[] = []
  return {
    calls,
    async listPages(databaseId: string): Promise<NotionApiPage[]> {
      calls.push(databaseId)
      return []
    },
  }
}

describe('runNotionRagDryRunCommand — injected runDryRun (bridge proof)', () => {
  // 1) enabled + injected runDryRun → it is called with (env, client) and its
  // report is formatted. Characterization of the existing injection seam.
  test('enabled → calls injected runDryRun with env+client, formats its report', async () => {
    const client = spyTraverseClient()
    const seen: Array<{ env: unknown; client: unknown }> = []
    const runDryRun = async (
      env: Record<string, string | undefined>,
      injectedClient: unknown
    ) => {
      seen.push({ env, client: injectedClient })
      return {
        status: 'ok' as const,
        sources: [
          { sourceTable: 'private_2025' as const, status: 'loaded' as const, pageCount: 2, recordCount: 5 },
        ],
        index: { totalRecords: 5, sourceCounts: { private_2025: 5 }, areaTokenCount: 3, themeTokenCount: 1 },
        issues: [],
      }
    }

    const output = await runNotionRagDryRunCommand({
      env: enabledEnv(),
      client,
      runDryRun,
    })

    expect(seen).toHaveLength(1)
    expect(seen[0].client).toBe(client)
    expect(output).toContain('完成')
    expect(output).toContain('總筆數：5')
    expect(output).toContain('私帳 2025')
  })

  // 2) the REAL TypeScript traverse plugs into the JS command seam, offline.
  test('real runNotionRagTraverseDryRun bridges through the command, leak-free', async () => {
    const fakePage: NotionApiPage = {
      id: 'p1',
      url: NOTION_LINK,
      parent: { type: 'database_id', database_id: DB_PRIVATE_2025 },
      properties: {
        客戶名稱: { type: 'title', title: [{ plain_text: CUSTOMER_NAME }] },
        日期: { type: 'date', date: { start: '2026-04-12', end: '2026-04-16' } },
        城市區域: { type: 'select', select: { name: '清邁' } },
        行程類型: { type: 'multi_select', multi_select: [{ name: '親子' }] },
        成本: { type: 'number', number: 22000 },
        分潤: { type: 'number', number: 8000 },
      },
    }
    const client = {
      calls: [] as string[],
      async listPages(databaseId: string): Promise<NotionApiPage[]> {
        this.calls.push(databaseId)
        return databaseId === DB_PRIVATE_2025 ? [fakePage] : []
      },
    }

    const output = await runNotionRagDryRunCommand({
      env: enabledEnv(),
      client,
      runDryRun: runNotionRagTraverseDryRun,
    })

    expect(client.calls).toEqual([DB_PRIVATE_2025])
    expect(output).toContain('完成')
    expect(output).toContain('私帳 2025')
    // Boundary stays leak-proof — nothing private survives to the operator text.
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(NOTION_LINK)
    expect(output).not.toContain('notion.so')
    expect(output).not.toContain(CUSTOMER_NAME)
    expect(output).not.toContain('22000')
    expect(output).not.toContain('8000')
  })

  // 3) injected runDryRun THROWS raw (with a secret in the message) → command
  // returns a sanitized client_error report, never propagating the raw throw.
  test('injected runDryRun throws → sanitized client_error, no leak', async () => {
    const client = spyTraverseClient()
    const runDryRun = async () => {
      throw new Error(`boom at ${NOTION_LINK} token=${SECRET_TOKEN} db=${DB_PRIVATE_2025}`)
    }

    const output = await runNotionRagDryRunCommand({
      env: enabledEnv(),
      client,
      runDryRun,
    })

    expect(output).toContain('失敗')
    expect(output).toContain('client_error')
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(NOTION_LINK)
    expect(output).not.toContain('notion.so')
    expect(output).not.toContain('boom')
  })
})

// --- runtime loader: pluggable real-runner entry -----------------------------
// When the command is enabled and NO runner is injected, it falls back to a
// runtime loader: `loadRuntime({ env }) → { runDryRun, client }`. This is the
// seam where a future knife wires the real @notionhq/client + TS traverse. For
// now the default loader is mock-first (not wired). Disabled never loads; loader
// throws collapse to a sanitized client_error; an empty/partial runtime stays a
// safe client_not_wired. The loader boundary must leak no token/db id/url.

const OK_REPORT = {
  status: 'ok' as const,
  sources: [
    { sourceTable: 'private_2025' as const, status: 'loaded' as const, pageCount: 1, recordCount: 2 },
  ],
  index: { totalRecords: 2, sourceCounts: { private_2025: 2 }, areaTokenCount: 1, themeTokenCount: 1 },
  issues: [],
}

/** Spy runtime loader: records each call's ctx; returns (or throws) `runtime`. */
function spyRuntimeLoader(runtime: unknown | (() => unknown)) {
  const calls: unknown[] = []
  return {
    calls,
    async load(ctx: unknown) {
      calls.push(ctx)
      return typeof runtime === 'function' ? (runtime as () => unknown)() : runtime
    },
  }
}

describe('runNotionRagDryRunCommand — runtime loader', () => {
  // 1) disabled gate short-circuits before any runtime load.
  test('disabled gate → runtime loader not called', async () => {
    const loader = spyRuntimeLoader({ runDryRun: async () => OK_REPORT, client: spyTraverseClient() })
    const output = await runNotionRagDryRunCommand({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'false' },
      loadRuntime: loader.load,
    })

    expect(output).toContain('略過')
    expect(loader.calls).toHaveLength(0)
  })

  // 3) enabled + no injection → loader is called and its runDryRun/client used.
  test('enabled + no injection → uses runtime loader runDryRun + client', async () => {
    const client = spyTraverseClient()
    const seen: Array<{ env: unknown; client: unknown }> = []
    const runDryRun = async (env: Record<string, string | undefined>, injectedClient: unknown) => {
      seen.push({ env, client: injectedClient })
      return OK_REPORT
    }
    const loader = spyRuntimeLoader({ runDryRun, client })

    const output = await runNotionRagDryRunCommand({ env: enabledEnv(), loadRuntime: loader.load })

    expect(loader.calls).toHaveLength(1)
    expect(seen).toHaveLength(1)
    expect(seen[0].client).toBe(client)
    expect(output).toContain('完成')
    expect(output).toContain('總筆數：2')
  })

  // 4) loader throws raw (secret in message) → sanitized client_error, no leak.
  test('runtime loader throws → sanitized client_error, no leak', async () => {
    const loader = spyRuntimeLoader(() => {
      throw new Error(`load fail at ${NOTION_LINK} token=${SECRET_TOKEN} db=${DB_PRIVATE_2025}`)
    })

    const output = await runNotionRagDryRunCommand({ env: enabledEnv(), loadRuntime: loader.load })

    expect(output).toContain('失敗')
    expect(output).toContain('client_error')
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(NOTION_LINK)
    expect(output).not.toContain('notion.so')
  })

  // 5) loader returns empty / missing runDryRun → safe client_not_wired.
  test('runtime loader returns missing runDryRun → client_not_wired, client untouched', async () => {
    const client = spyTraverseClient()
    const loader = spyRuntimeLoader({ runDryRun: null, client })

    const output = await runNotionRagDryRunCommand({ env: enabledEnv(), loadRuntime: loader.load })

    expect(loader.calls).toHaveLength(1)
    expect(output).toContain('失敗')
    expect(output).toContain('client_not_wired')
    expect(client.calls).toHaveLength(0)
  })

  // 6) default runtime (not wired) → client_not_wired, no secret-shaped env leak.
  test('default runtime not wired → client_not_wired, no secret-shaped env leak', async () => {
    const output = await runNotionRagDryRunCommand({
      env: enabledEnv({ AI_AGENT_INTERNAL_SECRET: SECRET_TOKEN }),
    })

    expect(output).toContain('client_not_wired')
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(DB_PRIVATE_2025)
  })
})
