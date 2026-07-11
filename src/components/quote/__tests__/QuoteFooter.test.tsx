import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('QuoteFooter 套餐詢價提示', () => {
  it('請客人提供人數與兒童年齡，不要求未包含的房型', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/quote/QuoteFooter.tsx'),
      'utf8'
    )

    expect(source).toContain('人數、兒童年齡與實際需求')
    expect(source).not.toContain('人數、房型與實際需求')
  })
})
