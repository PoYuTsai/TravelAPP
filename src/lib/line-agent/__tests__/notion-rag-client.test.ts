/**
 * notion-rag-client.test.ts
 *
 * RED-first spec for the real-shaped Notion SDK client adapter. It wraps an
 * INJECTED Notion-like SDK (`databases.query`) and implements the loader port
 *
 *   NotionRagClient.listPages(databaseId): Promise<NotionApiPage[]>
 *
 * The cursor/pagination loop lives in THIS layer (hidden from the orchestrator).
 * No real @notionhq/client is imported, no real API is hit, no real db id is
 * needed. Any thrown/reported error is sanitized — it must never carry a token,
 * database id, or notion.so url.
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

/**
 * A scripted SDK fake: hands back each queued response in turn and records the
 * args of every `databases.query` call so pagination behaviour can be asserted.
 */
function fakeSdk(responses: NotionQueryResponse[]): {
  sdk: NotionLikeSdkClient
  calls: Array<{ database_id: string; start_cursor?: string }>
} {
  const calls: Array<{ database_id: string; start_cursor?: string }> = []
  let i = 0
  const sdk: NotionLikeSdkClient = {
    databases: {
      async query(args) {
        calls.push({ database_id: args.database_id, start_cursor: args.start_cursor })
        const res = responses[i]
        i += 1
        if (!res) throw new Error('fake ran out of responses')
        return res
      },
    },
  }
  return { sdk, calls }
}

describe('createNotionRagClient — single page', () => {
  it('returns the page-like results from a one-page query', async () => {
    const { sdk, calls } = fakeSdk([
      { results: [fakePage('p1'), fakePage('p2')], has_more: false, next_cursor: null },
    ])
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1', 'p2'])
    // first call carries no cursor
    expect(calls).toEqual([{ database_id: 'db-handle', start_cursor: undefined }])
  })
})

describe('createNotionRagClient — pagination', () => {
  it('follows has_more + next_cursor into a second page and merges results', async () => {
    const { sdk, calls } = fakeSdk([
      { results: [fakePage('p1')], has_more: true, next_cursor: 'cursor-2' },
      { results: [fakePage('p2')], has_more: false, next_cursor: null },
    ])
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(calls).toEqual([
      { database_id: 'db-handle', start_cursor: undefined },
      { database_id: 'db-handle', start_cursor: 'cursor-2' },
    ])
  })

  it('stops when next_cursor is null even if has_more is true', async () => {
    const { sdk, calls } = fakeSdk([
      { results: [fakePage('p1')], has_more: true, next_cursor: null },
    ])
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1'])
    expect(calls).toHaveLength(1)
  })
})

describe('createNotionRagClient — conservative result filtering', () => {
  it('drops non-page-like results (no properties) before returning', async () => {
    const { sdk } = fakeSdk([
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
    ])
    const client = createNotionRagClient(sdk)

    const pages = await client.listPages('db-handle')

    expect(pages.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('createNotionRagClient — error sanitization', () => {
  it('throws a NotionRagClientError when the SDK rejects', async () => {
    const { sdk } = fakeSdk([])
    // override query to reject
    sdk.databases.query = async () => {
      throw new Error('boom')
    }
    const client = createNotionRagClient(sdk)

    await expect(client.listPages('db-handle')).rejects.toBeInstanceOf(
      NotionRagClientError
    )
  })

  it('never leaks token / db id / notion.so url into the thrown error', async () => {
    const { sdk } = fakeSdk([])
    sdk.databases.query = async () => {
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
