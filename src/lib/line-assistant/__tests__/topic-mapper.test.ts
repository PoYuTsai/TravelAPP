import { describe, expect, it } from 'vitest'
import { createMemoryTopicMapper } from '@/lib/line-assistant/telegram/topic-mapper'

describe('createMemoryTopicMapper', () => {
  it('creates one topic per line user id and reuses it for later messages', async () => {
    const mapper = createMemoryTopicMapper()

    const first = await mapper.ensureTopicForLineUser('user-1', '王先生')
    const second = await mapper.ensureTopicForLineUser('user-1', '王先生')
    const third = await mapper.ensureTopicForLineUser('user-2', '李小姐')

    expect(first).toBe(second)
    expect(third).not.toBe(first)
  })
})
