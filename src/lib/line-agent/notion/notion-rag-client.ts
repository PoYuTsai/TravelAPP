/**
 * notion-rag-client.ts
 *
 * Real-shaped Notion SDK client adapter. It wraps an INJECTED Notion-like SDK
 * (`databases.query`) and implements the loader port
 *
 *   NotionRagClient.listPages(databaseId): Promise<NotionApiPage[]>
 *
 * The cursor/pagination loop lives here so it never leaks into the orchestrator
 * (notion-rag-loader.ts). The real `@notionhq/client` is NOT imported here — the
 * caller injects either a real `Client` (its shape is structurally compatible)
 * or a fake of the same minimal shape. No live API is hit in tests.
 *
 * Boundaries (see docs/plans/2026-06-06-notion-rag-loader-design.md):
 *   - No config/disabled gate here — the resolver + loader own that.
 *   - Conservative result filtering: only page-like results (objects carrying a
 *     `properties` record) flow on to flattenNotionPage; anything else is dropped.
 *   - Leak guard: any SDK error is re-thrown as a sanitized NotionRagClientError
 *     whose message/stack NEVER carries a token, database id, or notion.so url.
 */

import type { NotionApiPage } from './page-flattener'
import type { NotionRagClient } from './notion-rag-loader'

/** One page of a `databases.query` response (only the fields we read). */
export interface NotionQueryResponse {
  results: unknown[]
  has_more: boolean
  next_cursor: string | null
}

/**
 * Minimal structural view of the injected SDK. The real `@notionhq/client`
 * `Client` satisfies this (it exposes `databases.query`), but we depend only on
 * this narrow surface so the adapter stays unit-testable with a trivial fake.
 */
export interface NotionLikeSdkClient {
  databases: {
    query(args: {
      database_id: string
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
      let cursor: string | undefined

      try {
        // Cursor loop: keep paging while the SDK reports more AND hands back a
        // cursor. has_more without a next_cursor terminates (defensive).
        for (;;) {
          const res = await sdk.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
          })

          for (const result of res.results) {
            if (isPageLike(result)) pages.push(result)
          }

          if (!res.has_more || !res.next_cursor) break
          cursor = res.next_cursor
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
