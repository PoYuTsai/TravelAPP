/**
 * notion-rag-loader.ts
 *
 * Thin READ orchestrator: turns Notion API pages (delivered by an injected
 * client port) into a RagIndex via the existing pure pipeline. It owns config
 * gating + deterministic traversal + the build helper — NOT field parsing,
 * NOT a real Notion client, NOT Sanity / webhook / send gate.
 *
 *   client.listPages(dbId)            → NotionApiPage[]
 *   flattenNotionPage                 → NotionPageFixture[]
 *   notionPagesToRagRecords({source}) → RagIndexRecord[]
 *   buildRagIndex(records)            → RagIndex
 *
 * Spec: docs/plans/2026-06-06-notion-rag-loader-design.md
 */

import { flattenNotionPage, type NotionApiPage } from './page-flattener'
import { notionPagesToRagRecords } from './notion-rag-adapter'
import { buildRagIndex, type RagIndex, type RagIndexRecord } from './rag-index'

/**
 * Notion loader sources. A strict subset of RagSourceTable: `markdown_template`
 * is a first-layer corpus merged later by the index builder, never a Notion
 * loader source.
 */
export type NotionRagSourceTable = 'private_2025' | 'private_2026' | 'team_2026'

/**
 * Injected port. Pagination/cursor loops are a future real-client internal
 * detail — they never leak into the orchestrator, so the fake stays trivial.
 */
export interface NotionRagClient {
  listPages(databaseId: string): Promise<NotionApiPage[]>
}

/** Resolved upstream — the builder itself is pure of `process.env`. */
export interface NotionRagConfig {
  enabled: boolean
  activeSources: NotionRagSourceTable[]
  databaseIds: Partial<Record<NotionRagSourceTable, string>>
}

export interface SourceLoadReport {
  sourceTable: NotionRagSourceTable
  status: 'loaded' | 'skipped' | 'error'
  pageCount?: number
  recordCount?: number
  /** Human-safe — NEVER a token, db id, or Notion url. */
  error?: string
}

export interface NotionRagBuildError {
  code: 'missing_database_id' | 'client_error'
  message: string
  failedSources: NotionRagSourceTable[]
}

export type NotionRagBuildResult =
  | { status: 'skipped'; reason: 'disabled'; index: RagIndex; notes: string[] }
  | { status: 'ok'; index: RagIndex; sources: SourceLoadReport[]; notes: string[] }
  | {
      status: 'error'
      error: NotionRagBuildError
      index: RagIndex
      sources: SourceLoadReport[]
    }

const emptyIndex = (): RagIndex => buildRagIndex([])

export async function buildNotionRagIndex(
  config: NotionRagConfig,
  client: NotionRagClient
): Promise<NotionRagBuildResult> {
  // 1) Disabled gate short-circuits FIRST — no id checks, no client calls.
  if (!config.enabled) {
    return {
      status: 'skipped',
      reason: 'disabled',
      index: emptyIndex(),
      notes: ['Notion RAG disabled (AI_AGENT_NOTION_RAG_ENABLED off)'],
    }
  }

  // 2) Every active source must resolve a db id before any client call.
  const missing = config.activeSources.filter(
    (source) => !config.databaseIds[source]
  )
  if (missing.length > 0) {
    return {
      status: 'error',
      error: {
        code: 'missing_database_id',
        message: `Missing database id for ${missing.length} active source(s)`,
        failedSources: missing,
      },
      index: emptyIndex(),
      sources: missing.map((sourceTable) => ({ sourceTable, status: 'error' })),
    }
  }

  // 3) Fail-aggregate: run every active source in order; catch per-source so
  //    all reports are complete, but any error ⇒ empty index (never partial).
  const sources: SourceLoadReport[] = []
  const allRecords: RagIndexRecord[] = []
  const failedSources: NotionRagSourceTable[] = []

  for (const sourceTable of config.activeSources) {
    const databaseId = config.databaseIds[sourceTable] as string
    try {
      const pages = await client.listPages(databaseId)
      const records = notionPagesToRagRecords(
        pages.map(flattenNotionPage),
        { sourceTable }
      )
      allRecords.push(...records)
      sources.push({
        sourceTable,
        status: 'loaded',
        pageCount: pages.length,
        recordCount: records.length,
      })
    } catch {
      // Swallow the raw error — it may carry a token / db id / Notion url.
      failedSources.push(sourceTable)
      sources.push({
        sourceTable,
        status: 'error',
        error: 'Failed to load source from Notion',
      })
    }
  }

  if (failedSources.length > 0) {
    return {
      status: 'error',
      error: {
        code: 'client_error',
        message: `Failed to load ${failedSources.length} active source(s)`,
        failedSources,
      },
      index: emptyIndex(),
      sources,
    }
  }

  // 4) Success — buildRagIndex already dedupes/merges.
  return {
    status: 'ok',
    index: buildRagIndex(allRecords),
    sources,
    notes: [],
  }
}
