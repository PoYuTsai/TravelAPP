import { describe, expect, it } from 'vitest'
import {
  markDraftSent,
  supersedeDraft,
} from '@/lib/line-assistant/domain/draft-lifecycle'
import type { ConversationDraft } from '@/lib/line-assistant/types'

function createDraft(overrides: Partial<ConversationDraft> = {}): ConversationDraft {
  return {
    id: 'draft-1',
    conversationId: 'conv-1',
    createdAt: '2026-03-22T00:00:00.000Z',
    createdFromEventId: 'evt-1',
    status: 'pending',
    originalDraft: '王大哥你好，我先幫你整理看看',
    ...overrides,
  }
}

describe('draft lifecycle', () => {
  it('marks a pending draft as superseded', () => {
    const next = supersedeDraft(createDraft())

    expect(next.status).toBe('superseded')
  })

  it('marks a sent draft as edited_then_sent when edited content exists', () => {
    const next = markDraftSent(
      createDraft({
        editedDraft: '王大哥你好，我先幫你整理 2 大 2 小的包車安排',
      }),
      {
        actionId: 'action-1',
        sentAt: '2026-03-22T02:00:00.000Z',
      }
    )

    expect(next.status).toBe('edited_then_sent')
    expect(next.actionId).toBe('action-1')
    expect(next.sentAt).toBe('2026-03-22T02:00:00.000Z')
  })
})
