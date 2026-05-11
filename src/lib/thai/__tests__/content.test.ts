import { describe, expect, it } from 'vitest'
import {
  childCategories,
  getStarterPhrases,
  parentCategories,
  thaiPhrases,
} from '../phrases'

describe('Thai phrase content', () => {
  it('keeps parent and child category ids unique', () => {
    const parentIds = parentCategories.map((category) => category.id)
    const childIds = childCategories.map((category) => category.id)

    expect(new Set(parentIds).size).toBe(parentIds.length)
    expect(new Set(childIds).size).toBe(childIds.length)
  })

  it('links every child category and phrase to an existing parent category', () => {
    const parentIds = new Set(parentCategories.map((category) => category.id))
    const childById = new Map(childCategories.map((category) => [category.id, category]))

    childCategories.forEach((category) => {
      expect(parentIds.has(category.parentId)).toBe(true)
    })

    thaiPhrases.forEach((phrase) => {
      expect(parentIds.has(phrase.parentId)).toBe(true)
      expect(childById.get(phrase.childId)?.parentId).toBe(phrase.parentId)
    })
  })

  it('ships the first MVP with 75 phrase records and at least five starter phrases', () => {
    expect(thaiPhrases).toHaveLength(75)
    expect(getStarterPhrases()).toHaveLength(5)
  })

  it('keeps phrase ids unique and aligned with audio paths', () => {
    const phraseIds = thaiPhrases.map((phrase) => phrase.id)

    expect(new Set(phraseIds).size).toBe(phraseIds.length)

    thaiPhrases.forEach((phrase) => {
      expect(phrase.audio.natural).toBe(
        `/audio/thai/${phrase.parentId}/${phrase.childId}/${phrase.id}-natural.mp3`
      )
      expect(phrase.audio.slow).toBe(
        `/audio/thai/${phrase.parentId}/${phrase.childId}/${phrase.id}-slow.mp3`
      )
    })
  })
})
