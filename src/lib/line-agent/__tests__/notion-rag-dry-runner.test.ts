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
import {
  createClientDefault,
  importTraverseDefault,
  loadNotionRagDryRunRuntime,
} from '../../../../scripts/notion-rag-dry-runner.mjs'
import {
  formatNotionRagTraverseReport,
  runNotionRagDryRunCommand,
} from '../../../../scripts/agent-command.mjs'

const DB_PRIVATE_2025 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

/** One Notion-shaped page the real traverse can flatten into a record. */
const FAKE_PAGE = {
  id: 'p1',
  url: NOTION_LINK,
  parent: { type: 'database_id', database_id: DB_PRIVATE_2025 },
  properties: {
    客戶名稱: { type: 'title', title: [{ plain_text: '王小明' }] },
    日期: { type: 'date', date: { start: '2026-04-12', end: '2026-04-16' } },
    城市區域: { type: 'select', select: { name: '清邁' } },
    行程類型: { type: 'multi_select', multi_select: [{ name: '親子' }] },
    成本: { type: 'number', number: 22000 },
    分潤: { type: 'number', number: 8000 },
  },
}

/** Real env that ALSO satisfies the traverse: active source + its db id. */
function realTraversableEnv(overrides = {}) {
  return realEnv({ NOTION_PRIVATE_2025_DATABASE_ID: DB_PRIVATE_2025, ...overrides })
}

/** Loader-port client returning one fake page for the private_2025 db. */
function fakeTraverseClient() {
  return {
    calls: [],
    async listPages(databaseId) {
      this.calls.push(databaseId)
      return databaseId === DB_PRIVATE_2025 ? [FAKE_PAGE] : []
    },
  }
}

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

  // CLIENT HALF NOW WIRED — under a TS + SDK-capable runtime (vitest here, tsx
  // later) the default factories assemble BOTH halves: importTraverse loads the
  // real TS traverse, createClient constructs a real @notionhq/client wrapped by
  // createNotionRagClient. Constructing the SDK touches NO network — the loader
  // only hits Notion when runDryRun later calls client.listPages. So real gate +
  // token + default factories now returns a real runDryRun + a real client.
  test('real gate + token + default factories → fully wired under TS runtime', async () => {
    const runtime = await loadNotionRagDryRunRuntime({ env: realEnv() })
    expect(typeof runtime.runDryRun).toBe('function')
    expect(runtime.client).not.toBeNull()
    expect(typeof runtime.client.listPages).toBe('function')
  })

  // DECISION A1 — the default importTraverse loads the real TS traverse when a
  // TS-capable runtime is present (vitest here, tsx later). Leave importTraverse
  // at its default, inject only a working client: runtime gets a real runDryRun.
  test('real gate + token + default importTraverse loads the real TS traverse', async () => {
    const client = fakeTraverseClient()

    const runtime = await loadNotionRagDryRunRuntime({
      env: realTraversableEnv(),
      createClient: async () => client,
    })

    expect(typeof runtime.runDryRun).toBe('function')
    expect(runtime.client).toBe(client)
  })

  // The default-loaded traverse composes end-to-end: command → ok report, and
  // nothing private (token / db id / notion.so url) survives to the operator text.
  test('default importTraverse + fake client → command ok report, leak-free', async () => {
    const client = fakeTraverseClient()

    const output = await runNotionRagDryRunCommand({
      env: realTraversableEnv(),
      loadRuntime: (ctx) =>
        loadNotionRagDryRunRuntime({ ...ctx, createClient: async () => client }),
    })

    expect(output).toContain('完成')
    expect(output).not.toContain(SECRET_TOKEN)
    expect(output).not.toContain(DB_PRIVATE_2025)
    expect(output).not.toContain(NOTION_LINK)
    expect(output).not.toContain('notion.so')
  })

  // plain-node path: a `.ts` dynamic import throws (unknown extension / not
  // found). The default factory swallows it → null (not-wired), never throws,
  // and a secret-bearing import error cannot leak (nothing propagates).
  test('importTraverseDefault swallows a secret-bearing import failure → null', async () => {
    let thrown = null
    let result
    try {
      result = await importTraverseDefault({
        importModule: async () => {
          throw new Error(`load fail token=${SECRET_TOKEN} db=${DB_PRIVATE_2025} at ${NOTION_LINK}`)
        },
      })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeNull()
    expect(result).toBeNull()
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

describe('createClientDefault — real Notion client assembly', () => {
  // Happy path: with injected fake SDK + fake rag factory, the default builds a
  // `new Client({ auth: token })` and hands it to createNotionRagClient, then
  // returns the wrapped NotionRagClient. Injectable imports keep this offline.
  test('fake SDK + fake rag factory → wraps Client({auth:token}) into NotionRagClient', async () => {
    let constructedAuth
    let wrappedSdk
    const ragClient = { listPages: async () => [] }
    class FakeClient {
      constructor(opts) {
        constructedAuth = opts?.auth
      }
    }

    const result = await createClientDefault({
      token: SECRET_TOKEN,
      importClientModule: async () => ({ Client: FakeClient }),
      importRagClientModule: async () => ({
        createNotionRagClient: (sdk) => {
          wrappedSdk = sdk
          return ragClient
        },
      }),
    })

    expect(result).toBe(ragClient)
    expect(constructedAuth).toBe(SECRET_TOKEN)
    expect(wrappedSdk).toBeInstanceOf(FakeClient)
  })

  // Leak guard (defense in depth, mirrors loader): a secret-bearing import/
  // construction throw is re-thrown sanitized — no token / db id / notion.so url
  // survives in message or stack, even when called directly (not via the loader).
  test('secret-bearing import throw → sanitized, no leak', async () => {
    let thrown
    try {
      await createClientDefault({
        token: SECRET_TOKEN,
        importClientModule: async () => {
          throw new Error(`sdk load token=${SECRET_TOKEN} db=${DB_PRIVATE_2025} at ${NOTION_LINK}`)
        },
      })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeTruthy()
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
