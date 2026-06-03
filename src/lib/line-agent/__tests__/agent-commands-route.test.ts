/**
 * agent-commands-route.test.ts
 *
 * Route-level tests for POST /api/agent/commands.
 *
 * Covers:
 *   1. Bad auth → 401 (unchanged).
 *   2. Bad body / parse failure → 400 (unchanged).
 *   3. Valid command, NO sendTarget → routed to a 'draft' decision.
 *   4. Valid command, explicit partner-group sendTarget → 'post_to_partner_group'.
 *
 * The route calls routeCommand with a safe default classifier (no API calls,
 * no keys), so these tests exercise the real bridge without network/LLM I/O.
 */

import { NextRequest } from 'next/server'
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/agent/commands/route'
import { createInitialCase } from '@/lib/line-agent/cases/case-state'
import { setStore } from '@/lib/line-agent/line/webhook-runtime'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'internal-secret-route-abc'

function commandRequest(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== undefined) headers['x-agent-secret'] = secret
  return new NextRequest('http://localhost/api/agent/commands', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const BASE_COMMAND = {
  actor: 'eric',
  sourceChannel: 'discord_private',
  commandText: 'summarise case for Wang',
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.AI_AGENT_INTERNAL_SECRET = SECRET
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/agent/commands', () => {
  it('returns 401 when the secret is missing or invalid', async () => {
    const res = await POST(commandRequest(BASE_COMMAND, 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const res = await POST(commandRequest('{not json', SECRET))
    expect(res.status).toBe(400)
  })

  it('returns 400 when the command fails validation', async () => {
    const res = await POST(commandRequest({ ...BASE_COMMAND, commandText: '' }, SECRET))
    expect(res.status).toBe(400)
  })

  it('routes a valid command with NO sendTarget to a draft decision', async () => {
    const res = await POST(commandRequest(BASE_COMMAND, SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('draft')
    expect(body.source).toBe('discord_private')
  })

  it('routes a valid command with explicit partner-group sendTarget to post_to_partner_group', async () => {
    const res = await POST(
      commandRequest(
        {
          ...BASE_COMMAND,
          sendTarget: { channel: 'line_partner_group', confirm: true },
        },
        SECRET
      )
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('post_to_partner_group')
    expect(body.source).toBe('discord_private')
  })

  it('routes list_cases through the bootstrapped store for CC/tmux testing', async () => {
    const store = new MemoryStore()
    await store.put({
      ...createInitialCase({
        caseId: 'CW-msg-live-001',
        lineUserId: 'U_live_customer',
        customerDisplayName: 'LINE-U_live',
        now: '2026-06-03T05:30:58.093Z',
      }),
      customerMessages: [
        {
          messageId: 'msg-live-001',
          text: '測試 webhook：2026/8/21',
          receivedAt: '2026-06-03T05:30:58.093Z',
          source: 'line_oa',
        },
      ],
    })
    setStore(store)

    const res = await POST(
      commandRequest(
        {
          actor: 'eric',
          sourceChannel: 'discord_private',
          commandText: '列出最近未處理客人',
        },
        SECRET
      )
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('list_cases')
    expect(body.handlerResult.meta.cases[0]).toMatchObject({
      caseId: 'CW-msg-live-001',
      latestCustomerMessageText: '測試 webhook：2026/8/21',
    })
  })
})
