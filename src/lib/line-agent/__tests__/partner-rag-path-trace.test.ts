/**
 * partner-rag-path-trace.test.ts
 *
 * RED-first spec for the M3.6b OFFLINE private-group RAG path tracer. Given a
 * simulated partner-group message + env, `tracePartnerRagPath` reports — without
 * touching LINE, Notion, an LLM, or any gate — exactly which of the four
 * `shouldUsePartnerRagDraft` preconditions hold, whether the answer source is
 * wireable (env presence only, NEVER a live verification), and which final path
 * the live dispatcher WOULD take:
 *   - deterministic RAG composer
 *   - fail-closed unavailable reply (gate on but source not wireable)
 *   - free-form fallback responder (a precondition failed) + the reason
 *
 * The tracer REUSES the real decision functions (detectPartnerRagIntent,
 * shouldUsePartnerRagDraft, isPartnerRagDraftEnabled, resolveNotionRagConfig) so
 * the report can never drift from the runtime it diagnoses.
 *
 * `formatPartnerRagPathTrace` is masked by contract: it prints only
 * enabled/disabled/present/missing/PASS/FAIL labels — never an env VALUE, token,
 * db id, or Notion url.
 */

import { describe, expect, test } from 'vitest'
import {
  tracePartnerRagPath,
  formatPartnerRagPathTrace,
} from '../partner-group/rag-path-trace'

// A realistic 32-hex Notion db id shape — it must NEVER echo into the report.
const FAKE_DB_ID = 'abcdef0123456789abcdef0123456789'
const FAKE_TOKEN = 'ntn_FAKE_secret_value_should_never_print'

/** Env where both gates are on and the source is fully wireable. */
function fullyWiredEnv(): Record<string, string | undefined> {
  return {
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
    NOTION_PRIVATE_2026_DATABASE_ID: FAKE_DB_ID,
    NOTION_TOKEN: FAKE_TOKEN,
  }
}

const RAG_INTENT_TEXT = '幫我查內部案例：清邁親子 大象 夜間動物園'

describe('tracePartnerRagPath — preconditions', () => {
  test('reproduces the live bug: partner draft gate off ⇒ silent free-form fallback', () => {
    // Eric's real private-group test env: NOTION_RAG_ENABLED on, but the SECOND
    // gate (PARTNER_RAG_DRAFT_ENABLED) is UNSET — the dispatcher routes to base.
    const env = {
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      // AI_AGENT_PARTNER_RAG_DRAFT_ENABLED intentionally unset
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
      NOTION_PRIVATE_2026_DATABASE_ID: FAKE_DB_ID,
      NOTION_TOKEN: FAKE_TOKEN,
    }
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env })

    expect(trace.isPartnerGroup).toBe(true)
    expect(trace.botDirected).toBe(true)
    expect(trace.intentHit).toBe(true)
    expect(trace.notionRagEnabled).toBe(true)
    expect(trace.partnerDraftEnabled).toBe(false)
    expect(trace.bothGatesEnabled).toBe(false)
    expect(trace.finalPath).toBe('fallback_responder')
    expect(trace.fallbackReason).toBe('gate_partner_draft_disabled')
  })

  test('both gates on + fully wireable ⇒ deterministic RAG composer', () => {
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env: fullyWiredEnv() })

    expect(trace.bothGatesEnabled).toBe(true)
    expect(trace.wiring).toBe('env_present')
    expect(trace.finalPath).toBe('rag_composer')
    expect(trace.fallbackReason).toBeNull()
  })

  test('gates on but NOTION_TOKEN missing ⇒ fail-closed, not fabricated', () => {
    const env = { ...fullyWiredEnv(), NOTION_TOKEN: undefined }
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env })

    expect(trace.bothGatesEnabled).toBe(true)
    expect(trace.wiring).toBe('missing_notion_token')
    expect(trace.finalPath).toBe('rag_fail_closed')
    expect(trace.fallbackReason).toBeNull()
  })

  test('gates on but database id missing ⇒ fail-closed (missing_database_id)', () => {
    const env = { ...fullyWiredEnv(), NOTION_PRIVATE_2026_DATABASE_ID: undefined }
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env })

    expect(trace.wiring).toBe('missing_database_id')
    expect(trace.finalPath).toBe('rag_fail_closed')
  })

  test('no active sources ⇒ fail-closed (no_active_sources) when gates on', () => {
    const env = { ...fullyWiredEnv(), AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: undefined }
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env })

    expect(trace.wiring).toBe('no_active_sources')
    expect(trace.finalPath).toBe('rag_fail_closed')
  })

  test('message without RAG intent ⇒ fallback (no_rag_intent)', () => {
    const trace = tracePartnerRagPath({
      text: '今天天氣不錯，晚點去喝咖啡',
      env: fullyWiredEnv(),
    })

    expect(trace.intentHit).toBe(false)
    expect(trace.finalPath).toBe('fallback_responder')
    expect(trace.fallbackReason).toBe('no_rag_intent')
  })

  test('not bot-directed ⇒ fallback (not_bot_directed)', () => {
    const trace = tracePartnerRagPath({
      text: RAG_INTENT_TEXT,
      botDirected: false,
      env: fullyWiredEnv(),
    })

    expect(trace.botDirected).toBe(false)
    expect(trace.finalPath).toBe('fallback_responder')
    expect(trace.fallbackReason).toBe('not_bot_directed')
  })

  test('non-partner channel ⇒ fallback (not_partner_group), never RAG', () => {
    const trace = tracePartnerRagPath({
      text: RAG_INTENT_TEXT,
      sourceChannel: 'line_oa',
      env: fullyWiredEnv(),
    })

    expect(trace.isPartnerGroup).toBe(false)
    expect(trace.finalPath).toBe('fallback_responder')
    expect(trace.fallbackReason).toBe('not_partner_group')
  })

  test('precondition reason order: channel fails before gate', () => {
    // Non-partner channel AND gate off — the channel reason wins (mirrors the
    // dispatcher short-circuit order).
    const trace = tracePartnerRagPath({
      text: RAG_INTENT_TEXT,
      sourceChannel: 'line_oa',
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' },
    })
    expect(trace.fallbackReason).toBe('not_partner_group')
  })

  test('defaults simulate a properly-addressed partner-group message', () => {
    // No sourceChannel / botDirected supplied ⇒ defaults isolate the gate as the
    // single variable, which is the diagnostic Eric needs.
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env: {} })
    expect(trace.sourceChannel).toBe('line_partner_group')
    expect(trace.isPartnerGroup).toBe(true)
    expect(trace.botDirected).toBe(true)
  })
})

describe('formatPartnerRagPathTrace — masked report', () => {
  test('never echoes the token or db id value', () => {
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env: fullyWiredEnv() })
    const report = formatPartnerRagPathTrace(trace, RAG_INTENT_TEXT)

    expect(report).not.toContain(FAKE_TOKEN)
    expect(report).not.toContain(FAKE_DB_ID)
  })

  test('surfaces gate NAMES with enabled/disabled status, not values', () => {
    const env = {
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
      NOTION_PRIVATE_2026_DATABASE_ID: FAKE_DB_ID,
      NOTION_TOKEN: FAKE_TOKEN,
    }
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env })
    const report = formatPartnerRagPathTrace(trace, RAG_INTENT_TEXT)

    expect(report).toContain('AI_AGENT_NOTION_RAG_ENABLED')
    expect(report).toContain('AI_AGENT_PARTNER_RAG_DRAFT_ENABLED')
    // The bug case: the second gate reads disabled.
    expect(report).toMatch(/AI_AGENT_PARTNER_RAG_DRAFT_ENABLED[^\n]*disabled/)
    // Token presence is shown as present/missing, never the value.
    expect(report).toMatch(/NOTION_TOKEN[^\n]*present/)
  })

  test('states the final path and the fallback reason for the bug case', () => {
    const env = {
      AI_AGENT_NOTION_RAG_ENABLED: 'true',
      AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
      NOTION_PRIVATE_2026_DATABASE_ID: FAKE_DB_ID,
      NOTION_TOKEN: FAKE_TOKEN,
    }
    const trace = tracePartnerRagPath({ text: RAG_INTENT_TEXT, env })
    const report = formatPartnerRagPathTrace(trace, RAG_INTENT_TEXT)

    expect(report).toContain('fallback')
    expect(report).toContain('AI_AGENT_PARTNER_RAG_DRAFT_ENABLED')
  })
})
