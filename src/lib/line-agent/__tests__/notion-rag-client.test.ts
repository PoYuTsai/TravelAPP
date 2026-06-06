/**
 * notion-rag-client.test.ts
 *
 * RED-first spec for the real-shaped Notion SDK client adapter, migrated to the
 * @notionhq/client v5 DATA-SOURCE model. It wraps an INJECTED Notion-like SDK
 * exposing `databases.retrieve` + `dataSources.query` and implements the loader
 * port (UNCHANGED public surface):
 *
 *   NotionRagClient.listPages(databaseId): Promise<NotionApiPage[]>
 *
 * v5 flow: retrieve the database → read its `data_sources[]` → query each data
 * source (paginated) in returned order → merge page-like results. The cursor
 * loop lives in THIS layer (hidden from the orchestrator). No real
 * @notionhq/client is imported, no real API is hit, no real db id is needed. Any
 * thrown error is sanitized — never carrying a token, database id, or notion.so
 * url.
 *
 * Spec: docs/plans/2026-06-06-notion-rag-loader-design.md
 */

import { describe, it, expect } from 'vitest'
import type { NotionApiPage } from '../notion/page-flattener'
import {
  createNotionRagClient,
  NotionRagClientError,
  type NotionLikeSdkClient,
  type NotionQueryResponse,
} from '../notion/notion-rag-client'

// --- secret-shaped fixtures (must never appear in a thrown error) ------------
const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const SECRET_DB_ID = 'db_secret_PRIVATE2025_DEADBEEF'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'

function fakePage(id: string): NotionApiPage {
  return {
    id,
    object: 'page',
    parent: { type: 'database_id', database_id: SECRET_DB_ID },
    properties: {
      Title: { type: 'title', title: [{ plain_text: id }] },
    },
  } as NotionApiPage & { object: string }
}

interface FakeSdkOptions {
  /** data_sources[] the retrieve call reports (default: one source 'ds1'). */
  dataSources?: Array<{ id: string }>
  /** Override the whole retrieve response (to model malformed shapes). */
  retrieveResponse?: unknown
  /** Queued query responses per data_source_id (consumed in order = pages). */
  queryByDs?: Record<string, NotionQueryResponse[]>
}

/**
 * A scripted v5 SDK fake. `databases.retrieve` reports data sources; each
 * `dataSources.query` hands back the next queued response for that source and
 * records its args so pagination + per-source ordering can be asserted.
 */
function fakeSdk(opts: FakeSdkOptions): {
  sdk: NotionLikeSdkClient
  calls: {
    retrieve: string[]
    query: Array<{ data_source_id: string; start_cursor?: string }>
  }
} {
  const calls = {
    retrieve: [] as string[],
    query: [] as Array<{ data_source_id: string; start_cursor?: string }>,
  }
  const cursors: Record<string, number> = {}
  const sdk: NotionLikeSdkClient = {
    databases: {
      async retrieve(args) {
        calls.retrieve.push(args.database_id)
        if (opts.retrieveResponse !== undefined) {
          return opts.retrieveResponse as { data_sources?: Array<{ id: string }> }
        }
        return { data_sources: opts.dataSources ?? [{ id: 'ds1' }] }
      },
    },
    dataSources: {
      async query(args) {
        calls.query.push({
          data_source_id: args.data_source_id,
          start_cursor: args.start_cursor,
        })
        const queue = opts.queryByDs?.[args.data_source_id] ?? []
        const idx = cursors[args.data_source_id] ?? 0
        cursors[args.data_source_id] = idx + 1
        const res = queue[idx]
        if (!res) throw new Error('fake ran out of responses')
        return res
      },
    },
  }
  return { sdk, calls }
}

describe('createNotionRagClient — retrieve → data source → query', () => {
  it('retrieves the db, queries its data source, returns page-like results', async () => {
    const { sdk, calls } = fakeSdk({
      dataSources: [{ id: 'ds1' }],
      queryByDs: {
        ds1: [{ results: [fakePage('p1'), fakePage('p2')], has_more: false, next_cursor: null }],
      },
    })
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(calls.retrieve).toEqual(['db-handle'])
    // first query carries the data source id and no cursor
    expect(calls.query).toEqual([{ data_source_id: 'ds1', start_cursor: undefined }])
  })
})

describe('createNotionRagClient — pagination', () => {
  it('follows has_more + next_cursor into a second page and merges results', async () => {
    const { sdk, calls } = fakeSdk({
      dataSources: [{ id: 'ds1' }],
      queryByDs: {
        ds1: [
          { results: [fakePage('p1')], has_more: true, next_cursor: 'cursor-2' },
          { results: [fakePage('p2')], has_more: false, next_cursor: null },
        ],
      },
    })
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(calls.query).toEqual([
      { data_source_id: 'ds1', start_cursor: undefined },
      { data_source_id: 'ds1', start_cursor: 'cursor-2' },
    ])
  })

  it('stops when next_cursor is null even if has_more is true', async () => {
    const { sdk, calls } = fakeSdk({
      dataSources: [{ id: 'ds1' }],
      queryByDs: { ds1: [{ results: [fakePage('p1')], has_more: true, next_cursor: null }] },
    })
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1'])
    expect(calls.query).toHaveLength(1)
  })
})

describe('createNotionRagClient — multiple data sources', () => {
  it('queries every data source in returned order and merges page-like results', async () => {
    const { sdk, calls } = fakeSdk({
      dataSources: [{ id: 'ds1' }, { id: 'ds2' }],
      queryByDs: {
        ds1: [{ results: [fakePage('a1')], has_more: true, next_cursor: 'c' }, { results: [fakePage('a2')], has_more: false, next_cursor: null }],
        ds2: [{ results: [fakePage('b1')], has_more: false, next_cursor: null }],
      },
    })
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['a1', 'a2', 'b1'])
    expect(calls.query).toEqual([
      { data_source_id: 'ds1', start_cursor: undefined },
      { data_source_id: 'ds1', start_cursor: 'c' },
      { data_source_id: 'ds2', start_cursor: undefined },
    ])
  })
})

describe('createNotionRagClient — conservative result filtering', () => {
  it('drops non-page-like results (no properties) before returning', async () => {
    const { sdk } = fakeSdk({
      dataSources: [{ id: 'ds1' }],
      queryByDs: {
        ds1: [
          {
            results: [
              fakePage('p1'),
              { object: 'data_source', id: 'ds1' }, // no properties → not page-like
              null,
              'nope',
            ],
            has_more: false,
            next_cursor: null,
          },
        ],
      },
    })
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('createNotionRagClient — missing / malformed data sources', () => {
  it('throws a sanitized error when the database reports no data sources', async () => {
    const { sdk } = fakeSdk({ dataSources: [], queryByDs: {} })
    const client = createNotionRagClient(sdk)

    await expect(client.listPages('db-handle')).rejects.toBeInstanceOf(NotionRagClientError)
  })

  it('throws a sanitized error when retrieve omits data_sources entirely', async () => {
    const { sdk } = fakeSdk({ retrieveResponse: {}, queryByDs: {} })
    const client = createNotionRagClient(sdk)

    await expect(client.listPages('db-handle')).rejects.toBeInstanceOf(NotionRagClientError)
  })
})

describe('createNotionRagClient — error sanitization', () => {
  it('throws a NotionRagClientError when retrieve rejects', async () => {
    const { sdk } = fakeSdk({ queryByDs: {} })
    sdk.databases.retrieve = async () => {
      throw new Error('boom')
    }
    const client = createNotionRagClient(sdk)

    await expect(client.listPages('db-handle')).rejects.toBeInstanceOf(NotionRagClientError)
  })

  it('throws a NotionRagClientError when a data source query rejects', async () => {
    const { sdk } = fakeSdk({ dataSources: [{ id: 'ds1' }], queryByDs: {} })
    sdk.dataSources.query = async () => {
      throw new Error('boom')
    }
    const client = createNotionRagClient(sdk)

    await expect(client.listPages('db-handle')).rejects.toBeInstanceOf(NotionRagClientError)
  })

  it('never leaks token / db id / notion.so url into the thrown error', async () => {
    const { sdk } = fakeSdk({ dataSources: [{ id: 'ds1' }], queryByDs: {} })
    sdk.dataSources.query = async () => {
      // a realistic SDK error carrying all three secrets
      throw new Error(
        `Notion 401 unauthorized: token ${SECRET_TOKEN} on database ${SECRET_DB_ID} at ${NOTION_LINK}`
      )
    }
    const client = createNotionRagClient(sdk)

    let caught: unknown
    try {
      await client.listPages(SECRET_DB_ID)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(NotionRagClientError)
    const serialized = `${(caught as Error).message}\n${(caught as Error).stack ?? ''}\n${JSON.stringify(
      caught,
      Object.getOwnPropertyNames(caught)
    )}`
    expect(serialized).not.toContain(SECRET_TOKEN)
    expect(serialized).not.toContain(SECRET_DB_ID)
    expect(serialized).not.toContain('notion.so')
  })
})
