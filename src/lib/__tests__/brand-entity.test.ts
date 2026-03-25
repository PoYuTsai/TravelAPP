import { describe, expect, it } from 'vitest'
import { metadata as carCharterMetadata } from '@/app/services/car-charter/page'
import { metadata as homeMetadata } from '@/app/page'
import {
  CAR_CHARTER_ENTITY_SENTENCE,
  HOMEPAGE_ENTITY_SENTENCE,
  ensureEntitySentence,
} from '@/lib/brand-entity'

describe('brand entity copy helpers', () => {
  it('appends the entity sentence when the brand and service terms are missing', () => {
    expect(
      ensureEntitySentence('提供在地中文協助與親子行程安排', HOMEPAGE_ENTITY_SENTENCE, [
        '清微旅行',
        '清邁親子包車',
      ])
    ).toContain(HOMEPAGE_ENTITY_SENTENCE)
  })

  it('keeps the original copy when the brand and service terms already exist', () => {
    const copy =
      '清微旅行 Chiangway Travel 專做清邁親子包車，也提供在地家庭視角的親子旅遊規劃。'

    expect(
      ensureEntitySentence(copy, CAR_CHARTER_ENTITY_SENTENCE, ['清微旅行', '清邁親子包車'])
    ).toBe(copy)
  })

  it('keeps both default entity sentences aligned to the target query', () => {
    expect(HOMEPAGE_ENTITY_SENTENCE).toContain('清微旅行')
    expect(HOMEPAGE_ENTITY_SENTENCE).toContain('清邁親子包車')
    expect(CAR_CHARTER_ENTITY_SENTENCE).toContain('清微旅行')
    expect(CAR_CHARTER_ENTITY_SENTENCE).toContain('清邁親子包車')
  })

  it('keeps homepage and car-charter metadata aligned to the brand and service query', () => {
    expect(homeMetadata.description).toContain('清微旅行')
    expect(homeMetadata.description).toContain('清邁親子包車')
    expect(carCharterMetadata.description).toContain('清微旅行')
    expect(carCharterMetadata.description).toContain('清邁親子包車')
  })
})
