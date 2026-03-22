import { describe, expect, it } from 'vitest'
import { schemaTypes } from '@/sanity/schemas'

describe('line assistant schema registration', () => {
  it('exports the new line assistant schemas from the schema index', () => {
    expect(schemaTypes.some((schema) => schema.name === 'learningConversation')).toBe(true)
    expect(schemaTypes.some((schema) => schema.name === 'promptVersion')).toBe(true)
    expect(schemaTypes.some((schema) => schema.name === 'itineraryTemplate')).toBe(true)
  })
})
