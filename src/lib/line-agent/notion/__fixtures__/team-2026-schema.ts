/**
 * Fixture schema for the Notion 2026 team-collaboration database.
 *
 * This is the list of property NAMES our fixtures use. The real 2026 DB schema
 * is NOT yet imported — these names are placeholders that alias to canonical
 * fields via FIELD_ALIASES (see field-policy.ts). When Eric supplies the real
 * schema, extend FIELD_ALIASES; do NOT hard-code the real names here as the
 * single source of truth.
 *
 * Grouped only for readability — the order/grouping carries no meaning.
 */

export const TEAM_2026_PROPERTY_NAMES = [
  // shareable trip structure (read_only)
  '日期',
  '天數',
  '人數',
  '大人',
  '小孩',
  '小孩年齡',
  '城市區域',
  '行程類型',
  '行程摘要',
  '景點餐廳',
  '車導配置',
  '狀態',
  '特殊需求',
  // operator-only operational context
  '內部備註',
  '內部標籤',
  '報價總額',
  // private — never reaches any output
  '成本',
  '分潤',
  '客人姓名',
] as const

export type Team2026PropertyName = (typeof TEAM_2026_PROPERTY_NAMES)[number]

/** A stable, non-secret label for this database (used in read audit). */
export const TEAM_2026_DATABASE_LABEL = 'team-2026'

/** Fixture database id — fixtures pretend to live in this database. */
export const TEAM_2026_FIXTURE_DATABASE_ID = 'db_team_2026_fixture'
