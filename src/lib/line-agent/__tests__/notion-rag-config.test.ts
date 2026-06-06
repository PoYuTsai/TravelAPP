/**
 * notion-rag-config.test.ts
 *
 * RED-first spec for the env → NotionRagConfig resolver. Pure function: takes an
 * env-like record and produces the typed config consumed by buildNotionRagIndex,
 * plus non-fatal validation issues. It NEVER throws, NEVER calls Notion, and
 * NEVER leaks a token / db id / Notion url into its issue messages.
 *
 * Boundary: the resolver does NOT decide load success/failure — a known source
 * with a missing id is kept in activeSources so the loader's structured
 * `missing_database_id` error still fires downstream.
 *
 * Spec: docs/plans/2026-06-06-notion-rag-loader-design.md
 */

import { describe, it, expect } from 'vitest'
import { resolveNotionRagConfig } from '../notion/notion-rag-config'
import {
  buildNotionRagIndex,
  type NotionRagClient,
} from '../notion/notion-rag-loader'

// --- secret-shaped fixtures (must never appear in issue messages) -----------
// Real db ids are 32-hex, so these are valid-but-recognisable hex blobs: the
// resolver now normalises ids, and a non-hex sentinel would be treated as
// unparseable. They still read as obvious "secrets" for the leak-guard assert.
const SECRET_DB_PRIVATE_2025 = 'deadbeefdeadbeefdeadbeefdead2025'
const SECRET_DB_PRIVATE_2026 = 'cafebabecafebabecafebabecafe2026'
const SECRET_DB_TEAM_2026 = 'f00df00df00df00df00df00df00d2026'
const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

describe('resolveNotionRagConfig — disabled gate', () => {
  it('disables (enabled false / empty sources / empty ids) when the flag is not "true"', () => {
    // Ids present but the gate is closed → nothing is parsed.
    const { config, issues } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'false',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
      NOTION_PRIVATE_2025_DATABASE_ID: SECRET_DB_PRIVATE_2025,
    })

    expect(config.enabled).toBe(false)
    expect(config.activeSources).toEqual([])
    expect(config.databaseIds).toEqual({})
    expect(issues).toEqual([])
  })

  it('treats a missing flag the same as disabled', () => {
    const { config } = resolveNotionRagConfig({})
    expect(config.enabled).toBe(false)
    expect(config.activeSources).toEqual([])
  })
})

describe('resolveNotionRagConfig — enabled happy path', () => {
  it('resolves activeSources + database ids in declared order', () => {
    const { config, issues } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025,team_2026',
      NOTION_PRIVATE_2025_DATABASE_ID: SECRET_DB_PRIVATE_2025,
      NOTION_TEAM_2026_DATABASE_ID: SECRET_DB_TEAM_2026,
    })

    expect(config.enabled).toBe(true)
    expect(config.activeSources).toEqual(['private_2025', 'team_2026'])
    expect(config.databaseIds).toEqual({
      private_2025: SECRET_DB_PRIVATE_2025,
      team_2026: SECRET_DB_TEAM_2026,
    })
    expect(issues).toEqual([])
  })
})

describe('resolveNotionRagConfig — missing database id (known source)', () => {
  it('does not throw and keeps the source so the loader can return a structured error', () => {
    const resolve = () =>
      resolveNotionRagConfig({
        AI_AGENT_NOTION_RAG_ENABLED: 'true',
        AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
        // NOTION_PRIVATE_2025_DATABASE_ID intentionally absent
      })
    expect(resolve).not.toThrow()

    const { config, issues } = resolve()
    expect(config.enabled).toBe(true)
    expect(config.activeSources).toEqual(['private_2025'])
    expect(config.databaseIds.private_2025).toBeUndefined()
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'missing_database_id',
        source: 'private_2025',
      })
    )
  })

  it('feeds the loader contract: resolved config yields missing_database_id, no client call', async () => {
    const { config } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
    })

    let called = false
    const client: NotionRagClient = {
      async listPages() {
        called = true
        throw new Error('should never be called')
      },
    }

    const result = await buildNotionRagIndex(config, client)
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('missing_database_id')
      expect(result.error.failedSources).toEqual(['private_2025'])
    }
    expect(called).toBe(false)
  })
})

describe('resolveNotionRagConfig — unknown active source', () => {
  it('does not silently drop; surfaces a validation issue', () => {
    const { config, issues } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025,bogus_source',
      NOTION_PRIVATE_2025_DATABASE_ID: SECRET_DB_PRIVATE_2025,
    })

    // Typed list only carries known sources…
    expect(config.activeSources).toEqual(['private_2025'])
    // …but the unknown token is reported, not dropped silently.
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'unknown_active_source',
        source: 'bogus_source',
      })
    )
  })
})

describe('resolveNotionRagConfig — normalisation', () => {
  it('trims whitespace and dedupes active sources, preserving first-seen order', () => {
    const { config } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: ' private_2025 , private_2025 ,team_2026 ',
      NOTION_PRIVATE_2025_DATABASE_ID: SECRET_DB_PRIVATE_2025,
      NOTION_TEAM_2026_DATABASE_ID: SECRET_DB_TEAM_2026,
    })

    expect(config.activeSources).toEqual(['private_2025', 'team_2026'])
  })
})

describe('resolveNotionRagConfig — database id normalisation', () => {
  // One canonical id in every accepted form. The API-usable form is the bare
  // 32-hex (lowercased); the resolver normalises each input to that.
  const BARE = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
  const DASHED = 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6'
  const VIEW = 'ffffffffffffffffffffffffffffffff'

  function idFor(rawId: string) {
    return resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
      NOTION_PRIVATE_2025_DATABASE_ID: rawId,
    }).config.databaseIds.private_2025
  }

  it('keeps a bare 32-hex id usable', () => {
    expect(idFor(BARE)).toBe(BARE)
  })

  it('accepts a dashed UUID and strips it to the API id', () => {
    expect(idFor(DASHED)).toBe(BARE)
  })

  it('extracts the database id from a full Notion URL', () => {
    expect(idFor(`https://www.notion.so/myws/Trips-${BARE}`)).toBe(BARE)
  })

  it('takes the path id, never the ?v= view id', () => {
    expect(idFor(`https://www.notion.so/myws/Trips-${BARE}?v=${VIEW}&pvs=4`)).toBe(BARE)
  })

  it('reports an unparseable value as missing_database_id and does not throw', () => {
    const resolve = () =>
      resolveNotionRagConfig({
        AI_AGENT_NOTION_RAG_ENABLED: 'true',
        AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
        NOTION_PRIVATE_2025_DATABASE_ID: 'https://www.notion.so/no-valid-id-here',
      })
    expect(resolve).not.toThrow()

    const { config, issues } = resolve()
    expect(config.databaseIds.private_2025).toBeUndefined()
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'missing_database_id', source: 'private_2025' })
    )
  })

  it('never embeds the raw value in the issue message for an unparseable id', () => {
    const raw = 'https://www.notion.so/secret-token-DEADBEEF-no-valid-id'
    const { issues } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025',
      NOTION_PRIVATE_2025_DATABASE_ID: raw,
    })
    const serialized = JSON.stringify(issues)
    expect(serialized).not.toContain(raw)
    expect(serialized).not.toContain('notion.so')
    expect(serialized).not.toContain('DEADBEEF')
  })
})

describe('resolveNotionRagConfig — leak guard', () => {
  it('never embeds a token / db id / Notion url in issue messages', () => {
    const { issues } = resolveNotionRagConfig({
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2025,private_2026,bogus_source',
      // private_2025 has its id; private_2026 is missing → both issue paths hit.
      NOTION_PRIVATE_2025_DATABASE_ID: SECRET_DB_PRIVATE_2025,
      NOTION_TOKEN: SECRET_TOKEN,
    })

    const serialized = JSON.stringify(issues)
    expect(serialized).not.toContain(SECRET_DB_PRIVATE_2025)
    expect(serialized).not.toContain(SECRET_DB_PRIVATE_2026)
    expect(serialized).not.toContain(SECRET_DB_TEAM_2026)
    expect(serialized).not.toContain(SECRET_TOKEN)
    expect(serialized).not.toContain(NOTION_LINK)
    expect(serialized).not.toContain('notion.so')
  })
})
