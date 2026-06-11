/**
 * distill-knowledge-write-config.test.ts
 *
 * RED-first spec for 沉澱刀3's Notion write env resolver. Pure function: takes
 * an env-like record and decides whether the knowledge writer may be built.
 * Three things must align — KNOWLEDGE_WRITE_ENABLED='true' (trim 後字面相等,
 * 同 AI_AGENT_NOTION_RAG_ENABLED 規則) ＋ NOTION_KNOWLEDGE_TOKEN ＋
 * NOTION_DISTILLED_QA_DB. Any miss ⇒ enabled:false ＋ fixed reason code that
 * NEVER carries the token or the raw db id value.
 *
 * db id normalisation is delegated to the existing normaliseDatabaseId
 * (notion-rag-config), so dashed UUIDs and full Notion URLs are tolerated.
 *
 * Spec: docs/plans/2026-06-11-distill-knife3-plan.md Task 2
 */

import { describe, it, expect } from 'vitest'
import { resolveKnowledgeWriteConfig } from '../distill/knowledge-write-config'

// --- secret-shaped fixtures (must never appear in reason codes) --------------
const SECRET_TOKEN = 'secret_ntn_knowledge-DEADBEEF'
const BARE = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const DASHED = 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6'

describe('resolveKnowledgeWriteConfig — enabled happy path', () => {
  it('returns enabled with token + normalised databaseId when all three align', () => {
    const config = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: 'true',
      NOTION_KNOWLEDGE_TOKEN: SECRET_TOKEN,
      NOTION_DISTILLED_QA_DB: BARE,
    })
    expect(config).toEqual({
      enabled: true,
      token: SECRET_TOKEN,
      databaseId: BARE,
    })
  })

  it("' true ' (whitespace-padded) counts as enabled — .trim() === 'true' rule", () => {
    const config = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: ' true ',
      NOTION_KNOWLEDGE_TOKEN: SECRET_TOKEN,
      NOTION_DISTILLED_QA_DB: BARE,
    })
    expect(config.enabled).toBe(true)
  })
})

describe('resolveKnowledgeWriteConfig — disabled gate short-circuits', () => {
  it.each([
    ['missing flag', undefined],
    ["'false'", 'false'],
    ["'TRUE' (case-sensitive)", 'TRUE'],
    ["'1'", '1'],
    ['empty string', ''],
  ])('gate %s → enabled:false with NO reason (token/db never read)', (_label, flag) => {
    const config = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: flag,
      // token/db present but the gate is closed → must not be inspected.
      NOTION_KNOWLEDGE_TOKEN: SECRET_TOKEN,
      NOTION_DISTILLED_QA_DB: BARE,
    })
    expect(config).toEqual({ enabled: false })
  })
})

describe('resolveKnowledgeWriteConfig — missing pieces while gate is open', () => {
  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('token %s → enabled:false reason missing_knowledge_token', (_label, token) => {
    const config = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: 'true',
      NOTION_KNOWLEDGE_TOKEN: token,
      NOTION_DISTILLED_QA_DB: BARE,
    })
    expect(config).toEqual({ enabled: false, reason: 'missing_knowledge_token' })
  })

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['unparseable (<32 hex)', 'https://www.notion.so/no-valid-id-here'],
  ])('db id %s → enabled:false reason missing_database_id', (_label, db) => {
    const config = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: 'true',
      NOTION_KNOWLEDGE_TOKEN: SECRET_TOKEN,
      NOTION_DISTILLED_QA_DB: db,
    })
    expect(config).toEqual({ enabled: false, reason: 'missing_database_id' })
  })
})

describe('resolveKnowledgeWriteConfig — db id normalisation (reuses normaliseDatabaseId)', () => {
  function idFor(raw: string) {
    const config = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: 'true',
      NOTION_KNOWLEDGE_TOKEN: SECRET_TOKEN,
      NOTION_DISTILLED_QA_DB: raw,
    })
    return config.enabled ? config.databaseId : undefined
  }

  it('accepts a dashed UUID and strips it to the bare 32-hex id', () => {
    expect(idFor(DASHED)).toBe(BARE)
  })

  it('extracts the database id from a full Notion URL (query dropped)', () => {
    expect(idFor(`https://www.notion.so/myws/QA-${BARE}?v=${'f'.repeat(32)}&pvs=4`)).toBe(BARE)
  })
})

describe('resolveKnowledgeWriteConfig — leak guard', () => {
  it('reason never carries the token or the raw db id value', () => {
    const rawDb = `https://www.notion.so/secret-page-${BARE}-but-too-short-DEADBEEF`
      .slice(0, 40) // mangle so it is unparseable → missing_database_id path
    const dbMiss = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: 'true',
      NOTION_KNOWLEDGE_TOKEN: SECRET_TOKEN,
      NOTION_DISTILLED_QA_DB: rawDb,
    })
    const tokenMiss = resolveKnowledgeWriteConfig({
      KNOWLEDGE_WRITE_ENABLED: 'true',
      NOTION_KNOWLEDGE_TOKEN: '',
      NOTION_DISTILLED_QA_DB: BARE,
    })

    for (const config of [dbMiss, tokenMiss]) {
      const serialized = JSON.stringify(config)
      expect(serialized).not.toContain(SECRET_TOKEN)
      expect(serialized).not.toContain(BARE)
      expect(serialized).not.toContain(rawDb)
      expect(serialized).not.toContain('notion.so')
    }
  })
})
