import { describe, expect, it, vi } from 'vitest'

import { savePricingExampleDocument } from '@/sanity/tools/pricing/sharedExampleMutations'

describe('savePricingExampleDocument', () => {
  it('updates an existing document with its loaded revision and leaves publicSlug untouched', async () => {
    const commit = vi.fn().mockResolvedValue({ _rev: 'next-rev' })
    const set = vi.fn().mockReturnValue({ commit })
    const ifRevisionId = vi.fn().mockReturnValue({ set })
    const patch = vi.fn().mockReturnValue({ ifRevisionId })
    const create = vi.fn()

    await savePricingExampleDocument({
      client: { patch, create },
      document: {
        _id: 'pricingExample.formal.quote-1',
        _type: 'pricingExample',
        name: '公開套餐',
        variant: 'formal',
        createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: '2026-07-11T01:00:00.000Z',
        payload: '{"exchangeRate":1}',
      },
      expectedRevision: 'loaded-rev',
      photos: [],
    })

    expect(patch).toHaveBeenCalledWith('pricingExample.formal.quote-1')
    expect(ifRevisionId).toHaveBeenCalledWith('loaded-rev')
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      name: '公開套餐',
      payload: '{"exchangeRate":1}',
      photos: [],
    }))
    expect(set.mock.calls[0][0]).not.toHaveProperty('publicSlug')
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a new document instead of replacing a possibly existing one', async () => {
    const create = vi.fn().mockResolvedValue({ _rev: 'created-rev' })
    const patch = vi.fn()

    await savePricingExampleDocument({
      client: { patch, create },
      document: {
        _id: 'pricingExample.formal.quote-2',
        _type: 'pricingExample',
        name: '新報價',
        variant: 'formal',
        createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: '2026-07-11T00:00:00.000Z',
        payload: '{}',
      },
      photos: [],
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'pricingExample.formal.quote-2',
        photos: [],
      }),
      { returnDocuments: true }
    )
    expect(patch).not.toHaveBeenCalled()
  })
})
