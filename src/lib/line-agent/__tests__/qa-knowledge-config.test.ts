import { describe, expect, it } from 'vitest'
import { resolveQaKnowledgeReadConfig } from '../partner-group/qa-knowledge-config'

const FULL = {
  QA_KNOWLEDGE_READ_ENABLED: 'true',
  NOTION_KNOWLEDGE_TOKEN: 'secret-token',
  NOTION_DISTILLED_QA_DB: 'abcdef1234abcdef1234abcdef123456',
}

describe('resolveQaKnowledgeReadConfig', () => {
  it('三件齊 ⇒ enabled＋token＋databaseId', () => {
    const config = resolveQaKnowledgeReadConfig(FULL)
    expect(config).toEqual({
      enabled: true,
      token: 'secret-token',
      databaseId: 'abcdef1234abcdef1234abcdef123456',
    })
  })

  it('閘未開（缺/false/空白）⇒ disabled 且不帶 reason', () => {
    expect(resolveQaKnowledgeReadConfig({})).toEqual({ enabled: false })
    expect(
      resolveQaKnowledgeReadConfig({ ...FULL, QA_KNOWLEDGE_READ_ENABLED: 'false' })
    ).toEqual({ enabled: false })
  })

  it('閘開但缺 token ⇒ disabled＋missing_knowledge_token', () => {
    expect(
      resolveQaKnowledgeReadConfig({ ...FULL, NOTION_KNOWLEDGE_TOKEN: ' ' })
    ).toEqual({ enabled: false, reason: 'missing_knowledge_token' })
  })

  it('閘開但缺 db id ⇒ disabled＋missing_database_id', () => {
    expect(
      resolveQaKnowledgeReadConfig({ ...FULL, NOTION_DISTILLED_QA_DB: '' })
    ).toEqual({ enabled: false, reason: 'missing_database_id' })
  })
})
