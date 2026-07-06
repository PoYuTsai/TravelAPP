/**
 * notion-rag-traverse.ts
 *
 * Operator-only Notion RAG *dry-run traverse* entry. It is the thin glue that
 * wires the config resolver and the read loader into ONE operator-safe summary:
 *
 *   resolveNotionRagConfig(env)         → { config, issues }
 *   buildNotionRagIndex(config, client) → NotionRagBuildResult
 *   → projectReport()                   → NotionRagTraverseReport
 *
 * This cut deliberately does NOT touch a real Notion API (the client is
 * injected — fixtures/mocks for now), NOT Sanity, NOT the webhook/send gate. It
 * writes nothing, caches nothing, schedules nothing: it just returns a report
 * object the operator can inspect.
 *
 * The report is a PROJECTION. The underlying RagIndex carries private context
 * (cost, profit, Notion url, db id) and the source pages carry PII; the report
 * surfaces ONLY counts, enum source tables, and issue/error codes. It must
 * never include a token, a database id, a notion.so url, customer PII, or
 * private money. The traverse tests assert exactly that.
 */

import {
  resolveNotionRagConfig,
  type NotionRagConfigIssue,
} from './notion-rag-config'
import {
  buildNotionRagIndex,
  type NotionRagClient,
  type NotionRagSourceTable,
} from './notion-rag-loader'
import type { RagIndex, RagSourceTable } from './rag-index'

/** Per-source load summary — carries only enum + counts, never ids/urls. */
export interface NotionRagTraverseSourceSummary {
  sourceTable: NotionRagSourceTable
  status: 'loaded' | 'skipped' | 'error'
  pageCount?: number
  recordCount?: number
}

/** De-identified shape of the assembled index — counts only. */
export interface NotionRagTraverseIndexSummary {
  totalRecords: number
  /** Records per source table (a merged 2026 record counts under each table). */
  sourceCounts: Partial<Record<RagSourceTable, number>>
  /** Distinct normalized area / theme tokens — coverage signal, no raw values. */
  areaTokenCount: number
  themeTokenCount: number
}

export interface NotionRagTraverseReport {
  status: 'skipped' | 'ok' | 'error'
  sources: NotionRagTraverseSourceSummary[]
  index: NotionRagTraverseIndexSummary
  /** Config-resolution + build issue CODES only — never raw tokens/messages. */
  issues: string[]
  /** Present only when status === 'error'. */
  errorCode?: 'missing_database_id' | 'client_error'
}

/** Collapse a RagIndex to counts only — drops every private/PII-carrying field. */
function summarizeIndex(index: RagIndex): NotionRagTraverseIndexSummary {
  const sourceCounts: Partial<Record<RagSourceTable, number>> = {}
  index.bySourceTable.forEach((records, table) => {
    sourceCounts[table] = records.length
  })
  return {
    totalRecords: index.records.length,
    sourceCounts,
    areaTokenCount: index.byArea.size,
    themeTokenCount: index.byTheme.size,
  }
}

/**
 * Run the dry-run traverse: resolve config from env, build the index via the
 * injected client, and return an operator-safe report. The disabled gate and
 * the missing-id gate both short-circuit before any client call (the loader
 * guarantees it); nothing here re-reaches into the index's private context.
 */
export async function runNotionRagTraverseDryRun(
  env: Record<string, string | undefined>,
  client: NotionRagClient
): Promise<NotionRagTraverseReport> {
  const { config, issues: configIssues } = resolveNotionRagConfig(env)
  const issues = configIssues.map((i: NotionRagConfigIssue) => i.code)

  const result = await buildNotionRagIndex(config, client)

  if (result.status === 'skipped') {
    return {
      status: 'skipped',
      sources: [],
      index: summarizeIndex(result.index),
      issues,
    }
  }

  const sources: NotionRagTraverseSourceSummary[] = result.sources.map((s) => ({
    sourceTable: s.sourceTable,
    status: s.status,
    pageCount: s.pageCount,
    recordCount: s.recordCount,
  }))

  if (result.status === 'error') {
    return {
      status: 'error',
      sources,
      index: summarizeIndex(result.index),
      issues: [...issues, result.error.code],
      errorCode: result.error.code,
    }
  }

  return {
    status: 'ok',
    sources,
    index: summarizeIndex(result.index),
    issues,
  }
}
