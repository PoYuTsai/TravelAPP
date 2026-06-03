/**
 * responder-config.test.ts — narrow selector for the partner-group responder
 * (design 2026-06-03 §3.2 解 B / §3.3 step 1).
 *
 * The selector parses ONLY the fields the partner-group responder needs.  Unlike
 * loadAgentConfig it is fault-isolated: it NEVER throws, and ANTHROPIC_API_KEY is
 * OPTIONAL on this path (missing key → empty string → factory decides to degrade).
 * This prevents a missing unrelated env (Notion/KV) — or a missing key — from
 * turning the partner-group enhancement path into a webhook 500.
 */

import { describe, it, expect } from 'vitest'
import { getPartnerResponderConfig } from '@/lib/line-agent/partner-group/responder-config'

describe('getPartnerResponderConfig', () => {
  // ── Mode defaulting ───────────────────────────────────────────────────────

  it('defaults partnerResponderMode to "stub" when AI_AGENT_PARTNER_RESPONDER_MODE is unset', () => {
    const cfg = getPartnerResponderConfig({})
    expect(cfg.partnerResponderMode).toBe('stub')
  })

  it('parses partnerResponderMode "anthropic" when explicitly set', () => {
    const cfg = getPartnerResponderConfig({ AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic' })
    expect(cfg.partnerResponderMode).toBe('anthropic')
  })

  it('falls back to "stub" for any unrecognized mode value', () => {
    const cfg = getPartnerResponderConfig({ AI_AGENT_PARTNER_RESPONDER_MODE: 'gpt' })
    expect(cfg.partnerResponderMode).toBe('stub')
  })

  // ── No-throw contract (the whole point of 解 B) ────────────────────────────

  it('does NOT throw when mode is unset and ANTHROPIC_API_KEY is missing', () => {
    expect(() => getPartnerResponderConfig({})).not.toThrow()
    const cfg = getPartnerResponderConfig({})
    expect(cfg.anthropicApiKey).toBe('')
  })

  it('does NOT throw when mode=stub and ANTHROPIC_API_KEY is missing', () => {
    expect(() =>
      getPartnerResponderConfig({ AI_AGENT_PARTNER_RESPONDER_MODE: 'stub' })
    ).not.toThrow()
  })

  it('does NOT throw when mode=anthropic but ANTHROPIC_API_KEY is missing (factory will degrade)', () => {
    expect(() =>
      getPartnerResponderConfig({ AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic' })
    ).not.toThrow()
    const cfg = getPartnerResponderConfig({ AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic' })
    expect(cfg.partnerResponderMode).toBe('anthropic')
    expect(cfg.anthropicApiKey).toBe('')
  })

  // ── Field passthrough ──────────────────────────────────────────────────────

  it('passes through ANTHROPIC_API_KEY and model names when present', () => {
    const cfg = getPartnerResponderConfig({
      AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-123',
      AI_AGENT_DEFAULT_MODEL: 'claude-default',
      AI_AGENT_RESEARCH_MODEL: 'claude-research',
    })
    expect(cfg.anthropicApiKey).toBe('sk-ant-123')
    expect(cfg.defaultModel).toBe('claude-default')
    expect(cfg.researchModel).toBe('claude-research')
  })

  it('returns empty strings (not throw) for absent model names', () => {
    const cfg = getPartnerResponderConfig({ AI_AGENT_PARTNER_RESPONDER_MODE: 'anthropic' })
    expect(cfg.defaultModel).toBe('')
    expect(cfg.researchModel).toBe('')
  })

  it('trims surrounding whitespace on parsed values', () => {
    const cfg = getPartnerResponderConfig({
      AI_AGENT_PARTNER_RESPONDER_MODE: '  anthropic  ',
      ANTHROPIC_API_KEY: '  sk-ant-123  ',
      AI_AGENT_DEFAULT_MODEL: '  claude-default  ',
    })
    expect(cfg.partnerResponderMode).toBe('anthropic')
    expect(cfg.anthropicApiKey).toBe('sk-ant-123')
    expect(cfg.defaultModel).toBe('claude-default')
  })
})
