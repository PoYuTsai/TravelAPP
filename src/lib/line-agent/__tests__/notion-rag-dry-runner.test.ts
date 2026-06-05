/**
 * notion-rag-dry-runner.test.ts
 *
 * RED-first spec for the runtime loader seam `loadNotionRagDryRunRuntime`
 * (scripts/notion-rag-dry-runner.mjs). The loader is the pluggable entry the
 * `notion-rag-dry-run` command falls back to when no runner is injected.
 *
 * This cut is the WIRING PROOF, not a live connection: the loader learns how to
 * ASSEMBLE runtime pieces from injectable factories, but stays safely not-wired
 * unless an explicit env gate (AI_AGENT_NOTION_RAG_RUNTIME=real) is set AND a
 * token is present. Even then it never hits a real Notion API in tests — the
 * factories are fakes. The loader owns its own leak guard: a factory throw is
 * re-thrown sanitized (no token / db id / notion.so url survives).
 */

import { describe, expect, test } from 'vitest'
import { loadNotionRagDryRunRuntime } from '../../../../scripts/notion-rag-dry-runner.mjs'
import {
  formatNotionRagTraverseReport,
  runNotionRagDryRunCommand,
} from '../../../../scripts/agent-command.mjs'

const DB_PRIVATE_2025 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

const OK_REPORT = {
  status: 'ok',
  sources: [{ sourceTable: 'private_2025', status: 'loaded', pageCount: 1, recordCount: 2 }],
  index: { totalRecords: 2, sourceCounts: { private_2025: 2 }, areaTokenCount: 1, themeTokenCount: 1 },
  issues: [],
}

/** Real-mode env: explicit runtime gate + a token the loader can read. */
function realEnv(overrides = {}) {
  return {
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
    AI_AGENT_NOTION_RAG_RUNTIME: 'real',
    NOTION_TOKEN: SECRET_TOKEN,
    ...overrides,
  }
}

/** Spy factory that records its calls and returns a fixed value as-is. */
function spyFactory(value) {
  const calls = []
  return {
    calls,
    fn: async (ctx) => {
      calls.push(ctx)
      return value
    },
  }
}

describe('loadNotionRagDryRunRuntime — default (not wired)', () => {
  // 1) default env (no real gate) → not wired, both null.
  test('default env → { runDryRun: null, client: null }', async () => {
    const runtime = await loadNotionRagDryRunRuntime({ env: {} })
    expect(runtime).toEqual({ runDryRun: null, client: null })
  })

  // 2) gate absent / not "real" → factories are NEVER called.
  test('non-real gate → injectable factories never called', async () => {
    const importTraverse = spyFactory(async () => OK_REPORT)
    const createClient = spyFactory({ listPages: async () => [] })

    const runtime = await loadNotionRagDryRunRuntime({
      env: { AI_AGENT_NOTION_RAG_RUNTIME: 'mock' },
      importTraverse: importTraverse.fn,
      createClient: createClient.fn,
    })

    expect(runtime).toEqual({ runDryRun: null, client: null })
    expect(importTraverse.calls).toHaveLength(0)
    expect(createClient.calls).toHaveLength(0)
  })
})

describe('loadNotionRagDryRunRuntime — real mode wiring', () => {
  // 3) real gate + fake factories → both pieces assembled and returned.
  test('real gate + fake factories → returns runDryRun + client', async () => {
    const runDryRun = async () => OK_REPORT
    const client = { listPages: async () => [] }
    const importTraverse = spyFactory(runDryRun)
    const createClient = spyFactory(client)

    const runtime = await loadNotionRagDryRunRuntime({
      env: realEnv(),
      importTraverse: importTraverse.fn,
      createClient: createClient.fn,
    })

    expect(runtime.runDryRun).toBe(runDryRun)
    expect(runtime.client).toBe(client)
    expect(importTraverse.calls).toHaveLength(1)
    expect(createClient.calls).toHaveLength(1)
  })

  // 5) real gate but token missing → safe not-wired, no client factory call.
  test('real gate, missing token → not wired, no env value leaked', async () => {
    const importTraverse = spyFactory(async () => OK_REPORT)
    const createClient = spyFactory({ listPages: async () => [] })

    const runtime = await loadNotionRagDryRunRuntime({
      env: realEnv({ NOTION_TOKEN: undefined }),
      importTraverse: importTraverse.fn,
      createClient: createClient.fn,
    })

    expect(runtime).toEqual({ runDryRun: null, client: null })
    expect(createClient.calls).toHaveLength(0)
  })

  // production default factories stay not-wired even with a real gate + token.
  test('real gate + default factories → still not wired (no live import)', async () => {
    const runtime = await loadNotionRagDryRunRuntime({ env: realEnv() })
    expect(runtime).toEqual({ runDryRun: null, client: null })
  })

  // 4) a factory throw (carrying secrets) → loader re-throws SANITIZED.
  test('factory throw with secrets → loader throws sanitized, no leak', async () => {
    const createClient = async () => {
      throw new Error(`wiring boom token=${SECRET_TOKEN} db=${DB_PRIVATE_2025} at ${NOTION_LINK}`)
    }

    await expect(
      loadNotionRagDryRunRuntime({
        env: realEnv(),
        importTraverse: async () => async () => OK_REPORT,
        createClient,
      })
    ).rejects.toThrow()

    let thrown
    try {
      await loadNotionRagDryRunRuntime({
        env: realEnv(),
        importTraverse: async () => async () => OK_REPORT,
        createClient,
      })
    } catch (err) {
      thrown = err
    }
    const blob = `${thrown?.message ?? ''}\n${thrown?.stack ?? ''}`
    expect(blob).not.toContain(SECRET_TOKEN)
    expect(blob).not.toContain(DB_PRIVATE_2025)
    expect(blob).not.toContain(NOTION_LINK)
    expect(blob).not.toContain('notion.so')
  })
})

describe('runNotionRagDryRunCommand — real loader integration', () => {
  // 6) command + real loader (fake factories) → formats an ok report.
  test('enabled + loader-assembled fake pieces → ok report', async () => {
    const runDryRun = async () => OK_REPORT
    const client = { listPages: async () => [] }
    const loadRuntime = (ctx) =>
      loadNotionRagDryRunRuntime({
        ...ctx,
        importTraverse: async () => runDryRun,
        createClient: async () => client,
      })

    const output = await runNotionRagDryRunCommand({ env: realEnv(), loadRuntime })

    expect(output).toBe(formatNotionRagTraverseReport(OK_REPORT))
    expect(output).toContain('完成')
    expect(output).toContain('總筆數：2')
    expect(output).not.toContain(SECRET_TOKEN)
  })

  // command + real loader factory throw → sanitized client_error projection.
  test('loader factory throw → command projects client_error, no leak', async () => {
    const loadRuntime = (ctx) =>
      loadNotionRagDryRunRuntime({
        ...ctx,
        importTraverse: async () => async () => OK_REPORT,
        createClient: async () => {
          throw new Error(`boom token=${SECRET_TOKEN} db=${DB_PRIVATE_2025} ${NOTION_LINK}`)
        },
      })

    const output = await runNotionRagDryRunCommand({ env: realEnv(), loadRuntime })

    expect(output).toContain('失敗')
    expect(output).toContain('client_error')
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(NOTION_LINK)
    expect(output).not.toContain('notion.so')
  })
})
