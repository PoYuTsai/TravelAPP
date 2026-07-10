import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const seedSource = readFileSync(
  resolve(process.cwd(), 'scripts/setup-notion-replies.mjs'),
  'utf8'
)

describe('legacy Notion replies seed policy', () => {
  it('is manual-only and refuses an accidental live database rewrite', () => {
    expect(seedSource).toContain('LEGACY / MANUAL-ONLY')
    expect(seedSource).toContain('--confirm-empty-database')
    expect(seedSource).toContain('不得用來修正或覆寫既有 live Notion')
    expect(seedSource).toContain("/query")
    expect(seedSource).toContain('目標話術資料庫不是空白')

    const emptyCheck = seedSource.indexOf('await assertTargetDatabaseIsEmpty()')
    const schemaWrite = seedSource.indexOf('await updateDatabaseSchema()')
    const pageWrites = seedSource.indexOf('await addReplies()')
    expect(emptyCheck).toBeGreaterThan(-1)
    expect(emptyCheck).toBeLessThan(schemaWrite)
    expect(emptyCheck).toBeLessThan(pageWrites)
  })

  it('keeps Thai drivers standard and Chinese-speaking guides optional', () => {
    expect(seedSource).toContain('公開標準服務是泰國司機')
    expect(seedSource).toContain('中文導遊為選配')
    expect(seedSource).not.toMatch(/導遊\(司機\).*都會用中文/)
  })

  it('keeps travel insurance optional at THB 100 per person per trip', () => {
    expect(seedSource).toContain('旅遊保險為自由選配，THB 100／人／趟')
    expect(seedSource).not.toContain('外地住宿補貼、泰國旅遊保險')
  })

  it('uses canonical charter hours, grace period, and per-car overtime', () => {
    expect(seedSource).toContain('清邁 10 小時')
    expect(seedSource).toContain('清萊／金三角 12 小時')
    expect(seedSource).toContain('基本用車時間用完後，另有 30 分鐘彈性')
    expect(seedSource).toContain('THB 300／小時／車')
    expect(seedSource).toContain('導遊不另收超時費')
    expect(seedSource).not.toContain('200/hr')
  })
})
