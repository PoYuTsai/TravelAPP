import { describe, expect, it } from 'vitest'
import { movePhotoByKey } from '../photoOrdering'

describe('pricing photo ordering', () => {
  it('moves the dragged photo before the dropped photo', () => {
    const photos = [{ _key: 'a' }, { _key: 'b' }, { _key: 'c' }]

    expect(movePhotoByKey(photos, 'c', 'a').map((photo) => photo._key)).toEqual(['c', 'a', 'b'])
  })

  it('keeps the order when either key cannot be found', () => {
    const photos = [{ _key: 'a' }, { _key: 'b' }, { _key: 'c' }]

    expect(movePhotoByKey(photos, 'x', 'a').map((photo) => photo._key)).toEqual(['a', 'b', 'c'])
    expect(movePhotoByKey(photos, 'a', 'x').map((photo) => photo._key)).toEqual(['a', 'b', 'c'])
  })
})
