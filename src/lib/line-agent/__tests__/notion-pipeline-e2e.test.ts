/**
 * notion-pipeline-e2e.test.ts
 *
 * Full pure-function pipeline, driven by MOCK Notion SDK page envelopes:
 *
 *   NotionApiPage  →(flattenNotionPage)→  NotionPageFixture
 *                  →(notionPageToRagRecord)→  RagIndexRecord
 *                  →(buildRagIndex)→  index  →(queryRagIndex)→  results
 *                  →(toPartnerSafeView)→  partner-safe projection
 *
 * Proves the three already-green units actually compose, and that a realistic
 * envelope carrying PII (客戶姓名), private money (成本/分潤), a page-level Notion
 * url, and a database id ends up with ZERO leaks in the partner view.
 *
 * NO real Notion API, NO real DB ids, NO Sanity, NO webhook/send.
 */

import { describe, it, expect } from 'vitest'
import { flattenNotionPage, type NotionApiPage } from '../notion/page-flattener'
import { notionPagesToRagRecords } from '../notion/notion-rag-adapter'
import {
  buildRagIndex,
  queryRagIndex,
  toPartnerSafeView,
} from '../notion/rag-index'

const DB = 'db-team-2026'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

function richText(...parts: string[]) {
  return parts.map((plain_text) => ({ plain_text }))
}

// Realistic envelopes as the Notion SDK would return them. Note: 行程類型 is a
// `select` (single value) so it lands in themeHints via the adapter's asHints.
const familyEnvelope: NotionApiPage = {
  id: 'case-family-cm-5d',
  url: NOTION_LINK,
  parent: { type: 'database_id', database_id: DB },
  properties: {
    客戶名稱: { type: 'title', title: richText('王先生') }, // PII — dropped by adapter whitelist
    日期: { type: 'date', date: { start: '2026-04-12', end: '2026-04-16' } },
    天數: { type: 'number', number: 5 },
    大人: { type: 'number', number: 2 },
    小孩: { type: 'number', number: 2 },
    城市區域: { type: 'select', select: { name: '清邁' } },
    行程類型: { type: 'select', select: { name: '親子' } },
    行程摘要: { type: 'rich_text', rich_text: richText('清邁親子 5 天，動物園 + 叢林飛索') },
    成本: { type: 'number', number: 22000 }, // private — privateContext only
    分潤: { type: 'number', number: 8000 }, // private — privateContext only
    負責人: { type: 'people', people: [{ id: 'u1', name: '機密' }] }, // unsupported — dropped
  },
}

const coupleEnvelope: NotionApiPage = {
  id: 'case-couple-honeymoon',
  url: NOTION_LINK,
  parent: { type: 'database_id', database_id: DB },
  properties: {
    日期: { type: 'date', date: { start: '2026-05-01', end: '2026-05-03' } },
    天數: { type: 'number', number: 3 },
    大人: { type: 'number', number: 2 },
    城市區域: { type: 'select', select: { name: '清邁' } },
    行程類型: { type: 'select', select: { name: '蜜月' } },
    行程摘要: { type: 'rich_text', rich_text: richText('清邁蜜月 3 天') },
    成本: { type: 'number', number: 11000 },
  },
}

describe('Notion pipeline e2e — envelope → flatten → record → index → query → partner view', () => {
  it('step 1+2: a mock envelope flattens then maps into shareable facts + private context', () => {
    const fixture = flattenNotionPage(familyEnvelope)
    const [record] = notionPagesToRagRecords([fixture], { sourceTable: 'team_2026' })

    expect(record.facts).toMatchObject({
      travelDateRange: '2026-04-12~2026-04-16',
      days: 5,
      adults: 2,
      children: 2,
      areaHints: ['清邁'],
      themeHints: ['親子'],
      itinerarySnippet: '清邁親子 5 天，動物園 + 叢林飛索',
    })
    expect(record.privateContext).toMatchObject({
      cost: 22000,
      profitShare: '8000',
      databaseId: DB,
    })
    expect(record.identity.sourceRecordIds).toEqual(['case-family-cm-5d'])
  })

  it('step 3+4: the index ranks the family case first for a 親子/清邁 query', () => {
    const records = notionPagesToRagRecords(
      [familyEnvelope, coupleEnvelope].map(flattenNotionPage),
      { sourceTable: 'team_2026' }
    )
    const index = buildRagIndex(records)
    const results = queryRagIndex(index, { area: '清邁', themes: ['親子'] })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].identity.sourceRecordIds).toContain('case-family-cm-5d')
  })

  it('step 5: partner-safe view keeps trip facts but leaks NO private data end to end', () => {
    const records = notionPagesToRagRecords(
      [familyEnvelope, coupleEnvelope].map(flattenNotionPage),
      { sourceTable: 'team_2026' }
    )
    const index = buildRagIndex(records)
    const results = queryRagIndex(index, { area: '清邁', themes: ['親子'] })

    const view = toPartnerSafeView(results[0])
    const serialized = JSON.stringify(view)

    // useful trip facts survive for the partner
    expect(view.facts).toMatchObject({ areaHints: ['清邁'], themeHints: ['親子'] })

    // every private / PII / provenance signal is gone
    expect('privateContext' in view).toBe(false)
    expect(serialized).not.toContain('22000') // cost
    expect(serialized).not.toContain('8000') // profit share
    expect(serialized).not.toContain(DB) // database id
    expect(serialized).not.toContain('王先生') // customer name (PII)
    expect(serialized).not.toContain('機密') // unsupported-type people value
    expect(serialized).not.toContain('notion.so') // page-level Notion link
  })
})
