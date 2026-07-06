/**
 * notion-rag-client.ts
 *
 * Real-shaped Notion SDK client adapter, on the @notionhq/client v5 DATA-SOURCE
 * model. It wraps an INJECTED Notion-like SDK (`databases.retrieve` +
 * `dataSources.query`) and implements the loader port (UNCHANGED surface)
 *
 *   NotionRagClient.listPages(databaseId): Promise<NotionApiPage[]>
 *
 * v5 flow: Notion API 2025-09-03 removed `databases.query`; a database now holds
 * one or more DATA SOURCES, and rows are read via `dataSources.query`. So this
 * adapter first `databases.retrieve(database_id)` to learn the database's
 * `data_sources[]`, then queries EACH data source (paginated) in returned order
 * and merges the page-like results. The cursor/pagination loop lives here so it
 * never leaks into the orchestrator (notion-rag-loader.ts). The real
 * `@notionhq/client` is NOT imported here — the caller injects either a real
 * `Client` (its shape is structurally compatible) or a fake of the same minimal
 * shape. No live API is hit in tests.
 *
 * Boundaries (see docs/plans/2026-06-06-notion-rag-loader-design.md):
 *   - No config/disabled gate here — the resolver + loader own that.
 *   - A database with NO data sources (or a malformed retrieve) is a structural
 *     failure → sanitized NotionRagClientError (the loader maps it to its error).
 *   - Conservative result filtering: only page-like results (objects carrying a
 *     `properties` record) flow on to flattenNotionPage; anything else is dropped.
 *   - Leak guard: any SDK error is re-thrown as a sanitized NotionRagClientError
 *     whose message/stack NEVER carries a token, database id, or notion.so url.
 */

import type { NotionApiPage } from './page-flattener'
import type { NotionRagClient } from './notion-rag-loader'

/** One page of a `dataSources.query` response (only the fields we read). */
export interface NotionQueryResponse {
  results: unknown[]
  has_more: boolean
  next_cursor: string | null
}

/** Minimal view of a `databases.retrieve` response — only `data_sources[]`. */
export interface NotionDatabaseRetrieveResponse {
  data_sources?: Array<{ id: string }>
}

/**
 * Minimal structural view of the injected SDK. The real `@notionhq/client` v5
 * `Client` satisfies this (it exposes `databases.retrieve` + `dataSources.query`),
 * but we depend only on this narrow surface so the adapter stays unit-testable
 * with a trivial fake.
 */
export interface NotionLikeSdkClient {
  databases: {
    retrieve(args: { database_id: string }): Promise<NotionDatabaseRetrieveResponse>
  }
  dataSources: {
    query(args: {
      data_source_id: string
      start_cursor?: string
    }): Promise<NotionQueryResponse>
  }
}

/**
 * Sanitized adapter error. Carries a fixed, secret-free message so a leaked
 * SDK error (token / db id / notion.so url) can never reach a caller or log.
 */
export class NotionRagClientError extends Error {
  readonly code = 'notion_query_failed'
  constructor() {
    super('Notion query failed while loading a RAG source')
    this.name = 'NotionRagClientError'
  }
}

/** A result is page-like iff it is an object exposing a `properties` record. */
function isPageLike(result: unknown): result is NotionApiPage {
  return (
    typeof result === 'object' &&
    result !== null &&
    typeof (result as { properties?: unknown }).properties === 'object' &&
    (result as { properties?: unknown }).properties !== null
  )
}

export function createNotionRagClient(
  sdk: NotionLikeSdkClient
): NotionRagClient {
  return {
    async listPages(databaseId: string): Promise<NotionApiPage[]> {
      const pages: NotionApiPage[] = []

      try {
        // v5 step 1: resolve the database's data sources.
        const db = await sdk.databases.retrieve({ database_id: databaseId })
        const dataSources = Array.isArray(db?.data_sources) ? db.data_sources : []
        if (dataSources.length === 0) {
          // No data source to read from — a structural failure. Throw the
          // sanitized error directly (the catch below would also catch it).
          throw new NotionRagClientError()
        }

        // v5 step 2: query each data source in returned order, paging through
        // each. Cursor loop: keep paging while the SDK reports more AND hands
        // back a cursor. has_more without a next_cursor terminates (defensive).
        for (const source of dataSources) {
          let cursor: string | undefined
          for (;;) {
            const res = await sdk.dataSources.query({
              data_source_id: source.id,
              start_cursor: cursor,
            })

            for (const result of res.results) {
              if (isPageLike(result)) pages.push(result)
            }

            if (!res.has_more || !res.next_cursor) break
            cursor = res.next_cursor
          }
        }
      } catch {
        // Swallow the raw SDK error — it may carry a token / db id / notion.so
        // url — and surface a fixed, sanitized error instead.
        throw new NotionRagClientError()
      }

      return pages
    },
  }
}
