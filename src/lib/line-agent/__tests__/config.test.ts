import { describe, it, expect } from 'vitest'
import { loadAgentConfig } from '../config'
import { AgentConfigError } from '../errors'

// ---------------------------------------------------------------------------
// Minimal valid fixture — all required vars present
// ---------------------------------------------------------------------------
const FULL_ENV: Record<string, string> = {
  // LINE
  LINE_CHANNEL_SECRET: 'test-line-secret',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
  LINE_PARTNER_GROUP_ID: 'C123partner',
  // LINE_ROUTE_MODE intentionally omitted to test default
  // DC / Discord
  AI_AGENT_INTERNAL_SECRET: 'test-internal-secret',
  DISCORD_PRIVATE_CHANNEL_ID: 'discord-chan-001',
  DISCORD_BOT_TOKEN: 'discord-bot-token',
  DISCORD_PUBLIC_KEY: 'discord-pubkey',
  // Models
  ANTHROPIC_API_KEY: 'anthropic-key',
  OPENAI_API_KEY: 'openai-key',
  AI_AGENT_DEFAULT_MODEL: 'claude-3-5-sonnet-20241022',
  AI_AGENT_RESEARCH_MODEL: 'claude-3-5-sonnet-20241022',
  AI_AGENT_VISION_MODEL: 'claude-3-5-sonnet-20241022',
  // Notion
  NOTION_TOKEN: 'notion-token',
  NOTION_TEAM_2026_DATABASE_ID: 'notion-db-id',
  // Storage
  AGENT_KV_URL: 'redis://localhost:6379',
  AGENT_KV_TOKEN: 'kv-token',
  // AGENT_RETENTION_DAYS omitted → should use safe default
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function envWithout(keys: string[]): Record<string, string> {
  const copy = { ...FULL_ENV }
  for (const k of keys) delete copy[k]
  return copy
}

// ---------------------------------------------------------------------------
// Tests — write FIRST (TDD red phase)
// ---------------------------------------------------------------------------

describe('loadAgentConfig', () => {
  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a correctly typed config when all required vars are present', () => {
    const cfg = loadAgentConfig(FULL_ENV)

    expect(cfg.line.channelSecret).toBe('test-line-secret')
    expect(cfg.line.channelAccessToken).toBe('test-line-token')
    expect(cfg.line.partnerGroupId).toBe('C123partner')
    expect(cfg.line.routeMode).toBe('discord_smoke') // default when LINE_ROUTE_MODE unset
  })

  it('uses LINE_ROUTE_MODE when explicitly set to partner_group', () => {
    const cfg = loadAgentConfig({ ...FULL_ENV, LINE_ROUTE_MODE: 'partner_group' })
    expect(cfg.line.routeMode).toBe('partner_group')
  })

  it('defaults LINE_ROUTE_MODE to discord_smoke when unset', () => {
    const cfg = loadAgentConfig(envWithout(['LINE_ROUTE_MODE']))
    expect(cfg.line.routeMode).toBe('discord_smoke')
  })

  it('provides safe default for AGENT_RETENTION_DAYS (90) when unset', () => {
    const cfg = loadAgentConfig(envWithout(['AGENT_RETENTION_DAYS']))
    expect(cfg.storage.retentionDays).toBe(90)
  })

  it('uses AGENT_RETENTION_DAYS when explicitly set', () => {
    const cfg = loadAgentConfig({ ...FULL_ENV, AGENT_RETENTION_DAYS: '30' })
    expect(cfg.storage.retentionDays).toBe(30)
  })

  it('parses Discord, model, Notion, and storage fields correctly', () => {
    const cfg = loadAgentConfig(FULL_ENV)

    expect(cfg.dc.internalSecret).toBe('test-internal-secret')
    expect(cfg.dc.discordPrivateChannelId).toBe('discord-chan-001')
    expect(cfg.dc.discordBotToken).toBe('discord-bot-token')
    expect(cfg.dc.discordPublicKey).toBe('discord-pubkey')

    expect(cfg.models.anthropicApiKey).toBe('anthropic-key')
    expect(cfg.models.openaiApiKey).toBe('openai-key')
    expect(cfg.models.defaultModel).toBe('claude-3-5-sonnet-20241022')
    expect(cfg.models.researchModel).toBe('claude-3-5-sonnet-20241022')
    expect(cfg.models.visionModel).toBe('claude-3-5-sonnet-20241022')

    expect(cfg.notion.token).toBe('notion-token')
    expect(cfg.notion.team2026DatabaseId).toBe('notion-db-id')

    expect(cfg.storage.kvUrl).toBe('redis://localhost:6379')
    expect(cfg.storage.kvToken).toBe('kv-token')
  })

  // ── Missing LINE vars ─────────────────────────────────────────────────────

  it('throws AgentConfigError naming LINE_CHANNEL_SECRET when missing', () => {
    const env = envWithout(['LINE_CHANNEL_SECRET'])
    expect(() => loadAgentConfig(env)).toThrow(AgentConfigError)
    try {
      loadAgentConfig(env)
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('LINE_CHANNEL_SECRET')
    }
  })

  it('throws AgentConfigError naming LINE_CHANNEL_ACCESS_TOKEN when missing', () => {
    const env = envWithout(['LINE_CHANNEL_ACCESS_TOKEN'])
    expect(() => loadAgentConfig(env)).toThrow(AgentConfigError)
    try {
      loadAgentConfig(env)
    } catch (e) {
      expect((e as AgentConfigError).missingVars).toContain('LINE_CHANNEL_ACCESS_TOKEN')
    }
  })

  it('throws AgentConfigError naming LINE_PARTNER_GROUP_ID when missing', () => {
    const env = envWithout(['LINE_PARTNER_GROUP_ID'])
    expect(() => loadAgentConfig(env)).toThrow(AgentConfigError)
    try {
      loadAgentConfig(env)
    } catch (e) {
      expect((e as AgentConfigError).missingVars).toContain('LINE_PARTNER_GROUP_ID')
    }
  })

  it('reports ALL missing LINE vars in one throw (not just the first)', () => {
    const env = envWithout(['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_PARTNER_GROUP_ID'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      const missing = (e as AgentConfigError).missingVars
      expect(missing).toContain('LINE_CHANNEL_SECRET')
      expect(missing).toContain('LINE_CHANNEL_ACCESS_TOKEN')
      expect(missing).toContain('LINE_PARTNER_GROUP_ID')
    }
  })

  // ── Missing DC / internal secret ──────────────────────────────────────────

  it('throws AgentConfigError when AI_AGENT_INTERNAL_SECRET is missing', () => {
    const env = envWithout(['AI_AGENT_INTERNAL_SECRET'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('AI_AGENT_INTERNAL_SECRET')
    }
  })

  it('throws AgentConfigError naming Discord vars when missing', () => {
    const env = envWithout(['DISCORD_BOT_TOKEN', 'DISCORD_PUBLIC_KEY'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      const missing = (e as AgentConfigError).missingVars
      expect(missing).toContain('DISCORD_BOT_TOKEN')
      expect(missing).toContain('DISCORD_PUBLIC_KEY')
    }
  })

  // ── Missing model keys ────────────────────────────────────────────────────

  it('throws AgentConfigError when ANTHROPIC_API_KEY is missing', () => {
    const env = envWithout(['ANTHROPIC_API_KEY'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('ANTHROPIC_API_KEY')
    }
  })

  it('throws AgentConfigError when OPENAI_API_KEY is missing', () => {
    const env = envWithout(['OPENAI_API_KEY'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('OPENAI_API_KEY')
    }
  })

  it('throws AgentConfigError when model name vars are missing', () => {
    const env = envWithout(['AI_AGENT_DEFAULT_MODEL', 'AI_AGENT_RESEARCH_MODEL', 'AI_AGENT_VISION_MODEL'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      const missing = (e as AgentConfigError).missingVars
      expect(missing).toContain('AI_AGENT_DEFAULT_MODEL')
      expect(missing).toContain('AI_AGENT_RESEARCH_MODEL')
      expect(missing).toContain('AI_AGENT_VISION_MODEL')
    }
  })

  // ── Missing Notion config ──────────────────────────────────────────────────

  it('throws AgentConfigError when NOTION_TOKEN is missing', () => {
    const env = envWithout(['NOTION_TOKEN'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('NOTION_TOKEN')
    }
  })

  it('throws AgentConfigError when NOTION_TEAM_2026_DATABASE_ID is missing', () => {
    const env = envWithout(['NOTION_TEAM_2026_DATABASE_ID'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('NOTION_TEAM_2026_DATABASE_ID')
    }
  })

  // ── Missing KV / storage config ───────────────────────────────────────────

  it('throws AgentConfigError when AGENT_KV_URL is missing', () => {
    const env = envWithout(['AGENT_KV_URL'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('AGENT_KV_URL')
    }
  })

  it('throws AgentConfigError when AGENT_KV_TOKEN is missing', () => {
    const env = envWithout(['AGENT_KV_TOKEN'])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      expect((e as AgentConfigError).missingVars).toContain('AGENT_KV_TOKEN')
    }
  })

  // ── Reports ALL missing vars in a single throw ────────────────────────────

  it('reports all missing vars from multiple groups in one AgentConfigError', () => {
    // Remove one from each group
    const env = envWithout([
      'LINE_CHANNEL_SECRET',
      'AI_AGENT_INTERNAL_SECRET',
      'ANTHROPIC_API_KEY',
      'NOTION_TOKEN',
      'AGENT_KV_URL',
    ])
    try {
      loadAgentConfig(env)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AgentConfigError)
      const missing = (e as AgentConfigError).missingVars
      expect(missing).toContain('LINE_CHANNEL_SECRET')
      expect(missing).toContain('AI_AGENT_INTERNAL_SECRET')
      expect(missing).toContain('ANTHROPIC_API_KEY')
      expect(missing).toContain('NOTION_TOKEN')
      expect(missing).toContain('AGENT_KV_URL')
    }
  })
})
