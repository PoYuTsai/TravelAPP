/**
 * operator-command.test.ts
 *
 * Tests for parsing / validating raw operator command payloads into typed
 * OperatorCommand objects.
 *
 * KEY safety invariant: a command that carries NO explicit sendTarget must have
 * sendTarget === undefined — it is never treated as authorization to post to LINE.
 */

import { describe, it, expect } from 'vitest'
import { parseOperatorCommand } from '@/lib/line-agent/operator/operator-command'
import type { OperatorCommand, OperatorCommandInput } from '@/lib/line-agent/operator/operator-command'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WELL_FORMED_BASE: OperatorCommandInput = {
  actor: 'eric',
  sourceChannel: 'discord_private',
  commandText: 'summarise case for Wang',
}

const WITH_CASE_ID: OperatorCommandInput = {
  ...WELL_FORMED_BASE,
  caseId: 'CASE-20260601-001',
}

const WITH_SEND_TARGET: OperatorCommandInput = {
  ...WELL_FORMED_BASE,
  sendTarget: { channel: 'line_partner_group', confirm: true },
}

const WITH_SEND_TARGET_NO_CONFIRM: OperatorCommandInput = {
  ...WELL_FORMED_BASE,
  sendTarget: { channel: 'line_partner_group', confirm: false },
}

// ---------------------------------------------------------------------------
// Parsing happy-path tests
// ---------------------------------------------------------------------------

describe('parseOperatorCommand — happy path', () => {
  it('parses a minimal well-formed command', () => {
    const result = parseOperatorCommand(WELL_FORMED_BASE)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const cmd: OperatorCommand = result.command
      expect(cmd.actor).toBe('eric')
      expect(cmd.sourceChannel).toBe('discord_private')
      expect(cmd.commandText).toBe('summarise case for Wang')
    }
  })

  it('parses a command with caseId', () => {
    const result = parseOperatorCommand(WITH_CASE_ID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.command.caseId).toBe('CASE-20260601-001')
    }
  })

  it('parses a command from internal_worker sourceChannel', () => {
    const input: OperatorCommandInput = {
      ...WELL_FORMED_BASE,
      sourceChannel: 'internal_worker',
    }
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.command.sourceChannel).toBe('internal_worker')
    }
  })
})

// ---------------------------------------------------------------------------
// DEFAULT-SAFE INVARIANT: no sendTarget === no LINE posting authorization
// ---------------------------------------------------------------------------

describe('parseOperatorCommand — default-safe sendTarget absence', () => {
  it(
    'a command with NO sendTarget has sendTarget === undefined — never defaults to posting to LINE',
    () => {
      const result = parseOperatorCommand(WELL_FORMED_BASE)
      expect(result.ok).toBe(true)
      if (result.ok) {
        // The critical invariant: undefined means "prepare/draft only", never post.
        expect(result.command.sendTarget).toBeUndefined()
      }
    }
  )

  it('omitting sendTarget entirely also yields undefined sendTarget', () => {
    // Explicit omission — not setting the key at all
    const input: OperatorCommandInput = {
      actor: 'eric',
      sourceChannel: 'discord_private',
      commandText: 'help me review this itinerary',
      // sendTarget intentionally absent
    }
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.command.sendTarget).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// Explicit sendTarget is preserved when provided
// ---------------------------------------------------------------------------

describe('parseOperatorCommand — explicit sendTarget', () => {
  it('retains sendTarget with confirm:true when provided', () => {
    const result = parseOperatorCommand(WITH_SEND_TARGET)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.command.sendTarget).toEqual({
        channel: 'line_partner_group',
        confirm: true,
      })
    }
  })

  it('retains sendTarget with confirm:false when provided', () => {
    const result = parseOperatorCommand(WITH_SEND_TARGET_NO_CONFIRM)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.command.sendTarget).toEqual({
        channel: 'line_partner_group',
        confirm: false,
      })
    }
  })
})

// ---------------------------------------------------------------------------
// Rejection / malformed input
// ---------------------------------------------------------------------------

describe('parseOperatorCommand — rejection', () => {
  it('rejects when actor is missing', () => {
    const input = { ...WELL_FORMED_BASE, actor: '' }
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INVALID_COMMAND')
      expect(result.message).toMatch(/actor/)
    }
  })

  it('rejects when commandText is empty', () => {
    const input = { ...WELL_FORMED_BASE, commandText: '' }
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INVALID_COMMAND')
    }
  })

  it('rejects when commandText is blank whitespace', () => {
    const input = { ...WELL_FORMED_BASE, commandText: '   ' }
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(false)
  })

  it('rejects when sourceChannel is an invalid value', () => {
    const input = { ...WELL_FORMED_BASE, sourceChannel: 'line_oa' as 'discord_private' }
    // line_oa is NOT a valid operator source channel
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INVALID_COMMAND')
      expect(result.message).toMatch(/sourceChannel/)
    }
  })

  it('rejects null/undefined input gracefully', () => {
    const result = parseOperatorCommand(null as unknown as OperatorCommandInput)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INVALID_COMMAND')
    }
  })

  it('rejects when sendTarget.channel is not a recognized destination', () => {
    const input: OperatorCommandInput = {
      ...WELL_FORMED_BASE,
      sendTarget: { channel: 'line_oa_customer' as 'line_partner_group', confirm: false },
    }
    const result = parseOperatorCommand(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('INVALID_COMMAND')
    }
  })
})
