/**
 * notion-page-flattener.test.ts
 *
 * Notion SDK page envelope → NotionPageFixture flattener (fixture/mock-only).
 *
 * The real Notion API returns each property as a typed object
 * (e.g. { type: 'date', date: { start, end } }). This flattener is the ONE
 * place that turns that verbose envelope into the minimal NotionPageFixture
 * shape (plain string | number | boolean | array) so every downstream read
 * stays SDK-agnostic and network-free.
 *
 * NO real Notion API, NO network. These are hand-built envelope mocks.
 *
 * Contract:
 *   1. supported scalar types flatten to plain values:
 *      title/rich_text → string, number → number, checkbox → boolean, url → string.
 *   2. select → its name string; multi_select → array of names.
 *   3. date → 'start~end' when both bounds exist, else just 'start'.
 *   4. databaseId comes from parent.database_id; id passes through.
 *   5. unsupported property TYPES (people/relation/rollup…) are dropped (type whitelist).
 *   6. the page-level Notion url (page.url) is NEVER copied into properties.
 *   7. null / empty values are skipped — no empty slots in the fixture.
 *   8. multi-segment title / rich_text concatenate their plain_text.
 */

import { describe, it, expect } from 'vitest'
import { flattenNotionPage, type NotionApiPage } from '../notion/page-flattener'

function text(...parts: string[]): { plain_text: string }[] {
  return parts.map((plain_text) => ({ plain_text }))
}

// A representative team-2026 row as the Notion SDK would actually return it.
const samplePage: NotionApiPage = {
  id: 'case-family-cm-5d',
  url: 'https://www.notion.so/case-family-cm-5d-deadbeef',
  parent: { type: 'database_id', database_id: 'db-team-2026' },
  properties: {
    客戶名稱: { type: 'title', title: text('王先生') },
    行程摘要: { type: 'rich_text', rich_text: text('清邁親子 5 天，動物園 + 叢林飛索') },
    天數: { type: 'number', number: 5 },
    日期: { type: 'date', date: { start: '2026-04-12', end: '2026-04-16' } },
    城市區域: { type: 'select', select: { name: '清邁' } },
    行程類型: { type: 'multi_select', multi_select: [{ name: '親子' }, { name: '動物' }] },
    需要安全座椅: { type: 'checkbox', checkbox: true },
    參考連結: { type: 'url', url: 'https://example.com/ref' },
  },
}

describe('flattenNotionPage — supported scalar types', () => {
  it('flattens title / rich_text / number / checkbox / url into plain values', () => {
    const fixture = flattenNotionPage(samplePage)
    expect(fixture.properties).toMatchObject({
      客戶名稱: '王先生',
      行程摘要: '清邁親子 5 天，動物園 + 叢林飛索',
      天數: 5,
      需要安全座椅: true,
      參考連結: 'https://example.com/ref',
    })
  })

  it('flattens select to its name and multi_select to an array of names', () => {
    const fixture = flattenNotionPage(samplePage)
    expect(fixture.properties.城市區域).toBe('清邁')
    expect(fixture.properties.行程類型).toEqual(['親子', '動物'])
  })
})

describe('flattenNotionPage — date flattening', () => {
  it('joins start and end with ~ when both bounds exist', () => {
    const fixture = flattenNotionPage(samplePage)
    expect(fixture.properties.日期).toBe('2026-04-12~2026-04-16')
  })

  it('uses the start alone when there is no end', () => {
    const page: NotionApiPage = {
      id: 'p-open-ended',
      parent: { type: 'database_id', database_id: 'db-team-2026' },
      properties: {
        日期: { type: 'date', date: { start: '2026-05-01', end: null } },
      },
    }
    expect(flattenNotionPage(page).properties.日期).toBe('2026-05-01')
  })
})

describe('flattenNotionPage — identity & provenance', () => {
  it('passes through the page id and reads databaseId from parent.database_id', () => {
    const fixture = flattenNotionPage(samplePage)
    expect(fixture.id).toBe('case-family-cm-5d')
    expect(fixture.databaseId).toBe('db-team-2026')
  })
})

describe('flattenNotionPage — type whitelist & leak guards', () => {
  it('drops unsupported property types (people / relation / rollup)', () => {
    const page: NotionApiPage = {
      id: 'p-unsupported',
      parent: { type: 'database_id', database_id: 'db-team-2026' },
      properties: {
        天數: { type: 'number', number: 3 },
        負責人: { type: 'people', people: [{ id: 'u1', name: '機密' }] },
        關聯案例: { type: 'relation', relation: [{ id: 'page-secret' }] },
        成本加總: { type: 'rollup', rollup: { type: 'number', number: 99999 } },
      },
    }
    const fixture = flattenNotionPage(page)
    expect(fixture.properties.天數).toBe(3)
    expect(Object.keys(fixture.properties)).toEqual(['天數'])
    expect(JSON.stringify(fixture)).not.toContain('機密')
    expect(JSON.stringify(fixture)).not.toContain('page-secret')
  })

  it('never copies the page-level Notion url into properties', () => {
    const fixture = flattenNotionPage(samplePage)
    expect(JSON.stringify(fixture.properties)).not.toContain('notion.so')
  })
})

describe('flattenNotionPage — empty / null handling', () => {
  it('skips properties whose value is null or empty (no empty slots)', () => {
    const page: NotionApiPage = {
      id: 'p-sparse',
      parent: { type: 'database_id', database_id: 'db-team-2026' },
      properties: {
        天數: { type: 'number', number: null },
        日期: { type: 'date', date: null },
        城市區域: { type: 'select', select: null },
        行程摘要: { type: 'rich_text', rich_text: [] },
        行程類型: { type: 'multi_select', multi_select: [] },
        參考連結: { type: 'url', url: null },
        完成: { type: 'checkbox', checkbox: false },
      },
    }
    const fixture = flattenNotionPage(page)
    // every empty field is gone; only the real boolean false survives
    expect(Object.keys(fixture.properties)).toEqual(['完成'])
    expect(fixture.properties.完成).toBe(false)
  })

  it('concatenates multi-segment title / rich_text plain_text', () => {
    const page: NotionApiPage = {
      id: 'p-multi-seg',
      parent: { type: 'database_id', database_id: 'db-team-2026' },
      properties: {
        客戶名稱: { type: 'title', title: text('王', '先生') },
        行程摘要: { type: 'rich_text', rich_text: text('清邁', '親子', '5 天') },
      },
    }
    const fixture = flattenNotionPage(page)
    expect(fixture.properties.客戶名稱).toBe('王先生')
    expect(fixture.properties.行程摘要).toBe('清邁親子5 天')
  })
})
