import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN_PUBLIC_MATRICES = [
  'charter-price-chiang-mai-v2026-07-11-v2-preview.png',
  'charter-price-chiang-mai-v2026-07-11-v2.png',
  'charter-price-chiang-rai-v2026-07-11-v2-preview.png',
  'charter-price-chiang-rai-v2026-07-11-v2.png',
]

describe('public pricing exposure policy', () => {
  it('does not publish the people × region × guide matrix as static assets', () => {
    FORBIDDEN_PUBLIC_MATRICES.forEach((filename) => {
      expect(
        existsSync(resolve(process.cwd(), 'public', 'images', 'line', filename)),
        `${filename} must stay outside public/`,
      ).toBe(false)
    })
  })
})
