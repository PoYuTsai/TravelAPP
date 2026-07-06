/**
 * notion-fixtures.smoke.test.ts
 *
 * Minimal smoke test for the Notion read adapter scaffold: confirms the §1
 * types and the fixture pages import cleanly and have the expected minimal
 * shape. This gives vitest something green to run from Task 1, keeping the
 * TDD rhythm before the policy/mapper/search logic lands.
 */

import { describe, it, expect } from 'vitest'
import type { NotionPageFixture } from '../notion/types'
import { FIXTURE_PAGES } from '../notion/__fixtures__/pages'
import {
  TEAM_2026_PROPERTY_NAMES,
  TEAM_2026_FIXTURE_DATABASE_ID,
} from '../notion/__fixtures__/team-2026-schema'

describe('notion read fixtures (smoke)', () => {
  it('ships at least 4 fixture pages', () => {
    expect(FIXTURE_PAGES.length).toBeGreaterThanOrEqual(4)
  })

  it('every fixture page has id / databaseId / properties', () => {
    for (const page of FIXTURE_PAGES) {
      const p: NotionPageFixture = page
      expect(typeof p.id).toBe('string')
      expect(p.id.length).toBeGreaterThan(0)
      expect(p.databaseId).toBe(TEAM_2026_FIXTURE_DATABASE_ID)
      expect(p.properties).toBeTypeOf('object')
      expect(Object.keys(p.properties).length).toBeGreaterThan(0)
    }
  })

  it('includes at least one case carrying sensitive cost/profit fields', () => {
    const withSensitive = FIXTURE_PAGES.filter(
      (p) => '成本' in p.properties && '分潤' in p.properties
    )
    expect(withSensitive.length).toBeGreaterThanOrEqual(1)
  })

  it('schema property-name list is non-empty and covers sensitive fields', () => {
    expect(TEAM_2026_PROPERTY_NAMES.length).toBeGreaterThan(0)
    expect(TEAM_2026_PROPERTY_NAMES).toContain('成本')
    expect(TEAM_2026_PROPERTY_NAMES).toContain('分潤')
  })
})
