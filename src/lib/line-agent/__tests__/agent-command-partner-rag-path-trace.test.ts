/**
 * agent-command-partner-rag-path-trace.test.ts
 *
 * RED-first spec for the operator `partner-rag-path-trace` command wrapper in
 * scripts/agent-command.mjs. It runs the M3.6b OFFLINE private-group RAG path
 * tracer from the CLI: feed a simulated partner-group message, get a masked
 * PASS/FAIL trace of the four preconditions, the wiring, and the final path.
 *
 * The wrapper touches no LINE / Notion / LLM and flips no gate. A real `traceKit`
 * (the pure TS trace module) is injected here so the command logic is tested
 * without a dynamic import.
 */

import { describe, expect, test } from 'vitest'
import {
  parseAgentCommandArgs,
  runPartnerRagPathTraceCommand,
} from '../../../../scripts/agent-command.mjs'
import {
  tracePartnerRagPath,
  formatPartnerRagPathTrace,
} from '../partner-group/rag-path-trace'

const TRACE_KIT = { tracePartnerRagPath, formatPartnerRagPathTrace }
const FAKE_DB_ID = 'abcdef0123456789abcdef0123456789'
const FAKE_TOKEN = 'ntn_FAKE_secret_value_should_never_print'

describe('parseAgentCommandArgs — partner-rag-path-trace', () => {
  test('parses the command + free-text message', () => {
    const parsed = parseAgentCommandArgs([
      'partner-rag-path-trace',
      '幫我查內部案例：清邁親子',
    ])
    expect(parsed.commandText).toBe('partner-rag-path-trace')
    expect(parsed.query).toBe('幫我查內部案例：清邁親子')
  })

  test('accepts the slash-prefixed form', () => {
    const parsed = parseAgentCommandArgs(['/partner-rag-path-trace', 'RAG'])
    expect(parsed.commandText).toBe('partner-rag-path-trace')
  })
})

describe('runPartnerRagPathTraceCommand', () => {
  test('reports the live-bug case: partner draft gate off ⇒ fallback', async () => {
    const env = {
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      // AI_AGENT_PARTNER_RAG_DRAFT_ENABLED unset — the real bug
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
      NOTION_PRIVATE_2026_DATABASE_ID: FAKE_DB_ID,
      NOTION_TOKEN: FAKE_TOKEN,
    }
    const out = await runPartnerRagPathTraceCommand({
      env,
      query: '幫我查內部案例：清邁親子 大象 夜間動物園',
      traceKit: TRACE_KIT,
    })

    expect(out).toContain('fallback')
    expect(out).toMatch(/AI_AGENT_PARTNER_RAG_DRAFT_ENABLED[^\n]*disabled/)
    // Masked: the token / db id values never appear.
    expect(out).not.toContain(FAKE_TOKEN)
    expect(out).not.toContain(FAKE_DB_ID)
  })

  test('both gates on + wired ⇒ deterministic RAG composer path', async () => {
    const env = {
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
      NOTION_PRIVATE_2026_DATABASE_ID: FAKE_DB_ID,
      NOTION_TOKEN: FAKE_TOKEN,
    }
    const out = await runPartnerRagPathTraceCommand({
      env,
      query: '幫我查內部案例：清邁親子',
      traceKit: TRACE_KIT,
    })
    expect(out).toContain('deterministic RAG composer')
  })

  test('empty message still produces a trace (no_rag_intent)', async () => {
    const out = await runPartnerRagPathTraceCommand({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' },
      query: '',
      traceKit: TRACE_KIT,
    })
    expect(out).toContain('RAG intent 命中：✗ FAIL')
  })
})
