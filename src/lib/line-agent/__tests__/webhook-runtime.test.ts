/**
 * Tests for the webhook runtime seams (tagged-reply plan Task 3).
 *
 * This batch covers ONLY the partner-group responder seam:
 *   - setPartnerGroupResponder injects a fake the default handler then uses
 *     when routing a partner-group tagged event through routeCommand.
 *   - the un-injected resolver lazily defaults to the safe stub (no API call).
 *
 * No reply client / no send is wired yet — that is Task 4. These tests assert
 * the responder is reached, not that anything is sent.
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  getEventHandler,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
} from '../line/webhook-runtime'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { PartnerGroupResponder } from '../partner-group/responder'

// Capture the pristine lazy default BEFORE any injection so afterEach can
// restore it — the seam is a module singleton and would otherwise leak.
const pristineResponder = getPartnerGroupResponder()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
})

function taggedPartnerGroupEvent(
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: '@bot 請幫我確認',
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
    replyToken: 'reply_token_xyz',
    ...overrides,
  }
}

describe('webhook-runtime partner-group responder seam', () => {
  it('routes a partner-group tagged event through the injected responder', async () => {
    let calls = 0
    const fake: PartnerGroupResponder = {
      async respond() {
        calls += 1
        return { text: 'FAKE-RESPONDER-TEXT', meta: { responder: 'llm' as const } }
      },
    }
    setPartnerGroupResponder(fake)

    await getEventHandler()(taggedPartnerGroupEvent(), new MemoryStore())

    expect(calls).toBe(1)
  })

  it('lazily defaults to the safe stub responder when none is injected', async () => {
    const result = await getPartnerGroupResponder().respond({
      event: taggedPartnerGroupEvent(),
      intent: { action: 'analyze', confidence: 'high', source: 'deterministic' },
      text: '@bot 請幫我確認',
    })
    expect(result.meta?.responder).toBe('stub')
  })
})
