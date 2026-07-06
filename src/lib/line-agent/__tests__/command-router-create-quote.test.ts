/**
 * command-router-create-quote.test.ts
 *
 * End-to-end routing tests for the Phase C (dry-run) quote path:
 *   DC explicit "create quote" command → router → createQuote (dry-run only).
 *
 * Hard contracts under test (Task 10, Scope A — DC chose option A):
 *  Q1  DC explicit create-quote dry-run command → routes to createQuote and
 *      returns the dry-run draft payload (+ non-official would-be URL).
 *  Q2  validation 'blocked' severity → NO draft / NO would-be URL (report only).
 *  Q3  partner-group source can NEVER trigger the quote write/dev action → DENIED.
 *  Q4  the dry-run writer ALWAYS reports written:false (no Sanity document).
 *
 * No real LLM, no Sanity client, no write token. The parser is frozen — these
 * tests reuse the existing quote/itinerary fixtures and add NO golden cases.
 *
 * TDD: written BEFORE the router create-quote wiring exists.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  routeCommand,
  type RouterInput,
  type RouterDecision,
} from '@/lib/line-agent/commands/router'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { OperatorCommand } from '@/lib/line-agent/operator/operator-command'
import type {
  LlmIntentClassifier,
  CommandIntent,
} from '@/lib/line-agent/commands/intent'

// ---------------------------------------------------------------------------
// Fixture helpers (same convention as create-quote.test.ts)
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(__dirname, '../quote/fixtures')

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8')
}

function loadNamedFixture(filename: string, name: string): string {
  const raw = loadFixture(filename)
  const marker = `===FIXTURE:${name}===`
  const startIdx = raw.indexOf(marker)
  if (startIdx === -1) throw new Error(`Fixture "${name}" not found in ${filename}`)
  const afterMarker = raw.slice(startIdx + marker.length)
  const nextMarker = afterMarker.indexOf('===FIXTURE:')
  return nextMarker === -1 ? afterMarker.trim() : afterMarker.slice(0, nextMarker).trim()
}

const CLEAN_ITINERARY = () => loadFixture('chiang-mai-5d4n.txt')
const CLEAN_QUOTE = () => loadFixture('chiang-mai-quote-examples.txt')
const BLOCKED_QUOTE = () => loadNamedFixture('messy-quote-examples.txt', 'math-error')

const CASE_ID = 'CW-0601-001'

const QUOTE_PAYLOAD = () => ({
  itineraryText: CLEAN_ITINERARY(),
  quoteText: CLEAN_QUOTE(),
  origin: 'https://chiangway-travel.com',
  timestamp: '2026-06-02T04:00:00.000Z',
  year: 2026,
})

// ---------------------------------------------------------------------------
// Stub LLM classifiers — the create-quote intent is injected via the seam so
// these tests are decoupled from the exact keyword used to detect the command.
// ---------------------------------------------------------------------------

const createQuoteStub: LlmIntentClassifier = {
  classify: async (): Promise<CommandIntent> => ({
    action: 'create_quote' as CommandIntent['action'],
    confidence: 'high',
    source: 'llm',
  }),
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeDcCommand(overrides: Partial<OperatorCommand> = {}): OperatorCommand {
  return {
    actor: 'eric',
    sourceChannel: 'discord_private',
    commandText: 'cc 建立報價 dry-run',
    caseId: CASE_ID,
    ...overrides,
  }
}

function makePartnerGroupEvent(
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: '幫我建立報價',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Q1: DC explicit create-quote dry-run command → routes to createQuote
// ---------------------------------------------------------------------------

describe('Q1 — DC create-quote command routes to createQuote (dry-run draft)', () => {
  it('returns a create_quote_dryrun decision carrying the dry-run draft payload', async () => {
    const input: RouterInput = {
      command: makeDcCommand(),
      llmClassifier: createQuoteStub,
      quoteDryRun: QUOTE_PAYLOAD(),
    }

    const decision: RouterDecision = await routeCommand(input)

    expect(decision.action).toBe('create_quote_dryrun')
    expect(decision.source).toBe('discord_private')
    expect(decision.denied).toBeFalsy()

    const result = decision.quoteDryRunResult
    expect(result).toBeDefined()
    expect(result?.status).toBe('ok')
    expect(result?.draft).not.toBeNull()
    // DRAFT-<caseId> slug — never a real 8-char sendable slug.
    expect(result?.draft?.publicSlug).toBe(`DRAFT-${CASE_ID}`)
    // The would-be URL is ALWAYS a non-official preview in this phase.
    expect(result?.wouldBeUrl).not.toBeNull()
    expect(result?.wouldBeUrl?.isOfficial).toBe(false)
    expect(result?.wouldBeUrl?.wouldBeUrl).toContain(`/quote/DRAFT-${CASE_ID}`)
  })
})

// ---------------------------------------------------------------------------
// Q2: blocked severity → no draft / no would-be URL (report only)
// ---------------------------------------------------------------------------

describe('Q2 — blocked validation produces no draft and no would-be URL', () => {
  it('routes a blocked quote to a report-only dry-run result', async () => {
    const input: RouterInput = {
      command: makeDcCommand(),
      llmClassifier: createQuoteStub,
      quoteDryRun: { ...QUOTE_PAYLOAD(), quoteText: BLOCKED_QUOTE() },
    }

    const decision = await routeCommand(input)

    expect(decision.action).toBe('create_quote_dryrun')
    const result = decision.quoteDryRunResult
    expect(result?.status).toBe('blocked')
    // A blocked report MUST NOT yield a draft or a (would-be) URL.
    expect(result?.draft).toBeNull()
    expect(result?.wouldBeUrl).toBeNull()
    // The validation report itself is still returned.
    expect(result?.report?.severity).toBe('blocked')
  })
})

// ---------------------------------------------------------------------------
// Q3: partner-group source can NEVER trigger the quote write/dev action
// ---------------------------------------------------------------------------

describe('Q3 — partner group cannot trigger a quote write/dev action', () => {
  it('DENIES a create_quote intent originating from line_partner_group', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent(),
      llmClassifier: createQuoteStub,
    }

    const decision = await routeCommand(input)

    expect(decision.denied).toBe(true)
    expect(decision.denialReason).toBeDefined()
    expect(decision.action).not.toBe('create_quote_dryrun')
  })
})

// ---------------------------------------------------------------------------
// Q4: dry-run writer ALWAYS reports written:false
// ---------------------------------------------------------------------------

describe('Q4 — dry-run writer never reports a write', () => {
  it('routes through the dry-run writer (writeResult.written === false)', async () => {
    const input: RouterInput = {
      command: makeDcCommand(),
      llmClassifier: createQuoteStub,
      quoteDryRun: QUOTE_PAYLOAD(),
    }

    const decision = await routeCommand(input)

    const result = decision.quoteDryRunResult
    expect(result?.writeResult).not.toBeNull()
    expect(result?.writeResult?.written).toBe(false)
  })
})
