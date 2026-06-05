/**
 * Notion SDK page envelope → NotionPageFixture flattener (fixture/mock-only).
 *
 * The Notion REST/SDK API returns every property as a typed object, e.g.
 *   { type: 'date', date: { start, end } } / { type: 'select', select: { name } }.
 * This module is the SINGLE place that flattens that verbose envelope into the
 * minimal NotionPageFixture shape (plain string | number | boolean | array),
 * so the read adapter (notion-rag-adapter.ts) only ever sees plain values and
 * stays SDK-agnostic and unit-testable without the network.
 *
 * NO real Notion API call lives here — callers hand in an already-fetched page
 * object (or a mock of the same shape).
 *
 * Two leak guards, by construction:
 *   - TYPE whitelist: only the eight supported property types are flattened;
 *     people / relation / rollup / formula / files… are dropped before they can
 *     carry PII or cross-database references into the fixture.
 *   - We read ONLY `properties`; the page-level Notion link (`page.url`) is never
 *     touched, so it cannot reach any partner-safe path.
 */

import type { NotionPageFixture } from './types'

// --- minimal structural view of a Notion SDK page (only what we read) --------

interface NotionRichTextItem {
  plain_text: string
}

/**
 * Discriminated by `type`. The trailing index signature lets an unsupported
 * type (people/relation/rollup/…) flow in and be dropped by the whitelist.
 */
export type NotionApiProperty =
  | { type: 'title'; title: NotionRichTextItem[] }
  | { type: 'rich_text'; rich_text: NotionRichTextItem[] }
  | { type: 'number'; number: number | null }
  | { type: 'date'; date: { start: string; end?: string | null } | null }
  | { type: 'select'; select: { name: string } | null }
  | { type: 'multi_select'; multi_select: { name: string }[] }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'url'; url: string | null }
  | { type: string; [key: string]: unknown }

export interface NotionApiPage {
  id: string
  /** Page-level Notion link — intentionally never read into the fixture. */
  url?: string
  parent?: { type?: string; database_id?: string }
  properties: Record<string, NotionApiProperty>
}

// --- per-type flattening -----------------------------------------------------

function joinPlainText(items: NotionRichTextItem[] | undefined): string | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined
  const joined = items.map((t) => t?.plain_text ?? '').join('')
  return joined.length > 0 ? joined : undefined
}

/** Returns the plain value, or `undefined` to signal "skip this property". */
function flattenProperty(prop: NotionApiProperty): unknown {
  switch (prop.type) {
    case 'title':
      return joinPlainText((prop as { title: NotionRichTextItem[] }).title)
    case 'rich_text':
      return joinPlainText((prop as { rich_text: NotionRichTextItem[] }).rich_text)
    case 'number': {
      const n = (prop as { number: number | null }).number
      return typeof n === 'number' && !Number.isNaN(n) ? n : undefined
    }
    case 'date': {
      const date = (prop as { date: { start: string; end?: string | null } | null }).date
      if (!date?.start) return undefined
      return date.end ? `${date.start}~${date.end}` : date.start
    }
    case 'select': {
      const name = (prop as { select: { name: string } | null }).select?.name
      return name && name.length > 0 ? name : undefined
    }
    case 'multi_select': {
      const names = (prop as { multi_select: { name: string }[] }).multi_select
        ?.map((o) => o?.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
      return names && names.length > 0 ? names : undefined
    }
    case 'checkbox': {
      const v = (prop as { checkbox: boolean }).checkbox
      return typeof v === 'boolean' ? v : undefined
    }
    case 'url': {
      const url = (prop as { url: string | null }).url
      return url && url.length > 0 ? url : undefined
    }
    default:
      // Unsupported type — dropped by the whitelist (never enters the fixture).
      return undefined
  }
}

/**
 * Flatten one Notion SDK page object into the minimal NotionPageFixture shape.
 * Empty / null / unsupported properties are omitted so the fixture has no empty
 * slots. Feed the result straight into notionPageToRagRecord().
 */
export function flattenNotionPage(page: NotionApiPage): NotionPageFixture {
  const properties: Record<string, unknown> = {}
  for (const [name, prop] of Object.entries(page.properties)) {
    const value = flattenProperty(prop)
    if (value !== undefined) properties[name] = value
  }

  return {
    id: page.id,
    databaseId: page.parent?.database_id ?? '',
    properties,
  }
}
