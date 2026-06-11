/**
 * notion-rag-config.ts
 *
 * Pure env → NotionRagConfig resolver. Keeps `buildNotionRagIndex` free of
 * `process.env`: it takes an env-like record and returns the typed config plus
 * non-fatal validation issues.
 *
 * Contract (see docs/plans/2026-06-06-notion-rag-loader-design.md):
 *   - Disabled gate first: AI_AGENT_NOTION_RAG_ENABLED must be exactly "true";
 *     anything else ⇒ disabled, empty sources/ids, no parsing.
 *   - Explicit active source list (AI_AGENT_NOTION_RAG_ACTIVE_SOURCES) — never
 *     "has an id ⇒ auto-enable". Tokens are trimmed and deduped (first-seen
 *     order preserved).
 *   - Unknown source ⇒ reported as a `unknown_active_source` issue, NOT silently
 *     dropped.
 *   - Known source with a missing db id ⇒ kept in activeSources and reported as
 *     a `missing_database_id` issue, so the loader's structured error still
 *     fires. The resolver never throws.
 *   - Leak guard: issue messages carry only the source label — never a token,
 *     db id, or Notion url.
 */

import type {
  NotionRagConfig,
  NotionRagSourceTable,
} from './notion-rag-loader'

const KNOWN_SOURCES: readonly NotionRagSourceTable[] = [
  'private_2025',
  'private_2026',
  'team_2026',
  'private_2027',
  'team_2027',
]

/** Each active source resolves its db id from exactly one env key. */
const DATABASE_ID_ENV_KEYS: Record<NotionRagSourceTable, string> = {
  private_2025: 'NOTION_PRIVATE_2025_DATABASE_ID',
  private_2026: 'NOTION_PRIVATE_2026_DATABASE_ID',
  team_2026: 'NOTION_TEAM_2026_DATABASE_ID',
  private_2027: 'NOTION_PRIVATE_2027_DATABASE_ID',
  team_2027: 'NOTION_TEAM_2027_DATABASE_ID',
}

export interface NotionRagConfigIssue {
  code: 'unknown_active_source' | 'missing_database_id'
  /** Human-safe; carries the source label only — never a token / db id / url. */
  message: string
  /** Raw token for unknown sources; the enum value for missing ids. */
  source: string
}

export interface NotionRagConfigResolution {
  config: NotionRagConfig
  issues: NotionRagConfigIssue[]
}

function isKnownSource(token: string): token is NotionRagSourceTable {
  return (KNOWN_SOURCES as readonly string[]).includes(token)
}

/**
 * Normalise a configured Notion database id into the bare 32-hex id the API
 * accepts. Tolerates every form an operator might paste:
 *   - bare 32-hex id                              → unchanged (lowercased)
 *   - dashed UUID (8-4-4-4-12)                    → dashes stripped
 *   - full Notion database URL (with a name slug) → trailing 32-hex extracted
 *   - URL carrying a `?v=<viewId>` query          → query dropped first, so the
 *     view id can never be mistaken for the database id
 *
 * Strategy: drop any query/fragment, keep only hex characters, and take the LAST
 * 32 — the database id always trails the path (a name slug may contribute stray
 * hex letters, but the real id sits at the very end). Fewer than 32 hex chars ⇒
 * unparseable ⇒ '' (the caller reports it as `missing_database_id`). Returns no
 * part of the raw input on failure, so a leak-prone URL never reaches an issue.
 */
export function normaliseDatabaseId(raw: string): string {
  const pathOnly = raw.split(/[?#]/, 1)[0]
  const hex = pathOnly.replace(/[^0-9a-fA-F]/g, '')
  return hex.length >= 32 ? hex.slice(-32).toLowerCase() : ''
}

export function resolveNotionRagConfig(
  env: Record<string, string | undefined> = process.env
): NotionRagConfigResolution {
  const enabled = (env.AI_AGENT_NOTION_RAG_ENABLED ?? '').trim() === 'true'

  // Disabled gate short-circuits FIRST — no source/id parsing at all.
  if (!enabled) {
    return {
      config: { enabled: false, activeSources: [], databaseIds: {} },
      issues: [],
    }
  }

  const issues: NotionRagConfigIssue[] = []

  // Explicit active source list: trim + dedupe, preserve first-seen order.
  const seen = new Set<string>()
  const activeSources: NotionRagSourceTable[] = []
  for (const token of (env.AI_AGENT_NOTION_RAG_ACTIVE_SOURCES ?? '').split(',')) {
    const name = token.trim()
    if (name === '' || seen.has(name)) continue
    seen.add(name)

    if (isKnownSource(name)) {
      activeSources.push(name)
    } else {
      issues.push({
        code: 'unknown_active_source',
        message: `Unknown Notion RAG active source: ${name}`,
        source: name,
      })
    }
  }

  // Resolve db ids only for known active sources. A missing id is reported but
  // the source stays active, so buildNotionRagIndex returns missing_database_id.
  const databaseIds: Partial<Record<NotionRagSourceTable, string>> = {}
  for (const source of activeSources) {
    const raw = (env[DATABASE_ID_ENV_KEYS[source]] ?? '').trim()
    // An empty OR unparseable value (e.g. a URL with no extractable id) both
    // collapse to '' → reported as missing, so the loader's structured error
    // still fires. The issue message carries only the source label, never `raw`.
    const value = normaliseDatabaseId(raw)
    if (value === '') {
      issues.push({
        code: 'missing_database_id',
        message: `Missing database id for active source: ${source}`,
        source,
      })
      continue
    }
    databaseIds[source] = value
  }

  return {
    config: { enabled: true, activeSources, databaseIds },
    issues,
  }
}
