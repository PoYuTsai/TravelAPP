import { describe, expect, it, vi } from 'vitest'
import {
  createQaKnowledgeSource,
  QA_KNOWLEDGE_HEADER,
  type QaKnowledgeSdkClient,
} from '../partner-group/qa-knowledge-source'

const page = (q: string, a: string, status = '已批准') => ({
  properties: {
    問題: { title: [{ plain_text: q }] },
    答案: { rich_text: [{ plain_text: a }] },
    狀態: { select: { name: status } },
  },
})

function fakeSdk(results: unknown[], hasMore = false): QaKnowledgeSdkClient {
  return {
    databases: {
      retrieve: vi.fn(async () => ({ data_sources: [{ id: 'ds-1' }] })),
    },
    dataSources: {
      query: vi.fn(async () => ({ results, has_more: hasMore })),
    },
  }
}

const make = (
  sdk: QaKnowledgeSdkClient,
  extra: Partial<{ ttlMs: number; now: () => number; log: any }> = {}
) =>
  createQaKnowledgeSource({
    sdk,
    databaseId: 'db-1',
    ttlMs: extra.ttlMs ?? 1000,
    now: extra.now ?? (() => 0),
    log: extra.log,
  })

describe('createQaKnowledgeSource', () => {
  it('撈已批准 QA → 知識區塊（header＋Q/A 條目）', async () => {
    const source = make(fakeSdk([page('兩大兩小坐小轎車會不會擠', '會擠，建議 Toyota Commuter 10 人座 Van')]))
    const text = await source()
    expect(text).toContain(QA_KNOWLEDGE_HEADER)
    expect(text).toContain('Q：兩大兩小坐小轎車會不會擠')
    expect(text).toContain('A：會擠，建議 Toyota Commuter 10 人座 Van')
  })

  it('過濾非已批准（防衛性 client-side filter）與空 Q/A', async () => {
    const source = make(
      fakeSdk([
        page('好問題', '好答案'),
        page('未批准的', '不該出現', '候選'),
        page('', '沒問題文字'),
      ])
    )
    const text = await source()
    expect(text).toContain('好問題')
    expect(text).not.toContain('不該出現')
    expect(text).not.toContain('沒問題文字')
  })

  it('0 條已批准 ⇒ null（不注入空區塊）', async () => {
    const source = make(fakeSdk([page('x', 'y', '候選')]))
    expect(await source()).toBeNull()
  })

  it('超過 cap 30 ⇒ 截斷照用＋log qa_knowledge_truncated', async () => {
    const log = vi.fn()
    const many = Array.from({ length: 35 }, (_, i) => page(`Q${i}`, `A${i}`))
    const source = make(fakeSdk(many), { log })
    const text = await source()
    expect(text).toContain('Q：Q29')
    expect(text).not.toContain('Q：Q30')
    expect(log).toHaveBeenCalledWith(
      'qa_knowledge_truncated',
      expect.objectContaining({ total: 35, kept: 30 })
    )
  })

  it('Notion 錯誤 ⇒ null＋log qa_knowledge_unavailable（fail-open，不上拋）', async () => {
    const log = vi.fn()
    const sdk = fakeSdk([])
    ;(sdk.dataSources.query as any).mockRejectedValue(
      new Error('secret-token leaked notion.so/db-1')
    )
    const source = make(sdk, { log })
    expect(await source()).toBeNull()
    expect(log).toHaveBeenCalledWith('qa_knowledge_unavailable', expect.any(Object))
  })

  it('TTL 快取：窗內只 query 一次；過期重撈', async () => {
    let t = 0
    const sdk = fakeSdk([page('q', 'a')])
    const source = make(sdk, { now: () => t, ttlMs: 1000 })
    await source()
    t = 999
    await source()
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(1)
    t = 1000
    await source()
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(2)
  })

  it('single-flight：併發只打一次 Notion', async () => {
    const sdk = fakeSdk([page('q', 'a')])
    const source = make(sdk)
    await Promise.all([source(), source()])
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(1)
  })

  it('錯誤不快取：第一次失敗回 null，下一則訊息重試成功', async () => {
    const sdk = fakeSdk([page('q', 'a')])
    ;(sdk.dataSources.query as any).mockRejectedValueOnce(new Error('boom'))
    const source = make(sdk)
    expect(await source()).toBeNull()
    expect(await source()).toContain('Q：q')
  })

  it('併發呼叫 join 同一個失敗的 load ⇒ 兩者都 fail-open 回 null，之後仍可重試', async () => {
    const sdk = fakeSdk([page('q', 'a')])
    ;(sdk.dataSources.query as any).mockRejectedValueOnce(new Error('boom'))
    const source = make(sdk)
    const [a, b] = await Promise.all([source(), source()])
    expect(a).toBeNull()
    expect(b).toBeNull()
    expect(sdk.dataSources.query).toHaveBeenCalledTimes(1)
    expect(await source()).toContain('Q：q')
  })
})
